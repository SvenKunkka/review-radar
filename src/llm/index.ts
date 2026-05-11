import type { LLMProvider, AppConfig } from '../types/index'
import { MockLLMProvider } from './base'
import { AnthropicLLMProvider } from './anthropic'
import { OllamaLLMProvider } from './ollama'

export function createLLMProvider(config: AppConfig): LLMProvider {
  if (config.llmProvider === 'anthropic' && config.anthropicApiKey) {
    return new AnthropicLLMProvider(config.anthropicApiKey)
  }
  if (config.llmProvider === 'ollama') {
    return new OllamaLLMProvider(config.ollamaBaseUrl, config.ollamaModel)
  }
  return new MockLLMProvider()
}
