import type { BprView } from '../lib/bprRecord'
import type { BprSection } from '../lib/bpr'
import { companyHeader, type DocCompany } from './printDocs'

function esc(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function num(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : value.toLocaleString('en-IN', { maximumFractionDigits: 3 })
}

function day(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  return Number.isNaN(date.getTime()) ? esc(value) : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function clock(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function blankRows(count: number, columns: number): string {
  return Array.from({ length: count }, () => `<tr>${'<td>&nbsp;</td>'.repeat(columns)}</tr>`).join('')
}

export function buildBprHtml(bpr: BprView, company: DocCompany | null): string {
  const verified = (section: BprSection) => {
    const entry = bpr.verify[section]
    return entry ? `${esc(entry.by ?? '')}<div class="muted">${day(entry.at)}</div>` : ''
  }
  const product = bpr.products.map((entry) => esc(entry.title)).join(', ')
  const code = bpr.products.map((entry) => esc(entry.code ?? '')).filter(Boolean).join(', ')
  const header = (title: string) => `<table class="head"><tr><th colspan="4" class="title">${title}</th></tr><tr><td class="k">Product Name</td><td>${product}</td><td class="k">BPR No.</td><td class="mono">${esc(bpr.bprNo)}</td></tr><tr><td class="k">Batch No.</td><td class="mono">${esc(bpr.batchNo)}</td><td class="k">Product Code</td><td class="mono">${code}</td></tr></table>`
  const pmRows = bpr.pm
    .map((row, index) => `<tr><td>${index + 1}.</td><td>${esc(row.title)}<div class="mono">${esc(row.code ?? '')}</div></td><td class="r">${num(row.required)} ${esc(row.unit)}</td><td class="r">${num(row.issued)} ${esc(row.unit)}</td><td>${esc(row.issuedBy ?? '')}</td><td>${esc(row.receivedBy ?? '')}</td><td>${verified('pm_issue')}</td></tr>`)
    .join('')
  const cleaningRows = bpr.cleaning
    .map((row, index) => `<tr><td>${index + 1}.</td><td>${esc(row.equipment)}</td><td class="mono">${esc(row.equipmentId ?? '')}</td><td>${esc(row.method ?? '')}</td><td>${esc(row.status)}</td><td>${esc(row.by ?? '')}<div class="muted">${day(row.at)}</div></td><td>${verified('cleaning')}</td></tr>`)
    .join('')
  const log = bpr.fillingLog
  const hours = log.minutes === null ? '' : `${Math.floor(log.minutes / 60)} h ${log.minutes % 60} min`
  const weights = (values: number[] | undefined) => Array.from({ length: 4 }, (_, index) => `<td class="r">${num(values?.[index] ?? null)}</td>`).join('')
  const okText = (value: boolean | undefined) => (value === undefined ? '' : value ? 'Ok' : '<b>Not Ok</b>')
  const inProcessRows = bpr.inProcess
    .map((row) => `<tr><td>${day(row.at)}</td><td>${clock(row.at)}</td>${weights(row.weights ?? (row.weightG != null ? [row.weightG] : []))}<td class="r">${num(row.avg ?? row.weightG ?? null)}</td><td class="r">${num(row.temp ?? null)}</td><td class="r">${num(row.rh ?? null)}</td><td>${okText(row.bottleOk)}</td><td>${okText(row.capOk)}</td><td>${esc(row.by ?? '')}</td><td>${verified('in_process')}</td></tr>`)
    .join('')
  const leakRows = bpr.leak
    .map((row, index) => `<tr><td>${index + 1}</td><td>${clock(row.at)}<div class="muted">${day(row.at)}</div></td><td class="r">${num(Number(row.tested))}</td><td class="r">${num(Number(row.failed))}</td><td>${esc(row.by ?? '')}</td><td>${verified('leak')}</td></tr>`)
    .join('')
  const packingRows = bpr.pm
    .filter((row) => row.stageKey === 'packing' || row.stageKey === 'filling')
    .map((row, index) => `<tr><td>${index + 1}</td><td>${esc(row.title)}</td><td class="r">${num(row.required)}</td><td class="r">${num(row.issued)}</td><td class="r">${num(row.used)}</td><td class="r">${num(row.returned)}</td><td>${esc(row.receivedBy ?? '')}</td><td>${verified('packing_report')}</td><td class="r">${num(row.destroyed)}</td></tr>`)
    .join('')
  const release = bpr.release
  const complies = release.decision === 'Released' ? 'complies' : release.decision ? 'does not comply' : 'complies / does not comply'
  const releaseWord = release.decision === 'Released' ? 'release' : release.decision ? 'not to release' : 'release / not to release'
  const report = bpr.packingReport
  const w = bpr.weight
  return `<!doctype html><html><head><meta charset="utf-8"><title>BPR ${esc(bpr.batchNo)}</title>
  <style>
    *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1c1917;margin:0;padding:24px;font-size:10.5px}
    .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1c1917;padding-bottom:10px;margin-bottom:10px}
    h2{font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin:16px 0 5px}
    .muted{color:#78716c;font-size:9px} .mono{font-family:ui-monospace,Menlo,monospace}
    table{width:100%;border-collapse:collapse;margin-bottom:4px} th,td{border:1px solid #57534e;padding:4px 5px;vertical-align:top;text-align:left}
    th{font-size:9px;background:#f5f5f4} .r{text-align:right;white-space:nowrap}
    .head .title{text-align:center;font-size:13px;letter-spacing:.1em;background:#fff} .head .k{width:16%;font-weight:600;background:#fafaf9}
    .lines{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin:6px 0} .lines div{border-bottom:1px dotted #a8a29e;padding:3px 0} .lines b{font-weight:600}
    .cert{border:1px solid #57534e;padding:8px;margin-top:6px;line-height:1.5}
    .signs{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:36px} .signs div{border-top:1px solid #57534e;padding-top:4px;text-align:center}
    .page{page-break-before:always}
    @media print{body{padding:10mm}}
  </style></head><body>
  <div class="top">${companyHeader(company, 'Batch packing record')}<div class="muted">${esc(bpr.orderNo)}</div></div>
  ${header('BATCH PACKING RECORD')}
  <h2>Packing material</h2>
  <table><thead><tr><th>Sr. No.</th><th>Packing Material</th><th class="r">Qty. Required</th><th class="r">Qty. actual issued</th><th>Issued by Store</th><th>Checked by Prod.</th><th>Verify by QA</th></tr></thead><tbody>${pmRows || blankRows(4, 7)}</tbody></table>
  <h2>Equipment cleaning — packing section</h2>
  <table><thead><tr><th>Sr. No.</th><th>Equipment Name</th><th>Equipment ID</th><th>Equipment Cleaning</th><th>Cleaned Status</th><th>Checked by (Production)</th><th>Verified by (QA)</th></tr></thead><tbody>${cleaningRows || blankRows(4, 7)}</tbody></table>
  <h2>Filling / Sealing / Crimping</h2>
  <table><thead><tr><th>Date</th><th>Temp &amp; RH</th><th>Starting time</th><th>Switch off time</th><th>Total time</th><th>Name of Operator</th><th>Production Chemist</th><th>Remark</th></tr></thead><tbody><tr><td>${day(log.date)}</td><td>${log.areaTemp !== null ? `${num(log.areaTemp)} °C` : ''}${log.areaRh !== null ? ` · ${num(log.areaRh)}% RH` : ''}</td><td>${clock(log.startedAt)}</td><td>${clock(log.stoppedAt)}</td><td>${hours}</td><td>${esc(log.operator ?? '')}</td><td>${esc(log.chemist ?? '')}</td><td>${esc(log.remarks ?? '')}</td></tr></tbody></table>
  <h2>Weight variation chart</h2>
  <table><thead><tr><th>Wt. of empty bottle</th><th>Wt. of filled bottle</th><th>% Limit allowed ml/gm</th><th>Maximum Limit</th><th>Minimum Limit</th></tr></thead><tbody><tr><td class="r">${num(w.empty)}</td><td class="r">${num(w.filled)}</td><td class="r">${w.percent !== null ? `± ${num(w.percent)} %` : ''}</td><td class="r">${num(w.limits?.max ?? null)}</td><td class="r">${num(w.limits?.min ?? null)}</td></tr></tbody></table>
  <h2>In-process</h2>
  <table><thead><tr><th rowspan="2">Date</th><th rowspan="2">Time</th><th colspan="5">Weight ml/gm${w.limits ? ` (Limit ${num(w.limits.min)} to ${num(w.limits.max)})` : ''}</th><th rowspan="2">Area Temp (°C)</th><th rowspan="2">%RH</th><th rowspan="2">Bottle/Tube Quality</th><th rowspan="2">Capping / crimping</th><th rowspan="2">Checked By</th><th rowspan="2">Verified by</th></tr><tr><th>1</th><th>2</th><th>3</th><th>4</th><th>Avg wt.</th></tr></thead><tbody>${inProcessRows || blankRows(6, 13)}</tbody></table>
  <div class="lines"><div>Quantity Filled: <b>${num(bpr.filledUnits)}</b></div><div>Temp. of Area: <b>${log.areaTemp !== null ? `${num(log.areaTemp)} °C` : ''}</b></div><div>Name of the Operator: <b>${esc(log.operator ?? '')}</b></div></div>
  <div class="page"></div>
  ${header('BATCH PACKING RECORD')}
  <h2>Leak test parameter</h2>
  <table><thead><tr><th>Sr. No</th><th>Time</th><th class="r">No. of bottles used for test</th><th class="r">No. of bottles failed in test</th><th>Done By</th><th>QA Verified By</th></tr></thead><tbody>${leakRows || blankRows(4, 6)}</tbody></table>
  <h2>Packing report</h2>
  <div class="lines"><div>Date of Packing: <b>${day(report.packedOn)}</b></div><div>P.M. Requisition given by: <b>${esc(report.requisitionBy ?? '')}</b></div><div>Batch No.: <b>${esc(bpr.batchNo)}</b></div><div>Label coded by: <b>${esc(report.labelCodedBy ?? '')}</b></div><div>Batch Size: <b>${bpr.batchSizeKg !== null ? `${num(bpr.batchSizeKg)} kg` : ''} · ${num(bpr.ordered)} pcs</b></div><div>Cartons coded by: <b>${esc(report.cartonsCodedBy ?? '')}</b></div></div>
  <table><thead><tr><th>Sr. No.</th><th>Packing material</th><th class="r">Qty. Required</th><th class="r">Qty. actual issued</th><th class="r">Qty. used</th><th class="r">Qty. Return</th><th>Checked by Prod.</th><th>Verify by QA</th><th class="r">Destroy Qty</th></tr></thead><tbody>${packingRows || blankRows(7, 9)}</tbody></table>
  <div class="lines"><div>Total Qty. Packed: <b>${num(report.packed)}</b></div><div>Date of Completion: <b>${day(report.completedAt)}</b></div></div>
  <h2>Release to finished goods store</h2>
  <div class="lines"><div>QC Report No.: <b>${release.qcReports.map((entry) => esc(entry.code)).join(', ')}</b></div><div>Date: <b>${release.qcReports.map((entry) => day(entry.date)).join(', ')}</b></div><div>Release Order No.: <b>${esc(release.releaseOrderNo ?? '')}</b></div><div>Date: <b>${day(release.decisionDate)}</b></div><div>Batch Size: <b>${num(bpr.ordered)} pcs</b></div><div>Quantity Released: <b>${num(release.qtyReleased)}</b></div></div>
  <div class="cert">Remarks – ${esc(release.remarks ?? '')}<br>The above batch has been manufactured under my supervision and in my opinion the above product's quality <b>${complies}</b> with the prescribed standard of quality. I have gone through the batch production records and test report of the final product and do hereby certify to <b>${releaseWord}</b> the finished product for sale and distribution.</div>
  <div class="lines"><div>At random inspection — random checking carried out by: <b>${esc(release.qaChemist ?? '')}</b></div></div>
  <div class="signs"><div>Q.A. Chemist / Sign &amp; Date<br><b>${esc(release.qaChemist ?? '')}</b></div><div>Q.A. / Q.C. Manager / Sign &amp; Date<br><b>${esc(release.qaManager ?? '')}</b> ${day(release.decisionDate)}</div></div>
  <script>window.addEventListener('load', function () { setTimeout(function () { window.print() }, 200) })</script>
  </body></html>`
}

export function printBpr(bpr: BprView, company: DocCompany | null): boolean {
  const popup = window.open('', '_blank', 'width=1000,height=1100')
  if (!popup) return false
  popup.document.open()
  popup.document.write(buildBprHtml(bpr, company))
  popup.document.close()
  return true
}
