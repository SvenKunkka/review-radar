import axios from 'axios'
import { BaseAdapter } from './base'
import type { RawReview, NormalizedReview, ReviewSource } from '../types/index'

const USER_AGENT = 'ProductReviewRadar/1.0 (contact: radar@example.com)'
const DELAY_MS = 1000

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export class RedditAdapter extends BaseAdapter {
  readonly source: ReviewSource = 'reddit'

  async search(productQuery: string, maxResults = 50): Promise<RawReview[]> {
    const results: RawReview[] = []
    const limit = Math.min(maxResults, 100)

    let posts: any[] = []
    try {
      const resp = await axios.get('https://www.reddit.com/search.json', {
        params: { q: productQuery, sort: 'relevance', limit, type: 'link' },
        headers: { 'User-Agent': USER_AGENT },
        timeout: 15000
      })
      posts = resp.data?.data?.children ?? []
    } catch (err: any) {
      console.warn('[Reddit] Search failed:', err.message)
      return results
    }

    for (const child of posts.slice(0, 20)) {
      const post = child.data
      if (!post) continue

      // Add the post body if it has meaningful self-text
      if (post.selftext && post.selftext.trim().length > 10) {
        results.push({
          source: 'reddit',
          sourceUrl: `https://www.reddit.com${post.permalink}`,
          title: post.title ?? '',
          content: post.selftext,
          authorName: post.author ?? '[deleted]',
          authorId: post.author_fullname,
          createdAt: new Date(post.created_utc * 1000).toISOString(),
          likeCount: post.score ?? 0,
          replyCount: post.num_comments ?? 0,
          rawMetadata: {
            subreddit: post.subreddit,
            id: post.id,
            upvoteRatio: post.upvote_ratio,
            isSelf: post.is_self,
            type: 'post'
          }
        })
      }

      // Fetch top comments for the post
      try {
        await sleep(DELAY_MS)
        const commentsResp = await axios.get(
          `https://www.reddit.com/r/${post.subreddit}/comments/${post.id}.json`,
          {
            params: { limit: 10, sort: 'top' },
            headers: { 'User-Agent': USER_AGENT },
            timeout: 10000
          }
        )
        const commentTree = commentsResp.data?.[1]?.data?.children ?? []
        for (const commentChild of commentTree.slice(0, 10)) {
          const c = commentChild.data
          if (!c || c.kind === 'more' || !c.body || c.body === '[deleted]') continue
          if (c.body.trim().length < 10) continue
          results.push({
            source: 'reddit',
            sourceUrl: `https://www.reddit.com${post.permalink}${c.id}/`,
            title: post.title ?? '',
            content: c.body,
            authorName: c.author ?? '[deleted]',
            authorId: c.author_fullname,
            createdAt: new Date(c.created_utc * 1000).toISOString(),
            likeCount: c.score ?? 0,
            replyCount: c.replies?.data?.children?.length ?? 0,
            rawMetadata: {
              subreddit: post.subreddit,
              id: c.id,
              parentId: c.parent_id,
              type: 'comment'
            }
          })
        }
      } catch (err: any) {
        // Non-fatal — skip comments for this post
        if (err.response?.status !== 429) {
          console.warn(`[Reddit] Comment fetch failed for ${post.id}:`, err.message)
        }
      }

      if (results.length >= maxResults) break
    }

    return results.slice(0, maxResults)
  }

  normalize(input: RawReview, productQuery: string, jobId: string): NormalizedReview {
    const isPost = (input.rawMetadata as any)?.type === 'post'
    const content = this.sanitizeText(input.content ?? '')
    return {
      id: this.generateId(input.sourceUrl + content, 'reddit'),
      jobId,
      productQuery,
      source: 'reddit',
      sourceType: isPost ? 'post' : 'comment',
      sourceUrl: input.sourceUrl,
      title: this.sanitizeText(input.title ?? ''),
      content,
      ratingRaw: undefined,
      sentiment: 'unknown',
      language: this.detectLanguage(content),
      authorName: input.authorName ?? '[deleted]',
      authorId: input.authorId,
      authorProfileUrl: input.authorId
        ? `https://www.reddit.com/user/${input.authorName}`
        : undefined,
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
