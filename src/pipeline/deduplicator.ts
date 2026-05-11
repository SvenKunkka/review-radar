import type { NormalizedReview } from '../types/index'

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2)
  )
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  const intersection = new Set([...a].filter(x => b.has(x)))
  const union = new Set([...a, ...b])
  return intersection.size / union.size
}

export function deduplicateReviews(reviews: NormalizedReview[]): NormalizedReview[] {
  // Stage 1: exact hash dedup
  const seenHashes = new Set<string>()
  const afterExact: NormalizedReview[] = reviews.map(r => {
    if (seenHashes.has(r.dedupeHash)) {
      return { ...r, isFiltered: true, authenticityReason: 'Exact duplicate' }
    }
    seenHashes.add(r.dedupeHash)
    return r
  })

  // Stage 2: near-duplicate dedup via Jaccard similarity (only on non-filtered)
  const keptTokens: Array<{ tokens: Set<string>; idx: number }> = []
  const afterNear: NormalizedReview[] = afterExact.map((r, idx) => {
    if (r.isFiltered) return r
    const tokens = tokenize(r.content)
    for (const kept of keptTokens) {
      if (jaccardSimilarity(tokens, kept.tokens) > 0.85) {
        return { ...r, isFiltered: true, authenticityReason: 'Near-duplicate' }
      }
    }
    keptTokens.push({ tokens, idx })
    return r
  })

  // Stage 3: same-author flood — keep only top 3 reviews by likeCount per authorId
  const authorMap = new Map<string, NormalizedReview[]>()
  for (const r of afterNear) {
    if (!r.isFiltered && r.authorId) {
      if (!authorMap.has(r.authorId)) authorMap.set(r.authorId, [])
      authorMap.get(r.authorId)!.push(r)
    }
  }

  const floodedIds = new Set<string>()
  for (const [, authorReviews] of authorMap) {
    if (authorReviews.length > 3) {
      const sorted = [...authorReviews].sort((a, b) => b.likeCount - a.likeCount)
      sorted.slice(3).forEach(r => floodedIds.add(r.id))
    }
  }

  return afterNear.map(r => {
    if (floodedIds.has(r.id)) {
      return { ...r, isFiltered: true, authenticityReason: 'Same-author flood' }
    }
    return r
  })
}
