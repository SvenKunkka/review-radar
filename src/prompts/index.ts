import type { NormalizedReview } from '../types/index'

// Kept intentionally compact — smaller models (llama3.2 3B) lose JSON discipline
// when given overly long instructions. "format: json" in Ollama handles the wrapping;
// these prompts only need to describe the schema clearly.

export function REVIEW_ANALYSIS_PROMPT(review: NormalizedReview, _productQuery: string): string {
  return `Analyze this product review and output JSON only.

Review: "${review.content.slice(0, 400)}"
Source: ${review.source} | Likes: ${review.likeCount} | Spam score: ${review.spamScore.toFixed(2)} | Bot score: ${review.botScore.toFixed(2)}

Output exactly this JSON structure (no other text):
{
  "isSuspectedAd": false,
  "isSuspectedBot": false,
  "sentiment": "neutral",
  "pros": [],
  "cons": [],
  "reason": ""
}

Field rules:
- sentiment: one of positive / negative / neutral / unknown
- pros: up to 3 short strings — specific product strengths mentioned in the review
- cons: up to 3 short strings — specific product weaknesses mentioned in the review
- reason: one sentence under 20 words explaining your judgment
- isSuspectedAd: true only if the review reads like paid promotion or affiliate content
- isSuspectedBot: true only if the review looks machine-generated or part of a bot campaign`
}

export function SUMMARY_PROMPT(reviews: NormalizedReview[], query: string): string {
  // Cap at 8 reviews × 150 chars — enough signal for a 3B model without overflowing context
  const reviewTexts = reviews
    .slice(0, 8)
    .map((r, i) => `${i + 1}. [${r.sentiment}] ${r.content.slice(0, 150)}`)
    .join('\n')

  return `You are analyzing customer reviews for the product "${query}". Output JSON only.

Reviews (${reviews.length} total, showing sample):
${reviewTexts}

Output exactly this JSON structure (no other text):
{
  "topPros": [],
  "topCons": [],
  "summary": ""
}

Field rules:
- topPros: up to 5 strings — specific strengths customers praise (e.g. "Tactile switches with satisfying feedback")
- topCons: up to 5 strings — specific complaints customers raise (e.g. "Software bugs on macOS")
- summary: 2 factual sentences describing overall customer sentiment — no marketing language
- If fewer than 5 pros or cons are supported by the data, return a shorter array`
}
