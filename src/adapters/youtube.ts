import axios from 'axios'
import { BaseAdapter } from './base'
import type { RawReview, NormalizedReview, ReviewSource } from '../types/index'

const API_BASE = 'https://www.googleapis.com/youtube/v3'

export class YoutubeAdapter extends BaseAdapter {
  readonly source: ReviewSource = 'youtube'
  private apiKey: string

  constructor() {
    super()
    // Vite exposes env vars prefixed with MAIN_VITE_ to the main process
    this.apiKey = (import.meta as any).env?.MAIN_VITE_YOUTUBE_API_KEY ?? ''
  }

  async search(productQuery: string, maxResults = 30): Promise<RawReview[]> {
    if (!this.apiKey) {
      console.warn('[YouTube] MAIN_VITE_YOUTUBE_API_KEY not set — skipping YouTube source')
      return []
    }

    const results: RawReview[] = []

    let videos: any[] = []
    try {
      const resp = await axios.get(`${API_BASE}/search`, {
        params: {
          part: 'snippet',
          q: `${productQuery} review`,
          type: 'video',
          maxResults: 5,
          relevanceLanguage: 'en',
          key: this.apiKey
        },
        timeout: 15000
      })
      videos = resp.data?.items ?? []
    } catch (err: any) {
      console.warn('[YouTube] Video search failed:', err.message)
      return results
    }

    const perVideo = Math.ceil(maxResults / Math.max(videos.length, 1))

    for (const video of videos) {
      const videoId = video.id?.videoId
      const videoTitle = video.snippet?.title ?? ''
      if (!videoId) continue

      try {
        const commentsResp = await axios.get(`${API_BASE}/commentThreads`, {
          params: {
            part: 'snippet',
            videoId,
            maxResults: Math.min(perVideo, 100),
            order: 'relevance',
            key: this.apiKey
          },
          timeout: 15000
        })
        const threads = commentsResp.data?.items ?? []
        for (const thread of threads) {
          const top = thread.snippet?.topLevelComment?.snippet
          if (!top || !top.textOriginal) continue
          results.push({
            source: 'youtube',
            sourceUrl: `https://www.youtube.com/watch?v=${videoId}&lc=${thread.id}`,
            title: videoTitle,
            content: top.textOriginal,
            authorName: top.authorDisplayName ?? 'Anonymous',
            authorId: top.authorChannelId?.value,
            authorProfileUrl: top.authorChannelUrl,
            createdAt: top.publishedAt,
            likeCount: top.likeCount ?? 0,
            replyCount: thread.snippet?.totalReplyCount ?? 0,
            rawMetadata: {
              videoId,
              videoTitle,
              commentId: thread.id,
              viewCount: undefined
            }
          })
        }
      } catch (err: any) {
        console.warn(`[YouTube] Comment fetch failed for ${videoId}:`, err.message)
      }

      if (results.length >= maxResults) break
    }

    return results.slice(0, maxResults)
  }

  normalize(input: RawReview, productQuery: string, jobId: string): NormalizedReview {
    const content = this.sanitizeText(input.content ?? '')
    return {
      id: this.generateId(input.sourceUrl + content, 'youtube'),
      jobId,
      productQuery,
      source: 'youtube',
      sourceType: 'video_comment',
      sourceUrl: input.sourceUrl,
      title: this.sanitizeText(input.title ?? ''),
      content,
      ratingRaw: undefined,
      sentiment: 'unknown',
      language: this.detectLanguage(content),
      authorName: input.authorName ?? 'Anonymous',
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
