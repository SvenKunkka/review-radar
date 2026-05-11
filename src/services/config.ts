import type { AppConfig } from '../types/index'

export function loadConfig(): AppConfig {
  const env = (import.meta as any).env ?? {}

  const sourcesEnv: string = env.MAIN_VITE_ENABLED_SOURCES ?? 'reddit,youtube,trustpilot'
  const enabledSources = sourcesEnv
    .split(',')
    .map((s: string) => s.trim())
    .filter((s: string) => ['reddit', 'youtube', 'trustpilot'].includes(s)) as AppConfig['enabledSources']

  return {
    redditClientId: env.MAIN_VITE_REDDIT_CLIENT_ID || undefined,
    redditClientSecret: env.MAIN_VITE_REDDIT_CLIENT_SECRET || undefined,
    youtubeApiKey: env.MAIN_VITE_YOUTUBE_API_KEY || undefined,
    anthropicApiKey: env.MAIN_VITE_ANTHROPIC_API_KEY || undefined,
    ollamaBaseUrl: env.MAIN_VITE_OLLAMA_BASE_URL ?? 'http://localhost:11434',
    ollamaModel: env.MAIN_VITE_OLLAMA_MODEL ?? 'llama3.2',
    llmProvider: (env.MAIN_VITE_LLM_PROVIDER ?? 'mock') as AppConfig['llmProvider'],
    defaultMaxResults: parseInt(env.MAIN_VITE_DEFAULT_MAX_RESULTS ?? '50', 10),
    cacheEnabled: (env.MAIN_VITE_CACHE_ENABLED ?? 'true') === 'true',
    cacheTTL: parseInt(env.MAIN_VITE_CACHE_TTL ?? '3600', 10),
    enabledSources: enabledSources.length > 0 ? enabledSources : ['reddit', 'youtube', 'trustpilot']
  }
}
