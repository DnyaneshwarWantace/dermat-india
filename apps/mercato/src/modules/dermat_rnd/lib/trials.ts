import { DermatOrderLine, DermatOrderStage } from '../../dermat_orders/data/entities'
import { currentUserName, type OrderContext } from '../../dermat_orders/lib/server'
import { createDraftBom, prepareDraftBom } from '../../dermat_boms/lib/service'
import { RdRequest, RdTrial, type RdFormulaLine, type RdReading, type RdRound, type RdTrialStatus } from '../data/entities'
import type { RdAction, RdTrialAction, RdTrialUpdate } from '../data/validators'
import { notifyStabilityFailedAfterApproval } from './notify'
import { RdError, findRequest } from './service'

export const TRIAL_ATTACHMENT_ENTITY = 'dermat_rnd:trial'

export function approvalProofRecordId(trialId: string): string {
  return `${trialId}:approval`
}

export async function approvalProofCounts(ctx: OrderContext, trialIds: string[]): Promise<Map<string, number>> {
  if (!trialIds.length) return new Map()
  const rows = await ctx.em.getConnection().execute<Array<{ record_id: string; files: string | number }>>(
    `select record_id, count(*) as files from attachments
      where entity_id = ? and tenant_id = ? and organization_id = ? and record_id in (${trialIds.map(() => '?').join(', ')})
      group by record_id`,
    [TRIAL_ATTACHMENT_ENTITY, ctx.tenantId, ctx.organizationId, ...trialIds.map(approvalProofRecordId)],
  )
  return new Map(rows.map((row) => [row.record_id.replace(/:approval$/, ''), Number(row.files)]))
}

