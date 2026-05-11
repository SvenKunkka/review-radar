import React, { useState } from 'react'

type ReviewSource = 'reddit' | 'youtube' | 'trustpilot' | 'bilibili' | 'zhihu' | 'tieba' | 'nga'

interface SearchOptions {
  productQuery: string
  sources: ReviewSource[]
  maxResults?: number
  deepAnalysis?: boolean
}

interface SearchBarProps {
  onSearch: (options: SearchOptions) => void
  isSearching: boolean
}

const INTERNATIONAL_SOURCES: ReviewSource[] = ['reddit', 'youtube', 'trustpilot']
const DOMESTIC_SOURCES: ReviewSource[] = ['bilibili', 'zhihu', 'tieba', 'nga']
const ALL_SOURCES: ReviewSource[] = [...INTERNATIONAL_SOURCES, ...DOMESTIC_SOURCES]

const SOURCE_DISPLAY_NAMES: Record<ReviewSource, string> = {
  reddit: 'Reddit',
  youtube: 'YouTube',
  trustpilot: 'Trustpilot',
  bilibili: 'Bilibili',
  zhihu: 'Zhihu',
  tieba: 'Tieba',
  nga: 'NGA',
}

export default function SearchBar({ onSearch, isSearching }: SearchBarProps) {
  const [productQuery, setProductQuery] = useState('')
  const [sources, setSources] = useState<Set<ReviewSource>>(new Set(ALL_SOURCES))
  const [maxResults, setMaxResults] = useState(50)
  const [deepAnalysis, setDeepAnalysis] = useState(false)
  const [error, setError] = useState('')

  const toggleSource = (source: ReviewSource) => {
    setSources((prev) => {
      const next = new Set(prev)
      if (next.has(source)) next.delete(source)
      else next.add(source)
      return next
    })
  }

  const handleSearch = () => {
    const trimmed = productQuery.trim()
    if (!trimmed) { setError('Product name is required.'); return }
    if (sources.size === 0) { setError('Select at least one source.'); return }
    setError('')
    onSearch({ productQuery: trimmed, sources: Array.from(sources), maxResults, deepAnalysis })
  }

  const isChinese = productQuery ? /[一-鿿]/.test(productQuery) : null

  return (
    <div className="bg-white border-b border-slate-200 px-4 pt-3 pb-2.5 flex-shrink-0">

      {/* Row 1: input + badge + search button */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className="flex-1 relative">
          <input
            type="text"
            value={productQuery}
            onChange={(e) => { setProductQuery(e.target.value); setError('') }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
            placeholder="Enter product name — English or Chinese, e.g.  Razer Viper V4 Pro  /  罗技G502 X"
            className="w-full border border-slate-300 rounded-md px-3.5 py-2 pr-20 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400"
            disabled={isSearching}
          />
          {isChinese !== null && (
            <span
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 pointer-events-none select-none font-medium"
              title={isChinese
                ? 'Chinese input — domestic platforms searched directly; Ollama generates localized English terms for Reddit/YouTube/Trustpilot'
                : 'English input — international platforms searched directly; Ollama generates localized Chinese terms for Bilibili/Zhihu/Tieba/NGA (e.g. Razer→雷蛇)'}
            >
              {isChinese ? '中 → EN' : 'EN → 中'}
            </span>
          )}
          {error && <p className="absolute left-0 top-full text-red-500 text-xs mt-1">{error}</p>}
        </div>

        <button
          onClick={handleSearch}
          disabled={isSearching}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold px-6 py-2 rounded-md transition-colors flex-shrink-0 whitespace-nowrap"
        >
          {isSearching ? 'Searching…' : 'Search'}
        </button>
      </div>

      {/* Row 2: sources + controls */}
      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs">

        {/* International sources */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-semibold uppercase tracking-wide text-[10px]">International</span>
          {INTERNATIONAL_SOURCES.map((src) => (
            <label key={src} className="flex items-center gap-1 cursor-pointer select-none text-slate-600 hover:text-slate-900">
              <input
                type="checkbox"
                checked={sources.has(src)}
                onChange={() => toggleSource(src)}
                disabled={isSearching}
                className="accent-blue-600"
              />
              {SOURCE_DISPLAY_NAMES[src]}
            </label>
          ))}
        </div>

        <div className="w-px h-4 bg-slate-200 flex-shrink-0" />

        {/* Domestic CN sources */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-semibold uppercase tracking-wide text-[10px]">Domestic CN</span>
          {DOMESTIC_SOURCES.map((src) => (
            <label key={src} className="flex items-center gap-1 cursor-pointer select-none text-slate-600 hover:text-slate-900">
              <input
                type="checkbox"
                checked={sources.has(src)}
                onChange={() => toggleSource(src)}
                disabled={isSearching}
                className="accent-blue-600"
              />
              {SOURCE_DISPLAY_NAMES[src]}
            </label>
          ))}
        </div>

        <div className="flex-1" />

        {/* Max results */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-slate-500 font-medium">Max</span>
          <input
            type="number"
            value={maxResults}
            onChange={(e) => setMaxResults(Math.max(1, parseInt(e.target.value) || 1))}
            disabled={isSearching}
            className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-16 text-center"
            min={1}
            max={500}
          />
        </div>

        {/* Deep analysis */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none flex-shrink-0 text-slate-600">
          <input
            type="checkbox"
            checked={deepAnalysis}
            onChange={(e) => setDeepAnalysis(e.target.checked)}
            disabled={isSearching}
            className="accent-blue-600"
          />
          <span className="font-medium">Deep analysis</span>
        </label>
      </div>
    </div>
  )
}
