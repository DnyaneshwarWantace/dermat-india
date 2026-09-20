import { z } from 'zod'
import { makeCrudRoute } from '@wantace/shared/lib/crud/factory'
import { GoodsReceiptLine } from '../../data/entities'
import { createPurchasingCrudOpenApi, createPagedListResponseSchema } from '../openapi'

const F = {
  id: 'id',
  organization_id: 'organization_id',
  tenant_id: 'tenant_id',
  goods_receipt_id: 'goods_receipt_id',
  purchase_order_line_id: 'purchase_order_line_id',
  product_variant_id: 'product_variant_id',
  product_name: 'product_name',
  received_quantity: 'received_quantity',
  accepted_quantity: 'accepted_quantity',
  rejected_quantity: 'rejected_quantity',
  batch_number: 'batch_number',
  lot_number: 'lot_number',
  expiry_date: 'expiry_date',
  warehouse_location_id: 'warehouse_location_id',
  notes: 'notes',
  created_at: 'created_at',
  updated_at: 'updated_at',
} as const

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['purchasing.goods_receipts.view'] },
}

export const metadata = routeMetadata

const listSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(100),
  ids: z.string().optional(),
  id: z.string().uuid().optional(),
  goodsReceiptId: z.string().uuid().optional(),
  sortField: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
}).passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: GoodsReceiptLine,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: 'purchasing:goods_receipt_line' },
  list: {
    schema: listSchema,
    entityId: 'purchasing:goods_receipt_line',
    fields: Object.values(F),
    sortFieldMap: {
      productName: F.product_name,
      createdAt: F.created_at,
    },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (typeof query.ids === 'string' && query.ids.trim().length > 0) {
        filters[F.id] = {
          $in: query.ids.split(',').map((v: string) => v.trim()).filter((v: string) => v.length > 0),
        }
      }
      if (query.goodsReceiptId) filters[F.goods_receipt_id] = { $eq: query.goodsReceiptId }
      return filters
    },
  },
  actions: {},
})

export const GET = crud.GET

const grLineItemSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  goods_receipt_id: z.string().uuid().nullable().optional(),
  product_name: z.string().nullable().optional(),
  received_quantity: z.string().nullable().optional(),
  accepted_quantity: z.string().nullable().optional(),
  rejected_quantity: z.string().nullable().optional(),
  batch_number: z.string().nullable().optional(),
  lot_number: z.string().nullable().optional(),
  expiry_date: z.string().nullable().optional(),
})

export const openApi = createPurchasingCrudOpenApi({
  resourceName: 'GoodsReceiptLine',
  pluralName: 'GoodsReceiptLines',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(grLineItemSchema),
})
