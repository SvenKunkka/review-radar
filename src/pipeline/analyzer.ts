import type {
  NormalizedReview,
  AnalysisResult,
  SentimentDistribution,
  RegionBreakdown,
  LLMProvider,
  ReviewSource
} from '../types/index'
import { DOMESTIC_SOURCES, INTERNATIONAL_SOURCES } from '../types/index'

function buildRegionBreakdown(
  active: NormalizedReview[],
  regionSources: ReviewSource[],
  safe: (n: number, d: number) => number
): RegionBreakdown | undefined {
  const reviews = active.filter(r => regionSources.includes(r.source))
  if (reviews.length === 0) return undefined

  const pos = reviews.filter(r => r.sentiment === 'positive').length
  const neg = reviews.filter(r => r.sentiment === 'negative').length
  const neu = reviews.length - pos - neg

  const proFreq = new Map<string, number>()
  const conFreq = new Map<string, number>()
  for (const r of reviews) {
    for (const pro of r.llmAnalysis?.pros ?? []) proFreq.set(pro, (proFreq.get(pro) ?? 0) + 1)
    for (const con of r.llmAnalysis?.cons ?? []) conFreq.set(con, (conFreq.get(con) ?? 0) + 1)
  }

  const sourceDistribution: Partial<Record<ReviewSource, SentimentDistribution>> = {}
  for (const src of regionSources) {
    const s = reviews.filter(r => r.source === src)
    if (s.length === 0) continue
    const sp = s.filter(r => r.sentiment === 'positive').length
    const sn = s.filter(r => r.sentiment === 'negative').length
    sourceDistribution[src] = {
      total: s.length, positive: sp, negative: sn, neutral: s.length - sp - sn,
      positiveRatio: safe(sp, s.length), negativeRatio: safe(sn, s.length), neutralRatio: safe(s.length - sp - sn, s.length)
    }
  }

  return {
    totalCount: reviews.length,
    validCount: reviews.filter(r => !r.isFiltered).length,
    positiveCount: pos, negativeCount: neg, neutralCount: neu,
    positiveRatio: safe(pos, reviews.length), negativeRatio: safe(neg, reviews.length), neutralRatio: safe(neu, reviews.length),
    topPros: [...proFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]),
    topCons: [...conFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]),
    sourceDistribution
  }
}

export async function generateAnalysis(
  jobId: string,
  reviews: NormalizedReview[],
  llm: LLMProvider,
  productQuery: string
): Promise<AnalysisResult> {
  const active = reviews.filter(r => !r.isFiltered)
  const totalCount = reviews.length
  const validCount = active.length

  const suspectedAdBotCount = active.filter(
    r =>
      r.authenticityScore < 0.4 ||
      r.spamScore > 0.6 ||
      r.botScore > 0.6 ||
      r.llmAnalysis?.isSuspectedAd ||
      r.llmAnalysis?.isSuspectedBot
  ).length

  const positiveCount = active.filter(r => r.sentiment === 'positive').length
  const negativeCount = active.filter(r => r.sentiment === 'negative').length
  const neutralCount = active.filter(r => r.sentiment === 'neutral' || r.sentiment === 'unknown').length

  // Safe division avoiding NaN
  const safe = (n: number, d: number) => d === 0 ? 0 : Math.round((n / d) * 100) / 100

  // Per-source sentiment breakdown
  const sourceDistribution: Partial<Record<ReviewSource, SentimentDistribution>> = {}
  const sources: ReviewSource[] = [...DOMESTIC_SOURCES, ...INTERNATIONAL_SOURCES]
  for (const src of sources) {
    const srcReviews = active.filter(r => r.source === src)
    if (srcReviews.length === 0) continue
    const pos = srcReviews.filter(r => r.sentiment === 'positive').length
    const neg = srcReviews.filter(r => r.sentiment === 'negative').length
    const neu = srcReviews.length - pos - neg
    sourceDistribution[src] = {
      total: srcReviews.length,
      positive: pos,
      negative: neg,
      neutral: neu,
      positiveRatio: safe(pos, srcReviews.length),
      negativeRatio: safe(neg, srcReviews.length),
      neutralRatio: safe(neu, srcReviews.length)
    }
  }

  // Aggregate pros/cons from per-review LLM analyses by frequency
  const proFreq = new Map<string, number>()
  const conFreq = new Map<string, number>()
  for (const r of active) {
    for (const pro of r.llmAnalysis?.pros ?? []) {
      proFreq.set(pro, (proFreq.get(pro) ?? 0) + 1)
    }
    for (const con of r.llmAnalysis?.cons ?? []) {
      conFreq.set(con, (conFreq.get(con) ?? 0) + 1)
    }
  }

  let topPros = [...proFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0])
  let topCons = [...conFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0])
  let llmSummary: string | undefined

  // When per-review data is sparse, run a batch summary call
  if (topPros.length < 3 || topCons.length < 3) {
    const representatives = [
      ...active.filter(r => r.sentiment === 'positive').sort((a, b) => b.likeCount - a.likeCount).slice(0, 5),
      ...active.filter(r => r.sentiment === 'negative').sort((a, b) => b.likeCount - a.likeCount).slice(0, 5),
      ...active.filter(r => r.sentiment === 'neutral').sort((a, b) => b.likeCount - a.likeCount).slice(0, 5)
    ].slice(0, 20)

    try {
      const summary = await llm.generateSummary(representatives, productQuery)
      topPros = summary.topPros.length > 0 ? summary.topPros : topPros
      topCons = summary.topCons.length > 0 ? summary.topCons : topCons
      llmSummary = summary.summary
    } catch (err: any) {
      console.warn('[Analyzer] generateSummary failed:', err.message)
    }
  }

  const representativePositive = active
    .filter(r => r.sentiment === 'positive')
    .sort((a, b) => b.likeCount - a.likeCount)
    .slice(0, 3)

  const representativeNegative = active
    .filter(r => r.sentiment === 'negative')
    .sort((a, b) => b.likeCount - a.likeCount)
    .slice(0, 3)

  const domesticBreakdown = buildRegionBreakdown(active, DOMESTIC_SOURCES, safe)
  const internationalBreakdown = buildRegionBreakdown(active, INTERNATIONAL_SOURCES, safe)

  return {
    jobId,
    totalCount,
    validCount,
    suspectedAdBotCount,
    suspectedAdBotRatio: safe(suspectedAdBotCount, validCount),
    positiveCount,
    negativeCount,
    neutralCount,
    positiveRatio: safe(positiveCount, validCount),
    negativeRatio: safe(negativeCount, validCount),
    neutralRatio: safe(neutralCount, validCount),
    topPros,
    topCons,
    representativePositive,
    representativeNegative,
    sourceDistribution,
    generatedAt: new Date().toISOString(),
    llmSummary,
    domesticBreakdown,
    internationalBreakdown
  }
}
