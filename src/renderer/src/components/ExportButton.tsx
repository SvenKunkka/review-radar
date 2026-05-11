import React, { useState, useRef, useEffect } from 'react'

type ReviewSource = 'reddit' | 'youtube' | 'trustpilot'
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

interface ExportButtonProps {
  jobId: string | null
  filters?: SearchFilters
}

type ExportFormat = 'json' | 'csv' | 'html'

export default function ExportButton({ jobId, filters }: ExportButtonProps) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!status) return
    const timer = setTimeout(() => setStatus(null), 4000)
    return () => clearTimeout(timer)
  }, [status])

  const handleExport = async (format: ExportFormat) => {
    setOpen(false)
    if (!jobId) return
    try {
      const result = await window.electronAPI.exportResults({ format, jobId, filters })
      if (result.success) {
        setStatus({ type: 'success', message: `Saved to: ${result.path ?? 'file'}` })
      } else {
        setStatus({ type: 'error', message: result.error ?? 'Export failed.' })
      }
    } catch (err) {
      setStatus({ type: 'error', message: String(err) })
    }
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={!jobId}
        className="flex items-center gap-1 text-xs border border-slate-300 rounded px-2.5 py-1.5 text-slate-600 hover:border-slate-400 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors bg-white"
      >
        Export
        <span className="text-slate-400">&#9660;</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded shadow-lg z-50 min-w-[130px]">
          <button
            onClick={() => handleExport('json')}
            className="w-full text-left text-xs px-3 py-2 hover:bg-slate-50 text-slate-700 transition-colors"
          >
            Export JSON
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="w-full text-left text-xs px-3 py-2 hover:bg-slate-50 text-slate-700 transition-colors border-t border-slate-100"
          >
            Export CSV
          </button>
          <button
            onClick={() => handleExport('html')}
            className="w-full text-left text-xs px-3 py-2 hover:bg-slate-50 text-slate-700 transition-colors border-t border-slate-100"
          >
            Export Report (HTML)
          </button>
        </div>
      )}

      {status && (
        <div
          className={`absolute right-0 top-full mt-1 text-xs rounded px-3 py-2 shadow z-50 max-w-xs whitespace-nowrap ${
            status.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {status.message}
        </div>
      )}
    </div>
  )
}
