import { randomBytes } from 'node:crypto'
import type { EntityManager } from '@mikro-orm/postgresql'
import { DermatDocLink, DermatOrder, DermatOrderLine, DermatOrderStage, type DocLinkKind, type DocLinkSend } from '../data/entities'
import { OrderError, loadCustomers, loadProducts, type OrderContext } from './server'
import { STAGE_ATTACHMENT_ENTITY } from './stageDocuments'
import { documentRecordId } from './stages'
import { companyView, findPi, loadCompany, piView } from '../../dermat_accounts/lib/documents'
import { findInvoice, invoiceView } from '../../dermat_accounts/lib/invoices'
import { findPo, poView } from '../../dermat_purchase/lib/service'
import { Vendor } from '../../dermat_vendors/data/entities'
import { RdRequest, RdTrial } from '../../dermat_rnd/data/entities'
import { requestView } from '../../dermat_rnd/lib/service'
import { trialView } from '../../dermat_rnd/lib/trials'

export const DOC_KINDS: DocLinkKind[] = ['pi', 'invoice', 'po', 'dispatch', 'sample']

type Target = { orderId: string | null; customerId: string | null; title: string; to: { name: string | null; email: string | null; phone: string | null } }

async function customerContact(ctx: OrderContext, customerId: string | null) {
  if (!customerId) return { name: null, email: null, phone: null }
  const customer = (await loadCustomers(ctx, [customerId])).get(customerId)
  return { name: customer?.name ?? null, email: customer?.email ?? null, phone: customer?.phone ?? null }
}

async function target(ctx: OrderContext, kind: DocLinkKind, recordId: string): Promise<Target> {
  if (kind === 'pi') {
    const pi = await findPi(ctx, recordId)
    return { orderId: pi.orderId ?? null, customerId: pi.customerId, title: `Proforma invoice ${pi.code}`, to: await customerContact(ctx, pi.customerId) }
  }
  if (kind === 'invoice') {
    const invoice = await findInvoice(ctx, recordId)
    return { orderId: invoice.orderId, customerId: invoice.customerId, title: `${invoice.kind === 'credit_note' ? 'Credit note' : 'Tax invoice'} ${invoice.code}`, to: await customerContact(ctx, invoice.customerId) }
  }
  if (kind === 'po') {
    const po = await findPo(ctx, recordId)
    const vendor = await ctx.em.findOne(Vendor, { id: po.vendorId, tenantId: ctx.tenantId, organizationId: ctx.organizationId })
    return { orderId: null, customerId: null, title: `Purchase order ${po.code}`, to: { name: po.vendorName, email: vendor?.contactEmail ?? null, phone: vendor?.contactPhone ?? null } }
  }
  if (kind === 'dispatch') {
    const order = await ctx.em.findOne(DermatOrder, { id: recordId, tenantId: ctx.tenantId, organizationId: ctx.organizationId, deletedAt: null })
    if (!order) throw new OrderError('Order not found', 404)
    return { orderId: order.id, customerId: order.customerId, title: `Dispatch details ${order.orderNo}`, to: await customerContact(ctx, order.customerId) }
  }
  const trial = await ctx.em.findOne(RdTrial, { id: recordId, tenantId: ctx.tenantId, organizationId: ctx.organizationId, deletedAt: null })
  if (!trial) throw new OrderError('Sample not found', 404)
  const request = await ctx.em.findOne(RdRequest, { id: trial.requestId, tenantId: ctx.tenantId, organizationId: ctx.organizationId, deletedAt: null })
  return { orderId: request?.orderId ?? null, customerId: request?.customerId ?? null, title: `Sample ${trial.code}`, to: await customerContact(ctx, request?.customerId ?? null) }
}

export function linkView(link: DermatDocLink) {
  return {
    id: link.id,
    kind: link.kind,
    recordId: link.recordId,
    orderId: link.orderId ?? null,
    customerId: link.customerId ?? null,
    title: link.title,
    path: `/d/${link.token}`,
    sends: link.sends ?? [],
    openedCount: link.openedCount,
    lastOpenedAt: link.lastOpenedAt ? link.lastOpenedAt.toISOString() : null,
    revokedAt: link.revokedAt ? link.revokedAt.toISOString() : null,
    createdByName: link.createdByName ?? null,
    createdAt: link.createdAt.toISOString(),
  }
}

export async function ensureLink(ctx: OrderContext, kind: DocLinkKind, recordId: string, byName: string | null) {
  const info = await target(ctx, kind, recordId)
  let link = await ctx.em.findOne(DermatDocLink, { tenantId: ctx.tenantId, organizationId: ctx.organizationId, kind, recordId, revokedAt: null })
  if (!link) {
    link = ctx.em.create(DermatDocLink, {
      organizationId: ctx.organizationId,
      tenantId: ctx.tenantId,
      token: randomBytes(18).toString('base64url'),
      kind,
      recordId,
      orderId: info.orderId,
      customerId: info.customerId,
      title: info.title,
      createdByName: byName,
    })
    ctx.em.persist(link)
    await ctx.em.flush()
  }
  return { link: linkView(link), to: info.to }
}

export async function findLink(ctx: OrderContext, id: string): Promise<DermatDocLink> {
  const link = await ctx.em.findOne(DermatDocLink, { id, tenantId: ctx.tenantId, organizationId: ctx.organizationId })
  if (!link) throw new OrderError('Link not found', 404)
  return link
}

