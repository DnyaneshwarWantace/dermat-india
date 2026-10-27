import { NextResponse } from 'next/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'

export const SUPPLIER_FEATURES = ['dermat_products.supplier', 'dermat_purchase.manage', 'dermat_purchase.approve']

const SUPPLIER_KEYS = new Set(['vendorName', 'vendorGstin', 'vendorCode', 'vendorPhone', 'vendorEmail', 'vendorContact', 'supplierName', 'supplier', 'vendor_name', 'cf_supplier'])

type RbacLike = { userHasAllFeatures: (userId: string, features: string[], scope: { tenantId: string; organizationId: string }) => Promise<boolean> }

export async function canSeeSuppliers(req: Request): Promise<boolean> {
  const auth = await getAuthFromRequest(req)
  if (!auth?.tenantId || typeof auth.sub !== 'string') return false
  const container = await createRequestContainer()
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  const organizationId = scope?.selectedId ?? auth.orgId ?? null
  if (!organizationId) return false
  const rbac = container.resolve('rbacService') as RbacLike
  for (const feature of SUPPLIER_FEATURES) if (await rbac.userHasAllFeatures(auth.sub, [feature], { tenantId: auth.tenantId, organizationId })) return true
  return false
}

export function maskSuppliers(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskSuppliers)
  if (!value || typeof value !== 'object') return value
  const out: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) out[key] = SUPPLIER_KEYS.has(key) ? null : maskSuppliers(entry)
  return out
}

export function withSupplierMask(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const res = await handler(req)
    if (res.status !== 200 || !(res.headers.get('content-type') ?? '').includes('application/json')) return res
    if (await canSeeSuppliers(req)) return res
    const body = await res.json().catch(() => null)
    return NextResponse.json(maskSuppliers(body), { status: res.status })
  }
}

export const FORMULA_FEATURES = ['dermat_boms.manage', 'dermat_boms.approve', 'dermat_orders.work.rnd', 'dermat_orders.work.production', 'dermat_orders.work.manufacturing', 'dermat_orders.work.planning', 'dermat_orders.full']

export async function hasAnyFeature(req: Request, features: string[]): Promise<boolean> {
  const auth = await getAuthFromRequest(req)
  if (!auth?.tenantId || typeof auth.sub !== 'string') return false
  const container = await createRequestContainer()
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  const organizationId = scope?.selectedId ?? auth.orgId ?? null
  if (!organizationId) return false
  const rbac = container.resolve('rbacService') as RbacLike
  for (const feature of features) if (await rbac.userHasAllFeatures(auth.sub, [feature], { tenantId: auth.tenantId, organizationId })) return true
  return false
}

export function withFormulaMask(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const res = await handler(req)
    if (res.status !== 200 || !(res.headers.get('content-type') ?? '').includes('application/json')) return res
    const body = (await res.clone().json().catch(() => null)) as Record<string, unknown> | null
    if (!body || body.kind !== 'formula' || !Array.isArray(body.items)) return res
    if (await hasAnyFeature(req, FORMULA_FEATURES)) return res
    return NextResponse.json({ ...body, items: [], totalPercent: null, formulaHidden: true }, { status: res.status })
  }
}
