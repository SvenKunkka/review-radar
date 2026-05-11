import axios from 'axios'
import { BaseAdapter } from './base'
import type { RawReview, NormalizedReview, ReviewSource } from '../types/index'

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36'

export class BilibiliAdapter extends BaseAdapter {
  readonly source: ReviewSource = 'bilibili'

  async search(productQuery: string, maxResults = 30): Promise<RawReview[]> {
    try {
      const resp = await axios.get(
        'https://api.bilibili.com/x/web-interface/search/all/v2',
        {
          params: { keyword: productQuery, page: 1 },
          headers: {
            'User-Agent': BROWSER_UA,
            'Referer': 'https://www.bilibili.com/'
          },
          timeout: 12000
        }
      )

      const resultGroups: any[] = resp.data?.data?.result ?? []
      const videos: any[] = []
      for (const group of resultGroups) {
        if (group.result_type === 'video') {
          const items: any[] = group.data ?? []
          videos.push(...items)
        }
      }

      const reviews: RawReview[] = []
      for (const v of videos.slice(0, maxResults)) {
        const bvid: string = v.bvid ?? ''
        const description: string = this.sanitizeText(v.description ?? '')
        if (!description || description.length < 10) continue

        reviews.push({
          source: 'bilibili',
          sourceUrl: `https://www.bilibili.com/video/${bvid}`,
          title: this.sanitizeText(v.title ?? ''),
          content: description,
          authorName: v.author ?? '',
          authorId: String(v.mid ?? ''),
          authorProfileUrl: v.mid ? `https://space.bilibili.com/${v.mid}` : undefined,
          createdAt: v.pubdate ? new Date(v.pubdate * 1000).toISOString() : new Date().toISOString(),
          likeCount: v.play ?? v.like ?? 0,
          replyCount: v.video_review ?? 0,
          rawMetadata: {
            bvid,
            mid: v.mid,
            play: v.play,
            like: v.like,
            favorites: v.favorites,
            danmaku: v.video_review,
            type: 'video'
          }
        })
      }

      return reviews.slice(0, maxResults)
    } catch (err: any) {
      console.warn('[Bilibili] Search failed:', err.message)
      return []
    }
  }

  normalize(input: RawReview, productQuery: string, jobId: string): NormalizedReview {
    const content = this.sanitizeText(input.content ?? '')
    return {
      id: this.generateId(input.sourceUrl + content, 'bilibili'),
      jobId,
      productQuery,
      source: 'bilibili',
      sourceType: 'video',
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
