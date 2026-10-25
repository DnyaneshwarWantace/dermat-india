import { DermatOrder, DermatOrderStage } from '../data/entities'
import { StoreRequest } from '../../dermat_store/data/entities'
import { batchFile, type BatchViewer } from './batches'
import { logEvent } from './engine'
import { BPR_SECTIONS, weightLimits, type BprEntry, type BprSection, type FillingCheck } from './bpr'
import { OrderError, currentUserName, hasFeatures, type OrderContext } from './server'
import { stageWorkFeatures, stepOwners, stepStates, stageDef } from './stages'

type BprData = { cleaning?: BprEntry[]; leak?: BprEntry[]; destroyed?: Record<string, number>; verify?: Partial<Record<BprSection, { by: string | null; at: string }>> }

const text = (value: unknown): string | null => (value === null || value === undefined || value === '' ? null : String(value))
const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function bprOf(stage: DermatOrderStage | undefined): BprData {
  const raw = stage?.data?.__bpr
  return raw && typeof raw === 'object' ? (raw as BprData) : {}
}

async function primaryStages(ctx: OrderContext, orderId: string) {
  const stages = await ctx.em.find(DermatOrderStage, { orderId, stageKey: { $in: ['filling', 'packing', 'qc_qa'] }, tenantId: ctx.tenantId, organizationId: ctx.organizationId })
  return new Map(stages.map((stage) => [stage.stageKey, stage]))
}

export async function bprView(ctx: OrderContext, batchNo: string, viewer: BatchViewer) {
  const file = await batchFile(ctx, batchNo, viewer)
  const orderId = file.orders[0]?.id
  if (!orderId) throw new OrderError(`Batch ${batchNo} not found`, 404)
  const readable = (key: string) => viewer.access.full || viewer.access.view.has(key)
  if (!['filling', 'packing', 'qc_qa'].some(readable)) throw new OrderError('The batch packing record is for Production and QA', 403)
  const stages = await primaryStages(ctx, orderId)
  const filling = stages.get('filling')
  const packing = stages.get('packing')
  const qa = stages.get('qc_qa')
  const fillData = (readable('filling') ? filling?.data : null) ?? {}
  const packData = (readable('packing') ? packing?.data : null) ?? {}
  const qaData = (readable('qc_qa') ? qa?.data : null) ?? {}
  const fillSteps = stepStates(fillData)
  const qaSteps = stepStates(qaData)
  const packBpr = bprOf(packing)
  const fillBpr = bprOf(filling)
  const requests = await ctx.em.find(StoreRequest, { orderId: { $in: file.orders.map((order) => order.id) }, tenantId: ctx.tenantId, organizationId: ctx.organizationId })
  const byRequest = new Map(requests.map((request) => [request.id, request]))
  const pm = file.materials
    .filter((material) => material.store === 'pm' || ['filling', 'packing'].includes(material.stageKey))
    .map((material) => {
      const request = byRequest.get(material.requestId)
      return {
        stageKey: material.stageKey,
        requestCode: material.requestCode,
        productId: material.productId,
        title: material.title,
        code: material.code,
        unit: material.unit,
        required: material.required,
        issued: material.issued,
        used: material.used,
        returned: material.returned,
        destroyed: packBpr.destroyed?.[material.productId] ?? null,
        issuedBy: Array.from(new Set(material.lots.map((lot) => lot.by).filter(Boolean))).join(', ') || null,
        requestedBy: request?.requestedByName ?? null,
        receivedBy: request?.receivedByName ?? null,
      }
    })
  const startedAt = text(fillSteps.started?.at)
  const stoppedAt = text(fillSteps.filled?.at)
  const minutes = startedAt && stoppedAt ? Math.max(0, Math.round((new Date(stoppedAt).getTime() - new Date(startedAt).getTime()) / 60000)) : null
  const checks = Array.isArray(fillData.__checks) ? (fillData.__checks as FillingCheck[]) : []
  const qcChecks = file.checks.filter((check) => ['packing', 'filling'].includes(check.stageKey ?? '') || check.operation === 'packing')
  return {
    batchNo: file.batchNo,
    bprNo: `BPR/${file.batchNo}`,
    orderNo: file.orders.map((order) => order.orderNo).join(', '),
    products: file.products,
    batchSizeKg: file.bulkKg,
    ordered: file.ordered,
    pm,
    cleaning: readable('packing') ? packBpr.cleaning ?? [] : [],
    fillingLog: {
      date: text(fillData.filling_date) ?? (startedAt ? startedAt.slice(0, 10) : null),
      areaTemp: num(fillData.area_temp),
      areaRh: num(fillData.area_rh),
      startedAt,
      stoppedAt,
      minutes,
      operator: text(fillData.operator),
      chemist: text(fillData.chemist),
      machine: text(fillData.machine),
      remarks: text(fillData.remarks),
    },
    weight: { empty: num(fillData.empty_weight), filled: num(fillData.filled_weight), percent: num(fillData.weight_limit_percent), limits: weightLimits(fillData) },
    inProcess: checks,
    filledUnits: num(fillData.filled_units),
    leak: readable('filling') ? fillBpr.leak ?? [] : [],
    packingReport: {
      packedOn: text(packData.packed_on),
      requisitionBy: Array.from(new Set(pm.filter((row) => row.stageKey === 'packing').map((row) => row.requestedBy).filter(Boolean))).join(', ') || null,
      labelCodedBy: text(packData.label_coded_by),
      cartonsCodedBy: text(packData.cartons_coded_by),
      packed: num(packData.packed_qty),
      completedAt: packing?.completedAt ? packing.completedAt.toISOString() : null,
    },
    release: {
      qcReports: qcChecks.map((check) => ({ code: check.arNo ?? check.code, status: check.status, date: check.createdAt.slice(0, 10) })),
      releaseOrderNo: text(qaData.release_order_no),
      decisionDate: text(qaData.released_on),
      qtyReleased: num(qaData.qty_released),
      decision: text(qaData.qc_result),
      remarks: text(qaData.remarks),
      qaChemist: text(qaSteps.qc_review?.by),
      qaManager: text(qaSteps.released?.by),
    },
    verify: packBpr.verify ?? {},
  }
}