const PERCENT_TOLERANCE = 0.001
const BOM_BATCH_KG = 100
const EDITABLE: RdTrialStatus[] = ['draft']
const OPEN_REQUEST = ['requested', 'in_progress', 'changes', 'sample_sent']

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function todayIst(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function stampTrial(trial: RdTrial, action: string, by: string | null, note: string | null) {
  trial.history = [...(trial.history ?? []), { action, by, at: new Date().toISOString(), note }]
}

function stampRequest(request: RdRequest, action: string, by: string | null, note: string | null) {
  request.history = [...(request.history ?? []), { action, by, at: new Date().toISOString(), note }]
}

export function formulaTotals(lines: Array<Pick<RdFormulaLine, 'percent' | 'isBalance'>>) {
  const fixed = lines.filter((line) => !line.isBalance).reduce((sum, line) => sum + Number(line.percent || 0), 0)
  const balanceLines = lines.filter((line) => line.isBalance)
  const balance = balanceLines.length ? Math.max(0, 100 - fixed) : 0
  const total = fixed + balance
  return { fixed: round(fixed), balance: round(balance), total: round(total), balanceCount: balanceLines.length }
}

function resolvedLines(lines: RdFormulaLine[]): RdFormulaLine[] {
  const { balance } = formulaTotals(lines)
  return lines.map((line) => (line.isBalance ? { ...line, percent: balance } : line))
}

function assertFormula(lines: RdFormulaLine[]) {
  if (!lines.length) throw new RdError('Add the formula lines first')
  const totals = formulaTotals(lines)
  if (totals.balanceCount > 1) throw new RdError('Only one line can be the balance (q.s. to 100)')
  if (totals.fixed > 100 + PERCENT_TOLERANCE) throw new RdError(`The formula adds up to ${totals.fixed}%. Bring it down to 100%.`)
  if (Math.abs(totals.total - 100) > PERCENT_TOLERANCE) throw new RdError(`The formula adds up to ${totals.total}%. It must be 100%, or mark one line as the balance.`)
}

export async function findTrial(ctx: OrderContext, id: string): Promise<RdTrial> {
  const trial = await ctx.em.findOne(RdTrial, { id, tenantId: ctx.tenantId, organizationId: ctx.organizationId, deletedAt: null })
  if (!trial) throw new RdError('Trial not found', 404)
  return trial
}

export async function listTrials(ctx: OrderContext, requestId: string): Promise<RdTrial[]> {
  return ctx.em.find(RdTrial, { requestId, tenantId: ctx.tenantId, organizationId: ctx.organizationId, deletedAt: null }, { orderBy: { trialNo: 'asc' } })
}

export async function createTrial(ctx: OrderContext, requestId: string, copyFrom: string | null | undefined): Promise<RdTrial> {
  const request = await findRequest(ctx, requestId)
  if (!OPEN_REQUEST.includes(request.status)) throw new RdError('This request is closed. Reopen it to make another trial.', 409)
  const existing = await listTrials(ctx, request.id)
  const source = copyFrom ? existing.find((trial) => trial.id === copyFrom) : existing[existing.length - 1]
  if (copyFrom && !source) throw new RdError('The trial to copy was not found on this request', 404)
  const byName = await currentUserName(ctx)
  const trialNo = (existing[existing.length - 1]?.trialNo ?? 0) + 1
  const trial = ctx.em.create(RdTrial, {
    organizationId: ctx.organizationId,
    tenantId: ctx.tenantId,
    requestId: request.id,
    code: `${request.code}-${String(trialNo).padStart(2, '0')}`,
    trialNo,
    batchDate: todayIst(),
    chemistName: byName,
    batchSize: source?.batchSize ?? '1000',
    batchUnit: source?.batchUnit ?? 'g',
    formula: (source?.formula ?? []).map((line) => ({ ...line })),
  })
  stampTrial(trial, 'created', byName, source ? `Copied from ${source.code}` : null)
  if (request.status === 'requested' || request.status === 'changes') {
    request.status = 'in_progress'
    request.assignedName = request.assignedName ?? byName
    stampRequest(request, 'start', byName, `Trial ${trial.code}`)
  }
  stampRequest(request, 'trial_created', byName, trial.code)
  request.updatedAt = new Date()
  ctx.em.persist(trial)
  await ctx.em.flush()
  return trial
}

export async function updateTrial(ctx: OrderContext, trial: RdTrial, input: RdTrialUpdate) {
  if (!EDITABLE.includes(trial.status)) throw new RdError('Only a draft trial can be changed. Make a new trial to try another formula.', 409)
  const totals = formulaTotals(input.formula)
  if (totals.balanceCount > 1) throw new RdError('Only one line can be the balance (q.s. to 100)')
  trial.batchDate = input.batchDate ?? null
  trial.chemistName = clean(input.chemistName)
  trial.batchSize = input.batchSize == null ? null : String(input.batchSize)
  trial.batchUnit = input.batchUnit
  trial.aim = clean(input.aim)
  trial.procedure = clean(input.procedure)
  trial.formula = input.formula.map((line) => ({
    id: line.id,
    phase: clean(line.phase),
    productId: line.productId ?? null,
    code: clean(line.code),
    name: line.name.trim(),
    function: clean(line.function),
    percent: round(Number(line.percent) || 0),
    isBalance: line.isBalance,
    note: clean(line.note),
  }))
  trial.updatedAt = new Date()
  await ctx.em.flush()
}

async function approve(ctx: OrderContext, trial: RdTrial, byName: string | null) {
  if (trial.status !== 'passed') throw new RdError('Approve a trial after its lab result is a pass', 409)
  const request = await findRequest(ctx, trial.requestId)
  if (request.approvedTrialId && request.approvedTrialId !== trial.id) {
    const previous = await ctx.em.findOne(RdTrial, { id: request.approvedTrialId, tenantId: ctx.tenantId, organizationId: ctx.organizationId, deletedAt: null })
    if (previous && previous.status === 'approved') {
      previous.status = 'passed'
      stampTrial(previous, 'replaced', byName, `Replaced by ${trial.code}`)
    }
  }
  trial.status = 'approved'
  request.approvedTrialId = trial.id
  request.bomId = null
  request.bomProductId = null
  stampRequest(request, 'formula_approved', byName, `${trial.code}${trial.stabilityStatus === 'running' ? ' (stability still running)' : ''}`)
  request.updatedAt = new Date()
  if (request.orderId) {
    const stage = await ctx.em.findOne(DermatOrderStage, { orderId: request.orderId, stageKey: 'sampling' })
    if (stage) stage.data = { ...(stage.data ?? {}), rd_number: trial.code }
    const lines = await ctx.em.find(DermatOrderLine, { orderId: request.orderId })
    for (const line of lines) if (!line.rdNumber || line.rdNumber === request.code || line.rdNumber.startsWith(`${request.code}-`)) line.rdNumber = trial.code
  }
}

async function makeBom(ctx: OrderContext, trial: RdTrial, productId: string | undefined, byName: string | null) {
  if (trial.status !== 'approved') throw new RdError('Approve the trial before making its BOM', 409)
  if (!(await approvalProofCounts(ctx, [trial.id])).get(trial.id)) throw new RdError('Upload the approval proof (photo or screenshot of the client approval) on this trial first', 409)
  if (!productId) throw new RdError('Pick the Bulk product this formula is for')
  const lines = resolvedLines(trial.formula ?? [])
  const unlinked = lines.filter((line) => !line.productId)
  if (unlinked.length) throw new RdError(`Link these lines to a material in the product master first: ${unlinked.map((line) => line.name).join(', ')}`)
  const merged = new Map<string, number>()
  for (const line of lines) merged.set(line.productId as string, round((merged.get(line.productId as string) ?? 0) + Number(line.percent)))
  const input = {
    productId,
    batchSize: BOM_BATCH_KG,
    notes: `From R&D trial ${trial.code}`,
    items: Array.from(merged.entries()).filter(([, percent]) => percent > 0).map(([componentProductId, value]) => ({ componentProductId, value })),
  }
  const prepared = await prepareDraftBom(ctx, input)
  if (prepared.kind !== 'formula') throw new RdError('Pick a Bulk or R&D product. Finished goods use a pack BOM.')
  const bom = await createDraftBom(ctx, input, prepared)
  const request = await findRequest(ctx, trial.requestId)
  request.bomId = bom.id
  request.bomProductId = productId
  stampRequest(request, 'bom_made', byName, `${trial.code} → ${prepared.product.title}`)
  stampTrial(trial, 'bom_made', byName, prepared.product.title)
  request.updatedAt = new Date()
  return bom
}

export async function actOnTrial(ctx: OrderContext, trial: RdTrial, input: RdTrialAction): Promise<{ bomId?: string }> {
  const byName = await currentUserName(ctx)
  let note: string | null = clean(input.remarks) ?? clean(input.note)
  let bomId: string | undefined
  let failedAfterApproval: RdRequest | null = null
  switch (input.action) {
    case 'submit':
      if (trial.status !== 'draft') throw new RdError('Only a draft trial can be sent for testing', 409)
      assertFormula(trial.formula ?? [])
      trial.formula = resolvedLines(trial.formula ?? [])
      trial.status = 'testing'
      break
    case 'record_result':
      if (!['testing', 'passed', 'failed'].includes(trial.status)) throw new RdError('Send the trial for testing first', 409)
      if (!input.result) throw new RdError('Is the result a pass or a fail?')
      trial.observations = { values: input.values ?? {}, result: input.result, remarks: clean(input.remarks), by: byName, at: new Date().toISOString() }
      trial.status = input.result === 'pass' ? 'passed' : 'failed'
      note = `${input.result === 'pass' ? 'Pass' : 'Fail'}${note ? ` · ${note}` : ''}`
      break
    case 'start_stability': {
      if (!['testing', 'passed', 'approved'].includes(trial.status)) throw new RdError('Start stability once the trial is made and sent for testing', 409)
      if (trial.stabilityStatus === 'running') throw new RdError('Stability is already running for this trial', 409)
      const conditions = (input.conditions ?? []).filter(Boolean)
      const checkpoints = Array.from(new Set(input.checkpoints ?? [])).sort((left, right) => left - right)
      if (!conditions.length) throw new RdError('Pick at least one storage condition')
      if (!checkpoints.length) throw new RdError('Pick at least one checkpoint day')
      trial.stability = { startDate: input.startDate ?? todayIst(), conditions, checkpoints, readings: trial.stability?.readings ?? [], conclusion: null }
      trial.stabilityStatus = 'running'
      note = `${conditions.join(', ')} · days ${checkpoints.join(', ')}`
      break
    }
    case 'record_reading': {
      const study = trial.stability
      if (!study || trial.stabilityStatus !== 'running') throw new RdError('Start the stability study first', 409)
      if (!input.condition || !study.conditions.includes(input.condition)) throw new RdError('Pick a condition of this study')
      if (input.day == null || !study.checkpoints.includes(input.day)) throw new RdError('Pick a checkpoint day of this study')
      if (!input.result) throw new RdError('Is this reading a pass or a fail?')
      const reading: RdReading = { condition: input.condition, day: input.day, date: input.readingDate ?? todayIst(), values: input.values ?? {}, result: input.result, remarks: clean(input.remarks), by: byName, at: new Date().toISOString() }
      trial.stability = { ...study, readings: [...study.readings.filter((entry) => !(entry.condition === reading.condition && entry.day === reading.day)), reading] }
      note = `${reading.condition} · day ${reading.day} · ${reading.result}`
      break
    }
    case 'finish_stability':
      if (!trial.stability || trial.stabilityStatus !== 'running') throw new RdError('Stability is not running for this trial', 409)
      if (!input.result) throw new RdError('Did the stability study pass or fail?')
      trial.stability = { ...trial.stability, conclusion: clean(input.remarks), endDate: input.readingDate ?? todayIst() }
      trial.stabilityStatus = input.result === 'pass' ? 'passed' : 'failed'
      if (input.result === 'fail' && trial.status === 'approved') {
        const request = await findRequest(ctx, trial.requestId)
        stampRequest(request, 'stability_failed', byName, `${trial.code}${note ? ` · ${note}` : ''}`)
        request.updatedAt = new Date()
        failedAfterApproval = request
      }
      break
    case 'record_micro':
      if (trial.status === 'draft') throw new RdError('Send the trial for testing first', 409)
      if (input.microRequired === false) {
        trial.micro = { required: false, testingDate: null, values: {}, releasedDate: null, result: null, remarks: clean(input.remarks), by: byName, at: new Date().toISOString() }
        note = 'Micro not required'
        break
      }
      if (!input.result) throw new RdError('Is the micro result a pass or a fail?')
      trial.micro = { required: true, testingDate: input.testingDate ?? todayIst(), values: input.values ?? {}, releasedDate: input.releasedDate ?? null, result: input.result, remarks: clean(input.remarks), by: byName, at: new Date().toISOString() }
      note = `Micro ${input.result}${note ? ` · ${note}` : ''}`
      break
    case 'set_details':
      trial.productCode = clean(input.productCode)
      trial.sampleReceivedBy = clean(input.sampleReceivedBy)
      note = null
      break
    case 'approve':
      await approve(ctx, trial, byName)
      break
    case 'reject':
      if (trial.status === 'approved' || trial.status === 'rejected') throw new RdError('This trial is already closed', 409)
      if (!note) throw new RdError('Write why the trial is rejected')
      trial.status = 'rejected'
      break
    case 'reopen':
      if (!['rejected', 'failed', 'testing'].includes(trial.status)) throw new RdError('Only a trial in testing, failed or rejected can go back to draft', 409)
      trial.status = 'draft'
      trial.observations = null
      break
    case 'make_bom': {
      const bom = await makeBom(ctx, trial, input.productId, byName)
      bomId = bom.id
      break
    }
  }
  if (input.action !== 'make_bom' && input.action !== 'set_details') stampTrial(trial, input.action, byName, note)
  trial.updatedAt = new Date()
  await ctx.em.flush()
  if (failedAfterApproval) await notifyStabilityFailedAfterApproval(ctx, failedAfterApproval, trial, clean(input.remarks))
  return { bomId }
}

export function trialView(trial: RdTrial, proofCount = 0) {
  const lines = resolvedLines(trial.formula ?? [])
  const totals = formulaTotals(trial.formula ?? [])
  const batch = trial.batchSize == null ? null : Number(trial.batchSize)
  return {
    id: trial.id,
    requestId: trial.requestId,
    code: trial.code,
    trialNo: trial.trialNo,
    status: trial.status,
    batchDate: trial.batchDate ?? null,
    chemistName: trial.chemistName ?? null,
    batchSize: batch,
    batchUnit: trial.batchUnit,
    aim: trial.aim ?? null,
    procedure: trial.procedure ?? null,
    formula: lines.map((line) => ({ ...line, quantity: batch == null ? null : round((batch * Number(line.percent)) / 100, 3) })),
    totals,
    observations: trial.observations ?? null,
    stability: trial.stability ?? null,
    stabilityStatus: trial.stabilityStatus,
    productCode: trial.productCode ?? null,
    sampleReceivedBy: trial.sampleReceivedBy ?? null,
    micro: trial.micro ?? null,
    approvalProofs: proofCount,
    history: trial.history ?? [],
    createdAt: trial.createdAt.toISOString(),
    updatedAt: trial.updatedAt.toISOString(),
  }
}

export type RdTrialView = ReturnType<typeof trialView>

function applyActives(lines: RdFormulaLine[], add: RdAction['addActives'], remove: RdAction['removeActives']): RdFormulaLine[] {
  const removed = new Set((remove ?? []).map((name) => name.toLowerCase()))
  const kept = lines.filter((line) => !removed.has(line.name.toLowerCase()) && !(line.code && removed.has(line.code.toLowerCase())))
  const present = new Set(kept.map((line) => line.productId).filter(Boolean))
  const added = (add ?? []).filter((ref) => !present.has(ref.productId)).map((ref, index) => ({
    id: `fb-${Date.now().toString(36)}-${index}`,
    phase: null,
    productId: ref.productId,
    code: ref.code,
    name: ref.name,
    function: 'Active',
    percent: 0,
    isBalance: false,
    note: 'Added from client feedback',
  }))
  return [...kept, ...added]
}

function feedbackNote(round: RdRound, input: RdAction): string {
  const parts = [`Client feedback (round ${round.round})${input.feedback ? `: ${input.feedback.trim()}` : ''}`]
  if (input.addActives?.length) parts.push(`Add: ${input.addActives.map((ref) => ref.name).join(', ')}`)
  if (input.removeActives?.length) parts.push(`Remove: ${input.removeActives.join(', ')}`)
  return parts.join(' · ')
}

export async function followUpFeedback(ctx: OrderContext, request: RdRequest, input: RdAction) {
  const rounds = request.rounds ?? []
  const round = rounds[rounds.length - 1]
  if (!round || !round.result || round.result === 'approved') return
  const byName = await currentUserName(ctx)
  const trials = await listTrials(ctx, request.id)
  const source = (round.trialId ? trials.find((trial) => trial.id === round.trialId) : null) ?? trials[trials.length - 1] ?? null
  const step = round.result === 'rejected' || !source ? 'new' : input.nextStep ?? 'new'
  const note = feedbackNote(round, input)
  if (source && round.result === 'rejected' && !['approved', 'rejected'].includes(source.status)) {
    source.status = 'rejected'
    stampTrial(source, 'reject', byName, note)
  }
  if (step === 'same' && source) {
    if (request.approvedTrialId === source.id) request.approvedTrialId = null
    source.status = 'draft'
    source.observations = null
    source.aim = [source.aim, note].filter(Boolean).join('\n')
    source.formula = applyActives(source.formula ?? [], input.addActives, input.removeActives)
    stampTrial(source, 'revision', byName, note)
    source.updatedAt = new Date()
    round.nextStep = 'same'
    round.nextTrialCode = source.code
  } else {
    const created = await createTrial(ctx, request.id, source?.id ?? null)
    created.aim = note
    created.formula = applyActives(created.formula ?? [], input.addActives, input.removeActives)
    round.nextStep = 'new'
    round.nextTrialCode = created.code
  }
  request.rounds = [...rounds.slice(0, -1), { ...round }]
  request.updatedAt = new Date()
  await ctx.em.flush()
}
