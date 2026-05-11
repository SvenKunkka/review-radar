import { useState, useEffect, useCallback } from 'react'

type ReviewSource = 'reddit' | 'youtube' | 'trustpilot' | 'bilibili' | 'zhihu' | 'tieba' | 'nga'
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

// ---------------------------------------------------------------------------
// Extend the ElectronAPI type declaration to include project methods
// ---------------------------------------------------------------------------
declare global {
  interface Window {
    electronAPI: {
      startSearch: (options: SearchOptions) => Promise<SearchJob>
      getJobs: () => Promise<SearchJob[]>
      getReviews: (jobId: string, filters?: SearchFilters) => Promise<NormalizedReview[]>
      getAnalysis: (jobId: string) => Promise<AnalysisResult | null>
      exportResults: (options: { format: 'json' | 'csv'; jobId: string; filters?: SearchFilters }) => Promise<{ success: boolean; path?: string; error?: string }>
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
  }
}

export function useSearch(): {
  activeJob: SearchJob | null
  reviews: NormalizedReview[]
  analysis: AnalysisResult | null
  isSearching: boolean
  progressMessages: SearchProgress[]
  jobs: SearchJob[]
  filters: SearchFilters
  setFilters: (f: SearchFilters) => void
  runSearch: (options: SearchOptions) => Promise<void>
  selectJob: (job: SearchJob) => Promise<void>
  activeTab: 'reviews' | 'analysis' | 'debug'
  setActiveTab: (tab: 'reviews' | 'analysis' | 'debug') => void
  projects: Project[]
  activeProject: Project | null
  selectProject: (project: Project) => Promise<void>
  refreshProject: (project: Project) => Promise<void>
  mergeIntoProject: (opts: { name: string; jobIds: string[]; productQuery: string }) => Promise<void>
  renameProject: (id: string, name: string) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  deleteReview: (id: string) => Promise<void>
} {
  const [activeJob, setActiveJob] = useState<SearchJob | null>(null)
  const [reviews, setReviews] = useState<NormalizedReview[]>([])
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [progressMessages, setProgressMessages] = useState<SearchProgress[]>([])
  const [jobs, setJobs] = useState<SearchJob[]>([])
  const [filters, setFiltersState] = useState<SearchFilters>({})
  const [activeTab, setActiveTab] = useState<'reviews' | 'analysis' | 'debug'>('reviews')
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProject, setActiveProject] = useState<Project | null>(null)

  const refreshProjects = useCallback(async () => {
    const p = await window.electronAPI.getProjects()
    setProjects(p)
  }, [])

  useEffect(() => {
    window.electronAPI.getJobs().then(setJobs).catch(console.error)
    refreshProjects().catch(console.error)
  }, [refreshProjects])

  const loadReviewsAndAnalysis = useCallback(async (jobId: string, currentFilters: SearchFilters) => {
    try {
      const [fetchedReviews, fetchedAnalysis] = await Promise.all([
        window.electronAPI.getReviews(jobId, currentFilters),
        window.electronAPI.getAnalysis(jobId),
      ])
      setReviews(fetchedReviews)
      setAnalysis(fetchedAnalysis)
    } catch (err) {
      console.error('Failed to load reviews/analysis:', err)
    }
  }, [])

  const runSearch = useCallback(async (options: SearchOptions) => {
    setIsSearching(true)
    setProgressMessages([])
    setReviews([])
    setAnalysis(null)

    const cleanup = window.electronAPI.onProgress((progress) => {
      setProgressMessages((prev) => [...prev, progress])
    })

    try {
      const job = await window.electronAPI.startSearch(options)
      setActiveJob(job)
      setJobs((prev) => [job, ...prev.filter((j) => j.id !== job.id)])
      await loadReviewsAndAnalysis(job.id, filters)
      // Refresh job status and projects after completion
      const [updatedJobs, updatedProjects] = await Promise.all([
        window.electronAPI.getJobs(),
        window.electronAPI.getProjects(),
      ])
      setJobs(updatedJobs)
      setProjects(updatedProjects)
      const updatedJob = updatedJobs.find((j) => j.id === job.id)
      if (updatedJob) setActiveJob(updatedJob)
      const proj = updatedProjects.find(
        p => p.productQuery.toLowerCase() === options.productQuery.toLowerCase()
      )
      if (proj) setActiveProject(proj)
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      cleanup()
      setIsSearching(false)
    }
  }, [filters, loadReviewsAndAnalysis])

  const setFilters = useCallback((newFilters: SearchFilters) => {
    setFiltersState(newFilters)
    if (activeJob) {
      window.electronAPI.getReviews(activeJob.id, newFilters)
        .then(setReviews)
        .catch(console.error)
    }
  }, [activeJob])

  const selectJob = useCallback(async (job: SearchJob) => {
    setActiveJob(job)
    setProgressMessages([])
    await loadReviewsAndAnalysis(job.id, filters)
  }, [filters, loadReviewsAndAnalysis])

  // View existing project data — no new search
  const selectProject = useCallback(async (project: Project) => {
    setActiveProject(project)
    setActiveJob(null)
    setProgressMessages([])
    try {
      const latestJobId = project.jobIds[0] ?? null
      const [fetchedReviews, fetchedAnalysis] = await Promise.all([
        window.electronAPI.getProjectReviews(project.id, filters),
        latestJobId ? window.electronAPI.getAnalysis(latestJobId) : Promise.resolve(null),
      ])
      setReviews(fetchedReviews)
      setAnalysis(fetchedAnalysis)
    } catch (err) {
      console.error('Failed to load project:', err)
    }
  }, [filters])

  // Fetch new reviews and append to the project
  const refreshProject = useCallback(async (project: Project) => {
    setActiveProject(project)
    setProgressMessages([])
    setIsSearching(true)
    const cleanup = window.electronAPI.onProgress(progress =>
      setProgressMessages(prev => [...prev, progress])
    )
    try {
      const job = await window.electronAPI.searchProject(project.id)
      setActiveJob(job)
      const [fetchedReviews, fetchedAnalysis, updatedProjects] = await Promise.all([
        window.electronAPI.getProjectReviews(project.id, filters),
        window.electronAPI.getAnalysis(job.id),
        window.electronAPI.getProjects(),
      ])
      setReviews(fetchedReviews)
      setAnalysis(fetchedAnalysis)
      setProjects(updatedProjects)
      const updated = updatedProjects.find(p => p.id === project.id)
      if (updated) setActiveProject(updated)
    } catch (err) {
      console.error('Project refresh failed:', err)
    } finally {
      cleanup()
      setIsSearching(false)
    }
  }, [filters])

  const mergeIntoProject = useCallback(async (opts: { name: string; jobIds: string[]; productQuery: string }) => {
    await window.electronAPI.mergeIntoProject(opts)
    await refreshProjects()
  }, [refreshProjects])

  const renameProject = useCallback(async (id: string, name: string) => {
    await window.electronAPI.renameProject(id, name)
    await refreshProjects()
  }, [refreshProjects])

  const deleteProject = useCallback(async (id: string) => {
    await window.electronAPI.deleteProject(id)
    setProjects(prev => prev.filter(p => p.id !== id))
    if (activeProject?.id === id) {
      setActiveProject(null)
      setReviews([])
      setAnalysis(null)
    }
  }, [activeProject])

  const deleteReview = useCallback(async (id: string) => {
    await window.electronAPI.deleteReview(id)
    setReviews(prev => prev.filter(r => r.id !== id))
  }, [])

  return {
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
  }
}