export async function logSend(ctx: OrderContext, link: DermatDocLink, via: DocLinkSend['via'], to: string | null, byName: string | null) {
  link.sends = [...(link.sends ?? []), { via, by: byName, at: new Date().toISOString(), to }]
  link.updatedAt = new Date()
  await ctx.em.flush()
}

export async function revokeLink(ctx: OrderContext, link: DermatDocLink) {
  link.revokedAt = new Date()
  await ctx.em.flush()
}

export async function listLinks(ctx: OrderContext, filter: { orderId?: string; customerId?: string; kind?: DocLinkKind; recordId?: string }) {
  const where: Record<string, unknown> = { tenantId: ctx.tenantId, organizationId: ctx.organizationId }
  if (filter.orderId) where.orderId = filter.orderId
  if (filter.customerId) where.customerId = filter.customerId
  if (filter.kind) where.kind = filter.kind
  if (filter.recordId) where.recordId = filter.recordId
  const rows = await ctx.em.find(DermatDocLink, where, { orderBy: { createdAt: 'desc' }, limit: 200 })
  return rows.map(linkView)
}

async function dispatchFiles(em: EntityManager, link: DermatDocLink, orderId: string) {
  return em.getConnection().execute<Array<{ id: string; file_name: string; mime_type: string }>>(
    `select id, file_name, mime_type from attachments where entity_id = ? and tenant_id = ? and organization_id = ? and record_id in (?, ?) order by created_at asc`,
    [STAGE_ATTACHMENT_ENTITY, link.tenantId, link.organizationId, documentRecordId(orderId, 'dispatch', 'lr_copy'), documentRecordId(orderId, 'dispatch', 'eway_bill')],
  )
}

export async function publicLink(em: EntityManager, token: string): Promise<DermatDocLink> {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) throw new OrderError('This link is not valid', 404)
  const link = await em.findOne(DermatDocLink, { token })
  if (!link || link.revokedAt) throw new OrderError('This link is not valid any more. Ask Dermat India for a new one.', 404)
  return link
}

export async function publicDocument(em: EntityManager, link: DermatDocLink) {
  const ctx = { em, tenantId: link.tenantId, organizationId: link.organizationId, userId: null } as unknown as OrderContext
  link.openedCount += 1
  link.lastOpenedAt = new Date()
  await em.flush()
  const base = { kind: link.kind, title: link.title }
  if (link.kind === 'pi') return { ...base, pi: piView(await findPi(ctx, link.recordId)), company: companyView(await loadCompany(ctx)) }
  if (link.kind === 'invoice') return { ...base, invoice: invoiceView(await findInvoice(ctx, link.recordId)), company: companyView(await loadCompany(ctx)) }
  if (link.kind === 'po') return { ...base, po: await poView(ctx, await findPo(ctx, link.recordId)) }
  if (link.kind === 'sample') {
    const trial = await em.findOne(RdTrial, { id: link.recordId, tenantId: link.tenantId, organizationId: link.organizationId, deletedAt: null })
    const request = trial ? await em.findOne(RdRequest, { id: trial.requestId, tenantId: link.tenantId, organizationId: link.organizationId }) : null
    if (!trial || !request) throw new OrderError('This sample is no longer available', 404)
    return { ...base, request: requestView(request), trial: trialView(trial) }
  }
  const order = await em.findOne(DermatOrder, { id: link.recordId, tenantId: link.tenantId, organizationId: link.organizationId, deletedAt: null })
  if (!order) throw new OrderError('This order is no longer available', 404)
  const [lines, stage, billing, customers] = await Promise.all([
    em.find(DermatOrderLine, { orderId: order.id }, { orderBy: { position: 'asc' } }),
    em.findOne(DermatOrderStage, { orderId: order.id, stageKey: 'dispatch' }),
    em.findOne(DermatOrderStage, { orderId: order.id, stageKey: 'billing' }),
    loadCustomers(ctx, [order.customerId]),
  ])
  const products = await loadProducts(ctx, lines.map((line) => line.productId))
  const text = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? String(value) : null)
  const files = await dispatchFiles(em, link, order.id)
  return {
    ...base,
    dispatch: {
      orderNo: order.orderNo,
      customerName: customers.get(order.customerId)?.name ?? null,
      products: lines.map((line) => ({ title: products.get(line.productId)?.title ?? '', packSize: line.packSize ?? null, quantity: Number(line.quantity), batchNo: line.batchNo ?? null })),
      dispatchDate: text(stage?.data?.dispatch_date),
      transporter: text(stage?.data?.transporter),
      lrNumber: text(stage?.data?.lr_number),
      vehicleNo: text(stage?.data?.vehicle_no),
      boxes: text(stage?.data?.packages),
      ewayBillNo: text(stage?.data?.eway_bill_no),
      invoiceNo: text(billing?.data?.invoice_number),
      files: files.map((file) => ({ id: file.id, fileName: file.file_name, mimeType: file.mime_type })),
    },
  }
}

export async function publicFileAllowed(em: EntityManager, link: DermatDocLink, fileId: string): Promise<boolean> {
  if (link.kind !== 'dispatch') return false
  return (await dispatchFiles(em, link, link.recordId)).some((file) => file.id === fileId)
}
