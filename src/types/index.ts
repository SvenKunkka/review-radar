// ============================================================
// Shared type definitions — imported by both main and renderer
// ============================================================

export type ReviewSource = 'reddit' | 'youtube' | 'trustpilot' | 'bilibili' | 'zhihu' | 'tieba' | 'nga';
export type SourceType = 'post' | 'comment' | 'video' | 'video_comment' | 'review';
export type SentimentLabel = 'positive' | 'negative' | 'neutral' | 'unknown';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';
export type LLMProviderType = 'anthropic' | 'ollama' | 'mock';

export const DOMESTIC_SOURCES: ReviewSource[] = ['bilibili', 'zhihu', 'tieba', 'nga'];
export const INTERNATIONAL_SOURCES: ReviewSource[] = ['reddit', 'youtube', 'trustpilot'];

// Raw output from a source adapter before normalization
export interface RawReview {
  source: ReviewSource;
  sourceUrl: string;
  title?: string;
  content: string;
  ratingRaw?: number;
  authorName?: string;
  authorId?: string;
  authorProfileUrl?: string;
  createdAt?: string; // ISO 8601
  likeCount?: number;
  replyCount?: number;
  rawMetadata?: Record<string, unknown>;
}

// Fully normalized, enriched review stored in the DB
export interface NormalizedReview {
  id: string;
  jobId: string;
  productQuery: string;
  source: ReviewSource;
  sourceType: SourceType;
  sourceUrl: string;
  title: string;
  content: string;
  ratingRaw?: number;
  sentiment: SentimentLabel;
  language: string;
  authorName: string;
  authorId?: string;
  authorProfileUrl?: string;
  authorMeta?: Record<string, unknown>;
  createdAt: string;
  likeCount: number;
  replyCount: number;
  rawMetadata: Record<string, unknown>;
  // Scoring
  spamScore: number;   // 0–1
  botScore: number;    // 0–1
  authenticityScore: number; // 0–1  (1 = most authentic)
  authenticityReason: string;
  dedupeHash: string;
  fetchedAt: string;
  matchedRules?: string[];
  llmAnalysis?: LLMAnalysis;
  isFiltered: boolean; // true = excluded from analysis
}

export interface LLMAnalysis {
  isSuspectedAd: boolean;
  isSuspectedBot: boolean;
  sentiment: SentimentLabel;
  pros: string[];
  cons: string[];
  reason: string;
  rawResponse?: string;
  cachedAt?: string;
}

export interface SearchJob {
  id: string;
  productQuery: string;
  sources: ReviewSource[];
  status: JobStatus;
  totalReviews: number;
  validReviews: number;
  suspectedAdBotCount: number;
  createdAt: string;
  completedAt?: string;
  error?: string;
  options: SearchOptions;
}

export interface AnalysisResult {
  jobId: string;
  totalCount: number;
  validCount: number;
  suspectedAdBotCount: number;
  suspectedAdBotRatio: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  positiveRatio: number;
  negativeRatio: number;
  neutralRatio: number;
  topPros: string[];
  topCons: string[];
  representativePositive: NormalizedReview[];
  representativeNegative: NormalizedReview[];
  sourceDistribution: Partial<Record<ReviewSource, SentimentDistribution>>;
  generatedAt: string;
  llmSummary?: string;
  domesticBreakdown?: RegionBreakdown;
  internationalBreakdown?: RegionBreakdown;
}

export interface Project {
  id: string;
  name: string;
  productQuery: string;    // canonical query; first job's query, or set at merge time
  createdAt: string;
  updatedAt: string;
  jobIds: string[];        // all linked job IDs, newest first
  totalReviews: number;    // approximate total across all jobs (before cross-job dedup)
  validReviews: number;
  lastSearchAt: string;
}

export interface SentimentDistribution {
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  positiveRatio: number;
  negativeRatio: number;
  neutralRatio: number;
}

export interface RegionBreakdown {
  totalCount: number;
  validCount: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  positiveRatio: number;
  negativeRatio: number;
  neutralRatio: number;
  topPros: string[];
  topCons: string[];
  llmSummary?: string;
  sourceDistribution: Partial<Record<ReviewSource, SentimentDistribution>>;
}

export interface SearchFilters {
  sources?: ReviewSource[];
  languages?: string[];
  sentiments?: SentimentLabel[];
  minAuthenticityScore?: number;
  maxAuthenticityScore?: number;
  includeSuspectedSpam?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export interface SearchOptions {
  productQuery: string;
  sources: ReviewSource[];
  maxResults?: number;
  deepAnalysis?: boolean;
  language?: string;
}

export interface ReviewSourceAdapter {
  readonly source: ReviewSource;
  search(productQuery: string, maxResults?: number): Promise<RawReview[]>;
  normalize(input: RawReview, productQuery: string, jobId: string): NormalizedReview;
}

export interface LLMProvider {
  analyzeReview(review: NormalizedReview): Promise<LLMAnalysis>;
  generateSummary(reviews: NormalizedReview[], query: string): Promise<SummaryResult>;
}

export interface SummaryResult {
  topPros: string[];
  topCons: string[];
  summary: string;
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'html';
  jobId: string;
  filters?: SearchFilters;
}

export interface SearchProgress {
  jobId: string;
  stage: string;
  message: string;
  current?: number;
  total?: number;
}

export interface RuleResult {
  spamScore: number;
  botScore: number;
  matchedRules: string[];
}

export interface AppConfig {
  redditClientId?: string;
  redditClientSecret?: string;
  youtubeApiKey?: string;
  anthropicApiKey?: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
  llmProvider: LLMProviderType;
  defaultMaxResults: number;
  cacheEnabled: boolean;
  cacheTTL: number;
  enabledSources: ReviewSource[];
}

// IPC bridge API shape (used by preload + renderer)
export interface ElectronAPI {
  startSearch: (options: SearchOptions) => Promise<SearchJob>;
  getJobs: () => Promise<SearchJob[]>;
  getReviews: (jobId: string, filters?: SearchFilters) => Promise<NormalizedReview[]>;
  getAnalysis: (jobId: string) => Promise<AnalysisResult | null>;
  exportResults: (options: ExportOptions) => Promise<{ success: boolean; path?: string; error?: string }>;
  onProgress: (callback: (progress: SearchProgress) => void) => () => void;
  getProjects: () => Promise<Project[]>;
  getProjectReviews: (projectId: string, filters?: SearchFilters) => Promise<NormalizedReview[]>;
  searchProject: (projectId: string) => Promise<SearchJob>;
  mergeIntoProject: (opts: { name: string; jobIds: string[]; productQuery: string }) => Promise<Project>;
  renameProject: (id: string, name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  deleteReview: (id: string) => Promise<void>;
}
