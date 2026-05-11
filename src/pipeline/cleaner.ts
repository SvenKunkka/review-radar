import type { NormalizedReview } from '../types/index'

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

export function cleanReview(review: NormalizedReview): NormalizedReview {
  const cleanedContent = stripHtml(review.content)
    .replace(/[​-‏﻿­]/g, '')  // zero-width and soft-hyphen characters
    .replace(/\s+/g, ' ')
    .trim()

  const cleanedTitle = stripHtml(review.title)
    .replace(/\s+/g, ' ')
    .trim()

  // Normalize createdAt to ISO 8601; fall back to fetchedAt if unparseable
  let createdAt = review.createdAt
  try {
    createdAt = new Date(review.createdAt).toISOString()
  } catch {
    createdAt = review.fetchedAt
  }

  const isFiltered = review.isFiltered || cleanedContent.length < 10

  return {
    ...review,
    title: cleanedTitle,
    content: cleanedContent,
    createdAt,
    isFiltered,
    authenticityReason: isFiltered && cleanedContent.length < 10
      ? 'Too short after cleaning'
      : review.authenticityReason
  }
}
