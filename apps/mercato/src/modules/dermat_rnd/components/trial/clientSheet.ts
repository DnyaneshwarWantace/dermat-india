import type { RdRequest, Round, Trial } from '../types'

export type ClientSheetLabels = Record<'title' | 'client' | 'brand' | 'product' | 'sampleNo' | 'packSize' | 'sentOn' | 'request' | 'texture' | 'fragrance' | 'colour' | 'claims' | 'ingredients' | 'instruction' | 'results' | 'parameter' | 'value' | 'result' | 'pass' | 'fail' | 'remarks' | 'note' | 'preparedBy' | 'receivedBy' | 'newProduct', string>

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)
}

function dayText(value: string | null | undefined): string {
  if (!value) return ''
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function row(label: string, value: string | null | undefined): string {
  if (!value || !value.trim()) return ''
  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
}

export function sentRoundFor(request: RdRequest, trial: Trial): Round | null {
  const rounds = request.rounds.filter((round) => round.trialId === trial.id)
  return rounds[rounds.length - 1] ?? null
}

export function buildClientSheetHtml(request: RdRequest, trial: Trial, labels: ClientSheetLabels): string {
  const sent = sentRoundFor(request, trial)
  const values = Object.entries(trial.observations?.values ?? {}).filter(([, value]) => value && value.trim())
  const ingredients = request.ingredientRefs.length ? request.ingredientRefs.map((ref) => ref.name).join(', ') : request.ingredients ?? ''
  const result = trial.observations?.result === 'pass' ? labels.pass : trial.observations?.result === 'fail' ? labels.fail : ''
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(`${trial.code} - ${request.productName}`)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; font-size: 12px; margin: 0; padding: 28px; background: #fff; }
  .top { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; padding-bottom: 12px; border-bottom: 2px solid #0f172a; }
  .brand { font-size: 20px; font-weight: 800; letter-spacing: 0.06em; }
  .doc { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; }
  .code { font-family: "SFMono-Regular", Menlo, Consolas, monospace; font-size: 18px; font-weight: 800; text-align: right; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #475569; margin: 22px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 7px 8px; border: 1px solid #cbd5e1; text-align: left; vertical-align: top; }
  th { width: 34%; background: #f8fafc; font-weight: 600; color: #334155; }
  .results th { width: auto; }
  .results thead th { background: #0f172a; color: #fff; }
  .verdict { margin-top: 8px; font-weight: 700; }
  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 48px; }
  .sign div { border-top: 1px solid #0f172a; padding-top: 5px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
  .note { margin-top: 20px; font-size: 10px; color: #64748b; }
  @media print { body { padding: 0; } }
</style></head>
<body>
  <div class="top">
    <div><div class="brand">DERMAT INDIA</div><div class="doc">${escapeHtml(labels.title)}</div></div>
    <div><div class="doc">${escapeHtml(labels.sampleNo)}</div><div class="code">${escapeHtml(trial.code)}</div></div>
  </div>
  <table style="margin-top:16px">
    ${row(labels.client, request.customerName ?? (request.kind === 'npd' ? labels.newProduct : ''))}
    ${row(labels.brand, request.brand)}
    ${row(labels.product, request.productName)}
    ${row(labels.packSize, request.packSize)}
    ${row(labels.sentOn, dayText(sent?.sentOn))}
  </table>
  <h2>${escapeHtml(labels.request)}</h2>
  <table>
    ${row(labels.texture, request.texture)}
    ${row(labels.fragrance, request.fragrance)}
    ${row(labels.colour, request.colour)}
    ${row(labels.claims, request.claims)}
    ${row(labels.ingredients, ingredients)}
    ${row(labels.instruction, request.clientInstruction)}
  </table>
  <h2>${escapeHtml(labels.results)}</h2>
  ${values.length ? `<table class="results"><thead><tr><th>${escapeHtml(labels.parameter)}</th><th>${escapeHtml(labels.value)}</th></tr></thead><tbody>${values.map(([name, value]) => `<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(value)}</td></tr>`).join('')}</tbody></table>` : '<p>—</p>'}
  ${result ? `<p class="verdict">${escapeHtml(labels.result)}: ${escapeHtml(result)}</p>` : ''}
  ${trial.observations?.remarks ? `<p>${escapeHtml(labels.remarks)}: ${escapeHtml(trial.observations.remarks)}</p>` : ''}
  <div class="sign"><div>${escapeHtml(labels.preparedBy)}</div><div>${escapeHtml(labels.receivedBy)}</div></div>
  <p class="note">${escapeHtml(labels.note)}</p>
  <script>window.addEventListener('load', function () { setTimeout(function () { window.print() }, 200) })</script>
</body></html>`
}

export function openClientSheet(request: RdRequest, trial: Trial, labels: ClientSheetLabels): boolean {
  const popup = window.open('', '_blank', 'width=900,height=1100')
  if (!popup) return false
  popup.document.open()
  popup.document.write(buildClientSheetHtml(request, trial, labels))
  popup.document.close()
  return true
}
