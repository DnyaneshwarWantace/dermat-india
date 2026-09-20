import { z } from 'zod'
import { makeCrudRoute } from '@wantace/shared/lib/crud/factory'
import { escapeLikePattern } from '@wantace/shared/lib/db/escapeLikePattern'
import { PurchaseOrderLine } from '../../data/entities'
import { createPurchasingCrudOpenApi, createPagedListResponseSchema } from '../openapi'

const F = {
  id: 'id',
  organization_id: 'organization_id',
  tenant_id: 'tenant_id',
  purchase_order_id: 'purchase_order_id',
  line_number: 'line_number',
  product_variant_id: 'product_variant_id',
  product_name: 'product_name',
  product_sku: 'product_sku',
  description: 'description',
  quantity: 'quantity',
  unit_of_measure: 'unit_of_measure',
  unit_price_cents: 'unit_price_cents',
  line_total: 'line_total',
  tax_rate: 'tax_rate',
  received_quantity: 'received_quantity',
  status: 'status',
  notes: 'notes',
  created_at: 'created_at',
  updated_at: 'updated_at',
} as const

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['purchasing.purchase_orders.view'] },
}

export const metadata = routeMetadata

const listSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(100),
  search: z.string().optional(),
  ids: z.string().optional(),
  id: z.string().uuid().optional(),
  purchaseOrderId: z.string().uuid().optional(),
  sortField: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
}).passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: PurchaseOrderLine,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: 'purchasing:purchase_order_line' },
  list: {
    schema: listSchema,
    entityId: 'purchasing:purchase_order_line',
    fields: Object.values(F),
    sortFieldMap: {
      lineNumber: F.line_number,
      productName: F.product_name,
      quantity: F.quantity,
      status: F.status,
      createdAt: F.created_at,
    },
    defaultSort: { field: F.line_number, dir: 'asc' },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (typeof query.ids === 'string' && query.ids.trim().length > 0) {
        filters[F.id] = {
          $in: query.ids.split(',').map((v: string) => v.trim()).filter((v: string) => v.length > 0),
        }
      }
      if (query.purchaseOrderId) filters[F.purchase_order_id] = { $eq: query.purchaseOrderId }
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
  actions: {},
})

export const GET = crud.GET

const lineItemSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  purchase_order_id: z.string().uuid().nullable().optional(),
  line_number: z.number().nullable().optional(),
  product_variant_id: z.string().uuid().nullable().optional(),
  product_name: z.string().nullable().optional(),
  product_sku: z.string().nullable().optional(),
  quantity: z.string().nullable().optional(),
  unit_of_measure: z.string().nullable().optional(),
  unit_price_cents: z.number().nullable().optional(),
  line_total: z.number().nullable().optional(),
  tax_rate: z.string().nullable().optional(),
  received_quantity: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
})

export const openApi = createPurchasingCrudOpenApi({
  resourceName: 'PurchaseOrderLine',
  pluralName: 'PurchaseOrderLines',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(lineItemSchema),
})
