<!-- SVENKUNKKA-README-NAV:BEGIN -->
[English overview](#project-overview-en) · [中文项目说明](#project-overview-zh) · [Maintainer on X / 维护者 X](https://x.com/Svenu1s5)
<!-- SVENKUNKKA-README-NAV:END -->

# Product Review Radar

A cross-platform desktop app that aggregates user reviews from multiple public sources, filters ads/bots using a rule engine + LLM second-pass, and produces structured sentiment analysis.

Built with Electron + React + TypeScript + SQLite.

---

## Quick Start

### 1. Install dependencies

```bash
cd product-review-radar
npm install
```

### 2. Rebuild native modules (required for better-sqlite3)

```bash
npm run rebuild
```

This compiles `better-sqlite3` against the Electron version bundled in the project. Run this once after `npm install` and again whenever you upgrade Electron.

### 3. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in the keys you have. See the **Configuration** section below for details. The app starts and runs with zero API keys (Reddit public JSON API works without auth; YouTube is skipped; LLM defaults to mock).

### 4. Run in development

```bash
npm run dev
```

This starts the Vite dev server for the renderer and launches Electron. Hot-reload is active for the renderer.

---

## Configuration

All config lives in `.env` (or environment variables set at the system level).

| Variable | Required | Default | Description |
|---|---|---|---|
| `MAIN_VITE_REDDIT_CLIENT_ID` | No | — | Reddit OAuth app client ID. Leave blank to use the unauthenticated public JSON API. |
| `MAIN_VITE_REDDIT_CLIENT_SECRET` | No | — | Reddit OAuth app client secret. |
| `MAIN_VITE_YOUTUBE_API_KEY` | No | — | YouTube Data API v3 key. Get one at [Google Cloud Console](https://console.cloud.google.com). If blank, YouTube source is skipped. |
| `MAIN_VITE_ANTHROPIC_API_KEY` | No | — | Anthropic Claude API key. Get one at [console.anthropic.com](https://console.anthropic.com). If blank, LLM falls back to a deterministic mock. |
| `MAIN_VITE_LLM_PROVIDER` | No | `mock` | `anthropic` or `mock`. |
| `MAIN_VITE_DEFAULT_MAX_RESULTS` | No | `50` | Max reviews to fetch per search (per source). |
| `MAIN_VITE_CACHE_ENABLED` | No | `true` | Cache LLM analysis results in SQLite. |
| `MAIN_VITE_CACHE_TTL` | No | `3600` | Cache TTL in seconds. |
| `MAIN_VITE_ENABLED_SOURCES` | No | `reddit,youtube,trustpilot` | Comma-separated list of sources to enable. |

**Without any API keys**, the app will:
- Fetch Reddit results using the unauthenticated public JSON endpoint (rate-limited but functional)
- Skip YouTube (warns in console)
- Return mock placeholder reviews for Trustpilot if scraping is blocked
- Use the mock LLM for sentiment/spam analysis (keyword-based heuristics)

---

## Building & Packaging

### macOS (DMG)

```bash
npm run package:mac
```

Output: `dist/Product Review Radar-{version}-{arch}.dmg`

### Windows (NSIS installer)

```bash
npm run package:win
```

> **Note:** Building Windows packages from macOS requires Wine or a Windows build environment. Cross-platform builds are best done in CI.

### Generic (auto-detect platform)

```bash
npm run package
```

---

## Project Structure

```
src/
├── main/                 # Electron main process
│   ├── index.ts          # App entry: window creation, DB init, IPC setup
│   └── ipc/
│       └── handlers.ts   # All IpcMain.handle() registrations
│
├── preload/
│   └── index.ts          # contextBridge — exposes window.electronAPI to renderer
│
├── renderer/             # React frontend
│   ├── index.html
│   └── src/
│       ├── App.tsx        # Root layout + global type declarations
│       ├── hooks/
│       │   └── useSearch.ts  # All search state + IPC calls
│       └── components/
│           ├── SearchBar.tsx
│           ├── FilterPanel.tsx
│           ├── ReviewList.tsx
│           ├── ReviewCard.tsx
│           ├── AnalysisView.tsx
│           ├── DebugPanel.tsx
│           └── ExportButton.tsx
│
├── types/
│   └── index.ts          # Shared types imported by both main and renderer
│
├── adapters/             # Data source adapters
│   ├── base.ts           # BaseAdapter abstract class
│   ├── reddit.ts
│   ├── youtube.ts
│   ├── trustpilot.ts
│   └── index.ts          # Registry: getAdapter(), getEnabledAdapters()
│
├── pipeline/             # Review processing pipeline
│   ├── cleaner.ts        # HTML strip, whitespace, length filter
│   ├── deduplicator.ts   # Exact + Jaccard near-dedup + author flood
│   ├── ruleEngine.ts     # 8 configurable spam/bot rules
│   ├── llmJudge.ts       # LLM second-pass on borderline reviews
│   ├── analyzer.ts       # Aggregate statistics + summary generation
│   └── index.ts          # runPipeline() orchestrator
│
├── services/
│   ├── config.ts         # Reads env vars → AppConfig
│   ├── searchService.ts  # Top-level runSearch() orchestrator
│   └── exportService.ts  # JSON + CSV serializers
│
├── db/
│   ├── schema.ts         # CREATE TABLE IF NOT EXISTS statements
│   ├── database.ts       # better-sqlite3 singleton init
│   └── queries.ts        # All typed DB read/write functions
│
├── llm/
│   ├── base.ts           # MockLLMProvider (keyword heuristics)
│   ├── anthropic.ts      # AnthropicLLMProvider (Claude Haiku)
│   └── index.ts          # createLLMProvider(config) factory
│
└── prompts/
    └── index.ts          # Prompt templates for review analysis + summary
```

---

## How to Add a New Data Source Adapter

1. **Create the adapter file** at `src/adapters/mysource.ts`:

```typescript
import { BaseAdapter } from './base'
import type { RawReview, NormalizedReview, ReviewSource } from '../types/index'

export class MySourceAdapter extends BaseAdapter {
  readonly source: ReviewSource = 'mysource' as ReviewSource  // or extend the union type

  async search(productQuery: string, maxResults = 50): Promise<RawReview[]> {
    // Fetch reviews from your source
    // Return RawReview[] — see the interface in src/types/index.ts
  }

  normalize(input: RawReview, productQuery: string, jobId: string): NormalizedReview {
    const content = this.sanitizeText(input.content ?? '')
    return {
      id: this.generateId(input.sourceUrl + content, this.source),
      jobId,
      productQuery,
      source: this.source,
      sourceType: 'review',
      sourceUrl: input.sourceUrl,
      title: this.sanitizeText(input.title ?? ''),
      content,
      // ... fill remaining fields
      dedupeHash: this.generateDedupeHash(content),
      fetchedAt: new Date().toISOString(),
      isFiltered: false,
    }
  }
}
```

2. **Extend the `ReviewSource` type** in `src/types/index.ts`:

```typescript
export type ReviewSource = 'reddit' | 'youtube' | 'trustpilot' | 'mysource';
```

3. **Register it** in `src/adapters/index.ts`:

```typescript
import { MySourceAdapter } from './mysource'

const registry: Record<ReviewSource, ReviewSourceAdapter> = {
  reddit: new RedditAdapter(),
  youtube: new YoutubeAdapter(),
  trustpilot: new TrustpilotAdapter(),
  mysource: new MySourceAdapter(),   // ← add here
}
```

4. **Update the UI** — the source checkbox in `SearchBar.tsx` and filter panel in `FilterPanel.tsx` need the new source name added to their arrays.

That's it. The pipeline (cleaning, dedup, rule engine, LLM) runs automatically on all reviews regardless of source.

---

## Pipeline Overview

```
Search trigger
    │
    ▼
[Adapters]  Reddit / YouTube / Trustpilot
    │  RawReview[]
    ▼
[Normalize]  → NormalizedReview[] (uniform structure)
    │
    ▼
[Stage 1: Clean]   Strip HTML, whitespace, remove <10 char content
    │
    ▼
[Stage 2: Dedup]   Exact SHA-256 hash → Jaccard near-dedup (>0.85) → author flood
    │
    ▼
[Stage 3: Rules]   8 configurable spam/bot rules → spamScore + botScore (0–1)
    │
    ▼
[Stage 4: LLM]     Only borderline samples (spamScore 0.2–0.7) + high-engagement
                   Checks LLM cache first → calls Claude Haiku → caches result
    │
    ▼
[Analyzer]   Stats + topPros/topCons + representative reviews
    │
    ▼
SQLite DB   search_jobs / normalized_reviews / analysis_results / llm_cache
```

---

## Data Source Notes

| Source | Method | Auth needed | Notes |
|---|---|---|---|
| Reddit | Public JSON API | No | `reddit.com/search.json` — 60 req/min unauthenticated |
| YouTube | Data API v3 | Yes (free key) | Quota: 10,000 units/day. Comments ≈ 1 unit each |
| Trustpilot | HTML scraping | No | May return mocks if Cloudflare blocks the request |

**Trustpilot**: Trustpilot uses Cloudflare and frequently blocks scrapers. The adapter tries multiple selector strategies and falls back to mock reviews rather than crashing. If you need reliable Trustpilot data, the proper path is the [Trustpilot Business API](https://developers.trustpilot.com/) (requires a business account).

---

## Database Location

The SQLite database is stored in the Electron user-data directory:
- **macOS**: `~/Library/Application Support/product-review-radar/radar.db`
- **Windows**: `%APPDATA%\product-review-radar\radar.db`

You can inspect it with any SQLite browser (e.g. [DB Browser for SQLite](https://sqlitebrowser.org/)).

---

## Exports

Click **Export ▾** in the top-right of the app to export the current filtered review list:

- **JSON**: Full `NormalizedReview[]` with all fields
- **CSV**: Selected columns suitable for spreadsheet analysis

Exports are saved to your Downloads folder.

---

## Architecture Notes

- **Main process** owns all I/O: HTTP requests, SQLite reads/writes, file exports. The renderer never touches the filesystem or network directly.
- **IPC channels**: `search:start`, `search:getJobs`, `reviews:get`, `analysis:get`, `export:results`, `search:progress` (event, not handler).
- **LLM is optional and bounded**: Only called for borderline-scoring reviews and the final summary. A full search with 50 reviews typically makes 5–15 LLM calls.
- **No cloud, no accounts**: All data stays on device.


---

<!-- SVENKUNKKA-PROJECT-INFO:BEGIN -->

<a id="project-overview-zh"></a>
## 中文项目说明

汇集多个公开来源产品评论的桌面工具，采用规则筛查和可选模型复核生成结构化情感分析，并使用 SQLite 缓存，支持 JSON/CSV 导出。

**使用入口：** 运行 `npm install`、`npm run rebuild`，复制 `.env.example` 为 `.env` 后按需配置服务，再用 `npm run dev` 启动。

**范围说明：** 默认模型为模拟实现；未配置密钥时跳过 YouTube，Trustpilot 抓取受阻时可能返回占位评论，不能将这些内容当成真实用户证据。

<a id="project-overview-en"></a>
## English project overview

A desktop tool that aggregates public product reviews, combines rule-based filtering with optional model review, produces structured sentiment analysis, caches results in SQLite and exports JSON/CSV.

**Getting started:** Run `npm install` and `npm run rebuild`, copy `.env.example` to `.env`, configure the desired services, then launch with `npm run dev`.

**Scope:** The model defaults to a mock. YouTube is skipped without a key, and blocked Trustpilot scraping may return placeholder reviews; these must not be treated as real user evidence.

**仓库维护者 / Repository maintainer:** [SvenKunkka](https://github.com/SvenKunkka) · [X / Twitter](https://x.com/Svenu1s5)

<!-- SVENKUNKKA-PROJECT-INFO:END -->
