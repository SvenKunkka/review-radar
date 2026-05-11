import React, { useState } from 'react'

type ReviewSource = 'reddit' | 'youtube' | 'trustpilot' | 'bilibili' | 'zhihu' | 'tieba' | 'nga'
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

interface ReviewCardProps {
  review: NormalizedReview
  onDelete?: () => void
}

const SOURCE_STYLES: Record<ReviewSource, { label: string; className: string }> = {
  reddit: { label: 'Reddit', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  youtube: { label: 'YouTube', className: 'bg-red-100 text-red-700 border-red-200' },
  trustpilot: { label: 'Trustpilot', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  bilibili: { label: 'Bilibili', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  zhihu: { label: 'Zhihu', className: 'bg-sky-100 text-sky-700 border-sky-200' },
  tieba: { label: 'Tieba', className: 'bg-red-50 text-red-600 border-red-100' },
  nga: { label: 'NGA', className: 'bg-amber-100 text-amber-700 border-amber-200' },
}

const SENTIMENT_STYLES: Record<SentimentLabel, string> = {
  positive: 'text-green-600',
  negative: 'text-red-600',
  neutral: 'text-slate-500',
  unknown: 'text-slate-400',
}

function AuthenticityBar({ score }: { score: number }) {
  const color = score > 0.7 ? 'bg-green-500' : score > 0.4 ? 'bg-yellow-400' : 'bg-red-500'
  return (
    <div className="flex items-center gap-1" title={`Authenticity: ${score.toFixed(2)}`}>
      <div className="w-12 h-1.5 bg-slate-200 rounded overflow-hidden">
        <div className={`h-full ${color} rounded`} style={{ width: `${score * 100}%` }} />
      </div>
      <span className="text-xs text-slate-400">{(score * 100).toFixed(0)}%</span>
    </div>
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

function sourceDomain(url: string): string {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '')
    // Shorten known long hostnames
    if (h.includes('reddit')) return 'reddit.com'
    if (h.includes('bilibili')) return 'bilibili.com'
    if (h.includes('zhihu')) return 'zhihu.com'
    if (h.includes('tieba')) return 'tieba.baidu.com'
    if (h.includes('nga')) return 'nga.cn'
    if (h.includes('youtube')) return 'youtube.com'
    if (h.includes('trustpilot')) return 'trustpilot.com'
    return h
  } catch {
    return ''
  }
}

export default function ReviewCard({ review, onDelete }: ReviewCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const sourceStyle = SOURCE_STYLES[review.source] ?? { label: review.source, className: 'bg-slate-100 text-slate-600 border-slate-200' }
  const sentimentStyle = SENTIMENT_STYLES[review.sentiment]
  const domain = review.sourceUrl ? sourceDomain(review.sourceUrl) : ''

  const isSuspicious =
    review.spamScore > 0.6 ||
    review.botScore > 0.6 ||
    review.llmAnalysis?.isSuspectedAd === true ||
    review.llmAnalysis?.isSuspectedBot === true

  const contentLines = review.content?.split('\n').filter(Boolean) ?? []
  const shortContent = contentLines.slice(0, 3).join(' ')
  const isLong = review.content?.length > 280 || contentLines.length > 3

  return (
    <div
      className={`bg-white border border-slate-200 rounded px-3 py-2.5 transition-opacity relative group ${
        review.isFiltered ? 'opacity-40' : ''
      }`}
    >
      {/* Row 1: source + link | sentiment + auth | meta */}
      <div className="flex items-center gap-2 text-xs mb-1.5">
        {/* Source badge + clickable domain */}
        <span className={`px-2 py-0.5 rounded border text-xs font-semibold flex-shrink-0 ${sourceStyle.className}`}>
          {sourceStyle.label}
        </span>
        {review.sourceUrl && (
          <a
            href={review.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-blue-600 hover:underline truncate max-w-[220px] font-mono text-[11px]"
            title={review.sourceUrl}
          >
            {domain}
          </a>
        )}

        <span className="flex-1" />

        {/* Sentiment */}
        <span className={`font-medium capitalize flex-shrink-0 ${sentimentStyle}`}>{review.sentiment}</span>

        {/* Authenticity bar */}
        <AuthenticityBar score={review.authenticityScore} />

        {/* Suspicious warning */}
        {isSuspicious && (
          <span className="text-amber-600 font-medium flex-shrink-0" title="Suspected ad/bot/spam">⚠ Suspicious</span>
        )}

        {/* Date */}
        <span className="text-slate-400 flex-shrink-0">{formatDate(review.createdAt)}</span>

        {/* Author */}
        <span className="text-slate-500 truncate max-w-[120px]" title={review.authorName}>
          {review.authorName}
        </span>

        {/* Engagement */}
        {review.likeCount > 0 && <span className="text-slate-400 flex-shrink-0">+{review.likeCount}</span>}
        {review.replyCount > 0 && <span className="text-slate-400 flex-shrink-0">[{review.replyCount}]</span>}

        {/* Delete / confirm — inline at end of row */}
        {onDelete && (
          confirmDelete ? (
            <span className="flex items-center gap-1 flex-shrink-0 ml-1">
              <span className="text-red-600 font-medium">Delete?</span>
              <button
                onClick={() => { onDelete(); setConfirmDelete(false) }}
                className="text-white bg-red-500 hover:bg-red-600 rounded px-1.5 py-0.5 font-semibold leading-none"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-slate-500 hover:text-slate-800 rounded px-1.5 py-0.5 border border-slate-200 leading-none"
              >
                No
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded px-1 leading-none text-base"
              title="Delete review"
              aria-label="Delete review"
            >
              ×
            </button>
          )
        )}
      </div>

      {/* Title */}
      {review.title && (
        <p className="text-sm font-semibold text-slate-800 mb-0.5 leading-snug line-clamp-1">{review.title}</p>
      )}

      {/* Content */}
      <p className="text-xs text-slate-600 leading-relaxed">
        {expanded ? review.content : shortContent}
        {isLong && !expanded && '…'}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-blue-500 hover:text-blue-700 mt-0.5"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}

      {/* Footer: tags + full source link */}
      {(review.matchedRules?.length || review.llmAnalysis || review.isFiltered || review.sourceUrl) && (
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5 pt-1.5 border-t border-slate-100">
          {review.matchedRules?.map((rule) => (
            <span key={rule} className="text-xs bg-slate-100 text-slate-500 border border-slate-200 rounded px-1.5 py-0.5">
              {rule}
            </span>
          ))}
          {review.llmAnalysis && (
            <span className="text-xs bg-purple-50 text-purple-600 border border-purple-200 rounded px-1.5 py-0.5">
              LLM analyzed
            </span>
          )}
          {review.isFiltered && (
            <span className="text-xs text-amber-600 italic">Filtered</span>
          )}
          <span className="flex-1" />
          {review.sourceUrl && (
            <a
              href={review.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:text-blue-700 hover:underline font-medium flex-shrink-0"
            >
              Open source ↗
            </a>
          )}
        </div>
      )}
    </div>
  )
}
