import { RedditAdapter } from './reddit'
import { YoutubeAdapter } from './youtube'
import { TrustpilotAdapter } from './trustpilot'
import { BilibiliAdapter } from './bilibili'
import { ZhihuAdapter } from './zhihu'
import { TiebaAdapter } from './tieba'
import { NgaAdapter } from './nga'
import type { ReviewSource, ReviewSourceAdapter } from '../types/index'

const registry: Record<ReviewSource, ReviewSourceAdapter> = {
  reddit: new RedditAdapter(),
  youtube: new YoutubeAdapter(),
  trustpilot: new TrustpilotAdapter(),
  bilibili: new BilibiliAdapter(),
  zhihu: new ZhihuAdapter(),
  tieba: new TiebaAdapter(),
  nga: new NgaAdapter()
}

export function getAdapter(source: ReviewSource): ReviewSourceAdapter {
  return registry[source]
}

export function getEnabledAdapters(sources: ReviewSource[]): ReviewSourceAdapter[] {
  return sources.map(s => registry[s]).filter(Boolean)
}
