import { randomUUID } from 'crypto'
import { getDb } from './database'
import type {
  SearchJob,
  JobStatus,
  NormalizedReview,
  SearchFilters,
  AnalysisResult,
  LLMAnalysis,
  Project
} from '../types/index'

// --- Search Jobs ---

export function createJob(job: SearchJob): void {
  const db = getDb()
  db.prepare(`
    INSERT INTO search_jobs
      (id, product_query, sources, status, total_reviews, valid_reviews,
       suspected_ad_bot_count, created_at, completed_at, error, options)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    job.id,
    job.productQuery,
    JSON.stringify(job.sources),
    job.status,
    job.totalReviews,
    job.validReviews,
    job.suspectedAdBotCount,
    job.createdAt,
    job.completedAt ?? null,
    job.error ?? null,
    JSON.stringify(job.options)
  )
}

export function updateJobStatus(
  id: string,
  status: JobStatus,
  extras?: {
    completedAt?: string
    error?: string
    totalReviews?: number
    validReviews?: number
    suspectedAdBotCount?: number
  }
): void {
  const db = getDb()
  db.prepare(`
    UPDATE search_jobs SET
      status = ?,
      completed_at = COALESCE(?, completed_at),
      error = COALESCE(?, error),
      total_reviews = COALESCE(?, total_reviews),
      valid_reviews = COALESCE(?, valid_reviews),
      suspected_ad_bot_count = COALESCE(?, suspected_ad_bot_count)
    WHERE id = ?
  `).run(
    status,
    extras?.completedAt ?? null,
    extras?.error ?? null,
    extras?.totalReviews ?? null,
    extras?.validReviews ?? null,
    extras?.suspectedAdBotCount ?? null,
    id
  )
}

function rowToJob(row: Record<string, unknown>): SearchJob {
  return {
    id: row.id as string,
    productQuery: row.product_query as string,
    sources: JSON.parse(row.sources as string),
    status: row.status as JobStatus,
    totalReviews: row.total_reviews as number,
    validReviews: row.valid_reviews as number,
    suspectedAdBotCount: row.suspected_ad_bot_count as number,
    createdAt: row.created_at as string,
    completedAt: row.completed_at as string | undefined,
    error: row.error as string | undefined,
    options: JSON.parse(row.options as string)
  }
}

export function getJob(id: string): SearchJob | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM search_jobs WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return row ? rowToJob(row) : null
}

export function getAllJobs(): SearchJob[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM search_jobs ORDER BY created_at DESC').all() as Record<string, unknown>[]
  return rows.map(rowToJob)
}

// --- Normalized Reviews ---

function rowToReview(row: Record<string, unknown>): NormalizedReview {
  return {
    id: row.id as string,
    jobId: row.job_id as string,
    productQuery: row.product_query as string,
    source: row.source as NormalizedReview['source'],
    sourceType: row.source_type as NormalizedReview['sourceType'],
    sourceUrl: row.source_url as string,
    title: row.title as string,
    content: row.content as string,
    ratingRaw: row.rating_raw as number | undefined,
    sentiment: row.sentiment as NormalizedReview['sentiment'],
    language: row.language as string,
    authorName: row.author_name as string,
    authorId: row.author_id as string | undefined,
    authorProfileUrl: row.author_profile_url as string | undefined,
    authorMeta: row.author_meta ? JSON.parse(row.author_meta as string) : {},
    createdAt: row.created_at as string,
    likeCount: row.like_count as number,
    replyCount: row.reply_count as number,
    rawMetadata: row.raw_metadata ? JSON.parse(row.raw_metadata as string) : {},
    spamScore: row.spam_score as number,
    botScore: row.bot_score as number,
    authenticityScore: row.authenticity_score as number,
    authenticityReason: row.authenticity_reason as string,
    dedupeHash: row.dedupe_hash as string,
    fetchedAt: row.fetched_at as string,
    matchedRules: row.matched_rules ? JSON.parse(row.matched_rules as string) : [],
    llmAnalysis: row.llm_analysis ? JSON.parse(row.llm_analysis as string) : undefined,
    isFiltered: (row.is_filtered as number) === 1
  }
}

export function insertReviews(reviews: NormalizedReview[]): void {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO normalized_reviews
      (id, job_id, product_query, source, source_type, source_url, title, content,
       rating_raw, sentiment, language, author_name, author_id, author_profile_url,
       author_meta, created_at, like_count, reply_count, raw_metadata, spam_score,
       bot_score, authenticity_score, authenticity_reason, dedupe_hash, fetched_at,
       matched_rules, llm_analysis, is_filtered)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  // Wrap in a transaction for bulk-insert performance
  const insertMany = db.transaction((items: NormalizedReview[]) => {
    for (const r of items) {
      stmt.run(
        r.id, r.jobId, r.productQuery, r.source, r.sourceType, r.sourceUrl,
        r.title, r.content, r.ratingRaw ?? null, r.sentiment, r.language,
        r.authorName, r.authorId ?? null, r.authorProfileUrl ?? null,
        JSON.stringify(r.authorMeta ?? {}),
        r.createdAt, r.likeCount, r.replyCount,
        JSON.stringify(r.rawMetadata ?? {}),
        r.spamScore, r.botScore, r.authenticityScore, r.authenticityReason,
        r.dedupeHash, r.fetchedAt,
        JSON.stringify(r.matchedRules ?? []),
        r.llmAnalysis ? JSON.stringify(r.llmAnalysis) : null,
        r.isFiltered ? 1 : 0
      )
    }
  })

  insertMany(reviews)
}

export function getReviews(jobId: string, filters?: SearchFilters): NormalizedReview[] {
  const db = getDb()
  const conditions: string[] = ['job_id = ?']
  const params: unknown[] = [jobId]

  if (filters) {
    if (filters.sources && filters.sources.length > 0) {
      conditions.push(`source IN (${filters.sources.map(() => '?').join(',')})`)
      params.push(...filters.sources)
    }
    if (filters.languages && filters.languages.length > 0) {
      conditions.push(`language IN (${filters.languages.map(() => '?').join(',')})`)
      params.push(...filters.languages)
    }
    if (filters.sentiments && filters.sentiments.length > 0) {
      conditions.push(`sentiment IN (${filters.sentiments.map(() => '?').join(',')})`)
      params.push(...filters.sentiments)
    }
    if (filters.minAuthenticityScore !== undefined) {
      conditions.push('authenticity_score >= ?')
      params.push(filters.minAuthenticityScore)
    }
    if (filters.maxAuthenticityScore !== undefined) {
      conditions.push('authenticity_score <= ?')
      params.push(filters.maxAuthenticityScore)
    }
    if (!filters.includeSuspectedSpam) {
      // Exclude filtered rows by default unless caller explicitly wants them
      conditions.push('is_filtered = 0')
    }
    if (filters.dateFrom) {
      conditions.push('created_at >= ?')
      params.push(filters.dateFrom)
    }
    if (filters.dateTo) {
      conditions.push('created_at <= ?')
      params.push(filters.dateTo)
    }
  }

  const sql = `SELECT * FROM normalized_reviews WHERE ${conditions.join(' AND ')} ORDER BY like_count DESC`
  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]
  return rows.map(rowToReview)
}

export function reviewHashExists(dedupeHash: string, jobId: string): boolean {
  const db = getDb()
  const row = db.prepare(
    'SELECT 1 FROM normalized_reviews WHERE dedupe_hash = ? AND job_id = ? LIMIT 1'
  ).get(dedupeHash, jobId)
  return !!row
}

// --- Analysis Results ---

export function saveAnalysis(result: AnalysisResult): void {
  const db = getDb()
  db.prepare(`
    INSERT OR REPLACE INTO analysis_results (job_id, data, generated_at)
    VALUES (?, ?, ?)
  `).run(result.jobId, JSON.stringify(result), result.generatedAt)
}

export function getAnalysis(jobId: string): AnalysisResult | null {
  const db = getDb()
  const row = db.prepare('SELECT data FROM analysis_results WHERE job_id = ?').get(jobId) as { data: string } | undefined
  return row ? JSON.parse(row.data) : null
}

// --- LLM Cache ---

export function getCachedLLM(key: string): LLMAnalysis | null {
  const db = getDb()
  const row = db.prepare('SELECT result FROM llm_cache WHERE cache_key = ?').get(key) as { result: string } | undefined
  return row ? JSON.parse(row.result) : null
}

export function setCachedLLM(key: string, result: LLMAnalysis): void {
  const db = getDb()
  db.prepare(`
    INSERT OR REPLACE INTO llm_cache (cache_key, result, created_at)
    VALUES (?, ?, ?)
  `).run(key, JSON.stringify(result), new Date().toISOString())
}

// --- Projects ---

function buildProject(
  row: Record<string, unknown>,
  jobIds: string[],
  totalReviews: number,
  validReviews: number,
  lastSearchAt: string
): Project {
  return {
    id: row.id as string,
    name: row.name as string,
    productQuery: row.product_query as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    jobIds,
    totalReviews,
    validReviews,
    lastSearchAt,
  }
}

export function createProject(project: Project): void {
  const db = getDb()
  db.prepare(`
    INSERT OR IGNORE INTO projects (id, name, product_query, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(project.id, project.name, project.productQuery, project.createdAt, project.updatedAt)
}

export function getAllProjects(): Project[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() as Record<string, unknown>[]

  return rows.map((row) => {
    const jobRows = db
      .prepare('SELECT job_id FROM project_jobs WHERE project_id = ? ORDER BY added_at DESC')
      .all(row.id as string) as Record<string, unknown>[]
    const jobIds = jobRows.map((r) => r.job_id as string)

    let totalReviews = 0
    let validReviews = 0
    let lastSearchAt = row.updated_at as string

    if (jobIds.length > 0) {
      const placeholders = jobIds.map(() => '?').join(',')
      const stats = db
        .prepare(
          `SELECT COUNT(*) as total,
                  SUM(CASE WHEN is_filtered = 0 THEN 1 ELSE 0 END) as valid,
                  MAX(fetched_at) as last_at
           FROM normalized_reviews
           WHERE job_id IN (${placeholders})`
        )
        .get(...jobIds) as Record<string, unknown> | undefined

      if (stats) {
        totalReviews = (stats.total as number) ?? 0
        validReviews = (stats.valid as number) ?? 0
        lastSearchAt = (stats.last_at as string) ?? lastSearchAt
      }
    }

    return buildProject(row, jobIds, totalReviews, validReviews, lastSearchAt)
  })
}

export function getProject(id: string): Project | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!row) return null

  const jobRows = db
    .prepare('SELECT job_id FROM project_jobs WHERE project_id = ? ORDER BY added_at DESC')
    .all(id) as Record<string, unknown>[]
  const jobIds = jobRows.map((r) => r.job_id as string)

  let totalReviews = 0
  let validReviews = 0
  let lastSearchAt = row.updated_at as string

  if (jobIds.length > 0) {
    const placeholders = jobIds.map(() => '?').join(',')
    const stats = db
      .prepare(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN is_filtered = 0 THEN 1 ELSE 0 END) as valid,
                MAX(fetched_at) as last_at
         FROM normalized_reviews
         WHERE job_id IN (${placeholders})`
      )
      .get(...jobIds) as Record<string, unknown> | undefined

    if (stats) {
      totalReviews = (stats.total as number) ?? 0
      validReviews = (stats.valid as number) ?? 0
      lastSearchAt = (stats.last_at as string) ?? lastSearchAt
    }
  }

  return buildProject(row, jobIds, totalReviews, validReviews, lastSearchAt)
}

export function findProjectByQuery(query: string): Project | null {
  const db = getDb()
  const row = db
    .prepare('SELECT * FROM projects WHERE LOWER(product_query) = LOWER(?)')
    .get(query) as Record<string, unknown> | undefined
  if (!row) return null
  return getProject(row.id as string)
}

export function updateProjectUpdatedAt(id: string): void {
  const db = getDb()
  db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), id)
}

export function renameProject(id: string, name: string): void {
  const db = getDb()
  db.prepare('UPDATE projects SET name = ?, updated_at = ? WHERE id = ?').run(
    name,
    new Date().toISOString(),
    id
  )
}

export function deleteReview(id: string): void {
  getDb().prepare('DELETE FROM normalized_reviews WHERE id = ?').run(id)
}

export function deleteProject(id: string): void {
  const db = getDb()
  const doDelete = db.transaction(() => {
    db.prepare('DELETE FROM projects WHERE id = ?').run(id)
    db.prepare('DELETE FROM project_jobs WHERE project_id = ?').run(id)
  })
  doDelete()
}

export function addJobToProject(projectId: string, jobId: string): void {
  const db = getDb()
  db.prepare(`
    INSERT OR IGNORE INTO project_jobs (project_id, job_id, added_at)
    VALUES (?, ?, ?)
  `).run(projectId, jobId, new Date().toISOString())
}

export function getProjectReviews(projectId: string, filters?: SearchFilters): NormalizedReview[] {
  const db = getDb()
  const jobRows = db
    .prepare('SELECT job_id FROM project_jobs WHERE project_id = ? ORDER BY added_at DESC')
    .all(projectId) as Record<string, unknown>[]
  const jobIds = jobRows.map((r) => r.job_id as string)

  if (jobIds.length === 0) return []

  const allReviews: NormalizedReview[] = []
  for (const jobId of jobIds) {
    const reviews = getReviews(jobId, filters)
    allReviews.push(...reviews)
  }

  // Deduplicate by dedupeHash — keep first occurrence (newest job first due to added_at DESC)
  const seen = new Set<string>()
  const deduped: NormalizedReview[] = []
  for (const review of allReviews) {
    if (!seen.has(review.dedupeHash)) {
      seen.add(review.dedupeHash)
      deduped.push(review)
    }
  }

  return deduped
}

export function mergeJobsIntoProject(
  name: string,
  jobIds: string[],
  productQuery: string
): Project {
  const now = new Date().toISOString()
  const project: Project = {
    id: randomUUID(),
    name,
    productQuery,
    createdAt: now,
    updatedAt: now,
    jobIds: [],
    totalReviews: 0,
    validReviews: 0,
    lastSearchAt: now,
  }

  createProject(project)
  for (const jobId of jobIds) {
    addJobToProject(project.id, jobId)
  }

  // Return the project with computed stats
  return getProject(project.id) ?? project
}
