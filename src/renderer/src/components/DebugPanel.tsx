import React from 'react'

type ReviewSource = 'reddit' | 'youtube' | 'trustpilot'
type SentimentLabel = 'positive' | 'negative' | 'neutral' | 'unknown'
type JobStatus = 'pending' | 'running' | 'completed' | 'failed'

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

interface SearchJob {
  id: string
  productQuery: string
  sources: ReviewSource[]
  status: JobStatus
  totalReviews: number
  validReviews: number
  suspectedAdBotCount: number
  createdAt: string
  completedAt?: string
  error?: string
}

interface SearchProgress {
  jobId: string
  stage: string
  message: string
  current?: number
  total?: number
}

interface DebugPanelProps {
  progressMessages: SearchProgress[]
  activeJob: SearchJob | null
  reviews: NormalizedReview[]
}

function countBy<T>(arr: T[], key: (item: T) => string): Record<string, number> {
  return arr.reduce<Record<string, number>>((acc, item) => {
    const k = key(item)
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {})
}

export default function DebugPanel({ progressMessages, activeJob, reviews }: DebugPanelProps) {
  const bySource = countBy(reviews, (r) => r.source)
  const bySentiment = countBy(reviews, (r) => r.sentiment)
  const byFiltered = countBy(reviews, (r) => String(r.isFiltered))

  // Rule engine stats
  const ruleCounts: Record<string, number> = {}
  for (const r of reviews) {
    for (const rule of r.matchedRules ?? []) {
      ruleCounts[rule] = (ruleCounts[rule] ?? 0) + 1
    }
  }
  const sortedRules = Object.entries(ruleCounts).sort((a, b) => b[1] - a[1])

  // LLM cache
  const withLlm = reviews.filter((r) => r.llmAnalysis).length
  const withoutLlm = reviews.length - withLlm

  const monoClass = 'font-mono text-xs'

  return (
    <div className="h-full overflow-y-auto p-4 space-y-5">
      {/* Job info */}
      <section>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Job Info</h3>
        {activeJob ? (
          <pre className={`${monoClass} bg-white border border-slate-200 rounded p-3 overflow-x-auto text-slate-700 leading-relaxed`}>
            {JSON.stringify(activeJob, null, 2)}
          </pre>
        ) : (
          <p className="text-xs text-slate-400">No active job.</p>
        )}
      </section>

      {/* Progress log */}
      <section>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Progress Log ({progressMessages.length} events)
        </h3>
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          {progressMessages.length === 0 ? (
            <p className="text-xs text-slate-400 px-3 py-2">No progress events yet.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-1.5 text-slate-500 font-medium w-28">Stage</th>
                    <th className="text-left px-3 py-1.5 text-slate-500 font-medium">Message</th>
                    <th className="text-right px-3 py-1.5 text-slate-500 font-medium w-20">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {progressMessages.map((p, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className={`px-3 py-1 text-blue-600 ${monoClass}`}>{p.stage}</td>
                      <td className={`px-3 py-1 text-slate-700 ${monoClass}`}>{p.message}</td>
                      <td className={`px-3 py-1 text-slate-400 text-right ${monoClass}`}>
                        {p.current !== undefined && p.total !== undefined
                          ? `${p.current}/${p.total}`
                          : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Review stats */}
      <section>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Review Stats</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-slate-200 rounded p-3">
            <p className="text-xs font-medium text-slate-500 mb-1.5">By Source</p>
            <table className="w-full text-xs">
              <tbody>
                {Object.entries(bySource).map(([src, count]) => (
                  <tr key={src}>
                    <td className="py-0.5 capitalize text-slate-700">{src}</td>
                    <td className="py-0.5 text-right font-mono text-slate-500">{count}</td>
                  </tr>
                ))}
                {Object.keys(bySource).length === 0 && (
                  <tr><td className="text-slate-400">—</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-white border border-slate-200 rounded p-3">
            <p className="text-xs font-medium text-slate-500 mb-1.5">By Sentiment</p>
            <table className="w-full text-xs">
              <tbody>
                {Object.entries(bySentiment).map(([sent, count]) => (
                  <tr key={sent}>
                    <td className="py-0.5 capitalize text-slate-700">{sent}</td>
                    <td className="py-0.5 text-right font-mono text-slate-500">{count}</td>
                  </tr>
                ))}
                {Object.keys(bySentiment).length === 0 && (
                  <tr><td className="text-slate-400">—</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-white border border-slate-200 rounded p-3">
            <p className="text-xs font-medium text-slate-500 mb-1.5">By Filter Status</p>
            <table className="w-full text-xs">
              <tbody>
                <tr>
                  <td className="py-0.5 text-slate-700">Visible</td>
                  <td className="py-0.5 text-right font-mono text-slate-500">{byFiltered['false'] ?? 0}</td>
                </tr>
                <tr>
                  <td className="py-0.5 text-slate-700">Filtered</td>
                  <td className="py-0.5 text-right font-mono text-slate-500">{byFiltered['true'] ?? 0}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Rule engine */}
      <section>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Rule Engine Hits</h3>
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          {sortedRules.length === 0 ? (
            <p className="text-xs text-slate-400 px-3 py-2">No matched rules.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-1.5 text-slate-500 font-medium">Rule</th>
                  <th className="text-right px-3 py-1.5 text-slate-500 font-medium w-20">Hits</th>
                </tr>
              </thead>
              <tbody>
                {sortedRules.map(([rule, count]) => (
                  <tr key={rule} className="border-t border-slate-100">
                    <td className={`px-3 py-1 text-slate-700 ${monoClass}`}>{rule}</td>
                    <td className={`px-3 py-1 text-right text-slate-500 ${monoClass}`}>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* LLM cache */}
      <section>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">LLM Analysis Cache</h3>
        <div className="bg-white border border-slate-200 rounded p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-600">With LLM analysis</span>
            <span className="font-mono text-slate-700">{withLlm}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Without LLM analysis</span>
            <span className="font-mono text-slate-700">{withoutLlm}</span>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-1 mt-1">
            <span className="text-slate-500">Coverage</span>
            <span className="font-mono text-slate-500">
              {reviews.length > 0 ? ((withLlm / reviews.length) * 100).toFixed(1) : '0.0'}%
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}
