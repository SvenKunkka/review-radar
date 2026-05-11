import type { NormalizedReview, AnalysisResult } from '../types/index'

export function exportToJSON(reviews: NormalizedReview[], jobId: string): string {
  return JSON.stringify(
    { jobId, exportedAt: new Date().toISOString(), count: reviews.length, reviews },
    null,
    2
  )
}

// RFC 4180-compliant CSV escaping
function escapeCSV(value: unknown): string {
  const str = String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

export function exportToCSV(reviews: NormalizedReview[]): string {
  const headers = [
    'id', 'source', 'sourceType', 'createdAt', 'authorName', 'sentiment',
    'authenticityScore', 'spamScore', 'botScore', 'language', 'likeCount',
    'replyCount', 'isFiltered', 'title', 'content', 'sourceUrl'
  ]

  const rows = reviews.map(r =>
    [
      r.id,
      r.source,
      r.sourceType,
      r.createdAt,
      r.authorName,
      r.sentiment,
      r.authenticityScore.toFixed(3),
      r.spamScore.toFixed(3),
      r.botScore.toFixed(3),
      r.language,
      r.likeCount,
      r.replyCount,
      r.isFiltered ? '1' : '0',
      r.title.slice(0, 200),   // cap to avoid bloated cells
      r.content.slice(0, 500),
      r.sourceUrl
    ].map(escapeCSV).join(',')
  )

  return [headers.join(','), ...rows].join('\n')
}

// ---------------------------------------------------------------------------
// HTML report — self-contained, no external dependencies
// ---------------------------------------------------------------------------
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`
}

function sentimentBar(pos: number, neu: number, neg: number, total: number): string {
  if (total === 0) return '<div class="sbar"><div class="sbar-empty"></div></div>'
  return `<div class="sbar">
    <div class="sbar-pos" style="width:${(pos / total * 100).toFixed(1)}%" title="Positive ${pct(pos / total)}"></div>
    <div class="sbar-neu" style="width:${(neu / total * 100).toFixed(1)}%" title="Neutral ${pct(neu / total)}"></div>
    <div class="sbar-neg" style="width:${(neg / total * 100).toFixed(1)}%" title="Negative ${pct(neg / total)}"></div>
  </div>`
}

function regionCard(
  title: string,
  dark: boolean,
  bd: AnalysisResult['domesticBreakdown']
): string {
  if (!bd || bd.totalCount === 0) {
    return `<div class="rcard ${dark ? 'rcard-dark' : 'rcard-light'}">
      <h4>${title}</h4>
      <p class="no-data">No reviews</p>
    </div>`
  }
  const srcPills = Object.entries(bd.sourceDistribution)
    .map(([src, d]) => `<span class="src-pill src-${src}">${esc(src)} <b>${d.total}</b></span>`)
    .join(' ')
  const prosList = bd.topPros.slice(0, 3).map(p => `<li>${esc(p)}</li>`).join('')
  const consList = bd.topCons.slice(0, 3).map(c => `<li>${esc(c)}</li>`).join('')
  return `<div class="rcard ${dark ? 'rcard-dark' : 'rcard-light'}">
    <h4>${title}</h4>
    <div class="rstat">${bd.validCount} valid / ${bd.totalCount} total</div>
    ${sentimentBar(bd.positiveCount, bd.neutralCount, bd.negativeCount, bd.totalCount)}
    <div class="rpcts">
      <span class="pct-pos">▲ ${pct(bd.positiveRatio)}</span>
      <span class="pct-neu">● ${pct(bd.neutralRatio)}</span>
      <span class="pct-neg">▼ ${pct(bd.negativeRatio)}</span>
    </div>
    ${prosList ? `<div class="rpc-label">Pros</div><ul class="rpc-list pros-list">${prosList}</ul>` : ''}
    ${consList ? `<div class="rpc-label">Cons</div><ul class="rpc-list cons-list">${consList}</ul>` : ''}
    <div class="src-pills">${srcPills}</div>
  </div>`
}

function reviewMini(r: NormalizedReview): string {
  const snippet = esc(r.content.slice(0, 240)) + (r.content.length > 240 ? '…' : '')
  return `<div class="rv-card">
    <div class="rv-meta">
      <span class="rv-badge badge-${r.source}">${esc(r.source)}</span>
      <span class="rv-author">${esc(r.authorName)}</span>
      ${r.likeCount > 0 ? `<span class="rv-likes">+${r.likeCount}</span>` : ''}
    </div>
    ${r.title ? `<p class="rv-title">${esc(r.title.slice(0, 100))}</p>` : ''}
    <p class="rv-content">${snippet}</p>
  </div>`
}

export function exportToHTML(
  analysis: AnalysisResult | null,
  reviews: NormalizedReview[],
  productQuery: string
): string {
  const now = new Date().toLocaleString()
  const active = reviews.filter(r => !r.isFiltered)

  const overviewCards = analysis ? [
    { label: 'Total Reviews', value: analysis.totalCount, sub: '' },
    { label: 'Valid Reviews', value: analysis.validCount, sub: '' },
    { label: 'Suspected Ads/Bots', value: analysis.suspectedAdBotCount, sub: pct(analysis.suspectedAdBotRatio) },
    { label: 'Positive', value: analysis.positiveCount, sub: pct(analysis.positiveRatio) },
    { label: 'Negative', value: analysis.negativeCount, sub: pct(analysis.negativeRatio) },
    { label: 'Neutral', value: analysis.neutralCount, sub: pct(analysis.neutralRatio) },
  ] : []

  const srcRows = analysis
    ? Object.entries(analysis.sourceDistribution).map(([src, d]) => `
      <div class="src-row">
        <div class="src-hdr"><span class="src-name">${esc(src)}</span><span class="src-cnt">${d.total} reviews</span></div>
        ${sentimentBar(d.positive, d.neutral, d.negative, d.total)}
        <div class="src-leg">
          <span class="pct-pos">▲ ${pct(d.positiveRatio)}</span>
          <span class="pct-neu">● ${pct(d.neutralRatio)}</span>
          <span class="pct-neg">▼ ${pct(d.negativeRatio)}</span>
        </div>
      </div>`).join('')
    : ''

  const hasRegion = analysis && (analysis.domesticBreakdown || analysis.internationalBreakdown)

  const posReps = (analysis?.representativePositive ?? active.filter(r => r.sentiment === 'positive').sort((a, b) => b.likeCount - a.likeCount)).slice(0, 3)
  const negReps = (analysis?.representativeNegative ?? active.filter(r => r.sentiment === 'negative').sort((a, b) => b.likeCount - a.likeCount)).slice(0, 3)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Review Report — ${esc(productQuery)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#1e293b;line-height:1.5}
.wrap{max-width:960px;margin:0 auto;padding:2rem 1.5rem}
header{background:#0f172a;border-radius:8px;padding:1.5rem 2rem;margin-bottom:1.25rem}
header .app{font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#475569;margin-bottom:.25rem}
header h1{font-size:1.4rem;font-weight:700;color:#fff;margin-bottom:.4rem}
header .meta{font-size:.7rem;color:#64748b}
.sec{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:1.25rem 1.5rem;margin-bottom:1rem}
.sec-title{font-size:.65rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;margin-bottom:.9rem}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.6rem}
.sc{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:.65rem .9rem}
.sc .lbl{font-size:.65rem;color:#94a3b8;margin-bottom:.2rem}
.sc .val{font-size:1.4rem;font-weight:700;color:#0f172a;line-height:1}
.sc .sub{font-size:.65rem;color:#94a3b8;margin-top:.2rem}
.sbar{display:flex;height:16px;border-radius:4px;overflow:hidden;background:#f1f5f9;margin:.4rem 0}
.sbar-pos{background:#22c55e}.sbar-neu{background:#94a3b8}.sbar-neg{background:#ef4444}.sbar-empty{flex:1;background:#f1f5f9}
.sbar-leg{display:flex;gap:1rem;font-size:.65rem;color:#64748b;margin-top:.35rem}
.pct-pos{color:#16a34a}.pct-neu{color:#64748b}.pct-neg{color:#dc2626}
.rg{display:grid;grid-template-columns:1fr 1fr;gap:.9rem}
.rcard{border-radius:8px;padding:1rem 1.25rem}
.rcard-dark{background:#0f172a;color:#e2e8f0}
.rcard-light{background:#f8fafc;border:1px solid #e2e8f0;color:#334155}
.rcard h4{font-size:.8rem;font-weight:700;margin-bottom:.65rem}
.rcard-dark h4{color:#fff}
.rcard-light h4{color:#1e293b}
.rcard .sbar{height:10px}
.rcard-dark .sbar{background:rgba(255,255,255,.1)}
.rstat{font-size:.65rem;color:#94a3b8;margin-bottom:.3rem}
.rpcts{display:flex;gap:.75rem;font-size:.65rem;margin:.4rem 0 .6rem}
.rcard-dark .pct-pos{color:#4ade80}.rcard-dark .pct-neu{color:#94a3b8}.rcard-dark .pct-neg{color:#f87171}
.rpc-label{font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-top:.5rem;margin-bottom:.2rem;color:#94a3b8}
.rpc-list{font-size:.65rem;padding-left:1rem;margin-bottom:.4rem}
.rcard-dark .pros-list li{color:#4ade80}.rcard-dark .cons-list li{color:#f87171}
.rcard-light .pros-list li{color:#15803d}.rcard-light .cons-list li{color:#b91c1c}
.rpc-list li{margin-bottom:.2rem}
.src-pills{display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.65rem}
.src-pill{font-size:.6rem;padding:.15rem .45rem;border-radius:3px;font-weight:500}
.src-pill b{font-weight:700}
.src-reddit{background:#fff7ed;color:#c2410c;border:1px solid #fed7aa}
.src-youtube{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}
.src-trustpilot{background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0}
.src-bilibili{background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe}
.src-zhihu{background:#f0f9ff;color:#0369a1;border:1px solid #bae6fd}
.src-tieba{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca}
.src-nga{background:#fffbeb;color:#b45309;border:1px solid #fde68a}
.src-row{margin-bottom:.85rem}.src-row:last-child{margin-bottom:0}
.src-hdr{display:flex;justify-content:space-between;font-size:.7rem;margin-bottom:.2rem}
.src-name{font-weight:600;color:#334155;text-transform:capitalize}
.src-cnt{color:#94a3b8}
.src-leg{display:flex;gap:.75rem;font-size:.65rem;margin-top:.3rem}
.pc-grid{display:grid;grid-template-columns:1fr 1fr;gap:.9rem}
.pros-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:.9rem}
.cons-box{background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:.9rem}
.pros-box h4{color:#15803d;font-size:.7rem;font-weight:700;margin-bottom:.5rem}
.cons-box h4{color:#b91c1c;font-size:.7rem;font-weight:700;margin-bottom:.5rem}
.pros-box ol{padding-left:1.1rem}.cons-box ol{padding-left:1.1rem}
.pros-box li{color:#166534;font-size:.7rem;margin-bottom:.25rem}
.cons-box li{color:#991b1b;font-size:.7rem;margin-bottom:.25rem}
.no-data{font-size:.7rem;color:#94a3b8;font-style:italic}
.summary-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:.9rem;font-size:.75rem;color:#334155;line-height:1.7;white-space:pre-wrap}
.rv-grid{display:grid;grid-template-columns:1fr 1fr;gap:.9rem}
.rv-col h4{font-size:.7rem;font-weight:700;margin-bottom:.5rem}
.rv-col-pos h4{color:#15803d}.rv-col-neg h4{color:#b91c1c}
.rv-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:.65rem .8rem;margin-bottom:.4rem;font-size:.7rem}
.rv-meta{display:flex;align-items:center;gap:.4rem;margin-bottom:.3rem}
.rv-badge{display:inline-block;padding:.1rem .35rem;border-radius:3px;font-size:.6rem;font-weight:700;text-transform:capitalize}
.badge-reddit{background:#fff7ed;color:#c2410c;border:1px solid #fed7aa}
.badge-youtube{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}
.badge-trustpilot{background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0}
.badge-bilibili{background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe}
.badge-zhihu{background:#f0f9ff;color:#0369a1;border:1px solid #bae6fd}
.badge-tieba{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca}
.badge-nga{background:#fffbeb;color:#b45309;border:1px solid #fde68a}
.rv-author{color:#94a3b8}.rv-likes{color:#94a3b8}
.rv-title{font-weight:600;color:#1e293b;margin-bottom:.2rem}
.rv-content{color:#475569;line-height:1.55}
footer{text-align:center;font-size:.65rem;color:#94a3b8;margin-top:1.5rem;padding-bottom:1.5rem}
@media(max-width:640px){.rg,.pc-grid,.rv-grid,.stats{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="wrap">

<header>
  <div class="app">Review Radar</div>
  <h1>${esc(productQuery)}</h1>
  <div class="meta">Generated ${esc(now)} &nbsp;·&nbsp; ${reviews.length} reviews collected</div>
</header>

${analysis ? `
<div class="sec">
  <div class="sec-title">Overview</div>
  <div class="stats">
    ${overviewCards.map(c => `<div class="sc"><div class="lbl">${esc(c.label)}</div><div class="val">${c.value}</div>${c.sub ? `<div class="sub">${esc(c.sub)}</div>` : ''}</div>`).join('')}
  </div>
</div>

<div class="sec">
  <div class="sec-title">Overall Sentiment</div>
  ${sentimentBar(analysis.positiveCount, analysis.neutralCount, analysis.negativeCount, analysis.validCount)}
  <div class="sbar-leg">
    <span class="pct-pos">▲ Positive ${pct(analysis.positiveRatio)}</span>
    <span class="pct-neu">● Neutral ${pct(analysis.neutralRatio)}</span>
    <span class="pct-neg">▼ Negative ${pct(analysis.negativeRatio)}</span>
  </div>
</div>
` : ''}

${hasRegion ? `
<div class="sec">
  <div class="sec-title">Regional Comparison</div>
  <div class="rg">
    ${regionCard('🇨🇳 Domestic (CN)', true, analysis!.domesticBreakdown)}
    ${regionCard('🌍 International', false, analysis!.internationalBreakdown)}
  </div>
</div>
` : ''}

${srcRows ? `
<div class="sec">
  <div class="sec-title">Source Distribution</div>
  ${srcRows}
</div>
` : ''}

${analysis && (analysis.topPros.length > 0 || analysis.topCons.length > 0) ? `
<div class="sec">
  <div class="sec-title">Pros &amp; Cons</div>
  <div class="pc-grid">
    <div class="pros-box">
      <h4>Top Positive Points</h4>
      ${analysis.topPros.length > 0
        ? `<ol>${analysis.topPros.slice(0, 5).map(p => `<li>${esc(p)}</li>`).join('')}</ol>`
        : '<p class="no-data">No data.</p>'}
    </div>
    <div class="cons-box">
      <h4>Top Pain Points</h4>
      ${analysis.topCons.length > 0
        ? `<ol>${analysis.topCons.slice(0, 5).map(c => `<li>${esc(c)}</li>`).join('')}</ol>`
        : '<p class="no-data">No data.</p>'}
    </div>
  </div>
</div>
` : ''}

${analysis?.llmSummary ? `
<div class="sec">
  <div class="sec-title">AI Summary</div>
  <div class="summary-box">${esc(analysis.llmSummary)}</div>
</div>
` : ''}

${posReps.length > 0 || negReps.length > 0 ? `
<div class="sec">
  <div class="sec-title">Representative Reviews</div>
  <div class="rv-grid">
    <div class="rv-col rv-col-pos">
      <h4>Top Positive</h4>
      ${posReps.map(reviewMini).join('')}
      ${posReps.length === 0 ? '<p class="no-data">None.</p>' : ''}
    </div>
    <div class="rv-col rv-col-neg">
      <h4>Top Negative</h4>
      ${negReps.map(reviewMini).join('')}
      ${negReps.length === 0 ? '<p class="no-data">None.</p>' : ''}
    </div>
  </div>
</div>
` : ''}

<footer>Review Radar &nbsp;·&nbsp; Exported ${esc(now)}</footer>
</div>
</body>
</html>`
}
