import React from 'react'

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

interface AnalysisResult {
  jobId: string
  totalCount: number
  validCount: number
  suspectedAdBotCount: number
  suspectedAdBotRatio: number
  positiveCount: number
  negativeCount: number
  neutralCount: number
  positiveRatio: number
  negativeRatio: number
  neutralRatio: number
  topPros: string[]
  topCons: string[]
  representativePositive: NormalizedReview[]
  representativeNegative: NormalizedReview[]
  sourceDistribution: Record<string, {
    total: number
    positive: number
    negative: number
    neutral: number
    positiveRatio: number
    negativeRatio: number
    neutralRatio: number
  }>
  generatedAt: string
  llmSummary?: string
  domesticBreakdown?: {
    totalCount: number
    validCount: number
    positiveCount: number
    negativeCount: number
    neutralCount: number
    positiveRatio: number
    negativeRatio: number
    neutralRatio: number
    topPros: string[]
    topCons: string[]
    llmSummary?: string
    sourceDistribution: Record<string, {
      total: number
      positive: number
      negative: number
      neutral: number
      positiveRatio: number
      negativeRatio: number
      neutralRatio: number
    }>
  }
  internationalBreakdown?: {
    totalCount: number
    validCount: number
    positiveCount: number
    negativeCount: number
    neutralCount: number
    positiveRatio: number
    negativeRatio: number
    neutralRatio: number
    topPros: string[]
    topCons: string[]
    llmSummary?: string
    sourceDistribution: Record<string, {
      total: number
      positive: number
      negative: number
      neutral: number
      positiveRatio: number
      negativeRatio: number
      neutralRatio: number
    }>
  }
}

interface AnalysisViewProps {
  analysis: AnalysisResult | null
  isLoading: boolean
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded px-3 py-2 flex flex-col">
      <span className="text-xs text-slate-500 mb-0.5">{label}</span>
      <span className="text-xl font-semibold text-slate-800 leading-tight">{value}</span>
      {sub && <span className="text-xs text-slate-400 mt-0.5">{sub}</span>}
    </div>
  )
}

function MiniReviewCard({ review }: { review: NormalizedReview }) {
  const SOURCE_COLORS: Record<string, string> = {
    reddit: 'text-orange-600',
    youtube: 'text-red-600',
    trustpilot: 'text-emerald-600',
    bilibili: 'text-blue-600',
    zhihu: 'text-sky-600',
    tieba: 'text-red-500',
    nga: 'text-amber-600',
  }
  return (
    <div className="border border-slate-200 rounded-sm bg-slate-50 px-2.5 py-2 text-xs">
      <div className="flex items-center gap-2 mb-1">
        <span className={`font-medium capitalize ${SOURCE_COLORS[review.source]}`}>{review.source}</span>
        <span className="text-slate-400 truncate">{review.authorName}</span>
      </div>
      <p className="text-slate-600 line-clamp-2 leading-relaxed">
        {review.content?.slice(0, 160)}{review.content?.length > 160 ? '...' : ''}
      </p>
    </div>
  )
}

function pct(ratio: number) {
  return `${(ratio * 100).toFixed(1)}%`
}

