import { z } from 'zod'
import { makeCrudRoute } from '@wantace/shared/lib/crud/factory'
import { resolveTranslations } from '@wantace/shared/lib/i18n/server'
import { parseScopedCommandInput, resolveCrudRecordId } from '@wantace/shared/lib/api/scoped'
import { escapeLikePattern } from '@wantace/shared/lib/db/escapeLikePattern'
import { ProductionStageTemplate } from '../../data/entities'
import { createStageTemplateSchema, updateStageTemplateSchema } from '../../data/validators'
import { createManufacturingCrudOpenApi, createPagedListResponseSchema, defaultOkResponseSchema } from '../openapi'

const F = {
  id: 'id', organization_id: 'organization_id', tenant_id: 'tenant_id',
  name: 'name', code: 'code', description: 'description',
  sequence_number: 'sequence_number', is_active: 'is_active',
  default_work_center_id: 'default_work_center_id', default_machine_id: 'default_machine_id',
  estimated_setup_minutes: 'estimated_setup_minutes', estimated_run_minutes: 'estimated_run_minutes',
  requires_quality_check: 'requires_quality_check', notes: 'notes',
  created_at: 'created_at', updated_at: 'updated_at',
} as const

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['manufacturing.stage_templates.view'] },
  POST: { requireAuth: true, requireFeatures: ['manufacturing.stage_templates.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['manufacturing.stage_templates.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['manufacturing.stage_templates.manage'] },
}

export const metadata = routeMetadata
const rawBodySchema = z.object({}).passthrough()

const listSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(25),
  search: z.string().optional(),
  id: z.string().uuid().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  sortField: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
}).passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: { entity: ProductionStageTemplate, idField: 'id', orgField: 'organizationId', tenantField: 'tenantId', softDeleteField: 'deletedAt' },
  indexer: { entityType: 'manufacturing:production_stage_template' },
  list: {
    schema: listSchema,
    entityId: 'manufacturing:production_stage_template',
    fields: Object.values(F),
    sortFieldMap: { name: F.name, code: F.code, sequenceNumber: F.sequence_number, createdAt: F.created_at },
    defaultSort: { field: F.sequence_number, dir: 'asc' },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (query.isActive === 'true') filters[F.is_active] = { $eq: true }
      if (query.isActive === 'false') filters[F.is_active] = { $eq: false }
      const term = query.search?.trim()
      if (term) { filters[F.name] = { $ilike: `%${escapeLikePattern(term)}%` } }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'manufacturing.stage_template.create', schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => { const { translate } = await resolveTranslations(); return parseScopedCommandInput(createStageTemplateSchema, raw ?? {}, ctx, translate) },
      response: ({ result }) => ({ id: result?.id ?? null }), status: 201,
    },
    update: {
      commandId: 'manufacturing.stage_template.update', schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => { const { translate } = await resolveTranslations(); return parseScopedCommandInput(updateStageTemplateSchema, raw ?? {}, ctx, translate) },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'manufacturing.stage_template.delete', schema: rawBodySchema,
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
  resourceName: 'ProductionStageTemplate', pluralName: 'ProductionStageTemplates', querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(z.object({ id: z.string().uuid().nullable().optional() })),
  create: { schema: createStageTemplateSchema, description: 'Creates a production stage template.' },
  update: { schema: updateStageTemplateSchema, responseSchema: defaultOkResponseSchema, description: 'Updates a production stage template.' },
  del: { schema: z.object({ id: z.string().uuid() }), responseSchema: defaultOkResponseSchema, description: 'Soft-deletes a production stage template.' },
})
