import React, { useMemo, useState } from 'react'
import ReviewCard from './ReviewCard'

type ReviewSource = 'reddit' | 'youtube' | 'trustpilot'
type SentimentLabel = 'positive' | 'negative' | 'neutral' | 'unknown'

interface NormalizedReview {
  id: string
  jobId: string
  productQuery: string
  source: ReviewSource
  sourceType: string
  sourceUrl: string
  title: string
  content: string
  ratingRaw?: number
  sentiment: SentimentLabel
  language: string
  authorName: string
  authorId?: string
  authorProfileUrl?: string
  createdAt: string
  likeCount: number
  replyCount: number
  spamScore: number
  botScore: number
  authenticityScore: number
  authenticityReason: string
  matchedRules?: string[]
  llmAnalysis?: {
    isSuspectedAd: boolean
    isSuspectedBot: boolean
    sentiment: SentimentLabel
    pros: string[]
    cons: string[]
    reason: string
  }
  isFiltered: boolean
  fetchedAt: string
  rawMetadata: Record<string, unknown>
}

interface ReviewListProps {
  reviews: NormalizedReview[]
  isLoading: boolean
  onDeleteReview: (id: string) => void
}

type SortKey = 'date' | 'authenticity' | 'likes'

function SkeletonCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-sm px-3 py-2 animate-pulse">
      <div className="flex gap-2 items-center">
        <div className="h-4 w-14 bg-slate-200 rounded" />
        <div className="h-4 w-10 bg-slate-200 rounded" />
        <div className="h-4 w-20 bg-slate-200 rounded ml-auto" />
      </div>
      <div className="mt-2 h-3 bg-slate-200 rounded w-3/4" />
      <div className="mt-1 h-3 bg-slate-200 rounded w-full" />
      <div className="mt-1 h-3 bg-slate-200 rounded w-5/6" />
    </div>
  )
}

export default function ReviewList({ reviews, isLoading, onDeleteReview }: ReviewListProps) {
  const [sortKey, setSortKey] = useState<SortKey>('date')

  const visible = useMemo(() => reviews.filter((r) => !r.isFiltered), [reviews])
  const filtered = reviews.length - visible.length

  const sorted = useMemo(() => {
    const copy = [...reviews]
    switch (sortKey) {
      case 'date':
        return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      case 'authenticity':
        return copy.sort((a, b) => b.authenticityScore - a.authenticityScore)
      case 'likes':
        return copy.sort((a, b) => b.likeCount - a.likeCount)
      default:
        return copy
    }
  }, [reviews, sortKey])

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Stats bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>
            <span className="font-semibold text-slate-700">{visible.length}</span> reviews shown
          </span>
          {filtered > 0 && (
            <span className="text-amber-500">{filtered} filtered out</span>
          )}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-400">Sort:</span>
          {(['date', 'authenticity', 'likes'] as SortKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setSortKey(key)}
              className={`px-2 py-0.5 rounded capitalize transition-colors ${
                sortKey === key
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              {key === 'date' ? 'Newest' : key === 'authenticity' ? 'Authenticity' : 'Likes'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
            No reviews match the current filters.
          </div>
        ) : (
          sorted.map((review) => (
            <ReviewCard key={review.id} review={review} onDelete={() => onDeleteReview(review.id)} />
          ))
        )}
      </div>
    </div>
  )
}
