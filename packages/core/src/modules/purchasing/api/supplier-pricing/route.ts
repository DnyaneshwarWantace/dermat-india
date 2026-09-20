import { z } from 'zod'
import { makeCrudRoute } from '@wantace/shared/lib/crud/factory'
import { resolveTranslations } from '@wantace/shared/lib/i18n/server'
import { parseScopedCommandInput, resolveCrudRecordId } from '@wantace/shared/lib/api/scoped'
import { escapeLikePattern } from '@wantace/shared/lib/db/escapeLikePattern'
import { parseBooleanToken } from '@wantace/shared/lib/boolean'
import { SupplierPricing } from '../../data/entities'
import { createSupplierPricingSchema, updateSupplierPricingSchema } from '../../data/validators'
import { createPurchasingCrudOpenApi, createPagedListResponseSchema, defaultOkResponseSchema } from '../openapi'

const F = {
  id: 'id',
  organization_id: 'organization_id',
  tenant_id: 'tenant_id',
  supplier_id: 'supplier_id',
  product_variant_id: 'product_variant_id',
  product_name: 'product_name',
  product_sku: 'product_sku',
  unit_price_cents: 'unit_price_cents',
  currency_code: 'currency_code',
  min_quantity: 'min_quantity',
  lead_time_days: 'lead_time_days',
  valid_from: 'valid_from',
  valid_to: 'valid_to',
  is_active: 'is_active',
  created_at: 'created_at',
  updated_at: 'updated_at',
} as const

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['purchasing.supplier_pricing.view'] },
  POST: { requireAuth: true, requireFeatures: ['purchasing.supplier_pricing.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['purchasing.supplier_pricing.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['purchasing.supplier_pricing.manage'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const listSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(25),
  search: z.string().optional(),
  ids: z.string().optional(),
  id: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  productVariantId: z.string().uuid().optional(),
  isActive: z.string().optional(),
  sortField: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
}).passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: SupplierPricing,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: 'purchasing:supplier_pricing' },
  list: {
    schema: listSchema,
    entityId: 'purchasing:supplier_pricing',
    fields: [
      F.id,
      F.organization_id,
      F.tenant_id,
      F.supplier_id,
      F.product_variant_id,
      F.product_name,
      F.product_sku,
      F.unit_price_cents,
      F.currency_code,
      F.min_quantity,
      F.lead_time_days,
      F.valid_from,
      F.valid_to,
      F.is_active,
      F.created_at,
      F.updated_at,
    ],
    sortFieldMap: {
      productName: F.product_name,
      unitPriceCents: F.unit_price_cents,
      minQuantity: F.min_quantity,
      createdAt: F.created_at,
      updatedAt: F.updated_at,
    },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (typeof query.ids === 'string' && query.ids.trim().length > 0) {
        filters[F.id] = {
          $in: query.ids.split(',').map((v: string) => v.trim()).filter((v: string) => v.length > 0),
        }
      }
      if (query.supplierId) filters[F.supplier_id] = { $eq: query.supplierId }
      if (query.productVariantId) filters[F.product_variant_id] = { $eq: query.productVariantId }
      const isActive = parseBooleanToken(query.isActive)
      if (isActive !== null) filters[F.is_active] = { $eq: isActive }
      const term = query.search?.trim()
      if (term) {
        const like = `%${escapeLikePattern(term)}%`
        filters.$or = [
          { [F.product_name]: { $ilike: like } },
          { [F.product_sku]: { $ilike: like } },
        ]
      }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'purchasing.supplier_pricing.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(createSupplierPricingSchema, raw ?? {}, ctx, translate)
      },
      response: ({ result }) => ({ id: result?.supplierPricingId ?? null }),
      status: 201,
    },
    update: {
      commandId: 'purchasing.supplier_pricing.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(updateSupplierPricingSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'purchasing.supplier_pricing.delete',
      schema: rawBodySchema,
      mapInput: async ({ parsed, ctx }) => {
        const { translate } = await resolveTranslations()
        return { id: resolveCrudRecordId(parsed, ctx, translate) }
      },
      response: () => ({ ok: true }),
    },
  },
})

export const GET = crud.GET
export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE

const supplierPricingListItemSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  supplier_id: z.string().uuid().nullable().optional(),
  product_variant_id: z.string().uuid().nullable().optional(),
  product_name: z.string().nullable().optional(),
  product_sku: z.string().nullable().optional(),
  unit_price_cents: z.number().nullable().optional(),
  currency_code: z.string().nullable().optional(),
  min_quantity: z.string().nullable().optional(),
  lead_time_days: z.number().nullable().optional(),
  valid_from: z.string().nullable().optional(),
  valid_to: z.string().nullable().optional(),
  is_active: z.boolean().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
})

export const openApi = createPurchasingCrudOpenApi({
  resourceName: 'SupplierPricing',
  pluralName: 'SupplierPricingRules',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(supplierPricingListItemSchema),
  create: {
    schema: createSupplierPricingSchema,
    description: 'Creates a new supplier pricing rule.',
  },
  update: {
    schema: updateSupplierPricingSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a supplier pricing rule by id.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a supplier pricing rule by id.',
  },
})
