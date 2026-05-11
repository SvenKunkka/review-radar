import React, { useRef, useEffect, useState } from 'react'
import { useSearch } from './hooks/useSearch'
import SearchBar from './components/SearchBar'
import FilterPanel from './components/FilterPanel'
import ProjectPanel from './components/ProjectPanel'
import ReviewList from './components/ReviewList'
import AnalysisView from './components/AnalysisView'
import DebugPanel from './components/DebugPanel'
import ExportButton from './components/ExportButton'

// ---------------------------------------------------------------------------
// Type declarations for window.electronAPI
// ---------------------------------------------------------------------------
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
}

interface SearchOptions {
  productQuery: string
  sources: ReviewSource[]
  maxResults?: number
  deepAnalysis?: boolean
}

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

interface SearchProgress {
  jobId: string
  stage: string
  message: string
  current?: number
  total?: number
}

interface ExportOptions {
  format: 'json' | 'csv'
  jobId: string
  filters?: SearchFilters
}

interface Project {
  id: string
  name: string
  productQuery: string
  createdAt: string
  updatedAt: string
  jobIds: string[]
  totalReviews: number
  validReviews: number
  lastSearchAt: string
}

interface ElectronAPI {
  startSearch: (options: SearchOptions) => Promise<SearchJob>
  getJobs: () => Promise<SearchJob[]>
  getReviews: (jobId: string, filters?: SearchFilters) => Promise<NormalizedReview[]>
  getAnalysis: (jobId: string) => Promise<AnalysisResult | null>
  exportResults: (options: ExportOptions) => Promise<{ success: boolean; path?: string; error?: string }>
  onProgress: (callback: (progress: SearchProgress) => void) => () => void
  // Project methods
  getProjects: () => Promise<Project[]>
  getProjectReviews: (projectId: string, filters?: SearchFilters) => Promise<NormalizedReview[]>
  searchProject: (projectId: string) => Promise<SearchJob>
  mergeIntoProject: (opts: { name: string; jobIds: string[]; productQuery: string }) => Promise<Project>
  renameProject: (id: string, name: string) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  deleteReview: (id: string) => Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

// ---------------------------------------------------------------------------
// Status badge for the job status indicator
// ---------------------------------------------------------------------------
const STATUS_STYLES: Record<JobStatus, string> = {
  pending: 'bg-slate-400',
  running: 'bg-blue-500 animate-pulse',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
}

function JobStatusDot({ status }: { status: JobStatus }) {
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_STYLES[status]}`}
      title={status}
    />
  )
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------
function ProgressBar({ messages }: { messages: SearchProgress[] }) {
  const latest = messages[messages.length - 1]
  const pct =
    latest?.current !== undefined && latest?.total
      ? Math.round((latest.current / latest.total) * 100)
      : null

  return (
    <div className="bg-blue-50 border-b border-blue-100 px-4 py-1.5 flex items-center gap-3">
      <div className="flex-1 h-1 bg-blue-200 rounded overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-300 rounded"
          style={{ width: pct !== null ? `${pct}%` : '100%' }}
        />
      </div>
      <span className="text-xs text-blue-600 flex-shrink-0 truncate max-w-xs">
        {latest ? `[${latest.stage}] ${latest.message}` : 'Starting...'}
      </span>
      {pct !== null && (
        <span className="text-xs text-blue-500 flex-shrink-0">{pct}%</span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Job history dropdown
// ---------------------------------------------------------------------------
interface JobHistoryDropdownProps {
  jobs: SearchJob[]
  activeJob: SearchJob | null
  onSelect: (job: SearchJob) => void
}

function JobHistoryDropdown({ jobs, activeJob, onSelect }: JobHistoryDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (jobs.length === 0) return null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white border border-slate-600 hover:border-slate-400 rounded px-2.5 py-1 transition-colors"
      >
        {activeJob ? (
          <>
            <JobStatusDot status={activeJob.status} />
            <span className="truncate max-w-[180px]">{activeJob.productQuery}</span>
          </>
        ) : (
          <span>Job history</span>
        )}
        <span className="text-slate-500 ml-0.5">&#9660;</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded shadow-xl z-50 min-w-[260px] max-h-64 overflow-y-auto">
          {jobs.map((job) => (
            <button
              key={job.id}
              onClick={() => { onSelect(job); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-700 transition-colors flex items-center gap-2 ${
                activeJob?.id === job.id ? 'bg-slate-700' : ''
              }`}
            >
              <JobStatusDot status={job.status} />
              <span className="flex-1 text-slate-200 truncate">{job.productQuery}</span>
              <span className="text-slate-500 flex-shrink-0">{job.totalReviews} rev</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------
