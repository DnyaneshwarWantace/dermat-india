import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import {
  createCrudOpenApiFactory,
  createPagedListResponseSchema as createSharedPagedListResponseSchema,
  defaultOkResponseSchema,
} from '@open-mercato/shared/lib/openapi/crud'
import { E } from '@/.mercato/generated/entities.ids.generated'
import { BatchStage } from '../../data/entities'
import { batchStageUpdateSchema, batchStageStatusSchema, batchStageTypeSchema, wastageActionSchema } from '../../data/validators'

const listSchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    productionBatchId: z.string().uuid().optional(),
    status: z.string().optional(),
    stageType: z.string().optional(),
    sortField: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    id: z.string().uuid().optional(),
  })
  .passthrough()

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['dermat_production.view'] },
  PUT: { requireAuth: true, requireFeatures: ['dermat_production.manage'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: BatchStage,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: {
    entityType: (E as { dermat_production?: { batch_stage?: string } }).dermat_production?.batch_stage
      ?? 'dermat_production:batch_stage',
  },
  list: {
    schema: listSchema,
    entityId: (E as { dermat_production?: { batch_stage?: string } }).dermat_production?.batch_stage
      ?? 'dermat_production:batch_stage',
    fields: [
      'id',
      'production_batch_id',
      'stage_type',
      'sequence_number',
      'is_skipped',
      'machine_used',
      'operator_name',
      'shift',
      'planned_output_qty',
      'actual_output_qty',
      'wastage_qty',
      'wastage_action',
      'status',
      'started_at',
      'completed_at',
      'signed_off_by',
      'organization_id',
      'tenant_id',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: {
      sequenceNumber: 'sequence_number',
      stageType: 'stage_type',
      status: 'status',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (query.id) filters.id = { $eq: query.id }
      if (query.productionBatchId) filters.production_batch_id = { $eq: query.productionBatchId }
      if (query.status) filters.status = { $eq: query.status }
      if (query.stageType) filters.stage_type = { $eq: query.stageType }
      return filters
    },
  },
  actions: {
    update: {
      commandId: 'dermat_production.batch_stages.update',
      schema: rawBodySchema,
      mapInput: async ({ raw }) => {
        await resolveTranslations()
        return batchStageUpdateSchema.parse(raw ?? {})
      },
      response: () => ({ ok: true }),
    },
  },
})

const { PUT } = crud

export { PUT }
export const GET = crud.GET

function createPagedListResponseSchema(itemSchema: z.ZodTypeAny) {
  return createSharedPagedListResponseSchema(itemSchema, { paginationMetaOptional: true })
}

const buildDermatBatchStagesCrudOpenApi = createCrudOpenApiFactory({
  defaultTag: 'DermatProductionBatchStages',
})

const stageListItemSchema = z.object({
  id: z.string().uuid(),
  production_batch_id: z.string().uuid(),
  stage_type: batchStageTypeSchema,
  sequence_number: z.number(),
  is_skipped: z.boolean(),
  machine_used: z.string().nullable().optional(),
  operator_name: z.string().nullable().optional(),
  shift: z.string().nullable().optional(),
  planned_output_qty: z.union([z.string(), z.number()]).nullable().optional(),
  actual_output_qty: z.union([z.string(), z.number()]).nullable().optional(),
  wastage_qty: z.union([z.string(), z.number()]).nullable().optional(),
  wastage_action: wastageActionSchema,
  status: batchStageStatusSchema,
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  signed_off_by: z.string().nullable().optional(),
  organization_id: z.string().uuid().nullable().optional(),
  tenant_id: z.string().uuid().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
})

export const openApi = buildDermatBatchStagesCrudOpenApi({
  resourceName: 'BatchStage',
  pluralName: 'BatchStages',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(stageListItemSchema),
  update: {
    schema: batchStageUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a batch stage (machine, operator, shift, output, wastage, status).',
  },
})
