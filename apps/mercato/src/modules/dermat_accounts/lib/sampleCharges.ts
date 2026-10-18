import type { OrderContext } from '../../dermat_orders/lib/server'
import { RdRequest } from '../../dermat_rnd/data/entities'
import { SampleCharge } from '../data/entities'
import type { SampleChargeInput } from '../data/validators'
import { AccountsError } from './service'

function todayIst(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function money(value: number): number {
  return Math.round(value * 100) / 100
}

export function sampleChargeView(charge: SampleCharge) {
  return {
    id: charge.id,
    kind: 'sample' as const,
    customerId: charge.customerId,
    rdRequestId: charge.rdRequestId ?? null,
    rdCode: charge.rdCode ?? null,
    amount: Number(charge.amount),
    paidOn: charge.paidOn,
    mode: charge.mode ?? null,
    reference: charge.reference ?? null,
    note: charge.note ?? null,
    byName: charge.byName ?? null,
    voided: Boolean(charge.voidedAt),
    voidReason: charge.voidReason ?? null,
    createdAt: charge.createdAt.toISOString(),
    updatedAt: charge.updatedAt.toISOString(),
  }
}

export async function sampleChargesFor(ctx: OrderContext, filter: { customerId?: string; rdRequestId?: string; customerIds?: string[] }, includeVoided = true): Promise<SampleCharge[]> {
  const where: Record<string, unknown> = { tenantId: ctx.tenantId, organizationId: ctx.organizationId }
  if (filter.customerId) where.customerId = filter.customerId
  if (filter.customerIds) where.customerId = { $in: filter.customerIds }
  if (filter.rdRequestId) where.rdRequestId = filter.rdRequestId
  if (!includeVoided) where.voidedAt = null
  return ctx.em.find(SampleCharge, where, { orderBy: { paidOn: 'desc', createdAt: 'desc' } })
}

export async function recordSampleCharge(ctx: OrderContext, input: SampleChargeInput, byName: string | null): Promise<SampleCharge> {
  let rdCode: string | null = null
  let customerId = input.customerId
  if (input.rdRequestId) {
    const request = await ctx.em.findOne(RdRequest, { id: input.rdRequestId, tenantId: ctx.tenantId, organizationId: ctx.organizationId, deletedAt: null })
    if (!request) throw new AccountsError('R&D request not found', 404)
    if (request.customerId && request.customerId !== customerId) throw new AccountsError('This R&D request belongs to another customer', 400)
    rdCode = request.code
    customerId = request.customerId ?? customerId
  }
  const charge = ctx.em.create(SampleCharge, {
    organizationId: ctx.organizationId,
    tenantId: ctx.tenantId,
    customerId,
    rdRequestId: input.rdRequestId ?? null,
    rdCode,
    amount: String(money(input.amount)),
    paidOn: input.paidOn ?? todayIst(),
    mode: input.mode?.trim() || null,
    reference: input.reference?.trim() || null,
    note: input.note?.trim() || null,
    byName,
  })
  ctx.em.persist(charge)
  await ctx.em.flush()
  return charge
}

export function sampleTotal(charges: SampleCharge[]): number {
  return money(charges.filter((charge) => !charge.voidedAt).reduce((sum, charge) => sum + Number(charge.amount), 0))
}
