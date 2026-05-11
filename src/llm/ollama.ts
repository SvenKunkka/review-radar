// Ollama LLM provider — calls a locally running Ollama server (no API key needed).
// Install Ollama: https://ollama.com  |  pull a model: ollama pull llama3.2
import axios from 'axios'
import type { LLMProvider, LLMAnalysis, NormalizedReview, SummaryResult } from '../types/index'
import { REVIEW_ANALYSIS_PROMPT, SUMMARY_PROMPT } from '../prompts/index'

// Secondary safety net — extract first {...} block if model adds surrounding prose
function extractJSON(text: string): string {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error(`No JSON object in Ollama response. Raw: "${text.slice(0, 200)}"`)
  return text.slice(start, end + 1)
}

export class OllamaLLMProvider implements LLMProvider {
  private baseUrl: string
  private model: string

  constructor(baseUrl = 'http://localhost:11434', model = 'llama3.2') {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.model = model
  }

  private async chat(prompt: string, maxTokens = 512, timeoutMs = 60000): Promise<string> {
    const resp = await axios.post(
      `${this.baseUrl}/api/chat`,
      {
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        format: 'json',  // forces the model to emit raw JSON — no markdown wrapping
        options: { num_predict: maxTokens, temperature: 0.1 }
      },
      { timeout: timeoutMs }
    )
    return resp.data?.message?.content ?? ''
  }

  async analyzeReview(review: NormalizedReview): Promise<LLMAnalysis> {
    const prompt = REVIEW_ANALYSIS_PROMPT(review, review.productQuery)
    try {
      const text = await this.chat(prompt, 512, 60000)
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
      console.warn('[Ollama] analyzeReview failed:', err.message)
      return {
        isSuspectedAd: false,
        isSuspectedBot: false,
        sentiment: 'unknown',
        pros: [],
        cons: [],
        reason: `Ollama error: ${err.message}`,
        cachedAt: new Date().toISOString()
      }
    }
  }

  async generateSummary(reviews: NormalizedReview[], query: string): Promise<SummaryResult> {
    const prompt = SUMMARY_PROMPT(reviews, query)
    try {
      // Allow extra time — summary prompt is larger than per-review prompts
      const text = await this.chat(prompt, 1024, 90000)
      const parsed = JSON.parse(extractJSON(text))
      return {
        topPros: Array.isArray(parsed.topPros) ? parsed.topPros : [],
        topCons: Array.isArray(parsed.topCons) ? parsed.topCons : [],
        summary: parsed.summary ?? ''
      }
    } catch (err: any) {
      console.warn('[Ollama] generateSummary failed:', err.message)
      return { topPros: [], topCons: [], summary: `Summary unavailable: ${err.message}` }
    }
  }
}
