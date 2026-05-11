import React from 'react'

type ReviewSource = 'reddit' | 'youtube' | 'trustpilot' | 'bilibili' | 'zhihu' | 'tieba' | 'nga'
type SentimentLabel = 'positive' | 'negative' | 'neutral' | 'unknown'

interface SearchFilters {
  sources?: ReviewSource[]
  languages?: string[]
  sentiments?: SentimentLabel[]
  minAuthenticityScore?: number
  maxAuthenticityScore?: number
  includeSuspectedSpam?: boolean
  dateFrom?: string
  dateTo?: string
}

interface FilterPanelProps {
  filters: SearchFilters
  onChange: (filters: SearchFilters) => void
  disabled: boolean
}

const INTERNATIONAL_SOURCES: ReviewSource[] = ['reddit', 'youtube', 'trustpilot']
const DOMESTIC_SOURCES: ReviewSource[] = ['bilibili', 'zhihu', 'tieba', 'nga']
const ALL_SOURCES: ReviewSource[] = [...INTERNATIONAL_SOURCES, ...DOMESTIC_SOURCES]
const ALL_SENTIMENTS: SentimentLabel[] = ['positive', 'negative', 'neutral']

const SENTIMENT_COLORS: Record<SentimentLabel, string> = {
  positive: 'text-green-400',
  negative: 'text-red-400',
  neutral: 'text-slate-400',
  unknown: 'text-slate-500',
}

export default function FilterPanel({ filters, onChange, disabled }: FilterPanelProps) {
  const activeSources = filters.sources ?? ALL_SOURCES
  const activeSentiments = filters.sentiments ?? ALL_SENTIMENTS
  const minAuth = filters.minAuthenticityScore ?? 0
  const maxAuth = filters.maxAuthenticityScore ?? 1
  const hideSpam = filters.includeSuspectedSpam === false

  const toggleSource = (src: ReviewSource) => {
    const next = activeSources.includes(src)
      ? activeSources.filter((s) => s !== src)
      : [...activeSources, src]
    onChange({ ...filters, sources: next.length === ALL_SOURCES.length ? undefined : next })
  }

  const toggleSentiment = (sent: SentimentLabel) => {
    const next = activeSentiments.includes(sent)
      ? activeSentiments.filter((s) => s !== sent)
      : [...activeSentiments, sent]
    onChange({ ...filters, sentiments: next.length === ALL_SENTIMENTS.length ? undefined : next })
  }

  const handleReset = () => {
    onChange({})
  }

  const inputClass = `
    bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200
    focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-40 w-full
  `

  return (
    <aside className="bg-slate-800 h-full overflow-y-auto flex flex-col" style={{ width: '220px', minWidth: '220px' }}>
      <div className="px-3 py-2 border-b border-slate-700">
        <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Filters</h2>
      </div>

      <div className={`flex-1 px-3 py-3 space-y-4 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>

        {/* Sources */}
        <section>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Source</p>
          <p className="text-xs text-slate-600 mb-0.5">— International —</p>
          <div className="space-y-1 mb-2">
            {INTERNATIONAL_SOURCES.map((src) => (
              <label key={src} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeSources.includes(src)}
                  onChange={() => toggleSource(src)}
                  className="accent-blue-500"
                />
                <span className="text-xs text-slate-300 capitalize">{src}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-600 mb-0.5">— Domestic CN —</p>
          <div className="space-y-1">
            {DOMESTIC_SOURCES.map((src) => (
              <label key={src} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeSources.includes(src)}
                  onChange={() => toggleSource(src)}
                  className="accent-blue-500"
                />
                <span className="text-xs text-slate-300 capitalize">{src}</span>
              </label>
            ))}
          </div>
        </section>

        <hr className="border-slate-700" />

        {/* Sentiment */}
        <section>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Sentiment</p>
          <div className="space-y-1">
            {ALL_SENTIMENTS.map((sent) => (
              <label key={sent} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeSentiments.includes(sent)}
                  onChange={() => toggleSentiment(sent)}
                  className="accent-blue-500"
                />
                <span className={`text-xs capitalize ${SENTIMENT_COLORS[sent]}`}>{sent}</span>
              </label>
            ))}
          </div>
        </section>

        <hr className="border-slate-700" />

        {/* Authenticity */}
        <section>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Authenticity Score
          </p>
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <p className="text-xs text-slate-500 mb-0.5">Min</p>
              <input
                type="number"
                value={minAuth}
                min={0}
                max={1}
                step={0.1}
                onChange={(e) => onChange({ ...filters, minAuthenticityScore: parseFloat(e.target.value) || 0 })}
                className={inputClass}
              />
            </div>
            <div className="flex-1">
              <p className="text-xs text-slate-500 mb-0.5">Max</p>
              <input
                type="number"
                value={maxAuth}
                min={0}
                max={1}
                step={0.1}
                onChange={(e) => onChange({ ...filters, maxAuthenticityScore: parseFloat(e.target.value) || 1 })}
                className={inputClass}
              />
            </div>
          </div>
          <div className="mt-1.5 h-1.5 rounded bg-slate-700 relative overflow-hidden">
            <div
              className="absolute h-full bg-blue-500 rounded"
              style={{ left: `${minAuth * 100}%`, right: `${(1 - maxAuth) * 100}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">{minAuth.toFixed(1)} – {maxAuth.toFixed(1)}</p>
        </section>

        <hr className="border-slate-700" />

        {/* Spam/bot */}
        <section>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Spam / Bot</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hideSpam}
              onChange={(e) => onChange({ ...filters, includeSuspectedSpam: e.target.checked ? false : undefined })}
              className="accent-blue-500"
            />
            <span className="text-xs text-slate-300">Hide suspected spam/bots</span>
          </label>
        </section>

        <hr className="border-slate-700" />

        {/* Date range */}
        <section>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Date Range</p>
          <div className="space-y-1.5">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">From</p>
              <input
                type="date"
                value={filters.dateFrom ?? ''}
                onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || undefined })}
                className={inputClass}
              />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">To</p>
              <input
                type="date"
                value={filters.dateTo ?? ''}
                onChange={(e) => onChange({ ...filters, dateTo: e.target.value || undefined })}
                className={inputClass}
              />
            </div>
          </div>
        </section>
      </div>

      {/* Reset */}
      <div className="px-3 py-3 border-t border-slate-700">
        <button
          onClick={handleReset}
          disabled={disabled}
          className="w-full text-xs text-slate-400 hover:text-slate-200 border border-slate-600 hover:border-slate-400 rounded py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Reset filters
        </button>
      </div>
    </aside>
  )
}
