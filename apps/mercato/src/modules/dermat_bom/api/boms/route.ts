import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { withScopedPayload } from '@open-mercato/shared/lib/api/scoped'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { buildIlikeTerm } from '@open-mercato/shared/lib/db/buildIlikeTerm'
import {
  createCrudOpenApiFactory,
  createPagedListResponseSchema as createSharedPagedListResponseSchema,
  defaultOkResponseSchema,
} from '@open-mercato/shared/lib/openapi/crud'
import { E } from '@/.mercato/generated/entities.ids.generated'
import { Bom } from '../../data/entities'
import { bomCreateSchema, bomUpdateSchema } from '../../data/validators'

const listSchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    search: z.string().optional(),
    isActive: z.string().optional(),
    sortField: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    id: z.string().uuid().optional(),
    catalogProductId: z.string().uuid().optional(),
  })
  .passthrough()

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['dermat_bom.view'] },
  POST: { requireAuth: true, requireFeatures: ['dermat_bom.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['dermat_bom.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['dermat_bom.manage'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: Bom,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: {
    entityType: (E as { dermat_bom?: { bom?: string } }).dermat_bom?.bom ?? 'dermat_bom:bom',
  },
  list: {
    schema: listSchema,
    entityId: (E as { dermat_bom?: { bom?: string } }).dermat_bom?.bom ?? 'dermat_bom:bom',
    fields: [
      'id',
      'bom_name',
      'catalog_product_id',
      'batch_quantity',
      'version',
      'is_active',
      'metadata',
      'organization_id',
      'tenant_id',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: {
      bomName: 'bom_name',
      version: 'version',
      isActive: 'is_active',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (query.id) filters.id = { $eq: query.id }
      if (query.catalogProductId) filters.catalog_product_id = { $eq: query.catalogProductId }
      if (query.search) {
        const pattern = buildIlikeTerm(query.search)
        filters.$or = [{ bom_name: { $ilike: pattern } }]
      }
      if (query.isActive === 'true') filters.is_active = { $eq: true }
      if (query.isActive === 'false') filters.is_active = { $eq: false }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'dermat_bom.boms.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        const scoped = withScopedPayload(raw ?? {}, ctx, translate)
        return bomCreateSchema.parse(scoped)
      },
      response: ({ result }) => ({
        id: result?.bomId ?? null,
      }),
      status: 201,
    },
    update: {
      commandId: 'dermat_bom.boms.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        const scoped = withScopedPayload(raw ?? {}, ctx, translate, { requireOrganization: false })
        return bomUpdateSchema.parse(scoped)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'dermat_bom.boms.delete',
      schema: rawBodySchema,
      mapInput: async ({ parsed, ctx }) => {
        const { translate } = await resolveTranslations()
        const id =
          parsed?.body?.id ??
          parsed?.id ??
          parsed?.query?.id ??
          (ctx.request ? new URL(ctx.request.url).searchParams.get('id') : null)
        if (!id) throw new CrudHttpError(400, { error: translate('dermat_bom.errors.id_required', 'BOM id is required') })
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

const buildDermatBomCrudOpenApi = createCrudOpenApiFactory({
  defaultTag: 'DermatBom',
})

const bomListItemSchema = z.object({
  id: z.string().uuid(),
  bom_name: z.string(),
  catalog_product_id: z.string().uuid().nullable().optional(),
  batch_quantity: z.union([z.string(), z.number()]).optional(),
  version: z.number().optional(),
  is_active: z.boolean().optional(),
  organization_id: z.string().uuid().nullable().optional(),
  tenant_id: z.string().uuid().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
})

const bomCreateResponseSchema = z.object({
  id: z.string().uuid().nullable(),
})

export const openApi = buildDermatBomCrudOpenApi({
  resourceName: 'Bom',
  pluralName: 'Boms',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(bomListItemSchema),
  create: {
    schema: bomCreateSchema,
    responseSchema: bomCreateResponseSchema,
    description: 'Creates a Bill of Materials for a finished product.',
  },
  update: {
    schema: bomUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a BOM record.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a BOM by id.',
  },
})
