import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@types': resolve('src/types'),
        '@db': resolve('src/db'),
        '@adapters': resolve('src/adapters'),
        '@pipeline': resolve('src/pipeline'),
        '@services': resolve('src/services'),
        '@llm': resolve('src/llm'),
        '@prompts': resolve('src/prompts')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@types': resolve('src/types')
      }
    },
    plugins: [react()]
  }
})
