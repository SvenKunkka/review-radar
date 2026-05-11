import axios from 'axios'
import * as cheerio from 'cheerio'
import { BaseAdapter } from './base'
import type { RawReview, NormalizedReview, ReviewSource, SentimentLabel } from '../types/index'

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function mockReviews(productQuery: string): RawReview[] {
  return [
    {
      source: 'trustpilot',
      sourceUrl: 'https://www.trustpilot.com',
      title: '[Mock] Great product',
      content: `[Mock review — Trustpilot scraping unavailable] ${productQuery} seems to have mixed reviews based on publicly available information.`,
      authorName: 'MockUser1',
      ratingRaw: 4,
      createdAt: new Date().toISOString(),
      likeCount: 0,
      replyCount: 0,
      rawMetadata: { isMock: true, reason: 'Scraping unavailable' }
    },
    {
      source: 'trustpilot',
      sourceUrl: 'https://www.trustpilot.com',
      title: '[Mock] Could be better',
      content: `[Mock review — Trustpilot scraping unavailable] Some users report issues with ${productQuery} quality and customer service.`,
      authorName: 'MockUser2',
      ratingRaw: 2,
      createdAt: new Date().toISOString(),
      likeCount: 0,
      replyCount: 0,
      rawMetadata: { isMock: true, reason: 'Scraping unavailable' }
    }
  ]
}

export class TrustpilotAdapter extends BaseAdapter {
  readonly source: ReviewSource = 'trustpilot'

  async search(productQuery: string, maxResults = 30): Promise<RawReview[]> {
    try {
      // Try search page first to find business listing URL
      const searchUrl = `https://www.trustpilot.com/search?query=${encodeURIComponent(productQuery)}`
      const searchResp = await axios.get(searchUrl, {
        headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9' },
        timeout: 15000
      })
      const $search = cheerio.load(searchResp.data)

      let businessUrl: string | null = null
      $search('a[href*="/review/"]').each((_, el) => {
        if (!businessUrl) {
          const href = $search(el).attr('href')
          if (href && href.startsWith('/review/')) businessUrl = `https://www.trustpilot.com${href}`
        }
      })

      if (!businessUrl) {
        // Fallback: construct a slug from the query
        const slug = productQuery.toLowerCase().replace(/\s+/g, '-')
        businessUrl = `https://www.trustpilot.com/review/${slug}`
      }

      const reviewResp = await axios.get(businessUrl, {
        headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9' },
        timeout: 15000
      })
      const $ = cheerio.load(reviewResp.data)

      const reviews: RawReview[] = []

      // Multiple selectors — Trustpilot changes markup periodically
      const reviewEls = $('[data-service-review-business-unit-display-name], .reviewCard, article[data-testid="review"]')

      if (reviewEls.length === 0) {
        // Fallback: JSON-LD structured data embedded in the page
        $('script[type="application/ld+json"]').each((_, el) => {
          try {
            const data = JSON.parse($(el).html() ?? '{}')
            if (data['@type'] === 'Product' && data.review) {
              const reviewArr = Array.isArray(data.review) ? data.review : [data.review]
              for (const r of reviewArr.slice(0, maxResults)) {
                reviews.push({
                  source: 'trustpilot',
                  sourceUrl: businessUrl!,
                  title: r.name ?? '',
                  content: r.reviewBody ?? '',
                  ratingRaw: r.reviewRating?.ratingValue,
                  authorName: r.author?.name ?? 'Anonymous',
                  createdAt: r.datePublished,
                  likeCount: 0,
                  replyCount: 0,
                  rawMetadata: { jsonLd: true }
                })
              }
            }
          } catch { /* skip malformed JSON-LD */ }
        })
      } else {
        reviewEls.slice(0, maxResults).each((_, el) => {
          const $el = $(el)
          const title = $el.find('h2, .link_notUnderlined__szqki, [data-service-review-title-typography]').first().text().trim()
          const body = $el.find('p.typography_body-l__KUYFJ, [data-service-review-text-typography], .review-content__text').first().text().trim()
          const ratingStr = $el.find('[data-service-review-rating], img[alt*="star"]').attr('alt') ?? ''
          const ratingMatch = ratingStr.match(/(\d)/)
          const rating = ratingMatch ? parseInt(ratingMatch[1]) : undefined
          const author = $el.find('.typography_heading-xxs__QKBS8, .consumer-info__name').first().text().trim()
          const dateStr = $el.find('time').attr('datetime')

          if (!body || body.length < 5) return
          reviews.push({
            source: 'trustpilot',
            sourceUrl: businessUrl!,
            title,
            content: body,
            ratingRaw: rating,
            authorName: author || 'Anonymous',
            createdAt: dateStr ?? new Date().toISOString(),
            likeCount: 0,
            replyCount: 0,
            rawMetadata: { scrapedUrl: businessUrl }
          })
        })
      }

      if (reviews.length === 0) {
        console.warn('[Trustpilot] No reviews parsed — falling back to mock reviews')
        return mockReviews(productQuery)
      }

      return reviews.slice(0, maxResults)
    } catch (err: any) {
      console.warn('[Trustpilot] Scraping unavailable:', err.message, '— returning mock reviews')
      return mockReviews(productQuery)
    }
  }

  normalize(input: RawReview, productQuery: string, jobId: string): NormalizedReview {
    const content = this.sanitizeText(input.content ?? '')
    const isMock = !!(input.rawMetadata as any)?.isMock

    // Infer sentiment directly from star rating when available
    let sentiment: SentimentLabel = 'unknown'
    if (input.ratingRaw !== undefined) {
      if (input.ratingRaw >= 4) sentiment = 'positive'
      else if (input.ratingRaw <= 2) sentiment = 'negative'
      else sentiment = 'neutral'
    }

    return {
      id: this.generateId(input.sourceUrl + content + (input.authorName ?? ''), 'trustpilot'),
      jobId,
      productQuery,
      source: 'trustpilot',
      sourceType: 'review',
      sourceUrl: input.sourceUrl,
      title: this.sanitizeText(input.title ?? ''),
      content,
      ratingRaw: input.ratingRaw,
      sentiment,
      language: this.detectLanguage(content),
      authorName: input.authorName ?? 'Anonymous',
      authorId: undefined,
      authorProfileUrl: undefined,
      authorMeta: {},
      createdAt: input.createdAt ?? new Date().toISOString(),
      likeCount: input.likeCount ?? 0,
      replyCount: input.replyCount ?? 0,
      rawMetadata: input.rawMetadata ?? {},
      spamScore: isMock ? 0.5 : 0,
      botScore: 0,
      authenticityScore: isMock ? 0.3 : 0.75,
      authenticityReason: isMock ? 'Mock fallback — scraping unavailable' : 'Pending rule engine',
      dedupeHash: this.generateDedupeHash(content),
      fetchedAt: new Date().toISOString(),
      matchedRules: [],
      isFiltered: isMock
    }
  }
}
