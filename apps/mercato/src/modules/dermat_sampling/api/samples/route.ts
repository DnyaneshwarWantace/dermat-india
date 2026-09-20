import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { withScopedPayload } from '@open-mercato/shared/lib/api/scoped'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import {
  createCrudOpenApiFactory,
  createPagedListResponseSchema as createSharedPagedListResponseSchema,
  defaultOkResponseSchema,
} from '@open-mercato/shared/lib/openapi/crud'
import { E } from '@/.mercato/generated/entities.ids.generated'
import { Sample } from '../../data/entities'
import {
  sampleCreateSchema,
  sampleStatusUpdateSchema,
  sampleStatusSchema,
  sampleRndStageSchema,
} from '../../data/validators'

const listSchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    orderId: z.string().optional(),
    status: z.string().optional(),
    sortField: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    id: z.string().uuid().optional(),
  })
  .passthrough()

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['dermat_sampling.view'] },
  POST: { requireAuth: true, requireFeatures: ['dermat_sampling.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['dermat_sampling.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['dermat_sampling.manage'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: Sample,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: {
    entityType: (E as { dermat_sampling?: { sample?: string } }).dermat_sampling?.sample ?? 'dermat_sampling:sample',
  },
  list: {
    schema: listSchema,
    entityId: (E as { dermat_sampling?: { sample?: string } }).dermat_sampling?.sample ?? 'dermat_sampling:sample',
    fields: [
      'id',
      'order_id',
      'product_name',
      'status',
      'rnd_stage',
      'source_order_verified_by',
      'requested_by',
      'requested_at',
      'sent_at',
      'customer_decision_at',
      'rejection_reason',
      'notes',
      'organization_id',
      'tenant_id',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: {
      status: 'status',
      requestedAt: 'requested_at',
      sentAt: 'sent_at',
      customerDecisionAt: 'customer_decision_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (query.id) filters.id = { $eq: query.id }
      if (query.orderId) filters.order_id = { $eq: query.orderId }
      if (query.status) filters.status = { $eq: query.status }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'dermat_sampling.samples.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        const scoped = withScopedPayload(raw ?? {}, ctx, translate)
        return sampleCreateSchema.parse(scoped)
      },
      response: ({ result }) => ({
        id: result?.sampleId ?? null,
      }),
      status: 201,
    },
    update: {
      commandId: 'dermat_sampling.samples.update_status',
      schema: rawBodySchema,
      mapInput: async ({ raw }) => {
        await resolveTranslations()
        return sampleStatusUpdateSchema.parse(raw ?? {})
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'dermat_sampling.samples.delete',
      schema: rawBodySchema,
      mapInput: async ({ parsed, ctx }) => {
        const { translate } = await resolveTranslations()
        const id =
          parsed?.body?.id ??
          parsed?.id ??
          parsed?.query?.id ??
          (ctx.request ? new URL(ctx.request.url).searchParams.get('id') : null)
        if (!id) throw new CrudHttpError(400, { error: translate('dermat_sampling.errors.id_required', 'Sample id is required') })
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

const buildDermatSamplesCrudOpenApi = createCrudOpenApiFactory({
  defaultTag: 'DermatSampling',
})

const sampleListItemSchema = z.object({
  id: z.string().uuid(),
  order_id: z.string(),
  product_name: z.string().nullable().optional(),
  status: sampleStatusSchema,
  rnd_stage: sampleRndStageSchema.optional(),
  source_order_verified_by: z.string().nullable().optional(),
  requested_by: z.string().nullable().optional(),
  requested_at: z.string().nullable().optional(),
  sent_at: z.string().nullable().optional(),
  customer_decision_at: z.string().nullable().optional(),
  rejection_reason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  organization_id: z.string().uuid().nullable().optional(),
  tenant_id: z.string().uuid().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
})

const sampleCreateResponseSchema = z.object({
  id: z.string().uuid().nullable(),
})

export const openApi = buildDermatSamplesCrudOpenApi({
  resourceName: 'Sample',
  pluralName: 'Samples',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(sampleListItemSchema),
  create: {
    schema: sampleCreateSchema,
    responseSchema: sampleCreateResponseSchema,
    description: 'Requests a new R&D sample for a sales order.',
  },
  update: {
    schema: sampleStatusUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates an R&D sample\'s status (requested/in_preparation/sent/approved/rejected).',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a sample record by id.',
  },
})
