import { createHash } from 'crypto'
import type { RawReview, NormalizedReview, ReviewSource, ReviewSourceAdapter } from '../types/index'

export abstract class BaseAdapter implements ReviewSourceAdapter {
  abstract readonly source: ReviewSource
  abstract search(productQuery: string, maxResults?: number): Promise<RawReview[]>
  abstract normalize(input: RawReview, productQuery: string, jobId: string): NormalizedReview

  protected generateId(content: string, source: string): string {
    return createHash('sha256').update(content + source + Date.now().toString()).digest('hex').slice(0, 16)
  }

  protected generateDedupeHash(content: string): string {
    const normalized = content.toLowerCase().trim().replace(/\s+/g, ' ')
    return createHash('sha256').update(normalized).digest('hex')
  }

  protected detectLanguage(text: string): string {
    // Unicode range heuristics — no external library needed
    const sample = text.slice(0, 200)
    if (/[一-鿿㐀-䶿]/.test(sample)) return 'zh'
    if (/[぀-ヿㇰ-ㇿ]/.test(sample)) return 'ja'
    if (/[가-힯ᄀ-ᇿ]/.test(sample)) return 'ko'
    if (/[؀-ۿ]/.test(sample)) return 'ar'
    if (/[Ѐ-ӿ]/.test(sample)) return 'ru'
    if (/[À-ɏ]/.test(sample)) return 'fr' // rough latin-extended → European
    return 'en'
  }

  protected sanitizeText(text: string): string {
    return text
      .replace(/<[^>]+>/g, '')            // strip HTML tags
      .replace(/[​-‏﻿]/g, '')  // zero-width chars
      .replace(/\s+/g, ' ')
      .trim()
  }
}
