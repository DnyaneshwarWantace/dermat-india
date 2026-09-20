import { z } from 'zod'
import { makeCrudRoute } from '@wantace/shared/lib/crud/factory'
import { resolveTranslations } from '@wantace/shared/lib/i18n/server'
import { parseScopedCommandInput, resolveCrudRecordId } from '@wantace/shared/lib/api/scoped'
import { escapeLikePattern } from '@wantace/shared/lib/db/escapeLikePattern'
import { GoodsReceipt } from '../../data/entities'
import { createGoodsReceiptSchema } from '../../data/validators'
import { createPurchasingCrudOpenApi, createPagedListResponseSchema, defaultOkResponseSchema } from '../openapi'

const F = {
  id: 'id',
  organization_id: 'organization_id',
  tenant_id: 'tenant_id',
  receipt_number: 'receipt_number',
  purchase_order_id: 'purchase_order_id',
  status: 'status',
  receipt_date: 'receipt_date',
  warehouse_id: 'warehouse_id',
  received_by_user_id: 'received_by_user_id',
  notes: 'notes',
  created_at: 'created_at',
  updated_at: 'updated_at',
} as const

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['purchasing.goods_receipts.view'] },
  POST: { requireAuth: true, requireFeatures: ['purchasing.goods_receipts.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['purchasing.goods_receipts.manage'] },
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
  purchaseOrderId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortField: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
}).passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: GoodsReceipt,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: 'purchasing:goods_receipt' },
  list: {
    schema: listSchema,
    entityId: 'purchasing:goods_receipt',
    fields: [
      F.id,
      F.organization_id,
      F.tenant_id,
      F.receipt_number,
      F.purchase_order_id,
      F.status,
      F.receipt_date,
      F.warehouse_id,
      F.received_by_user_id,
      F.notes,
      F.created_at,
      F.updated_at,
    ],
    sortFieldMap: {
      receiptNumber: F.receipt_number,
      status: F.status,
      receiptDate: F.receipt_date,
      createdAt: F.created_at,
    },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (typeof query.ids === 'string' && query.ids.trim().length > 0) {
        filters[F.id] = {
          $in: query.ids.split(',').map((v: string) => v.trim()).filter((v: string) => v.length > 0),
        }
      }
      if (query.status) filters[F.status] = { $eq: query.status }
      if (query.purchaseOrderId) filters[F.purchase_order_id] = { $eq: query.purchaseOrderId }
      if (query.dateFrom) filters[F.receipt_date] = { ...(filters[F.receipt_date] as object ?? {}), $gte: new Date(query.dateFrom) }
      if (query.dateTo) filters[F.receipt_date] = { ...(filters[F.receipt_date] as object ?? {}), $lte: new Date(query.dateTo) }
      const term = query.search?.trim()
      if (term) {
        const like = `%${escapeLikePattern(term)}%`
        filters.$or = [
          { [F.receipt_number]: { $ilike: like } },
          { [F.notes]: { $ilike: like } },
        ]
      }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'purchasing.goods_receipts.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(createGoodsReceiptSchema, raw ?? {}, ctx, translate)
      },
      response: ({ result }) => ({ id: result?.goodsReceiptId ?? null, receiptNumber: result?.receiptNumber ?? null }),
      status: 201,
    },
    update: {
      commandId: 'purchasing.goods_receipts.complete',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return { id: resolveCrudRecordId(raw ?? {}, ctx, translate) }
      },
      response: () => ({ ok: true }),
    },
  },
})

export const GET = crud.GET
export const POST = crud.POST
export const PUT = crud.PUT

const grListItemSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  receipt_number: z.string().nullable().optional(),
  purchase_order_id: z.string().uuid().nullable().optional(),
  status: z.string().nullable().optional(),
  receipt_date: z.string().nullable().optional(),
  warehouse_id: z.string().uuid().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
})

export const openApi = createPurchasingCrudOpenApi({
  resourceName: 'GoodsReceipt',
  pluralName: 'GoodsReceipts',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(grListItemSchema),
  create: {
    schema: createGoodsReceiptSchema,
    description: 'Creates a goods receipt against a purchase order.',
  },
  update: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Completes a goods receipt and updates purchase order line received quantities.',
  },
})
