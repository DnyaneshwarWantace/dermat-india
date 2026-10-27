import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { runRouteMutationGuards } from '@open-mercato/shared/lib/crud/route-mutation-guard'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { createProductWithStockSetup } from '../../lib/createProduct'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['catalog.products.manage'] },
}

const bodySchema = z.object({
  productId: z.string().uuid(),
  size: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(300),
  itemCode: z.string().trim().max(80).optional().nullable(),
})

const SKIPPED_FIELDS = new Set(['item_code', 'capacity', 'parent_product_id', 'packing_item_type'])

async function POST(req: Request) {
  const auth = await getAuthFromRequest(req)
  if (!auth?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const container = await createRequestContainer()
  const organizationScope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  const organizationId = organizationScope?.selectedId ?? auth.orgId ?? null
  if (!organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Give the new size and name' }, { status: 400 })
  const em = (container.resolve('em') as EntityManager).fork()
  const connection = em.getConnection()
  const [source] = await connection.execute<Array<{ id: string; title: string; kind: string | null; unit: string | null; tax_rate_id: string | null }>>(
    `select id, title, custom_fieldset_code as kind, default_unit as unit, tax_rate_id from catalog_products
      where id = ? and tenant_id = ? and organization_id = ? and deleted_at is null`,
    [parsed.data.productId, auth.tenantId, organizationId],
  )
  if (!source) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  if (source.kind !== 'packing_material') return NextResponse.json({ error: 'Sizes can be added to packing materials only' }, { status: 400 })
  const values = await connection.execute<Array<{ field_key: string; value_text: string | null; value_multiline: string | null; value_int: number | null; value_float: number | null; value_bool: boolean | null }>>(
    `select field_key, value_text, value_multiline, value_int, value_float, value_bool from custom_field_values
      where entity_id = 'catalog:catalog_product' and record_id = ? and deleted_at is null`,
    [source.id],
  )
  if (values.some((row) => row.field_key === 'parent_product_id' && row.value_text)) {
    return NextResponse.json({ error: 'This item is printed for one product. Add the size to the plain item instead.' }, { status: 400 })
  }
  const itemCode = parsed.data.itemCode?.trim() || null
  if (itemCode) {
    const [taken] = await connection.execute<Array<{ id: string }>>(
      `select p.id from custom_field_values v join catalog_products p on p.id::text = v.record_id and p.deleted_at is null
        where v.entity_id = 'catalog:catalog_product' and v.field_key = 'item_code' and v.deleted_at is null and upper(v.value_text) = upper(?) and p.tenant_id = ? and p.organization_id = ? limit 1`,
      [itemCode, auth.tenantId, organizationId],
    )
    if (taken) return NextResponse.json({ error: `Code ${itemCode} is already used by another product` }, { status: 409 })
  }
  const custom: Record<string, unknown> = {}
  for (const row of values) {
    if (SKIPPED_FIELDS.has(row.field_key)) continue
    const value = row.value_text ?? row.value_multiline ?? row.value_float ?? row.value_int ?? row.value_bool
    if (value !== null && value !== undefined) custom[`cf_${row.field_key}`] = value
  }
  custom.cf_capacity = parsed.data.size
  if (itemCode) custom.cf_item_code = itemCode
  const [category] = await connection.execute<Array<{ category_id: string }>>(
    `select category_id from catalog_product_category_assignments where product_id = ? limit 1`,
    [source.id],
  ).catch(() => [])
  const userId = typeof auth.sub === 'string' ? auth.sub : 'system'
  const guard = await runRouteMutationGuards({
    container,
    req,
    auth: { userId, tenantId: auth.tenantId, organizationId },
    input: { resourceKind: 'dermat_products.size_variant', resourceId: source.id, operation: 'create', mutationPayload: parsed.data },
  })
  if (!guard.ok) return guard.response
  const ctx: CommandRuntimeContext = {
    container,
    auth,
    organizationScope,
    selectedOrganizationId: organizationId,
    organizationIds: organizationScope?.filterIds ?? [organizationId],
    request: req,
  }
  const created = await createProductWithStockSetup(container.resolve('commandBus') as CommandBus, ctx, connection, {
    title: parsed.data.title,
    kind: 'packing_material',
    unit: source.unit ?? 'pc',
    categoryId: category?.category_id ?? null,
    taxRateId: source.tax_rate_id,
    custom,
    tenantId: auth.tenantId,
    organizationId,
  })
  await guard.runAfterSuccess()
  return NextResponse.json({ id: created.productId, title: parsed.data.title, code: itemCode, sku: created.sku, size: parsed.data.size }, { status: 201 })
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat Products',
  summary: 'New size of a packing material',
  methods: {
    POST: {
      summary: 'Create a new packing material from an existing one with a different size (same type, colours, vendor and specs; stock is not copied)',
      tags: ['Dermat Products'],
      requestBody: { schema: bodySchema },
      responses: [{ status: 201, description: 'New packing material', schema: z.object({ id: z.string(), title: z.string() }).passthrough() }],
      errors: [{ status: 400, description: 'Not a plain packing material' }, { status: 409, description: 'Code already used' }],
    },
  },
}

export { POST }