const TABS = [
  { key: 'reviews' as const, label: 'Reviews' },
  { key: 'analysis' as const, label: 'Analysis' },
  { key: 'debug' as const, label: 'Debug' },
]

// ---------------------------------------------------------------------------
// Root App
// ---------------------------------------------------------------------------
const isMac = navigator.userAgent.includes('Macintosh')

export default function App() {
  const {
    activeJob,
    reviews,
    analysis,
    isSearching,
    progressMessages,
    jobs,
    filters,
    setFilters,
    runSearch,
    selectJob,
    activeTab,
    setActiveTab,
    projects,
    activeProject,
    selectProject,
    refreshProject,
    mergeIntoProject,
    renameProject,
    deleteProject,
    deleteReview,
  } = useSearch()

  const [sidebarTab, setSidebarTab] = useState<'projects' | 'filters'>('projects')

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100">

      {/* Header bar */}
      <header
        className="flex items-center justify-between bg-slate-900 flex-shrink-0"
        style={{ height: '48px', paddingLeft: isMac ? '80px' : '16px', paddingRight: '16px', WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold text-sm tracking-tight">Review Radar</span>
          {activeJob && (
            <span className="text-slate-500 text-xs truncate max-w-[200px]">/ {activeJob.productQuery}</span>
          )}
          {activeProject && !activeJob && (
            <span className="text-slate-500 text-xs truncate max-w-[200px]">/ {activeProject.name}</span>
          )}
        </div>
        <div
          className="flex items-center gap-3"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <ExportButton jobId={activeJob?.id ?? null} filters={filters} />
          <JobHistoryDropdown jobs={jobs} activeJob={activeJob} onSelect={selectJob} />
        </div>
      </header>

      {/* Search bar */}
      <SearchBar onSearch={runSearch} isSearching={isSearching} />

      {/* Progress bar (shown while searching) */}
      {isSearching && <ProgressBar messages={progressMessages} />}

      {/* Main 2-column layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar: projects + filter panel with tab toggle */}
        <aside className="w-[220px] flex-shrink-0 flex flex-col bg-slate-800 border-r border-slate-700 overflow-hidden">
          {/* Tab toggle */}
          <div className="flex border-b border-slate-700 flex-shrink-0">
            {(['projects', 'filters'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setSidebarTab(tab)}
                className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  sidebarTab === tab
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {sidebarTab === 'projects' ? (
              <ProjectPanel
                projects={projects}
                activeProjectId={activeProject?.id ?? null}
                isSearching={isSearching}
                allJobs={jobs}
                onSelectProject={selectProject}
                onRefreshProject={refreshProject}
                onRenameProject={renameProject}
                onDeleteProject={deleteProject}
                onMergeIntoProject={mergeIntoProject}
              />
            ) : (
              <FilterPanel
                filters={filters}
                onChange={setFilters}
                disabled={activeJob === null}
              />
            )}
          </div>
        </aside>

        {/* Right: tab content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center border-b border-slate-200 bg-white px-3 flex-shrink-0">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
                {tab.key === 'reviews' && reviews.length > 0 && (
                  <span className="ml-1.5 text-xs text-slate-400">({reviews.length})</span>
                )}
              </button>
            ))}

            {/* Active job status pill */}
            {activeJob && (
              <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-500 pr-1">
                <JobStatusDot status={activeJob.status} />
                <span className="capitalize">{activeJob.status}</span>
                {activeJob.status === 'completed' && activeJob.completedAt && (
                  <span className="text-slate-400">
                    &middot; {new Date(activeJob.completedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'reviews' && (
              <ReviewList reviews={reviews} isLoading={isSearching && reviews.length === 0} onDeleteReview={deleteReview} />
            )}
            {activeTab === 'analysis' && (
              <AnalysisView analysis={analysis} isLoading={isSearching && analysis === null} />
            )}
            {activeTab === 'debug' && (
              <DebugPanel
                progressMessages={progressMessages}
                activeJob={activeJob}
                reviews={reviews}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
