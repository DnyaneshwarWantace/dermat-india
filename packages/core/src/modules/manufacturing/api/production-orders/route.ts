import { z } from 'zod'
import { makeCrudRoute } from '@wantace/shared/lib/crud/factory'
import { resolveTranslations } from '@wantace/shared/lib/i18n/server'
import { parseScopedCommandInput, resolveCrudRecordId } from '@wantace/shared/lib/api/scoped'
import { escapeLikePattern } from '@wantace/shared/lib/db/escapeLikePattern'
import { ProductionOrder } from '../../data/entities'
import { createProductionOrderSchema, updateProductionOrderSchema } from '../../data/validators'
import { createManufacturingCrudOpenApi, createPagedListResponseSchema, defaultOkResponseSchema } from '../openapi'

const F = {
  id: 'id', organization_id: 'organization_id', tenant_id: 'tenant_id',
  order_number: 'order_number',
  sales_order_id: 'sales_order_id', sales_order_number: 'sales_order_number',
  bom_id: 'bom_id', bom_name: 'bom_name',
  product_variant_id: 'product_variant_id', product_name: 'product_name',
  planned_quantity: 'planned_quantity', produced_quantity: 'produced_quantity', rejected_quantity: 'rejected_quantity',
  status: 'status', priority: 'priority',
  planned_start_date: 'planned_start_date', planned_end_date: 'planned_end_date',
  actual_start_date: 'actual_start_date', actual_end_date: 'actual_end_date',
  warehouse_id: 'warehouse_id',
  material_cost_cents: 'material_cost_cents', labor_cost_cents: 'labor_cost_cents',
  overhead_cost_cents: 'overhead_cost_cents', total_cost_cents: 'total_cost_cents',
  notes: 'notes',
  created_at: 'created_at', updated_at: 'updated_at',
} as const

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['manufacturing.production_orders.view'] },
  POST: { requireAuth: true, requireFeatures: ['manufacturing.production_orders.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['manufacturing.production_orders.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['manufacturing.production_orders.manage'] },
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
  priority: z.string().optional(),
  bomId: z.string().uuid().optional(),
  salesOrderId: z.string().uuid().optional(),
  sortField: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
}).passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: { entity: ProductionOrder, idField: 'id', orgField: 'organizationId', tenantField: 'tenantId', softDeleteField: 'deletedAt' },
  indexer: { entityType: 'manufacturing:production_order' },
  list: {
    schema: listSchema,
    entityId: 'manufacturing:production_order',
    fields: Object.values(F),
    sortFieldMap: { orderNumber: F.order_number, productName: F.product_name, status: F.status, priority: F.priority, createdAt: F.created_at },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (typeof query.ids === 'string' && query.ids.trim().length > 0) {
        filters[F.id] = { $in: query.ids.split(',').map((v: string) => v.trim()).filter((v: string) => v.length > 0) }
      }
      if (query.status) filters[F.status] = { $eq: query.status }
      if (query.priority) filters[F.priority] = { $eq: query.priority }
      if (query.bomId) filters[F.bom_id] = { $eq: query.bomId }
      if (query.salesOrderId) filters[F.sales_order_id] = { $eq: query.salesOrderId }
      const term = query.search?.trim()
      if (term) {
        const like = `%${escapeLikePattern(term)}%`
        filters.$or = [{ [F.order_number]: { $ilike: like } }, { [F.product_name]: { $ilike: like } }, { [F.bom_name]: { $ilike: like } }]
      }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'manufacturing.production_order.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => { const { translate } = await resolveTranslations(); return parseScopedCommandInput(createProductionOrderSchema, raw ?? {}, ctx, translate) },
      response: ({ result }) => ({ id: result?.productionOrderId ?? null, orderNumber: result?.orderNumber ?? null }),
      status: 201,
    },
    update: {
      commandId: 'manufacturing.production_order.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => { const { translate } = await resolveTranslations(); return parseScopedCommandInput(updateProductionOrderSchema, raw ?? {}, ctx, translate) },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'manufacturing.production_order.delete',
      schema: rawBodySchema,
      mapInput: async ({ parsed, ctx }) => { const { translate } = await resolveTranslations(); return { id: resolveCrudRecordId(parsed, ctx, translate) } },
      response: () => ({ ok: true }),
    },
  },
})

export const GET = crud.GET
export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE

export const openApi = createManufacturingCrudOpenApi({
  resourceName: 'ProductionOrder',
  pluralName: 'ProductionOrders',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(z.object({ id: z.string().uuid().nullable().optional() })),
  create: { schema: createProductionOrderSchema, description: 'Creates a new production order.' },
  update: { schema: updateProductionOrderSchema, responseSchema: defaultOkResponseSchema, description: 'Updates a production order.' },
  del: { schema: z.object({ id: z.string().uuid() }), responseSchema: defaultOkResponseSchema, description: 'Soft-deletes a production order.' },
})
