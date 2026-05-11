import axios from 'axios'
import * as cheerio from 'cheerio'
import { BaseAdapter } from './base'
import type { RawReview, NormalizedReview, ReviewSource } from '../types/index'

export class NgaAdapter extends BaseAdapter {
  readonly source: ReviewSource = 'nga'

  async search(productQuery: string, maxResults = 30): Promise<RawReview[]> {
    try {
      const resp = await axios.get(
        'https://bbs.nga.cn/thread.php',
        {
          params: { key: productQuery, recommend: 0 },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
            'Referer': 'https://bbs.nga.cn/',
            'Accept-Language': 'zh-CN,zh;q=0.9'
          },
          timeout: 12000,
          responseType: 'text'
        }
      )

      const $ = cheerio.load(resp.data as string)
      const reviews: RawReview[] = []

      // Try progressively broader row selectors
      let rows = $('#topicrows tr.topicrow')
      if (rows.length === 0) rows = $('table.topic tr')
      if (rows.length === 0) rows = $('tr').filter((_, el) => {
        const cls = $(el).attr('class') ?? ''
        return cls.includes('topic') || $(el).find('a.topic').length > 0
      })

      rows.each((_, el) => {
        try {
          const $el = $(el)

          // Title + link
          const titleEl = $el.find('a.topic, td.topic a').first()
          let title = titleEl.text().trim()
          let href = titleEl.attr('href') ?? ''

          // Fallback: any anchor with meaningful text in first td
          if (!title) {
            const fallbackA = $el.find('td').first().find('a').first()
            title = fallbackA.text().trim()
            href = fallbackA.attr('href') ?? ''
          }

          if (!title) return

          const sourceUrl = href.startsWith('http')
            ? href
            : href
              ? `https://bbs.nga.cn${href.startsWith('/') ? '' : '/'}${href}`
              : `https://bbs.nga.cn`

          // Author
          const authorName = $el.find('.author a, td.author a').first().text().trim()
            || $el.find('[uid] a, td[uid] a').first().text().trim()
            || ''

          // Post time
          const dateStr = $el.find('.postdate, td.postdate').first().text().trim()
          let createdAt: string
          try {
            createdAt = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString()
          } catch {
            createdAt = new Date().toISOString()
          }

          // Reply count — look for td with purely numeric content
          let replyCount = 0
          $el.find('td').each((_, td) => {
            const txt = $(td).text().trim()
            if (/^\d+$/.test(txt)) {
              const n = parseInt(txt, 10)
              if (n > replyCount) replyCount = n
            }
          })

          reviews.push({
            source: 'nga',
            sourceUrl,
            title,
            content: this.sanitizeText(title), // NGA search results don't show snippets
            authorName: authorName || undefined,
            createdAt,
            likeCount: 0,
            replyCount,
            rawMetadata: { type: 'post' }
          })
        } catch {
          // Skip malformed rows
        }
      })

      if (reviews.length === 0) {
        console.warn('[NGA] No thread rows found in response')
        return []
      }

      return reviews.slice(0, maxResults)
    } catch (err: any) {
      console.warn('[NGA] Search failed:', err.message)
      return []
    }
  }

  normalize(input: RawReview, productQuery: string, jobId: string): NormalizedReview {
    const content = this.sanitizeText(input.content ?? '')
    return {
      id: this.generateId(input.sourceUrl + content, 'nga'),
      jobId,
      productQuery,
      source: 'nga',
      sourceType: 'post',
      sourceUrl: input.sourceUrl,
      title: this.sanitizeText(input.title ?? ''),
      content,
      ratingRaw: undefined,
      sentiment: 'unknown',
      language: 'zh',
      authorName: input.authorName ?? '',
      authorId: input.authorId,
      authorProfileUrl: input.authorProfileUrl,
      authorMeta: {},
      createdAt: input.createdAt ?? new Date().toISOString(),
      likeCount: input.likeCount ?? 0,
      replyCount: input.replyCount ?? 0,
      rawMetadata: input.rawMetadata ?? {},
      spamScore: 0,
      botScore: 0,
      authenticityScore: 0.7,
      authenticityReason: 'Pending rule engine',
      dedupeHash: this.generateDedupeHash(content),
      fetchedAt: new Date().toISOString(),
      matchedRules: [],
      isFiltered: false
    }
  }
}
