import axios from 'axios'
import * as cheerio from 'cheerio'
import { BaseAdapter } from './base'
import type { RawReview, NormalizedReview, ReviewSource } from '../types/index'

export class TiebaAdapter extends BaseAdapter {
  readonly source: ReviewSource = 'tieba'

  async search(productQuery: string, maxResults = 30): Promise<RawReview[]> {
    try {
      const resp = await axios.get(
        'https://tieba.baidu.com/f/search/res',
        {
          params: { qw: productQuery, pn: 0, rn: 20, z: '', only_thread: 0 },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Referer': 'https://tieba.baidu.com/'
          },
          timeout: 12000,
          responseType: 'text'
        }
      )

      const $ = cheerio.load(resp.data as string)
      const reviews: RawReview[] = []

      // Primary selectors — Tieba search result containers
      const containers = $('.s_post, .post_list .j_post_list li')
      const els = containers.length > 0 ? containers : $('li').filter((_, el) => $(el).find('.p_title').length > 0)

      els.each((_, el) => {
        try {
          const $el = $(el)

          // Title + link
          const titleEl = $el.find('.p_title a').first()
          const title = titleEl.text().trim()
          const href = titleEl.attr('href') ?? ''
          if (!title || !href) return

          const sourceUrl = href.startsWith('http') ? href : `https://tieba.baidu.com${href}`

          // Snippet
          const snippet = $el.find('.p_content .d_post_content').first().text().trim()
            || $el.find('.p_content').first().text().trim()
          const content = this.sanitizeText(snippet || title)

          // Author
          const authorEl = $el.find('.p_author .p_props span.tb_icon_author_rich a, .p_author a.p_author_name').first()
          const authorName = authorEl.text().trim() || $el.find('.p_author a').first().text().trim() || ''

          // Date — format: "YYYY-MM-DD HH:MM"
          const dateStr = $el.find('.p_date').first().text().trim()
          let createdAt: string
          try {
            createdAt = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString()
          } catch {
            createdAt = new Date().toISOString()
          }

          // Reply count
          const replyText = $el.find('.p_reply, .p_num').first().text()
          const replyMatch = replyText.match(/\d+/)
          const replyCount = replyMatch ? parseInt(replyMatch[0], 10) : 0

          reviews.push({
            source: 'tieba',
            sourceUrl,
            title,
            content,
            authorName: authorName || undefined,
            createdAt,
            likeCount: 0,
            replyCount,
            rawMetadata: { type: 'post' }
          })
        } catch {
          // Skip malformed items
        }
      })

      return reviews.slice(0, maxResults)
    } catch (err: any) {
      console.warn('[Tieba] Search failed:', err.message)
      return []
    }
  }

  normalize(input: RawReview, productQuery: string, jobId: string): NormalizedReview {
    const content = this.sanitizeText(input.content ?? '')
    return {
      id: this.generateId(input.sourceUrl + content, 'tieba'),
      jobId,
      productQuery,
      source: 'tieba',
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
      authenticityScore: 0.65,
      authenticityReason: 'Pending rule engine',
      dedupeHash: this.generateDedupeHash(content),
      fetchedAt: new Date().toISOString(),
      matchedRules: [],
      isFiltered: false
    }
  }
}
