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
import { QcPolicy } from '../../data/entities'
import { qcPolicyCreateSchema, qcPolicyUpdateSchema } from '../../data/validators'

const listSchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    search: z.string().optional(),
    sortField: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    id: z.string().uuid().optional(),
  })
  .passthrough()

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['dermat_qc.view'] },
  POST: { requireAuth: true, requireFeatures: ['dermat_qc.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['dermat_qc.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['dermat_qc.manage'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: QcPolicy,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: {
    entityType: (E as { dermat_qc?: { qc_policy?: string } }).dermat_qc?.qc_policy ?? 'dermat_qc:qc_policy',
  },
  list: {
    schema: listSchema,
    entityId: (E as { dermat_qc?: { qc_policy?: string } }).dermat_qc?.qc_policy ?? 'dermat_qc:qc_policy',
    fields: [
      'id',
      'applies_to',
      'chemical_required',
      'micro_required',
      'organization_id',
      'tenant_id',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: {
      appliesTo: 'applies_to',
      chemicalRequired: 'chemical_required',
      microRequired: 'micro_required',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (query.id) filters.id = { $eq: query.id }
      if (query.search) {
        const pattern = buildIlikeTerm(query.search)
        filters.$or = [{ applies_to: { $ilike: pattern } }]
      }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'dermat_qc.qc_policies.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        const scoped = withScopedPayload(raw ?? {}, ctx, translate)
        return qcPolicyCreateSchema.parse(scoped)
      },
      response: ({ result }) => ({
        id: result?.qcPolicyId ?? null,
      }),
      status: 201,
    },
    update: {
      commandId: 'dermat_qc.qc_policies.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        const scoped = withScopedPayload(raw ?? {}, ctx, translate, { requireOrganization: false })
        return qcPolicyUpdateSchema.parse(scoped)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'dermat_qc.qc_policies.delete',
      schema: rawBodySchema,
      mapInput: async ({ parsed, ctx }) => {
        const { translate } = await resolveTranslations()
        const id =
          parsed?.body?.id ??
          parsed?.id ??
          parsed?.query?.id ??
          (ctx.request ? new URL(ctx.request.url).searchParams.get('id') : null)
        if (!id) throw new CrudHttpError(400, { error: translate('dermat_qc.errors.id_required', 'QC policy id is required') })
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

const buildDermatQcPoliciesCrudOpenApi = createCrudOpenApiFactory({
  defaultTag: 'DermatQc',
})

const qcPolicyListItemSchema = z.object({
  id: z.string().uuid(),
  applies_to: z.string(),
  chemical_required: z.boolean(),
  micro_required: z.boolean(),
  organization_id: z.string().uuid().nullable().optional(),
  tenant_id: z.string().uuid().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
})

const qcPolicyCreateResponseSchema = z.object({
  id: z.string().uuid().nullable(),
})

export const openApi = buildDermatQcPoliciesCrudOpenApi({
  resourceName: 'QcPolicy',
  pluralName: 'QcPolicies',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(qcPolicyListItemSchema),
  create: {
    schema: qcPolicyCreateSchema,
    responseSchema: qcPolicyCreateResponseSchema,
    description: 'Creates a QC policy (Chemical/Micro required) for a material or product.',
  },
  update: {
    schema: qcPolicyUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a QC policy.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a QC policy by id.',
  },
})
