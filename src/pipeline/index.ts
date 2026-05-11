import type { NormalizedReview, LLMProvider, SearchProgress } from '../types/index'
import { cleanReview } from './cleaner'
import { deduplicateReviews } from './deduplicator'
import { applyRules } from './ruleEngine'
import { runLLMJudgment } from './llmJudge'

export async function runPipeline(
  reviews: NormalizedReview[],
  llm: LLMProvider,
  productQuery: string,
  deepAnalysis: boolean,
  onProgress: (progress: SearchProgress) => void,
  jobId: string
): Promise<NormalizedReview[]> {
  const emit = (stage: string, message: string, current?: number, total?: number) =>
    onProgress({ jobId, stage, message, current, total })

  // Stage 1: normalise and clean raw text
  emit('cleaning', `Cleaning ${reviews.length} reviews...`)
  let processed = reviews.map(r => cleanReview(r))

  // Stage 2: remove exact and near-duplicate content
  emit('deduplication', 'Deduplicating reviews...')
  processed = deduplicateReviews(processed)

  // Stage 3: lightweight rule-based spam/bot scoring
  emit('rule_engine', 'Applying rule engine...')
  processed = processed.map(r => {
    if (r.isFiltered) return r
    const result = applyRules(r)
    return {
      ...r,
      spamScore: result.spamScore,
      botScore: result.botScore,
      matchedRules: result.matchedRules,
      // Composite authenticity: equal weight to spam and bot signals
      authenticityScore: Math.max(0, 1 - (result.spamScore * 0.5 + result.botScore * 0.5)),
      authenticityReason: result.matchedRules.length > 0
        ? `Matched rules: ${result.matchedRules.slice(0, 3).join(', ')}`
        : 'Passed rule engine'
    }
  })

  // Stage 4: LLM-based judgment on borderline and representative reviews
  emit('llm_judgment', 'Running LLM analysis on borderline reviews...')
  processed = await runLLMJudgment(
    processed,
    llm,
    productQuery,
    deepAnalysis,
    (msg, current, total) => emit('llm_judgment', msg, current, total)
  )

  return processed
}
