import { z } from 'zod'
import { makeCrudRoute } from '@wantace/shared/lib/crud/factory'
import { resolveTranslations } from '@wantace/shared/lib/i18n/server'
import { parseScopedCommandInput, resolveCrudRecordId } from '@wantace/shared/lib/api/scoped'
import { escapeLikePattern } from '@wantace/shared/lib/db/escapeLikePattern'
import { parseBooleanToken } from '@wantace/shared/lib/boolean'
import { BillOfMaterials } from '../../data/entities'
import { createBOMSchema, updateBOMSchema } from '../../data/validators'
import { createManufacturingCrudOpenApi, createPagedListResponseSchema, defaultOkResponseSchema } from '../openapi'

const F = {
  id: 'id', organization_id: 'organization_id', tenant_id: 'tenant_id',
  name: 'name', code: 'code', description: 'description',
  product_variant_id: 'product_variant_id', product_name: 'product_name',
  output_quantity: 'output_quantity', unit_of_measure: 'unit_of_measure',
  status: 'status', version: 'version', is_default: 'is_default',
  material_cost_cents: 'material_cost_cents', operation_cost_cents: 'operation_cost_cents',
  total_cost_cents: 'total_cost_cents',
  created_at: 'created_at', updated_at: 'updated_at',
} as const

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['manufacturing.bom.view'] },
  POST: { requireAuth: true, requireFeatures: ['manufacturing.bom.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['manufacturing.bom.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['manufacturing.bom.manage'] },
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
  productVariantId: z.string().uuid().optional(),
  isDefault: z.string().optional(),
  sortField: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
}).passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: { entity: BillOfMaterials, idField: 'id', orgField: 'organizationId', tenantField: 'tenantId', softDeleteField: 'deletedAt' },
  indexer: { entityType: 'manufacturing:bom' },
  list: {
    schema: listSchema,
    entityId: 'manufacturing:bom',
    fields: Object.values(F),
    sortFieldMap: {
      name: F.name, code: F.code, status: F.status,
      productName: F.product_name, totalCostCents: F.total_cost_cents,
      createdAt: F.created_at, updatedAt: F.updated_at,
    },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (typeof query.ids === 'string' && query.ids.trim().length > 0) {
        filters[F.id] = { $in: query.ids.split(',').map((v: string) => v.trim()).filter((v: string) => v.length > 0) }
      }
      if (query.status) filters[F.status] = { $eq: query.status }
      if (query.productVariantId) filters[F.product_variant_id] = { $eq: query.productVariantId }
      const isDefault = parseBooleanToken(query.isDefault)
      if (isDefault !== null) filters[F.is_default] = { $eq: isDefault }
      const term = query.search?.trim()
      if (term) {
        const like = `%${escapeLikePattern(term)}%`
        filters.$or = [{ [F.name]: { $ilike: like } }, { [F.code]: { $ilike: like } }, { [F.product_name]: { $ilike: like } }]
      }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'manufacturing.bom.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => { const { translate } = await resolveTranslations(); return parseScopedCommandInput(createBOMSchema, raw ?? {}, ctx, translate) },
      response: ({ result }) => ({ id: result?.bomId ?? null }),
      status: 201,
    },
    update: {
      commandId: 'manufacturing.bom.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => { const { translate } = await resolveTranslations(); return parseScopedCommandInput(updateBOMSchema, raw ?? {}, ctx, translate) },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'manufacturing.bom.delete',
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

const bomListItemSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  product_name: z.string().nullable().optional(),
  output_quantity: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  version: z.number().nullable().optional(),
  is_default: z.boolean().nullable().optional(),
  material_cost_cents: z.number().nullable().optional(),
  operation_cost_cents: z.number().nullable().optional(),
  total_cost_cents: z.number().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
})

export const openApi = createManufacturingCrudOpenApi({
  resourceName: 'BillOfMaterials',
  pluralName: 'BillsOfMaterials',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(bomListItemSchema),
  create: { schema: createBOMSchema, description: 'Creates a new bill of materials with lines and operations.' },
  update: { schema: updateBOMSchema, responseSchema: defaultOkResponseSchema, description: 'Updates a bill of materials by id.' },
  del: { schema: z.object({ id: z.string().uuid() }), responseSchema: defaultOkResponseSchema, description: 'Soft-deletes a bill of materials by id.' },
})
