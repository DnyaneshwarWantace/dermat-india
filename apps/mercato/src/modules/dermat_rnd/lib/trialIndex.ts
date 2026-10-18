import type { RdRequest, RdTrial } from '../data/entities'

const TRIAL_STATUS: Record<string, string> = { draft: 'Draft', testing: 'In testing', passed: 'Passed', failed: 'Failed', approved: 'Approved', rejected: 'Rejected' }
const STABILITY_STATUS: Record<string, string> = { not_started: 'Not started', running: 'Running', passed: 'Passed', failed: 'Failed' }
const REQUEST_STATUS: Record<string, string> = { requested: 'Requested', in_progress: 'In progress', sample_sent: 'Sample with client', changes: 'Changes asked', approved: 'Approved', dropped: 'Dropped' }

export const TRIAL_INDEX_GROUPS: Array<{ title: string; span: number }> = [
  { title: 'Product Development Details', span: 15 },
  { title: 'Quality Evaluation & Stability', span: 11 },
  { title: 'Microbiological Parameters Result', span: 9 },
]

export const TRIAL_INDEX_COLUMNS = [
  'Trial No.', 'Date of Trial', 'Product Name', 'Product code', 'Batch No.', 'Processed by', 'Approval Status', 'Reason for trial', 'Ingredients / Brief', 'Fragrance name & %', 'Client Name', 'Brief by', 'Reason for trial', 'Batch Size', 'Sample Received By',
  'Stability @40°C Start', 'Stability @40°C End', 'Photo on approval', 'Description', 'pH', 'Density @25°C (g/ml)', 'Centrifuge (3000 RPM, 30 min)', 'Viscosity @25°C (mPa.s)', 'Stability Status', 'R&D Status', 'Remarks',
  'Testing date', 'TAMC', 'TYMC', 'S.aureus', 'P.aeruginosa', 'E.coli', 'Salmonella', 'Released date', 'Status',
]

function pick(values: Record<string, string> | undefined, pattern: RegExp): string {
  if (!values) return ''
  const key = Object.keys(values).find((name) => pattern.test(name))
  return key ? values[key] : ''
}

function fragranceOf(request: RdRequest, trial: RdTrial): string {
  const lines = (trial.formula ?? []).filter((line) => /fragrance|perfume|parfum/i.test(`${line.function ?? ''} ${line.name}`))
  if (lines.length) return lines.map((line) => `${line.name} ${line.percent}%`).join('; ')
  return request.fragrance ?? ''
}

function briefOf(request: RdRequest): string {
  const ingredients = request.ingredientRefs?.length ? request.ingredientRefs.map((ref) => ref.name).join(', ') : request.ingredients ?? ''
  return [ingredients, request.clientInstruction].filter(Boolean).join(' · ')
}

export function trialIndexRow(request: RdRequest, trial: RdTrial, proofs: number): string[] {
  const values = trial.observations?.values
  const micro = trial.micro
  const microStatus = micro ? (micro.required ? (micro.result === 'pass' ? 'Pass' : micro.result === 'fail' ? 'Fail' : '') : 'Micro not required') : ''
  const remarks = [trial.observations?.remarks, trial.stability?.conclusion].filter(Boolean).join(' · ')
  return [
    String(trial.trialNo),
    trial.batchDate ?? '',
    request.productName,
    trial.productCode ?? '',
    trial.code,
    trial.chemistName ?? '',
    TRIAL_STATUS[trial.status] ?? trial.status,
    trial.aim ?? '',
    briefOf(request),
    fragranceOf(request, trial),
    request.customerName ?? (request.kind === 'npd' ? 'New product' : ''),
    request.requestedByName ?? '',
    trial.aim ?? '',
    trial.batchSize == null ? '' : `${Number(trial.batchSize)} ${trial.batchUnit}`,
    trial.sampleReceivedBy ?? '',
    trial.stability?.startDate ?? '',
    trial.stability?.endDate ?? '',
    proofs > 0 ? 'Yes' : '',
    pick(values, /^description$/i) || pick(values, /appearance/i),
    pick(values, /^ph\b/i),
    pick(values, /density|specific gravity/i),
    pick(values, /centrifuge/i),
    pick(values, /viscosity/i),
    STABILITY_STATUS[trial.stabilityStatus] ?? trial.stabilityStatus,
    REQUEST_STATUS[request.status] ?? request.status,
    remarks,
    micro?.testingDate ?? '',
    pick(micro?.values, /tamc/i),
    pick(micro?.values, /tymc/i),
    pick(micro?.values, /aureus/i),
    pick(micro?.values, /aeruginosa/i),
    pick(micro?.values, /coli/i),
    pick(micro?.values, /salmonella/i),
    micro?.releasedDate ?? '',
    microStatus,
  ]
}
