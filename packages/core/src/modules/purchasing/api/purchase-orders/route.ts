import { z } from 'zod'
import { makeCrudRoute } from '@wantace/shared/lib/crud/factory'
import { resolveTranslations } from '@wantace/shared/lib/i18n/server'
import { parseScopedCommandInput, resolveCrudRecordId } from '@wantace/shared/lib/api/scoped'
import { escapeLikePattern } from '@wantace/shared/lib/db/escapeLikePattern'
import { PurchaseOrder } from '../../data/entities'
import { createPurchaseOrderSchema, updatePurchaseOrderSchema } from '../../data/validators'
import { createPurchasingCrudOpenApi, createPagedListResponseSchema, defaultOkResponseSchema } from '../openapi'

const F = {
  id: 'id',
  organization_id: 'organization_id',
  tenant_id: 'tenant_id',
  order_number: 'order_number',
  supplier_id: 'supplier_id',
  status: 'status',
  order_date: 'order_date',
  expected_delivery_date: 'expected_delivery_date',
  warehouse_id: 'warehouse_id',
  currency_code: 'currency_code',
  subtotal_cents: 'subtotal_cents',
  tax_cents: 'tax_cents',
  total_cents: 'total_cents',
  payment_terms: 'payment_terms',
  created_by_user_id: 'created_by_user_id',
  notes: 'notes',
  created_at: 'created_at',
  updated_at: 'updated_at',
} as const

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['purchasing.purchase_orders.view'] },
  POST: { requireAuth: true, requireFeatures: ['purchasing.purchase_orders.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['purchasing.purchase_orders.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['purchasing.purchase_orders.manage'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const listSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(25),
  search: z.string().optional(),
  ids: z.string().optional(),
  id: z.string().uuid().optional(),
  status: z.string().optional(),
  supplierId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortField: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
}).passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: PurchaseOrder,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: 'purchasing:purchase_order' },
  list: {
    schema: listSchema,
    entityId: 'purchasing:purchase_order',
    fields: [
      F.id,
      F.organization_id,
      F.tenant_id,
      F.order_number,
      F.supplier_id,
      F.status,
      F.order_date,
      F.expected_delivery_date,
      F.warehouse_id,
      F.currency_code,
      F.subtotal_cents,
      F.tax_cents,
      F.total_cents,
      F.payment_terms,
      F.created_by_user_id,
      F.notes,
      F.created_at,
      F.updated_at,
    ],
    sortFieldMap: {
      orderNumber: F.order_number,
      status: F.status,
      orderDate: F.order_date,
      expectedDeliveryDate: F.expected_delivery_date,
      totalCents: F.total_cents,
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
      if (query.status) filters[F.status] = { $eq: query.status }
      if (query.supplierId) filters[F.supplier_id] = { $eq: query.supplierId }
      if (query.dateFrom) filters[F.order_date] = { ...(filters[F.order_date] as object ?? {}), $gte: new Date(query.dateFrom) }
      if (query.dateTo) filters[F.order_date] = { ...(filters[F.order_date] as object ?? {}), $lte: new Date(query.dateTo) }
      const term = query.search?.trim()
      if (term) {
        const like = `%${escapeLikePattern(term)}%`
        filters.$or = [
          { [F.order_number]: { $ilike: like } },
          { [F.notes]: { $ilike: like } },
        ]
      }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'purchasing.purchase_orders.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(createPurchaseOrderSchema, raw ?? {}, ctx, translate)
      },
      response: ({ result }) => ({ id: result?.purchaseOrderId ?? null, orderNumber: result?.orderNumber ?? null }),
      status: 201,
    },
    update: {
      commandId: 'purchasing.purchase_orders.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(updatePurchaseOrderSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'purchasing.purchase_orders.delete',
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

const poListItemSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  order_number: z.string().nullable().optional(),
  supplier_id: z.string().uuid().nullable().optional(),
  status: z.string().nullable().optional(),
  order_date: z.string().nullable().optional(),
  expected_delivery_date: z.string().nullable().optional(),
  total_cents: z.number().nullable().optional(),
  currency_code: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
})

export const openApi = createPurchasingCrudOpenApi({
  resourceName: 'PurchaseOrder',
  pluralName: 'PurchaseOrders',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(poListItemSchema),
  create: {
    schema: createPurchaseOrderSchema,
    description: 'Creates a new purchase order.',
  },
  update: {
    schema: updatePurchaseOrderSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a purchase order by id.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a purchase order by id.',
  },
})
