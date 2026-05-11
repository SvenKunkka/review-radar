import axios from 'axios'
import { BaseAdapter } from './base'
import type { RawReview, NormalizedReview, ReviewSource } from '../types/index'

export class ZhihuAdapter extends BaseAdapter {
  readonly source: ReviewSource = 'zhihu'

  async search(productQuery: string, maxResults = 30): Promise<RawReview[]> {
    try {
      const resp = await axios.get(
        'https://www.zhihu.com/api/v4/search_v3',
        {
          params: {
            t: 'general',
            q: productQuery,
            correction: 1,
            offset: 0,
            limit: 20
          },
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
            'Referer': 'https://www.zhihu.com/',
            'x-api-version': '3.0.91'
          },
          timeout: 12000
        }
      )

      const items: any[] = resp.data?.data ?? []
      const reviews: RawReview[] = []

      for (const item of items.slice(0, maxResults)) {
        const obj = item?.object
        if (!obj) continue

        const objType: string = obj.type ?? ''
        let content = ''
        let authorName = ''
        let authorId = ''
        let createdAt: string | undefined
        let likeCount = 0
        let replyCount = 0
        let sourceUrl = ''

        if (objType === 'answer') {
          content = this.sanitizeText(obj.excerpt ?? obj.content ?? '')
          authorName = obj.author?.name ?? ''
          authorId = obj.author?.id ?? ''
          createdAt = obj.created_time ? new Date(obj.created_time * 1000).toISOString() : undefined
          likeCount = obj.voteup_count ?? 0
          replyCount = obj.comment_count ?? 0
          sourceUrl = obj.url ?? ''
        } else if (objType === 'article') {
          content = this.sanitizeText(obj.excerpt ?? obj.content ?? '')
          authorName = obj.author?.name ?? ''
          authorId = obj.author?.id ?? ''
          createdAt = obj.created ? new Date(obj.created * 1000).toISOString() : undefined
          likeCount = obj.voteup_count ?? 0
          replyCount = obj.comment_count ?? 0
          sourceUrl = obj.url ?? ''
        } else if (objType === 'question') {
          content = this.sanitizeText(obj.title ?? '')
          createdAt = obj.created ? new Date(obj.created * 1000).toISOString() : undefined
          likeCount = obj.follower_count ?? 0
          replyCount = obj.answer_count ?? 0
          sourceUrl = obj.url ?? (obj.id ? `https://www.zhihu.com/question/${obj.id}` : '')
        } else {
          continue
        }

        if (!content || content.length < 10) continue

        reviews.push({
          source: 'zhihu',
          sourceUrl,
          title: objType === 'question' ? content : '',
          content,
          authorName: authorName || undefined,
          authorId: authorId || undefined,
          authorProfileUrl: authorId ? `https://www.zhihu.com/people/${authorId}` : undefined,
          createdAt,
          likeCount,
          replyCount,
          rawMetadata: { type: objType }
        })
      }

      return reviews.slice(0, maxResults)
    } catch (err: any) {
      console.warn('[Zhihu] Search failed:', err.message)
      return []
    }
  }

  normalize(input: RawReview, productQuery: string, jobId: string): NormalizedReview {
    const content = this.sanitizeText(input.content ?? '')
    return {
      id: this.generateId(input.sourceUrl + content, 'zhihu'),
      jobId,
      productQuery,
      source: 'zhihu',
      sourceType: (input.rawMetadata as any)?.type === 'question' ? 'post' : 'post',
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
