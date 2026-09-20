import { z } from 'zod'
import { makeCrudRoute } from '@wantace/shared/lib/crud/factory'
import { resolveTranslations } from '@wantace/shared/lib/i18n/server'
import { parseScopedCommandInput, resolveCrudRecordId } from '@wantace/shared/lib/api/scoped'
import { escapeLikePattern } from '@wantace/shared/lib/db/escapeLikePattern'
import { Machine } from '../../data/entities'
import { createMachineSchema, updateMachineSchema } from '../../data/validators'
import { createManufacturingCrudOpenApi, createPagedListResponseSchema, defaultOkResponseSchema } from '../openapi'

const F = {
  id: 'id', organization_id: 'organization_id', tenant_id: 'tenant_id',
  name: 'name', code: 'code', description: 'description',
  work_center_id: 'work_center_id', status: 'status',
  make_model: 'make_model', serial_number: 'serial_number',
  purchase_date: 'purchase_date', last_maintenance_date: 'last_maintenance_date',
  next_maintenance_date: 'next_maintenance_date',
  created_at: 'created_at', updated_at: 'updated_at',
} as const

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['manufacturing.machines.view'] },
  POST: { requireAuth: true, requireFeatures: ['manufacturing.machines.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['manufacturing.machines.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['manufacturing.machines.manage'] },
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
  workCenterId: z.string().uuid().optional(),
  sortField: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
}).passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: { entity: Machine, idField: 'id', orgField: 'organizationId', tenantField: 'tenantId', softDeleteField: 'deletedAt' },
  indexer: { entityType: 'manufacturing:machine' },
  list: {
    schema: listSchema,
    entityId: 'manufacturing:machine',
    fields: Object.values(F),
    sortFieldMap: { name: F.name, code: F.code, status: F.status, createdAt: F.created_at, updatedAt: F.updated_at },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (typeof query.ids === 'string' && query.ids.trim().length > 0) {
        filters[F.id] = { $in: query.ids.split(',').map((v: string) => v.trim()).filter((v: string) => v.length > 0) }
      }
      if (query.status) filters[F.status] = { $eq: query.status }
      if (query.workCenterId) filters[F.work_center_id] = { $eq: query.workCenterId }
      const term = query.search?.trim()
      if (term) {
        const like = `%${escapeLikePattern(term)}%`
        filters.$or = [{ [F.name]: { $ilike: like } }, { [F.code]: { $ilike: like } }, { [F.serial_number]: { $ilike: like } }]
      }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'manufacturing.machines.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => { const { translate } = await resolveTranslations(); return parseScopedCommandInput(createMachineSchema, raw ?? {}, ctx, translate) },
      response: ({ result }) => ({ id: result?.machineId ?? null }),
      status: 201,
    },
    update: {
      commandId: 'manufacturing.machines.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => { const { translate } = await resolveTranslations(); return parseScopedCommandInput(updateMachineSchema, raw ?? {}, ctx, translate) },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'manufacturing.machines.delete',
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

const machineListItemSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  work_center_id: z.string().uuid().nullable().optional(),
  status: z.string().nullable().optional(),
  make_model: z.string().nullable().optional(),
  serial_number: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
})

export const openApi = createManufacturingCrudOpenApi({
  resourceName: 'Machine',
  pluralName: 'Machines',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(machineListItemSchema),
  create: { schema: createMachineSchema, description: 'Creates a new machine.' },
  update: { schema: updateMachineSchema, responseSchema: defaultOkResponseSchema, description: 'Updates a machine by id.' },
  del: { schema: z.object({ id: z.string().uuid() }), responseSchema: defaultOkResponseSchema, description: 'Soft-deletes a machine by id.' },
})
