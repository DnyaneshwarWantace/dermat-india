import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { withScopedPayload } from '@open-mercato/shared/lib/api/scoped'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { buildIlikeTerm } from '@open-mercato/shared/lib/db/buildIlikeTerm'
import { parseIdsParam, mergeIdFilter, isIdsParamProvided } from '@open-mercato/shared/lib/crud/ids'
import {
  createCrudOpenApiFactory,
  createPagedListResponseSchema as createSharedPagedListResponseSchema,
  defaultOkResponseSchema,
} from '@open-mercato/shared/lib/openapi/crud'
import { E } from '@/.mercato/generated/entities.ids.generated'
import { PackagingMaterial } from '../../data/entities'
import { packagingMaterialCreateSchema, packagingMaterialUpdateSchema } from '../../data/validators'

const listSchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    search: z.string().optional(),
    unit: z.string().optional(),
    category: z.string().optional(),
    isActive: z.string().optional(),
    sortField: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    id: z.string().uuid().optional(),
    ids: z.string().optional(),
  })
  .passthrough()

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['dermat_pm_master.view'] },
  POST: { requireAuth: true, requireFeatures: ['dermat_pm_master.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['dermat_pm_master.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['dermat_pm_master.manage'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: PackagingMaterial,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: {
    entityType: (E as { dermat_pm_master?: { packaging_material?: string } }).dermat_pm_master?.packaging_material
      ?? 'dermat_pm_master:packaging_material',
  },
  list: {
    schema: listSchema,
    entityId: (E as { dermat_pm_master?: { packaging_material?: string } }).dermat_pm_master?.packaging_material
      ?? 'dermat_pm_master:packaging_material',
    fields: [
      'id',
      'name',
      'code',
      'stock',
      'unit',
      'make_brand_name',
      'supplier',
      'category',
      'dimensions',
      'is_active',
      'organization_id',
      'tenant_id',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: {
      name: 'name',
      code: 'code',
      stock: 'stock',
      unit: 'unit',
      makeBrandName: 'make_brand_name',
      supplier: 'supplier',
      category: 'category',
      dimensions: 'dimensions',
      isActive: 'is_active',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    buildFilters: async (query) => {
      let filters: Record<string, unknown> = {}
      if (query.id) filters.id = { $eq: query.id }
      filters = mergeIdFilter(filters, parseIdsParam(query.ids), { idsParamProvided: isIdsParamProvided(query.ids) })
      if (query.search) {
        const pattern = buildIlikeTerm(query.search)
        filters.$or = [
          { name: { $ilike: pattern } },
          { code: { $ilike: pattern } },
          { make_brand_name: { $ilike: pattern } },
          { supplier: { $ilike: pattern } },
        ]
      }
      if (query.unit) filters.unit = { $eq: query.unit }
      if (query.category) filters.category = { $eq: query.category }
      if (query.isActive === 'true') filters.is_active = { $eq: true }
      if (query.isActive === 'false') filters.is_active = { $eq: false }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'dermat_pm_master.pm_master.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        const scoped = withScopedPayload(raw ?? {}, ctx, translate)
        return packagingMaterialCreateSchema.parse(scoped)
      },
      response: ({ result }) => ({
        id: result?.packagingMaterialId ?? null,
      }),
      status: 201,
    },
    update: {
      commandId: 'dermat_pm_master.pm_master.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        const scoped = withScopedPayload(raw ?? {}, ctx, translate, { requireOrganization: false })
        return packagingMaterialUpdateSchema.parse(scoped)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'dermat_pm_master.pm_master.delete',
      schema: rawBodySchema,
      mapInput: async ({ parsed, ctx }) => {
        const { translate } = await resolveTranslations()
        const id =
          parsed?.body?.id ??
          parsed?.id ??
          parsed?.query?.id ??
          (ctx.request ? new URL(ctx.request.url).searchParams.get('id') : null)
        if (!id) throw new CrudHttpError(400, { error: translate('dermat_pm_master.errors.id_required', 'Packaging material id is required') })
        return { id }
      },
      response: () => ({ ok: true }),
    },
  },
})

const { POST, PUT, DELETE } = crud

export { POST, PUT, DELETE }
export const GET = crud.GET

function createPagedListResponseSchema(itemSchema: z.ZodTypeAny) {
  return createSharedPagedListResponseSchema(itemSchema, { paginationMetaOptional: true })
}

const buildDermatPmMasterCrudOpenApi = createCrudOpenApiFactory({
  defaultTag: 'DermatPmMaster',
})

const packagingMaterialListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string(),
  stock: z.union([z.string(), z.number()]).nullable().optional(),
  unit: z.string(),
  make_brand_name: z.string().nullable().optional(),
  supplier: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  dimensions: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  organization_id: z.string().uuid().nullable().optional(),
  tenant_id: z.string().uuid().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
})

const packagingMaterialCreateResponseSchema = z.object({
  id: z.string().uuid().nullable(),
})

export const openApi = buildDermatPmMasterCrudOpenApi({
  resourceName: 'PackagingMaterial',
  pluralName: 'PackagingMaterials',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(packagingMaterialListItemSchema),
  create: {
    schema: packagingMaterialCreateSchema,
    responseSchema: packagingMaterialCreateResponseSchema,
    description: 'Creates a packaging material master-data record.',
  },
  update: {
    schema: packagingMaterialUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a packaging material record.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a packaging material by id.',
  },
})