export const BPR_KINDS = ['cleaning', 'leak', 'destroyed', 'verify', 'remove'] as const
export type BprAction =
  | { kind: 'cleaning'; equipment: string; equipmentId?: string | null; method?: string | null; status: 'Clean' | 'Not clean' }
  | { kind: 'leak'; tested: number; failed: number; note?: string | null }
  | { kind: 'destroyed'; productId: string; quantity: number }
  | { kind: 'verify'; section: BprSection }
  | { kind: 'remove'; list: 'cleaning' | 'leak'; at: string }

async function mayAny(ctx: OrderContext, features: string[]): Promise<boolean> {
  for (const feature of features) if (await hasFeatures(ctx, [feature])) return true
  return false
}

function stageWorkers(stageKey: string): string[] {
  const def = stageDef(stageKey)
  return Array.from(new Set([...stageWorkFeatures(stageKey), ...(def?.steps ?? []).flatMap((step) => stepOwners(stageKey, step))]))
}

const QA_FEATURES = ['dermat_orders.work.qa', 'dermat_orders.work.ipqa']

export async function applyBprAction(ctx: OrderContext, batchNo: string, action: BprAction) {
  const file = await batchFile(ctx, batchNo)
  const orderId = file.orders[0]?.id
  if (!orderId) throw new OrderError(`Batch ${batchNo} not found`, 404)
  const order = await ctx.em.findOne(DermatOrder, { id: orderId, tenantId: ctx.tenantId, organizationId: ctx.organizationId, deletedAt: null })
  if (!order) throw new OrderError(`Batch ${batchNo} not found`, 404)
  if (order.status === 'cancelled' || order.status === 'completed') throw new OrderError('This order is closed', 409)
  const stages = await primaryStages(ctx, orderId)
  const stageKey = action.kind === 'leak' || (action.kind === 'remove' && action.list === 'leak') ? 'filling' : 'packing'
  const stage = stages.get(stageKey)
  if (!stage) throw new OrderError('Stage not found', 404)
  const allowed = action.kind === 'verify' ? await mayAny(ctx, QA_FEATURES) : await mayAny(ctx, [...stageWorkers(stageKey), ...(action.kind === 'leak' ? QA_FEATURES : [])])
  if (!allowed) throw new OrderError(action.kind === 'verify' ? 'Only QA can verify the batch packing record' : `Only ${stageDef(stageKey)?.department ?? 'Production'} can fill this part of the batch packing record`, 403)
  if (action.kind !== 'verify' && stage.status !== 'open' && stage.status !== 'on_hold') throw new OrderError(`${stageDef(stageKey)?.label ?? stageKey} is not in progress`, 409)
  const byName = await currentUserName(ctx)
  const at = new Date().toISOString()
  const bpr = bprOf(stage)
  let note = ''
  if (action.kind === 'cleaning') {
    bpr.cleaning = [...(bpr.cleaning ?? []), { at, by: byName, equipment: action.equipment, equipmentId: action.equipmentId ?? null, method: action.method ?? null, status: action.status }]
    note = `Equipment cleaning: ${action.equipment}${action.equipmentId ? ` (${action.equipmentId})` : ''} · ${action.status}`
  } else if (action.kind === 'leak') {
    if (action.failed > action.tested) throw new OrderError('Failed bottles cannot be more than the bottles tested', 400)
    bpr.leak = [...(bpr.leak ?? []), { at, by: byName, tested: action.tested, failed: action.failed, note: action.note ?? null }]
    note = `Leak test: ${action.failed} of ${action.tested} failed${action.note ? ` · ${action.note}` : ''}`
  } else if (action.kind === 'destroyed') {
    if (!file.materials.some((material) => material.productId === action.productId)) throw new OrderError('That packing material was not issued for this batch', 400)
    bpr.destroyed = { ...(bpr.destroyed ?? {}), [action.productId]: action.quantity }
    note = `Packing material destroyed: ${file.materials.find((material) => material.productId === action.productId)?.title ?? ''} · ${action.quantity}`
  } else if (action.kind === 'verify') {
    if (!(BPR_SECTIONS as readonly string[]).includes(action.section)) throw new OrderError('Unknown section', 400)
    bpr.verify = { ...(bpr.verify ?? {}), [action.section]: { by: byName, at } }
    note = `QA verified the batch packing record: ${action.section.replace('_', ' ')}`
  } else {
    const list = (bpr[action.list] ?? []) as BprEntry[]
    const entry = list.find((item) => item.at === action.at)
    if (!entry) throw new OrderError('That entry is gone', 404)
    if (entry.by !== byName && !(await mayAny(ctx, ['dermat_orders.manage']))) throw new OrderError('Only the person who wrote it can remove it', 403)
    bpr[action.list] = list.filter((item) => item.at !== action.at)
    note = `Removed a ${action.list === 'leak' ? 'leak test' : 'cleaning'} entry`
  }
  stage.data = { ...(stage.data ?? {}), __bpr: bpr }
  logEvent(ctx, order, 'saved', stageKey, note, byName)
  order.updatedAt = new Date()
  await ctx.em.flush()
}

export type BprView = Awaited<ReturnType<typeof bprView>>
