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
import { ProductionBatch } from '../../data/entities'
import { productionBatchCreateSchema, productionBatchUpdateSchema, productionBatchStatusSchema } from '../../data/validators'

const listSchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    search: z.string().optional(),
    status: z.string().optional(),
    sortField: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    id: z.string().uuid().optional(),
  })
  .passthrough()

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['dermat_production.view'] },
  POST: { requireAuth: true, requireFeatures: ['dermat_production.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['dermat_production.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['dermat_production.manage'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: ProductionBatch,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: {
    entityType: (E as { dermat_production?: { production_batch?: string } }).dermat_production?.production_batch
      ?? 'dermat_production:production_batch',
  },
  list: {
    schema: listSchema,
    entityId: (E as { dermat_production?: { production_batch?: string } }).dermat_production?.production_batch
      ?? 'dermat_production:production_batch',
    fields: [
      'id',
      'batch_number',
      'order_id',
      'product_name',
      'planned_quantity',
      'planned_unit',
      'status',
      'created_by',
      'organization_id',
      'tenant_id',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: {
      batchNumber: 'batch_number',
      productName: 'product_name',
      plannedQuantity: 'planned_quantity',
      status: 'status',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (query.id) filters.id = { $eq: query.id }
      if (query.search) {
        const pattern = buildIlikeTerm(query.search)
        filters.$or = [
          { batch_number: { $ilike: pattern } },
          { product_name: { $ilike: pattern } },
          { order_id: { $ilike: pattern } },
        ]
      }
      if (query.status) filters.status = { $eq: query.status }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'dermat_production.batches.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        const scoped = withScopedPayload(raw ?? {}, ctx, translate)
        return productionBatchCreateSchema.parse(scoped)
      },
      response: ({ result }) => ({
        id: result?.batchId ?? null,
      }),
      status: 201,
    },
    update: {
      commandId: 'dermat_production.batches.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        const scoped = withScopedPayload(raw ?? {}, ctx, translate, { requireOrganization: false })
        return productionBatchUpdateSchema.parse(scoped)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'dermat_production.batches.delete',
      schema: rawBodySchema,
      mapInput: async ({ parsed, ctx }) => {
        const { translate } = await resolveTranslations()
        const id =
          parsed?.body?.id ??
          parsed?.id ??
          parsed?.query?.id ??
          (ctx.request ? new URL(ctx.request.url).searchParams.get('id') : null)
        if (!id) throw new CrudHttpError(400, { error: translate('dermat_production.errors.id_required', 'Production batch id is required') })
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

const buildDermatProductionCrudOpenApi = createCrudOpenApiFactory({
  defaultTag: 'DermatProduction',
})

const batchListItemSchema = z.object({
  id: z.string().uuid(),
  batch_number: z.string(),
  order_id: z.string().nullable().optional(),
  product_name: z.string(),
  planned_quantity: z.union([z.string(), z.number()]),
  planned_unit: z.string(),
  status: productionBatchStatusSchema,
  created_by: z.string().nullable().optional(),
  organization_id: z.string().uuid().nullable().optional(),
  tenant_id: z.string().uuid().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
})

const batchCreateResponseSchema = z.object({
  id: z.string().uuid().nullable(),
})

export const openApi = buildDermatProductionCrudOpenApi({
  resourceName: 'ProductionBatch',
  pluralName: 'ProductionBatches',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(batchListItemSchema),
  create: {
    schema: productionBatchCreateSchema,
    responseSchema: batchCreateResponseSchema,
    description: 'Creates a production batch and its Bulk/Semi-Finished/Finished stages.',
  },
  update: {
    schema: productionBatchUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a production batch.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a production batch by id.',
  },
})
