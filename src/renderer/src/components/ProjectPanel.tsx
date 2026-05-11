import React, { useState, useRef, useEffect } from 'react'

type ReviewSource = 'reddit' | 'youtube' | 'trustpilot'
type JobStatus = 'pending' | 'running' | 'completed' | 'failed'

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

interface ProjectPanelProps {
  projects: Project[]
  activeProjectId: string | null
  isSearching: boolean
  allJobs: SearchJob[]
  onSelectProject: (project: Project) => void
  onRefreshProject: (project: Project) => void
  onRenameProject: (id: string, name: string) => void
  onDeleteProject: (id: string) => void
  onMergeIntoProject: (opts: { name: string; jobIds: string[]; productQuery: string }) => void
}

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ---------------------------------------------------------------------------
// Inline rename input
// ---------------------------------------------------------------------------
interface InlineRenameProps {
  initialValue: string
  onSave: (name: string) => void
  onCancel: () => void
}

function InlineRename({ initialValue, onSave, onCancel }: InlineRenameProps) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const commit = () => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== initialValue) {
      onSave(trimmed)
    } else {
      onCancel()
    }
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') onCancel()
      }}
      className="w-full bg-slate-600 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
      onClick={e => e.stopPropagation()}
    />
  )
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------
function Spinner() {
  return (
    <svg
      className="animate-spin w-3 h-3 text-blue-400 flex-shrink-0"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Merge panel
// ---------------------------------------------------------------------------
interface MergePanelProps {
  allJobs: SearchJob[]
  onMerge: (opts: { name: string; jobIds: string[]; productQuery: string }) => void
  onClose: () => void
}

function MergePanel({ allJobs, onMerge, onClose }: MergePanelProps) {
  const [name, setName] = useState('')
  const [checkedJobIds, setCheckedJobIds] = useState<Set<string>>(new Set())

  const sortedJobs = [...allJobs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const toggleJob = (id: string) => {
    setCheckedJobIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const canSubmit = name.trim().length > 0 && checkedJobIds.size >= 1

  const handleSubmit = () => {
    if (!canSubmit) return
    const selectedIds = [...checkedJobIds]
    const firstJob = sortedJobs.find(j => selectedIds.includes(j.id))
    onMerge({
      name: name.trim(),
      jobIds: selectedIds,
      productQuery: firstJob?.productQuery ?? '',
    })
    setName('')
    setCheckedJobIds(new Set())
    onClose()
  }

  return (
    <div className="border-t border-slate-700 bg-slate-850 flex flex-col" style={{ background: 'rgb(20 27 42)' }}>
      <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Merge into project</span>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-300 text-xs leading-none"
          aria-label="Close merge panel"
        >
          ✕
        </button>
      </div>

      <div className="px-3 py-2 space-y-3 flex-1 overflow-y-auto" style={{ maxHeight: '280px' }}>
        {/* Project name */}
        <div>
          <label className="text-xs text-slate-400 block mb-1">Project name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. MX Master Research"
            className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
          />
        </div>

        {/* Job checklist */}
        <div>
          <p className="text-xs text-slate-400 mb-1.5">All past searches</p>
          {sortedJobs.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No past searches available.</p>
          ) : (
            <div className="space-y-1">
              {sortedJobs.map(job => (
                <label
                  key={job.id}
                  className="flex items-start gap-2 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={checkedJobIds.has(job.id)}
                    onChange={() => toggleJob(job.id)}
                    className="mt-0.5 accent-blue-500 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-200 truncate">{job.productQuery}</p>
                    <p className="text-xs text-slate-500">
                      {relativeTime(job.createdAt)} &middot; {job.totalReviews} reviews
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-3 py-2 border-t border-slate-700">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full text-xs font-semibold rounded py-1.5 transition-colors bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Create Project
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProjectPanel
// ---------------------------------------------------------------------------
export default function ProjectPanel({
  projects,
  activeProjectId,
  isSearching,
  allJobs,
  onSelectProject,
  onRefreshProject,
  onRenameProject,
  onDeleteProject,
  onMergeIntoProject,
}: ProjectPanelProps) {
  const [showMerge, setShowMerge] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const handleDelete = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation()
    if (window.confirm(`Delete project "${project.name}"? This cannot be undone.`)) {
      onDeleteProject(project.id)
    }
  }

  const handleRenameClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setRenamingId(id)
  }

  const handleRenameSave = (id: string, name: string) => {
    onRenameProject(id, name)
    setRenamingId(null)
  }

  return (
    <div className="flex flex-col h-full bg-slate-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700 flex-shrink-0">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Projects</span>
        <button
          onClick={() => setShowMerge(v => !v)}
          className={`text-xs px-2 py-0.5 rounded transition-colors border ${
            showMerge
              ? 'border-blue-500 text-blue-400 bg-blue-500/10'
              : 'border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-400'
          }`}
          aria-label="Toggle merge panel"
        >
          &#8853; Merge
        </button>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-slate-500 leading-relaxed">
              No projects yet. Run a search to create one automatically.
            </p>
          </div>
        ) : (
          <div className="py-1">
            {projects.map(project => {
              const isActive = project.id === activeProjectId
              const isRenaming = renamingId === project.id
              const isHovered = hoveredId === project.id

              return (
                <div
                  key={project.id}
                  onClick={() => !isRenaming && onSelectProject(project)}
                  onMouseEnter={() => setHoveredId(project.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`px-3 py-2 cursor-pointer transition-colors relative ${
                    isActive ? 'bg-slate-700' : ''
                  }`}
                  style={!isActive && isHovered ? { background: 'rgba(51,65,85,0.6)' } : undefined}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !isRenaming) onSelectProject(project)
                  }}
                >
                  {/* Action buttons — absolutely positioned top-right, shown on hover */}
                  {!isRenaming && (isHovered || isActive) && (
                    <div className="absolute top-1.5 right-2 flex items-center gap-0.5 z-10">
                      <button
                        onClick={e => { e.stopPropagation(); onRefreshProject(project) }}
                        disabled={isActive && isSearching}
                        className="text-slate-400 hover:text-blue-400 text-base leading-none px-1.5 py-1 rounded hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="Fetch new reviews"
                        title="Fetch new reviews"
                      >
                        ↺
                      </button>
                      <button
                        onClick={e => handleRenameClick(e, project.id)}
                        className="text-slate-400 hover:text-slate-100 text-base leading-none px-1.5 py-1 rounded hover:bg-slate-600"
                        aria-label="Rename project"
                        title="Rename"
                      >
                        ✎
                      </button>
                      <button
                        onClick={e => handleDelete(e, project)}
                        className="text-slate-400 hover:text-red-400 text-base leading-none px-1.5 py-1 rounded hover:bg-slate-600"
                        aria-label="Delete project"
                        title="Delete"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  {/* Name + subtitle */}
                  <div className="min-w-0">
                    {isRenaming ? (
                      <InlineRename
                        initialValue={project.name}
                        onSave={name => handleRenameSave(project.id, name)}
                        onCancel={() => setRenamingId(null)}
                      />
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5 min-w-0 pr-20">
                          {isActive && isSearching && <Spinner />}
                          <p
                            className={`text-xs truncate leading-snug ${
                              isActive ? 'font-semibold text-white' : 'font-medium text-slate-200'
                            }`}
                          >
                            {project.name}
                          </p>
                        </div>
                        {project.name !== project.productQuery && (
                          <p className="text-xs text-slate-500 truncate mt-0.5 leading-snug pr-20">
                            {project.productQuery}
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Badge + time row */}
                  {!isRenaming && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center justify-center min-w-[28px] rounded-full bg-slate-700 border border-slate-600 px-1.5 py-0.5 text-xs text-slate-300 font-medium">
                        {project.totalReviews}
                      </span>
                      <span className="text-xs text-slate-500 whitespace-nowrap">
                        {relativeTime(project.lastSearchAt)}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Merge panel (collapsible) */}
      {showMerge && (
        <MergePanel
          allJobs={allJobs}
          onMerge={onMergeIntoProject}
          onClose={() => setShowMerge(false)}
        />
      )}
    </div>
  )
}
