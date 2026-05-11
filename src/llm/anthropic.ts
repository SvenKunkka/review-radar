import Anthropic from '@anthropic-ai/sdk'
import type { LLMProvider, LLMAnalysis, NormalizedReview, SummaryResult } from '../types/index'
import { REVIEW_ANALYSIS_PROMPT, SUMMARY_PROMPT } from '../prompts/index'

// Extract the first JSON object from the model response, tolerating surrounding text
function extractJSON(text: string): string {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object found in response')
  return text.slice(start, end + 1)
}

export class AnthropicLLMProvider implements LLMProvider {
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async analyzeReview(review: NormalizedReview): Promise<LLMAnalysis> {
    const prompt = REVIEW_ANALYSIS_PROMPT(review, review.productQuery)
    try {
      const msg = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }]
      })
      const text = (msg.content[0] as any).text ?? ''
      const parsed = JSON.parse(extractJSON(text))
      return {
        isSuspectedAd: Boolean(parsed.isSuspectedAd),
        isSuspectedBot: Boolean(parsed.isSuspectedBot),
        sentiment: parsed.sentiment ?? 'unknown',
        pros: Array.isArray(parsed.pros) ? parsed.pros : [],
        cons: Array.isArray(parsed.cons) ? parsed.cons : [],
        reason: parsed.reason ?? '',
        rawResponse: text,
        cachedAt: new Date().toISOString()
      }
    } catch (err: any) {
      console.warn('[Anthropic] analyzeReview failed:', err.message)
      return {
        isSuspectedAd: false,
        isSuspectedBot: false,
        sentiment: 'unknown',
        pros: [],
        cons: [],
        reason: `LLM analysis failed: ${err.message}`,
        cachedAt: new Date().toISOString()
      }
    }
  }

  async generateSummary(reviews: NormalizedReview[], query: string): Promise<SummaryResult> {
    const prompt = SUMMARY_PROMPT(reviews, query)
    try {
      const msg = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
      const text = (msg.content[0] as any).text ?? ''
      const parsed = JSON.parse(extractJSON(text))
      return {
        topPros: Array.isArray(parsed.topPros) ? parsed.topPros : [],
        topCons: Array.isArray(parsed.topCons) ? parsed.topCons : [],
        summary: parsed.summary ?? ''
      }
    } catch (err: any) {
      console.warn('[Anthropic] generateSummary failed:', err.message)
      return { topPros: [], topCons: [], summary: `Summary generation failed: ${err.message}` }
    }
  }
}
