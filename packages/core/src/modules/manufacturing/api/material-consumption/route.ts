import { z } from 'zod'
import { makeCrudRoute } from '@wantace/shared/lib/crud/factory'
import { resolveTranslations } from '@wantace/shared/lib/i18n/server'
import { parseScopedCommandInput, resolveCrudRecordId } from '@wantace/shared/lib/api/scoped'
import { escapeLikePattern } from '@wantace/shared/lib/db/escapeLikePattern'
import { MaterialConsumption } from '../../data/entities'
import { createMaterialConsumptionSchema, updateMaterialConsumptionSchema } from '../../data/validators'
import { createManufacturingCrudOpenApi, createPagedListResponseSchema, defaultOkResponseSchema } from '../openapi'

const F = {
  id: 'id', organization_id: 'organization_id', tenant_id: 'tenant_id',
  production_order_id: 'production_order_id', bom_line_id: 'bom_line_id',
  product_variant_id: 'product_variant_id', product_name: 'product_name', product_sku: 'product_sku',
  planned_quantity: 'planned_quantity', actual_quantity: 'actual_quantity', wastage_quantity: 'wastage_quantity',
  unit_of_measure: 'unit_of_measure', unit_cost_cents: 'unit_cost_cents',
  status: 'status', warehouse_id: 'warehouse_id', lot_id: 'lot_id',
  issued_at: 'issued_at', issued_by: 'issued_by',
  created_at: 'created_at', updated_at: 'updated_at',
} as const

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['manufacturing.material_consumption.view'] },
  POST: { requireAuth: true, requireFeatures: ['manufacturing.material_consumption.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['manufacturing.material_consumption.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['manufacturing.material_consumption.manage'] },
}

export const metadata = routeMetadata
const rawBodySchema = z.object({}).passthrough()

const listSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(25),
  search: z.string().optional(),
  id: z.string().uuid().optional(),
  productionOrderId: z.string().uuid().optional(),
  status: z.string().optional(),
  sortField: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
}).passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: { entity: MaterialConsumption, idField: 'id', orgField: 'organizationId', tenantField: 'tenantId', softDeleteField: 'deletedAt' },
  indexer: { entityType: 'manufacturing:material_consumption' },
  list: {
    schema: listSchema,
    entityId: 'manufacturing:material_consumption',
    fields: Object.values(F),
    sortFieldMap: { productName: F.product_name, status: F.status, createdAt: F.created_at },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (query.productionOrderId) filters[F.production_order_id] = { $eq: query.productionOrderId }
      if (query.status) filters[F.status] = { $eq: query.status }
      const term = query.search?.trim()
      if (term) {
        const like = `%${escapeLikePattern(term)}%`
        filters.$or = [{ [F.product_name]: { $ilike: like } }, { [F.product_sku]: { $ilike: like } }]
      }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'manufacturing.material_consumption.create', schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => { const { translate } = await resolveTranslations(); return parseScopedCommandInput(createMaterialConsumptionSchema, raw ?? {}, ctx, translate) },
      response: ({ result }) => ({ id: result?.materialConsumptionId ?? null }), status: 201,
    },
    update: {
      commandId: 'manufacturing.material_consumption.update', schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => { const { translate } = await resolveTranslations(); return parseScopedCommandInput(updateMaterialConsumptionSchema, raw ?? {}, ctx, translate) },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'manufacturing.material_consumption.delete', schema: rawBodySchema,
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
  resourceName: 'MaterialConsumption', pluralName: 'MaterialConsumptions', querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(z.object({ id: z.string().uuid().nullable().optional() })),
  create: { schema: createMaterialConsumptionSchema, description: 'Creates a material consumption record.' },
  update: { schema: updateMaterialConsumptionSchema, responseSchema: defaultOkResponseSchema, description: 'Updates a material consumption record.' },
  del: { schema: z.object({ id: z.string().uuid() }), responseSchema: defaultOkResponseSchema, description: 'Soft-deletes a material consumption record.' },
})
