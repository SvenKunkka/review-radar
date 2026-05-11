import type { NormalizedReview, RuleResult } from '../types/index'

export interface Rule {
  id: string
  description: string
  test(review: NormalizedReview): boolean
  spamWeight: number
  botWeight: number
}

const MARKETING_KEYWORDS = [
  'click here', 'buy now', 'limited offer', 'discount code', 'use code',
  'affiliate', 'sponsored', 'promo', 'free shipping', 'coupon', 'referral',
  'get yours', 'order now', 'shop now', 'check out my'
]

const TEMPLATE_PHRASES = [
  'i highly recommend', 'best product ever', 'changed my life',
  'five stars', 'five star', '10/10 would recommend', '5/5 stars',
  'must buy', 'you won\'t regret', 'absolutely amazing'
]

const STOPWORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'have', 'from', 'they',
  'not', 'are', 'was', 'but', 'his', 'her', 'she', 'he', 'it', 'its',
  'been', 'has', 'had', 'can', 'all', 'were', 'there', 'their', 'what',
  'when', 'will', 'would', 'could', 'should', 'about', 'which', 'also'
])

export const RULES: Rule[] = [
  {
    id: 'marketing_keywords',
    description: 'Contains marketing/promotional keywords',
    test: (r) => {
      const lower = r.content.toLowerCase()
      return MARKETING_KEYWORDS.some(kw => lower.includes(kw))
    },
    spamWeight: 0.4,
    botWeight: 0.1
  },
  {
    id: 'contact_info',
    description: 'Contains contact information or redirect prompts',
    test: (r) => {
      const lower = r.content.toLowerCase()
      return /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i.test(r.content) ||
        /\+?\d[\d\s\-().]{7,}\d/.test(r.content) ||
        ['whatsapp', 'telegram', 'dm me', 'message me', 'contact me'].some(kw => lower.includes(kw))
    },
    spamWeight: 0.5,
    botWeight: 0.1
  },
  {
    id: 'external_links',
    description: 'Contains suspicious external links',
    test: (r) => {
      const urlMatches = r.content.match(/https?:\/\/[^\s]+/g) ?? []
      const sourceHost = (() => {
        try { return new URL(r.sourceUrl).hostname } catch { return '' }
      })()
      return urlMatches.some(url => {
        try {
          const host = new URL(url).hostname
          // Flag links that don't share the root domain with the source
          return !host.includes(sourceHost.split('.').slice(-2).join('.'))
        } catch { return false }
      })
    },
    spamWeight: 0.3,
    botWeight: 0.1
  },
  {
    id: 'template_phrasing',
    description: 'Uses generic template-like phrasing',
    test: (r) => {
      const lower = r.content.toLowerCase()
      return TEMPLATE_PHRASES.some(phrase => lower.includes(phrase))
    },
    spamWeight: 0.35,
    botWeight: 0.15
  },
  {
    id: 'no_specific_details',
    description: 'Very short with no specific product details',
    test: (r) => {
      const words = r.content.split(/\s+/).filter(w => w.length > 0)
      if (words.length >= 50) return false
      const meaningfulWords = words.filter(w => w.length > 6 && !STOPWORDS.has(w.toLowerCase()))
      return meaningfulWords.length < 2
    },
    spamWeight: 0.2,
    botWeight: 0.15
  },
  {
    id: 'extreme_language',
    description: 'Excessive all-caps or exclamation marks',
    test: (r) => {
      const words = r.content.split(/\s+/)
      const capsRatio = words.filter(w => w === w.toUpperCase() && /[A-Z]{2,}/.test(w)).length / Math.max(words.length, 1)
      const exclCount = (r.content.match(/!/g) ?? []).length
      return capsRatio > 0.3 || exclCount > 3
    },
    spamWeight: 0.25,
    botWeight: 0.1
  },
  {
    id: 'repetitive_product_mention',
    description: 'Product name mentioned abnormally often',
    test: (r) => {
      const query = r.productQuery.toLowerCase()
      const content = r.content.toLowerCase()
      const count = (content.match(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) ?? []).length
      return count > 4
    },
    botWeight: 0.3,
    spamWeight: 0.2
  },
  {
    id: 'new_account_suspicious',
    description: 'New account with no engagement',
    test: (r) => {
      const ageDays = (r.authorMeta as any)?.accountAgeDays
      return typeof ageDays === 'number' && ageDays < 7 && r.likeCount === 0 && r.replyCount === 0
    },
    botWeight: 0.35,
    spamWeight: 0.15
  }
]

export function applyRules(review: NormalizedReview): RuleResult {
  const matchedRules: string[] = []
  let totalSpamWeight = 0
  let totalBotWeight = 0

  for (const rule of RULES) {
    if (rule.test(review)) {
      matchedRules.push(rule.id)
      totalSpamWeight += rule.spamWeight
      totalBotWeight += rule.botWeight
    }
  }

  return {
    spamScore: Math.min(totalSpamWeight, 1),
    botScore: Math.min(totalBotWeight, 1),
    matchedRules
  }
}
