import { z } from 'zod'
import { makeCrudRoute } from '@wantace/shared/lib/crud/factory'
import { resolveTranslations } from '@wantace/shared/lib/i18n/server'
import { parseScopedCommandInput, resolveCrudRecordId } from '@wantace/shared/lib/api/scoped'
import { escapeLikePattern } from '@wantace/shared/lib/db/escapeLikePattern'
import { WorkCenter } from '../../data/entities'
import { createWorkCenterSchema, updateWorkCenterSchema } from '../../data/validators'
import { createManufacturingCrudOpenApi, createPagedListResponseSchema, defaultOkResponseSchema } from '../openapi'

const F = {
  id: 'id', organization_id: 'organization_id', tenant_id: 'tenant_id',
  name: 'name', code: 'code', description: 'description', status: 'status',
  cost_per_hour_cents: 'cost_per_hour_cents', capacity_per_day: 'capacity_per_day',
  unit_of_measure: 'unit_of_measure', location: 'location',
  created_at: 'created_at', updated_at: 'updated_at',
} as const

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['manufacturing.work_centers.view'] },
  POST: { requireAuth: true, requireFeatures: ['manufacturing.work_centers.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['manufacturing.work_centers.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['manufacturing.work_centers.manage'] },
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
  sortField: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
}).passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: { entity: WorkCenter, idField: 'id', orgField: 'organizationId', tenantField: 'tenantId', softDeleteField: 'deletedAt' },
  indexer: { entityType: 'manufacturing:work_center' },
  list: {
    schema: listSchema,
    entityId: 'manufacturing:work_center',
    fields: Object.values(F),
    sortFieldMap: { name: F.name, code: F.code, status: F.status, createdAt: F.created_at, updatedAt: F.updated_at },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (typeof query.ids === 'string' && query.ids.trim().length > 0) {
        filters[F.id] = { $in: query.ids.split(',').map((v: string) => v.trim()).filter((v: string) => v.length > 0) }
      }
      if (query.status) filters[F.status] = { $eq: query.status }
      const term = query.search?.trim()
      if (term) {
        const like = `%${escapeLikePattern(term)}%`
        filters.$or = [{ [F.name]: { $ilike: like } }, { [F.code]: { $ilike: like } }, { [F.location]: { $ilike: like } }]
      }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'manufacturing.work_centers.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => { const { translate } = await resolveTranslations(); return parseScopedCommandInput(createWorkCenterSchema, raw ?? {}, ctx, translate) },
      response: ({ result }) => ({ id: result?.workCenterId ?? null }),
      status: 201,
    },
    update: {
      commandId: 'manufacturing.work_centers.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => { const { translate } = await resolveTranslations(); return parseScopedCommandInput(updateWorkCenterSchema, raw ?? {}, ctx, translate) },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'manufacturing.work_centers.delete',
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

const workCenterListItemSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  cost_per_hour_cents: z.number().nullable().optional(),
  capacity_per_day: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
})

export const openApi = createManufacturingCrudOpenApi({
  resourceName: 'WorkCenter',
  pluralName: 'WorkCenters',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(workCenterListItemSchema),
  create: { schema: createWorkCenterSchema, description: 'Creates a new work center.' },
  update: { schema: updateWorkCenterSchema, responseSchema: defaultOkResponseSchema, description: 'Updates a work center by id.' },
  del: { schema: z.object({ id: z.string().uuid() }), responseSchema: defaultOkResponseSchema, description: 'Soft-deletes a work center by id.' },
})
