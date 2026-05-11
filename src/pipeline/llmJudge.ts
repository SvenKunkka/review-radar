import { createHash } from 'crypto'
import type { NormalizedReview, LLMProvider } from '../types/index'
import { getCachedLLM, setCachedLLM } from '../db/queries'

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Cache key derived from content only so identical reviews share a cached result
function contentCacheKey(content: string): string {
  return createHash('sha256').update(content.toLowerCase().trim()).digest('hex')
}

export async function runLLMJudgment(
  reviews: NormalizedReview[],
  llm: LLMProvider,
  _productQuery: string,
  deepAnalysis: boolean,
  onProgress?: (msg: string, current: number, total: number) => void
): Promise<NormalizedReview[]> {
  const active = reviews.filter(r => !r.isFiltered)

  // Identify candidates for LLM analysis
  const candidates = new Set<string>()

  // Borderline spam/bot scores where the rule engine is uncertain
  for (const r of active) {
    if (r.spamScore >= 0.2 && r.spamScore <= 0.7) candidates.add(r.id)
  }

  if (deepAnalysis) {
    // Analyse the most-engaged reviews as well
    const byLikes = [...active].sort((a, b) => b.likeCount - a.likeCount).slice(0, 10)
    byLikes.forEach(r => candidates.add(r.id))
  }

  // Always sample a few random reviews for quality assurance
  const remaining = active.filter(r => !candidates.has(r.id))
  const shuffled = remaining.sort(() => Math.random() - 0.5).slice(0, 5)
  shuffled.forEach(r => candidates.add(r.id))

  const candidateList = active.filter(r => candidates.has(r.id))
  const total = candidateList.length

  const enriched = new Map<string, NormalizedReview>()

  for (let i = 0; i < candidateList.length; i++) {
    const review = candidateList[i]
    onProgress?.(`LLM analyzing review ${i + 1}/${total}`, i + 1, total)

    const cacheKey = contentCacheKey(review.content)
    let analysis = getCachedLLM(cacheKey)

    if (!analysis) {
      analysis = await llm.analyzeReview(review)
      setCachedLLM(cacheKey, analysis)
      await sleep(200) // gentle rate-limit between API calls
    }

    // Reduce authenticity score proportionally for suspected ads/bots
    let authenticityScore = review.authenticityScore
    if (analysis.isSuspectedAd) authenticityScore = Math.max(0, authenticityScore - 0.3)
    if (analysis.isSuspectedBot) authenticityScore = Math.max(0, authenticityScore - 0.3)

    enriched.set(review.id, {
      ...review,
      llmAnalysis: analysis,
      sentiment: analysis.sentiment !== 'unknown' ? analysis.sentiment : review.sentiment,
      authenticityScore,
      authenticityReason: analysis.reason || review.authenticityReason
    })
  }

  return reviews.map(r => enriched.get(r.id) ?? r)
}
