import { MAIN_CARD, cardFieldKeys, documentCard, stepStates, type StageDef } from '../lib/stages'
import { ACTION_LABEL } from './OrderHistory'
import { isMoneyStageField } from '../lib/moneyFields'
import type { Order, Stage } from './types'

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)
}

function when(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
}

function shown(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  return String(value)
}

export function buildStagePrintHtml(order: Order, stage: Stage, def: StageDef): string {
  const states = stepStates(stage.data)
  const docs = order.documents?.[stage.key] ?? []
  const cards = def.steps.length ? def.steps.map((step) => ({ key: step.key, label: step.label })) : [{ key: MAIN_CARD, label: def.label }]
  const fieldLabel = new Map(def.fields.map((field) => [field.key, field.label]))
  const blocks = cards
    .map((card, index) => {
      const state = card.key === MAIN_CARD ? { done: stage.status === 'done', by: stage.completedByName, at: stage.completedAt } : states[card.key]
      const fields = cardFieldKeys(def, card.key)
        .filter((key) => order.canSeeMoney !== false || !isMoneyStageField(stage.key, key))
        .map((key) => `<tr><th>${escapeHtml(fieldLabel.get(key) ?? key)}</th><td>${escapeHtml(shown(stage.data?.[key]))}</td></tr>`)
        .join('')
      const files = docs.filter((doc) => documentCard(def, doc) === card.key).map((doc) => `<li>${escapeHtml(doc.label)} · ${doc.count} file(s)</li>`).join('')
      return `<section><h3><span class="n">${index + 1}</span>${escapeHtml(card.label)}<span class="st ${state?.done ? 'ok' : ''}">${state?.done ? `Done · ${escapeHtml([state.by, when(state.at)].filter(Boolean).join(' · '))}` : 'Not done'}</span></h3>${fields ? `<table>${fields}</table>` : ''}${files ? `<ul>${files}</ul>` : ''}</section>`
    })
    .join('')
  const history = order.events
    .filter((event) => event.stageKey === stage.key)
    .map((event) => `<tr><td>${escapeHtml(when(event.at))}</td><td>${escapeHtml(ACTION_LABEL[event.action] ?? event.action)}</td><td>${escapeHtml(event.note ?? '')}</td><td>${escapeHtml(event.byName ?? '')}</td></tr>`)
    .join('')
  const products = order.lines.map((line) => `${line.product?.title ?? ''} × ${line.quantity}`).join(', ')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(`${order.orderNo} - ${def.label}`)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; font-size: 11px; margin: 0; padding: 24px; }
  .top { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; }
  .brand { font-size: 18px; font-weight: 800; letter-spacing: .06em; }
  .doc { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #475569; font-weight: 700; }
  h1 { margin: 4px 0 0; font-size: 16px; }
  section { margin-top: 12px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; page-break-inside: avoid; }
  h3 { margin: 0 0 6px; font-size: 12px; display: flex; gap: 8px; align-items: baseline; }
  .n { color: #64748b; }
  .st { margin-left: auto; font-weight: 400; color: #b45309; }
  .st.ok { color: #15803d; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 3px 6px; border-top: 1px solid #e2e8f0; vertical-align: top; }
  th { width: 38%; color: #475569; font-weight: 600; }
  ul { margin: 6px 0 0; padding-left: 16px; }
  .history { margin-top: 16px; }
  .history th, .history td { width: auto; font-size: 10px; }
  @media print { body { padding: 0; } }
</style></head><body>
<div class="top"><div><div class="brand">DERMAT INDIA</div><div class="doc">Stage sheet</div><h1>${escapeHtml(def.label)}</h1></div>
<div style="text-align:right"><div style="font-family:Menlo,monospace;font-weight:700">${escapeHtml(order.orderNo)}</div><div>${escapeHtml(order.customer?.name ?? '')}</div><div style="color:#475569">${escapeHtml(products)}</div><div style="color:#475569">Printed ${escapeHtml(when(new Date().toISOString()))}</div></div></div>
${blocks}
${history ? `<div class="history"><div class="doc">History</div><table><tr><th>When</th><th>What</th><th>Note</th><th>Who</th></tr>${history}</table></div>` : ''}
<script>window.addEventListener('load', function () { setTimeout(function () { window.print() }, 200) })</script>
</body></html>`
}

export function openStagePrint(order: Order, stage: Stage, def: StageDef): boolean {
  const popup = window.open('', '_blank', 'width=900,height=1100')
  if (!popup) return false
  popup.document.open()
  popup.document.write(buildStagePrintHtml(order, stage, def))
  popup.document.close()
  return true
}
