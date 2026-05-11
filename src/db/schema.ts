import type Database from 'better-sqlite3'

export function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS search_jobs (
      id TEXT PRIMARY KEY,
      product_query TEXT NOT NULL,
      sources TEXT NOT NULL,
      status TEXT NOT NULL,
      total_reviews INTEGER DEFAULT 0,
      valid_reviews INTEGER DEFAULT 0,
      suspected_ad_bot_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      error TEXT,
      options TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS normalized_reviews (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      product_query TEXT NOT NULL,
      source TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_url TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      rating_raw REAL,
      sentiment TEXT DEFAULT 'unknown',
      language TEXT DEFAULT 'en',
      author_name TEXT NOT NULL,
      author_id TEXT,
      author_profile_url TEXT,
      author_meta TEXT,
      created_at TEXT NOT NULL,
      like_count INTEGER DEFAULT 0,
      reply_count INTEGER DEFAULT 0,
      raw_metadata TEXT NOT NULL,
      spam_score REAL DEFAULT 0,
      bot_score REAL DEFAULT 0,
      authenticity_score REAL DEFAULT 0.7,
      authenticity_reason TEXT DEFAULT '',
      dedupe_hash TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      matched_rules TEXT,
      llm_analysis TEXT,
      is_filtered INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS analysis_results (
      job_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      generated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS llm_cache (
      cache_key TEXT PRIMARY KEY,
      result TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_reviews_job_id ON normalized_reviews(job_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_dedupe_hash ON normalized_reviews(dedupe_hash);
    CREATE INDEX IF NOT EXISTS idx_reviews_source ON normalized_reviews(source);
    CREATE INDEX IF NOT EXISTS idx_llm_cache_created_at ON llm_cache(created_at);

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      product_query TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_jobs (
      project_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      added_at TEXT NOT NULL,
      PRIMARY KEY (project_id, job_id)
    );

    CREATE INDEX IF NOT EXISTS idx_project_jobs_project_id ON project_jobs(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_jobs_job_id ON project_jobs(job_id);
  `)
}
