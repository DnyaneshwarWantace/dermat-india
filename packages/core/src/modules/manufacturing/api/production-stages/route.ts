import { z } from 'zod'
import { makeCrudRoute } from '@wantace/shared/lib/crud/factory'
import { resolveTranslations } from '@wantace/shared/lib/i18n/server'
import { parseScopedCommandInput, resolveCrudRecordId } from '@wantace/shared/lib/api/scoped'
import { escapeLikePattern } from '@wantace/shared/lib/db/escapeLikePattern'
import { ProductionStage } from '../../data/entities'
import { createProductionStageSchema, updateProductionStageSchema } from '../../data/validators'
import { createManufacturingCrudOpenApi, createPagedListResponseSchema, defaultOkResponseSchema } from '../openapi'

const F = {
  id: 'id', organization_id: 'organization_id', tenant_id: 'tenant_id',
  production_order_id: 'production_order_id', sequence_number: 'sequence_number',
  name: 'name', description: 'description', work_center_id: 'work_center_id', machine_id: 'machine_id',
  status: 'status', planned_quantity: 'planned_quantity',
  produced_quantity: 'produced_quantity', rejected_quantity: 'rejected_quantity',
  planned_setup_minutes: 'planned_setup_minutes', planned_run_minutes: 'planned_run_minutes',
  actual_setup_minutes: 'actual_setup_minutes', actual_run_minutes: 'actual_run_minutes',
  started_at: 'started_at', completed_at: 'completed_at', operator_id: 'operator_id',
  created_at: 'created_at', updated_at: 'updated_at',
} as const

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['manufacturing.production_stages.view'] },
  POST: { requireAuth: true, requireFeatures: ['manufacturing.production_stages.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['manufacturing.production_stages.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['manufacturing.production_stages.manage'] },
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
  orm: { entity: ProductionStage, idField: 'id', orgField: 'organizationId', tenantField: 'tenantId', softDeleteField: 'deletedAt' },
  indexer: { entityType: 'manufacturing:production_stage' },
  list: {
    schema: listSchema,
    entityId: 'manufacturing:production_stage',
    fields: Object.values(F),
    sortFieldMap: { name: F.name, sequenceNumber: F.sequence_number, status: F.status, createdAt: F.created_at },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (query.productionOrderId) filters[F.production_order_id] = { $eq: query.productionOrderId }
      if (query.status) filters[F.status] = { $eq: query.status }
      const term = query.search?.trim()
      if (term) { filters[F.name] = { $ilike: `%${escapeLikePattern(term)}%` } }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'manufacturing.production_stage.create', schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => { const { translate } = await resolveTranslations(); return parseScopedCommandInput(createProductionStageSchema, raw ?? {}, ctx, translate) },
      response: ({ result }) => ({ id: result?.productionStageId ?? null }), status: 201,
    },
    update: {
      commandId: 'manufacturing.production_stage.update', schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => { const { translate } = await resolveTranslations(); return parseScopedCommandInput(updateProductionStageSchema, raw ?? {}, ctx, translate) },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'manufacturing.production_stage.delete', schema: rawBodySchema,
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
  resourceName: 'ProductionStage', pluralName: 'ProductionStages', querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(z.object({ id: z.string().uuid().nullable().optional() })),
  create: { schema: createProductionStageSchema, description: 'Creates a production stage.' },
  update: { schema: updateProductionStageSchema, responseSchema: defaultOkResponseSchema, description: 'Updates a production stage.' },
  del: { schema: z.object({ id: z.string().uuid() }), responseSchema: defaultOkResponseSchema, description: 'Soft-deletes a production stage.' },
})
