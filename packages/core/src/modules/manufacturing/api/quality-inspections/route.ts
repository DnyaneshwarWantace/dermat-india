import { z } from 'zod'
import { makeCrudRoute } from '@wantace/shared/lib/crud/factory'
import { resolveTranslations } from '@wantace/shared/lib/i18n/server'
import { parseScopedCommandInput, resolveCrudRecordId } from '@wantace/shared/lib/api/scoped'
import { escapeLikePattern } from '@wantace/shared/lib/db/escapeLikePattern'
import { QualityInspection } from '../../data/entities'
import { createQualityInspectionSchema, updateQualityInspectionSchema } from '../../data/validators'
import { createManufacturingCrudOpenApi, createPagedListResponseSchema, defaultOkResponseSchema } from '../openapi'

const F = {
  id: 'id', organization_id: 'organization_id', tenant_id: 'tenant_id',
  inspection_number: 'inspection_number', inspection_type: 'inspection_type', status: 'status',
  production_order_id: 'production_order_id', production_stage_id: 'production_stage_id',
  product_variant_id: 'product_variant_id', product_name: 'product_name',
  inspected_quantity: 'inspected_quantity', passed_quantity: 'passed_quantity', failed_quantity: 'failed_quantity',
  overall_result: 'overall_result', inspector_id: 'inspector_id', inspected_at: 'inspected_at',
  created_at: 'created_at', updated_at: 'updated_at',
} as const

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['manufacturing.quality_inspections.view'] },
  POST: { requireAuth: true, requireFeatures: ['manufacturing.quality_inspections.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['manufacturing.quality_inspections.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['manufacturing.quality_inspections.manage'] },
}

export const metadata = routeMetadata
const rawBodySchema = z.object({}).passthrough()

const listSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(25),
  search: z.string().optional(),
  id: z.string().uuid().optional(),
  status: z.string().optional(),
  inspectionType: z.string().optional(),
  productionOrderId: z.string().uuid().optional(),
  overallResult: z.string().optional(),
  sortField: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
}).passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: { entity: QualityInspection, idField: 'id', orgField: 'organizationId', tenantField: 'tenantId', softDeleteField: 'deletedAt' },
  indexer: { entityType: 'manufacturing:quality_inspection' },
  list: {
    schema: listSchema,
    entityId: 'manufacturing:quality_inspection',
    fields: Object.values(F),
    sortFieldMap: { inspectionNumber: F.inspection_number, status: F.status, inspectionType: F.inspection_type, createdAt: F.created_at },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (query.status) filters[F.status] = { $eq: query.status }
      if (query.inspectionType) filters[F.inspection_type] = { $eq: query.inspectionType }
      if (query.productionOrderId) filters[F.production_order_id] = { $eq: query.productionOrderId }
      if (query.overallResult) filters[F.overall_result] = { $eq: query.overallResult }
      const term = query.search?.trim()
      if (term) {
        const like = `%${escapeLikePattern(term)}%`
        filters.$or = [{ [F.inspection_number]: { $ilike: like } }, { [F.product_name]: { $ilike: like } }]
      }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'manufacturing.quality_inspection.create', schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => { const { translate } = await resolveTranslations(); return parseScopedCommandInput(createQualityInspectionSchema, raw ?? {}, ctx, translate) },
      response: ({ result }) => ({ id: result?.qualityInspectionId ?? null, inspectionNumber: result?.inspectionNumber ?? null }), status: 201,
    },
    update: {
      commandId: 'manufacturing.quality_inspection.update', schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => { const { translate } = await resolveTranslations(); return parseScopedCommandInput(updateQualityInspectionSchema, raw ?? {}, ctx, translate) },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'manufacturing.quality_inspection.delete', schema: rawBodySchema,
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
  resourceName: 'QualityInspection', pluralName: 'QualityInspections', querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(z.object({ id: z.string().uuid().nullable().optional() })),
  create: { schema: createQualityInspectionSchema, description: 'Creates a quality inspection.' },
  update: { schema: updateQualityInspectionSchema, responseSchema: defaultOkResponseSchema, description: 'Updates a quality inspection.' },
  del: { schema: z.object({ id: z.string().uuid() }), responseSchema: defaultOkResponseSchema, description: 'Soft-deletes a quality inspection.' },
})
