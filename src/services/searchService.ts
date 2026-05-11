import type {
  SearchOptions,
  SearchJob,
  NormalizedReview,
  AnalysisResult,
  AppConfig,
  SearchProgress
} from '../types/index'
import { DOMESTIC_SOURCES, INTERNATIONAL_SOURCES } from '../types/index'
import { createJob, updateJobStatus, insertReviews, saveAnalysis } from '../db/queries'
import { getEnabledAdapters } from '../adapters/index'
import { runPipeline } from '../pipeline/index'
import { generateAnalysis } from '../pipeline/analyzer'
import { createLLMProvider } from '../llm/index'
import { isChinese, adaptQueryForSearch } from '../services/translator'

export async function runSearch(
  options: SearchOptions,
  config: AppConfig,
  onProgress: (progress: SearchProgress) => void
): Promise<{ job: SearchJob; reviews: NormalizedReview[]; analysis: AnalysisResult }> {
  const jobId = crypto.randomUUID()
  const now = new Date().toISOString()

  const job: SearchJob = {
    id: jobId,
    productQuery: options.productQuery,
    sources: options.sources,
    status: 'pending',
    totalReviews: 0,
    validReviews: 0,
    suspectedAdBotCount: 0,
    createdAt: now,
    options
  }

  createJob(job)

  try {
    updateJobStatus(jobId, 'running')
    onProgress({ jobId, stage: 'start', message: `Starting search for "${options.productQuery}"` })

    const llm = createLLMProvider(config)
    const adapters = getEnabledAdapters(options.sources)
    const maxPerSource = Math.ceil((options.maxResults ?? config.defaultMaxResults) / Math.max(adapters.length, 1))

    // Detect language and compute per-region queries
    const inputIsChinese = isChinese(options.productQuery)
    let domesticQuery = options.productQuery
    let internationalQuery = options.productQuery

    onProgress({ jobId, stage: 'translation', message: 'Generating localized search queries...' })

    if (!inputIsChinese) {
      // English input → generate Chinese search terms for domestic platforms
      domesticQuery = await adaptQueryForSearch(
        options.productQuery, 'zh', config.ollamaBaseUrl, config.ollamaModel
      )
      onProgress({ jobId, stage: 'translation', message: `Domestic query: "${domesticQuery}"` })
    } else {
      // Chinese input → generate English search terms for international platforms
      internationalQuery = await adaptQueryForSearch(
        options.productQuery, 'en', config.ollamaBaseUrl, config.ollamaModel
      )
      onProgress({ jobId, stage: 'translation', message: `International query: "${internationalQuery}"` })
    }

    const allRaw: NormalizedReview[] = []

    for (const adapter of adapters) {
      const isDomestic = DOMESTIC_SOURCES.includes(adapter.source as any)
      const adapterQuery = isDomestic ? domesticQuery : internationalQuery
      onProgress({ jobId, stage: 'fetching', message: `Fetching from ${adapter.source} [${adapterQuery}]...` })
      try {
        const rawReviews = await adapter.search(adapterQuery, maxPerSource)
        // Keep options.productQuery (original) in normalize so reviews are grouped correctly
        const normalized = rawReviews.map(r => adapter.normalize(r, options.productQuery, jobId))
        allRaw.push(...normalized)
        onProgress({ jobId, stage: 'fetching', message: `Got ${rawReviews.length} results from ${adapter.source}` })
      } catch (err: any) {
        console.error(`[SearchService] Adapter ${adapter.source} failed:`, err.message)
        onProgress({ jobId, stage: 'fetching', message: `${adapter.source} failed: ${err.message}` })
      }
    }

    onProgress({ jobId, stage: 'pipeline', message: `Processing ${allRaw.length} raw reviews...` })

    const enriched = await runPipeline(
      allRaw,
      llm,
      options.productQuery,
      options.deepAnalysis ?? false,
      onProgress,
      jobId
    )

    insertReviews(enriched)

    onProgress({ jobId, stage: 'analysis', message: 'Generating analysis...' })
    const analysis = await generateAnalysis(jobId, enriched, llm, options.productQuery)
    saveAnalysis(analysis)

    const validCount = enriched.filter(r => !r.isFiltered).length
    const suspectedCount = enriched.filter(
      r => !r.isFiltered && (r.authenticityScore < 0.4 || r.spamScore > 0.6)
    ).length

    updateJobStatus(jobId, 'completed', {
      completedAt: new Date().toISOString(),
      totalReviews: enriched.length,
      validReviews: validCount,
      suspectedAdBotCount: suspectedCount
    })

    const finalJob: SearchJob = {
      ...job,
      status: 'completed',
      totalReviews: enriched.length,
      validReviews: validCount,
      suspectedAdBotCount: suspectedCount,
      completedAt: new Date().toISOString()
    }

    onProgress({ jobId, stage: 'done', message: `Search complete. Found ${validCount} valid reviews.` })

    return { job: finalJob, reviews: enriched, analysis }
  } catch (err: any) {
    updateJobStatus(jobId, 'failed', { error: err.message })
    throw err
  }
}
