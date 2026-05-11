import type { LLMProvider, LLMAnalysis, NormalizedReview, SummaryResult } from '../types/index'

export type { LLMProvider }

// Deterministic keyword-based mock — usable without any API key
export class MockLLMProvider implements LLMProvider {
  async analyzeReview(review: NormalizedReview): Promise<LLMAnalysis> {
    const lower = review.content.toLowerCase()
    let sentiment: LLMAnalysis['sentiment'] = 'neutral'
    if (/\b(love|great|excellent|amazing|perfect|awesome|fantastic|best)\b/.test(lower)) sentiment = 'positive'
    else if (/\b(bad|terrible|worst|awful|horrible|broken|waste|disappoint)\b/.test(lower)) sentiment = 'negative'

    return {
      isSuspectedAd: review.spamScore > 0.6,
      isSuspectedBot: review.botScore > 0.6,
      sentiment,
      pros: [],
      cons: [],
      reason: `[Mock] Sentiment inferred from keywords. Spam: ${review.spamScore.toFixed(2)}, Bot: ${review.botScore.toFixed(2)}`,
      cachedAt: new Date().toISOString()
    }
  }

  async generateSummary(_reviews: NormalizedReview[], query: string): Promise<SummaryResult> {
    return {
      topPros: [
        `${query} received positive feedback on build quality`,
        'Customers appreciate the value for money',
        'Generally good performance reported',
        'Easy setup mentioned by several users',
        'Reliable daily use according to reviewers'
      ],
      topCons: [
        'Some users report customer service issues',
        'Price point considered high by some',
        'Minor quality control inconsistencies noted',
        'Software/firmware could be improved',
        'Shipping times vary by region'
      ],
      summary: `[Mock summary] ${query} has mixed reviews across platforms. Most users are satisfied with the core product experience, though some concerns about pricing and support exist.`
    }
  }
}