export default function AnalysisView({ analysis, isLoading }: AnalysisViewProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-400 text-sm animate-pulse">
        Loading analysis...
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
        Run a search to see analysis.
      </div>
    )
  }

  const sourceEntries = Object.entries(analysis.sourceDistribution)

  return (
    <div className="overflow-y-auto h-full p-4 space-y-5">
      {/* Top stats */}
      <section>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Overview</h3>
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
          <StatCard label="Total Reviews" value={analysis.totalCount} />
          <StatCard label="Valid Reviews" value={analysis.validCount} />
          <StatCard
            label="Suspected Ads/Bots"
            value={analysis.suspectedAdBotCount}
            sub={pct(analysis.suspectedAdBotRatio)}
          />
          <StatCard
            label="Positive"
            value={analysis.positiveCount}
            sub={pct(analysis.positiveRatio)}
          />
          <StatCard
            label="Negative"
            value={analysis.negativeCount}
            sub={pct(analysis.negativeRatio)}
          />
          <StatCard
            label="Neutral"
            value={analysis.neutralCount}
            sub={pct(analysis.neutralRatio)}
          />
        </div>
      </section>

      {/* Source distribution */}
      {sourceEntries.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Source Distribution</h3>
          <div className="bg-white border border-slate-200 rounded p-3 space-y-3">
            {sourceEntries.map(([source, data]) => (
              <div key={source}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium capitalize text-slate-700">{source}</span>
                  <span className="text-xs text-slate-400">{data.total} reviews</span>
                </div>
                <div className="flex h-4 rounded overflow-hidden bg-slate-100">
                  {data.positiveRatio > 0 && (
                    <div
                      className="bg-green-500 h-full"
                      style={{ width: `${data.positiveRatio * 100}%` }}
                      title={`Positive: ${pct(data.positiveRatio)}`}
                    />
                  )}
                  {data.neutralRatio > 0 && (
                    <div
                      className="bg-slate-400 h-full"
                      style={{ width: `${data.neutralRatio * 100}%` }}
                      title={`Neutral: ${pct(data.neutralRatio)}`}
                    />
                  )}
                  {data.negativeRatio > 0 && (
                    <div
                      className="bg-red-500 h-full"
                      style={{ width: `${data.negativeRatio * 100}%` }}
                      title={`Negative: ${pct(data.negativeRatio)}`}
                    />
                  )}
                </div>
                <div className="flex gap-3 mt-1 text-xs text-slate-400">
                  <span><span className="inline-block w-2 h-2 rounded-sm bg-green-500 mr-1" />{pct(data.positiveRatio)}</span>
                  <span><span className="inline-block w-2 h-2 rounded-sm bg-slate-400 mr-1" />{pct(data.neutralRatio)}</span>
                  <span><span className="inline-block w-2 h-2 rounded-sm bg-red-500 mr-1" />{pct(data.negativeRatio)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Regional Comparison */}
      {(analysis.domesticBreakdown || analysis.internationalBreakdown) && (
        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Regional Comparison</h3>
          <div className="grid grid-cols-2 gap-3">
            {/* Domestic CN card */}
            <div className="bg-slate-800 rounded p-3 text-white">
              <h4 className="text-xs font-semibold text-white mb-2">🇨🇳 Domestic (CN)</h4>
              {analysis.domesticBreakdown ? (
                <>
                  <div className="flex h-3 rounded overflow-hidden bg-slate-600 mb-1">
                    {analysis.domesticBreakdown.positiveRatio > 0 && (
                      <div
                        className="bg-green-500 h-full"
                        style={{ width: `${analysis.domesticBreakdown.positiveRatio * 100}%` }}
                        title={`Positive: ${pct(analysis.domesticBreakdown.positiveRatio)}`}
                      />
                    )}
                    {analysis.domesticBreakdown.neutralRatio > 0 && (
                      <div
                        className="bg-slate-400 h-full"
                        style={{ width: `${analysis.domesticBreakdown.neutralRatio * 100}%` }}
                        title={`Neutral: ${pct(analysis.domesticBreakdown.neutralRatio)}`}
                      />
                    )}
                    {analysis.domesticBreakdown.negativeRatio > 0 && (
                      <div
                        className="bg-red-500 h-full"
                        style={{ width: `${analysis.domesticBreakdown.negativeRatio * 100}%` }}
                        title={`Negative: ${pct(analysis.domesticBreakdown.negativeRatio)}`}
                      />
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mb-1">
                    {analysis.domesticBreakdown.validCount} valid / {analysis.domesticBreakdown.totalCount} total
                  </p>
                  <div className="flex gap-2 text-xs mb-2">
                    <span className="text-green-400">{pct(analysis.domesticBreakdown.positiveRatio)} pos</span>
                    <span className="text-red-400">{pct(analysis.domesticBreakdown.negativeRatio)} neg</span>
                    <span className="text-slate-400">{pct(analysis.domesticBreakdown.neutralRatio)} neu</span>
                  </div>
                  {analysis.domesticBreakdown.topPros.slice(0, 3).length > 0 && (
                    <ul className="mb-1 space-y-0.5">
                      {analysis.domesticBreakdown.topPros.slice(0, 3).map((pro, i) => (
                        <li key={i} className="text-xs text-green-400 flex gap-1">
                          <span>•</span><span>{pro}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {analysis.domesticBreakdown.topCons.slice(0, 3).length > 0 && (
                    <ul className="mb-2 space-y-0.5">
                      {analysis.domesticBreakdown.topCons.slice(0, 3).map((con, i) => (
                        <li key={i} className="text-xs text-red-400 flex gap-1">
                          <span>•</span><span>{con}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(analysis.domesticBreakdown.sourceDistribution).map(([src, data]) => (
                      <span key={src} className="text-xs bg-slate-700 text-slate-300 rounded-full px-2 py-0.5 capitalize">
                        {src} <span className="text-slate-400">{data.total}</span>
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-400">No domestic reviews</p>
              )}
            </div>

            {/* International card */}
            <div className="bg-white border border-slate-200 rounded p-3">
              <h4 className="text-xs font-semibold text-slate-700 mb-2">🌍 International</h4>
              {analysis.internationalBreakdown ? (
                <>
                  <div className="flex h-3 rounded overflow-hidden bg-slate-100 mb-1">
                    {analysis.internationalBreakdown.positiveRatio > 0 && (
                      <div
                        className="bg-green-500 h-full"
                        style={{ width: `${analysis.internationalBreakdown.positiveRatio * 100}%` }}
                        title={`Positive: ${pct(analysis.internationalBreakdown.positiveRatio)}`}
                      />
                    )}
                    {analysis.internationalBreakdown.neutralRatio > 0 && (
                      <div
                        className="bg-slate-400 h-full"
                        style={{ width: `${analysis.internationalBreakdown.neutralRatio * 100}%` }}
                        title={`Neutral: ${pct(analysis.internationalBreakdown.neutralRatio)}`}
                      />
                    )}
                    {analysis.internationalBreakdown.negativeRatio > 0 && (
                      <div
                        className="bg-red-500 h-full"
                        style={{ width: `${analysis.internationalBreakdown.negativeRatio * 100}%` }}
                        title={`Negative: ${pct(analysis.internationalBreakdown.negativeRatio)}`}
                      />
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mb-1">
                    {analysis.internationalBreakdown.validCount} valid / {analysis.internationalBreakdown.totalCount} total
                  </p>
                  <div className="flex gap-2 text-xs mb-2">
                    <span className="text-green-600">{pct(analysis.internationalBreakdown.positiveRatio)} pos</span>
                    <span className="text-red-600">{pct(analysis.internationalBreakdown.negativeRatio)} neg</span>
                    <span className="text-slate-500">{pct(analysis.internationalBreakdown.neutralRatio)} neu</span>
                  </div>
                  {analysis.internationalBreakdown.topPros.slice(0, 3).length > 0 && (
                    <ul className="mb-1 space-y-0.5">
                      {analysis.internationalBreakdown.topPros.slice(0, 3).map((pro, i) => (
                        <li key={i} className="text-xs text-green-600 flex gap-1">
                          <span>•</span><span>{pro}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {analysis.internationalBreakdown.topCons.slice(0, 3).length > 0 && (
                    <ul className="mb-2 space-y-0.5">
                      {analysis.internationalBreakdown.topCons.slice(0, 3).map((con, i) => (
                        <li key={i} className="text-xs text-red-600 flex gap-1">
                          <span>•</span><span>{con}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(analysis.internationalBreakdown.sourceDistribution).map(([src, data]) => (
                      <span key={src} className="text-xs bg-slate-100 text-slate-600 border border-slate-200 rounded-full px-2 py-0.5 capitalize">
                        {src} <span className="text-slate-400">{data.total}</span>
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-400">No international reviews</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Pros & Cons */}
      <section>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Pros &amp; Cons</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-slate-200 rounded p-3">
            <h4 className="text-xs font-semibold text-green-600 mb-2">Top Positive Points</h4>
            {analysis.topPros.length === 0 ? (
              <p className="text-xs text-slate-400">No data yet.</p>
            ) : (
              <ol className="space-y-1">
                {analysis.topPros.slice(0, 5).map((pro, i) => (
                  <li key={i} className="flex gap-2 text-xs text-slate-700">
                    <span className="text-green-500 font-semibold flex-shrink-0">{i + 1}.</span>
                    <span>{pro}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="bg-white border border-slate-200 rounded p-3">
            <h4 className="text-xs font-semibold text-red-600 mb-2">Top Pain Points</h4>
            {analysis.topCons.length === 0 ? (
              <p className="text-xs text-slate-400">No data yet.</p>
            ) : (
              <ol className="space-y-1">
                {analysis.topCons.slice(0, 5).map((con, i) => (
                  <li key={i} className="flex gap-2 text-xs text-slate-700">
                    <span className="text-red-500 font-semibold flex-shrink-0">{i + 1}.</span>
                    <span>{con}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </section>

      {/* LLM Summary */}
      {analysis.llmSummary && (
        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">AI Summary</h3>
          <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
            {analysis.llmSummary}
          </div>
        </section>
      )}

      {/* Representative Reviews */}
      <section>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Representative Reviews</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <h4 className="text-xs font-semibold text-green-600 mb-2">Top Positive Reviews</h4>
            <div className="space-y-2">
              {analysis.representativePositive.slice(0, 3).map((r) => (
                <MiniReviewCard key={r.id} review={r} />
              ))}
              {analysis.representativePositive.length === 0 && (
                <p className="text-xs text-slate-400">None available.</p>
              )}
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-red-600 mb-2">Top Negative Reviews</h4>
            <div className="space-y-2">
              {analysis.representativeNegative.slice(0, 3).map((r) => (
                <MiniReviewCard key={r.id} review={r} />
              ))}
              {analysis.representativeNegative.length === 0 && (
                <p className="text-xs text-slate-400">None available.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
