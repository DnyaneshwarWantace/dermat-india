import { createHash, randomBytes } from 'node:crypto'
import type { EntityManager } from '@mikro-orm/postgresql'
import { resolveNotificationService } from '@open-mercato/core/modules/notifications/lib/notificationService'
import { createLogger } from '@open-mercato/shared/lib/logger'
import { DermatArtworkApproval, DermatOrder, DermatOrderLine, DermatOrderStage } from '../data/entities'
import { assignDefaultCard, logEvent } from './engine'
import { OrderError, loadCustomers, loadProducts, type OrderContext } from './server'
import { STAGE_ATTACHMENT_ENTITY } from './stageDocuments'
import { documentRecordId, stepStates } from './stages'
import { effectiveStageDef, loadStageOverrides } from './stageSettings'

const logger = createLogger('dermat_orders')
const LINK_DAYS = 30
const MAX_SIGNATURE = 300_000
const MIN_SIGNATURE = 400

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

type FileRow = { id: string; file_name: string; mime_type: string; record_id: string }

async function artworkFiles(em: EntityManager, tenantId: string, organizationId: string, orderId: string): Promise<FileRow[]> {
  const rows = await em.getConnection().execute<FileRow[]>(
    `select id, file_name, mime_type, record_id from attachments
      where entity_id = ? and tenant_id = ? and organization_id = ? and record_id in (?, ?)
      order by created_at asc`,
    [STAGE_ATTACHMENT_ENTITY, tenantId, organizationId, documentRecordId(orderId, 'artwork', 'design_file'), `${orderId}:artwork`],
  )
  const design = rows.filter((row) => row.record_id.endsWith(':design_file'))
  return design.length ? design : rows
}

export function approvalView(row: DermatArtworkApproval) {
  return {
    id: row.id,
    status: row.status,
    clientName: row.clientName ?? null,
    clientDesignation: row.clientDesignation ?? null,
    signature: row.signature ?? null,
    comments: row.comments ?? null,
    ip: row.ip ?? null,
    userAgent: row.userAgent ?? null,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    expiresAt: row.expiresAt.toISOString(),
    fileCount: (row.fileIds ?? []).length,
    createdByName: row.createdByName ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function listApprovals(ctx: OrderContext, orderId: string) {
  const rows = await ctx.em.find(DermatArtworkApproval, { orderId, tenantId: ctx.tenantId, organizationId: ctx.organizationId }, { orderBy: { createdAt: 'desc' } })
  return rows.map(approvalView)
}

export async function createApproval(ctx: OrderContext, order: DermatOrder, byName: string | null): Promise<{ token: string; approval: DermatArtworkApproval }> {
  const stage = await ctx.em.findOne(DermatOrderStage, { orderId: order.id, stageKey: 'artwork' })
  if (!stage || (stage.status !== 'open' && stage.status !== 'on_hold')) throw new OrderError('Artwork & packaging is not in progress', 409)
  const steps = stepStates(stage.data)
  if (!steps.design?.done) throw new OrderError('Finish "Artwork designed" first, then send it to the client', 409)
  if (steps.client_approved?.done) throw new OrderError('The client has already approved this artwork', 409)
  const files = await artworkFiles(ctx.em, ctx.tenantId, ctx.organizationId, order.id)
  if (!files.length) throw new OrderError('Upload the artwork design file on "Artwork designed" first', 400)
  const open = await ctx.em.find(DermatArtworkApproval, { orderId: order.id, tenantId: ctx.tenantId, organizationId: ctx.organizationId, status: 'open' })
  for (const row of open) row.status = 'closed'
  const token = randomBytes(24).toString('base64url')
  const approval = ctx.em.create(DermatArtworkApproval, {
    organizationId: ctx.organizationId,
    tenantId: ctx.tenantId,
    orderId: order.id,
    tokenHash: hashToken(token),
    fileIds: files.map((file) => file.id),
    expiresAt: new Date(Date.now() + LINK_DAYS * 86_400_000),
    createdByName: byName,
  })
  ctx.em.persist(approval)
  logEvent(ctx, order, 'approval_link', 'artwork', `Approval link sent to the client (${files.length} file${files.length > 1 ? 's' : ''})`, byName)
  await ctx.em.flush()
  return { token, approval }
}

export async function approvalByToken(em: EntityManager, token: string): Promise<DermatArtworkApproval> {
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) throw new OrderError('This link is not valid', 404)
  const row = await em.findOne(DermatArtworkApproval, { tokenHash: hashToken(token) })
  if (!row) throw new OrderError('This link is not valid', 404)
  return row
}

export async function publicApprovalView(em: EntityManager, row: DermatArtworkApproval) {
  const scope = { em, tenantId: row.tenantId, organizationId: row.organizationId } as unknown as OrderContext
  const order = await em.findOne(DermatOrder, { id: row.orderId, tenantId: row.tenantId, organizationId: row.organizationId, deletedAt: null })
  if (!order) throw new OrderError('This link is not valid', 404)
  const [lines, stage, customers] = await Promise.all([
    em.find(DermatOrderLine, { orderId: order.id }, { orderBy: { position: 'asc' } }),
    em.findOne(DermatOrderStage, { orderId: order.id, stageKey: 'artwork' }),
    loadCustomers(scope, [order.customerId]),
  ])
  const products = await loadProducts(scope, lines.map((line) => line.productId))
  const files = row.fileIds?.length
    ? await em.getConnection().execute<Array<{ id: string; file_name: string; mime_type: string }>>(`select id, file_name, mime_type from attachments where id = any(?::uuid[])`, [`{${row.fileIds.join(',')}}`])
    : []
  const expired = row.status === 'open' && row.expiresAt.getTime() < Date.now()
  return {
    status: expired ? 'expired' : row.status,
    orderNo: order.orderNo,
    customerName: customers.get(order.customerId)?.name ?? null,
    products: lines.map((line) => ({ title: products.get(line.productId)?.title ?? '', brandName: line.brandName ?? null, packSize: line.packSize ?? null, quantity: Number(line.quantity) })),
    composition: typeof stage?.data?.composition_text === 'string' ? stage.data.composition_text : null,
    files: files.map((file) => ({ id: file.id, fileName: file.file_name, mimeType: file.mime_type })),
    decision: row.status === 'approved' || row.status === 'changes' ? { clientName: row.clientName, clientDesignation: row.clientDesignation, decidedAt: row.decidedAt?.toISOString() ?? null, comments: row.comments } : null,
  }
}

export type ClientDecision = { decision: 'approve' | 'changes'; name: string; designation: string | null; signature: string; comments: string | null }

export async function recordDecision(em: EntityManager, container: OrderContext['container'], row: DermatArtworkApproval, input: ClientDecision, ip: string | null, userAgent: string | null) {
  if (row.status !== 'open') throw new OrderError(row.status === 'closed' ? 'A newer version was sent; please use the latest link' : 'This artwork is already answered', 409)
  if (row.expiresAt.getTime() < Date.now()) throw new OrderError('This link has expired. Ask Dermat India for a new one.', 410)
  if (!input.signature.startsWith('data:image/png;base64,') || input.signature.length < MIN_SIGNATURE || input.signature.length > MAX_SIGNATURE) throw new OrderError('Please sign in the box', 400)
  if (input.decision === 'changes' && !input.comments?.trim()) throw new OrderError('Please write what should change', 400)
  const ctx = { em, container, tenantId: row.tenantId, organizationId: row.organizationId, userId: null } as unknown as OrderContext
  const order = await em.findOne(DermatOrder, { id: row.orderId, tenantId: row.tenantId, organizationId: row.organizationId, deletedAt: null })
  const stage = order ? await em.findOne(DermatOrderStage, { orderId: order.id, stageKey: 'artwork' }) : null
  if (!order || !stage) throw new OrderError('This link is not valid', 404)
  if (stage.status !== 'open' && stage.status !== 'on_hold') throw new OrderError('This artwork is no longer waiting for approval', 409)
  const who = `${input.name.trim()}${input.designation?.trim() ? `, ${input.designation.trim()}` : ''} (client, online)`
  const now = new Date()
  row.status = input.decision === 'approve' ? 'approved' : 'changes'
  row.clientName = input.name.trim()
  row.clientDesignation = input.designation?.trim() || null
  row.signature = input.signature
  row.comments = input.comments?.trim() || null
  row.ip = ip
  row.userAgent = userAgent?.slice(0, 400) ?? null
  row.decidedAt = now
  const steps = stepStates(stage.data)
  if (input.decision === 'approve') {
    const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    stage.data = { ...(stage.data ?? {}), artwork_approved_on: stage.data?.artwork_approved_on || today, __approval: { id: row.id, name: who, at: now.toISOString() }, __steps: { ...steps, client_approved: { done: true, at: now.toISOString(), by: who } } }
    logEvent(ctx, order, 'step_done', 'artwork', `Client approved the artwork online · ${who}${row.comments ? ` · ${row.comments}` : ''}`, who)
    const overrides = await loadStageOverrides(ctx)
    const def = effectiveStageDef('artwork', overrides)
    if (def) assignDefaultCard(def, stage, overrides)
  } else {
    stage.data = { ...(stage.data ?? {}), status_note: `Client asked for changes: ${row.comments}`, __steps: { ...steps, design: { done: false, at: null, by: null } } }
    logEvent(ctx, order, 'step_undone', 'artwork', `Client asked for changes online · ${who} · ${row.comments}`, who)
  }
  order.updatedAt = now
  await em.flush()
  try {
    const service = resolveNotificationService(container as unknown as { resolve: (name: string) => unknown })
    for (const feature of ['dermat_orders.work.artwork', 'dermat_orders.manage']) {
      await service.createForFeature(
        {
          type: 'dermat_orders.stage.ready',
          requiredFeature: feature,
          title: input.decision === 'approve' ? `${order.orderNo}: client approved the artwork` : `${order.orderNo}: client asked for artwork changes`,
          body: [who, row.comments].filter(Boolean).join(' · '),
          severity: input.decision === 'approve' ? 'success' : 'warning',
          sourceModule: 'dermat_orders',
          sourceEntityType: 'dermat_orders:order',
          sourceEntityId: order.id,
          linkHref: `/backend/orders/${order.id}/stages/artwork`,
          groupKey: `dermat_orders:${order.id}:approval:${row.id}:${feature}`,
        },
        { tenantId: row.tenantId, organizationId: row.organizationId },
      )
    }
  } catch (error) {
    logger.error('Failed to send the artwork approval notification', { err: error })
  }
}
