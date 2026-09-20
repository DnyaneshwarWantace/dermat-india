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
import { QcTest } from '../../data/entities'
import {
  qcTestCreateSchema,
  qcTestResultUpdateSchema,
  qcReferenceTypeSchema,
  qcTestTypeSchema,
  qcResultSchema,
} from '../../data/validators'

const listSchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    referenceType: z.string().optional(),
    referenceId: z.string().optional(),
    testType: z.string().optional(),
    result: z.string().optional(),
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
    entity: QcTest,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: {
    entityType: (E as { dermat_qc?: { qc_test?: string } }).dermat_qc?.qc_test ?? 'dermat_qc:qc_test',
  },
  list: {
    schema: listSchema,
    entityId: (E as { dermat_qc?: { qc_test?: string } }).dermat_qc?.qc_test ?? 'dermat_qc:qc_test',
    fields: [
      'id',
      'reference_type',
      'reference_id',
      'test_type',
      'result',
      'tested_by',
      'tested_at',
      'remarks',
      'organization_id',
      'tenant_id',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: {
      referenceType: 'reference_type',
      testType: 'test_type',
      result: 'result',
      testedAt: 'tested_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (query.id) filters.id = { $eq: query.id }
      if (query.referenceType) filters.reference_type = { $eq: query.referenceType }
      if (query.referenceId) filters.reference_id = { $eq: query.referenceId }
      if (query.testType) filters.test_type = { $eq: query.testType }
      if (query.result) filters.result = { $eq: query.result }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'dermat_qc.qc_tests.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        const scoped = withScopedPayload(raw ?? {}, ctx, translate)
        return qcTestCreateSchema.parse(scoped)
      },
      response: ({ result }) => ({
        id: result?.qcTestId ?? null,
      }),
      status: 201,
    },
    update: {
      commandId: 'dermat_qc.qc_tests.update_result',
      schema: rawBodySchema,
      mapInput: async ({ raw }) => {
        await resolveTranslations()
        return qcTestResultUpdateSchema.parse(raw ?? {})
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'dermat_qc.qc_tests.delete',
      schema: rawBodySchema,
      mapInput: async ({ parsed, ctx }) => {
        const { translate } = await resolveTranslations()
        const id =
          parsed?.body?.id ??
          parsed?.id ??
          parsed?.query?.id ??
          (ctx.request ? new URL(ctx.request.url).searchParams.get('id') : null)
        if (!id) throw new CrudHttpError(400, { error: translate('dermat_qc.errors.id_required', 'QC test id is required') })
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

const buildDermatQcTestsCrudOpenApi = createCrudOpenApiFactory({
  defaultTag: 'DermatQc',
})

const qcTestListItemSchema = z.object({
  id: z.string().uuid(),
  reference_type: qcReferenceTypeSchema,
  reference_id: z.string().nullable().optional(),
  test_type: qcTestTypeSchema,
  result: qcResultSchema,
  tested_by: z.string().nullable().optional(),
  tested_at: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
  organization_id: z.string().uuid().nullable().optional(),
  tenant_id: z.string().uuid().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
})

const qcTestCreateResponseSchema = z.object({
  id: z.string().uuid().nullable(),
})

export const openApi = buildDermatQcTestsCrudOpenApi({
  resourceName: 'QcTest',
  pluralName: 'QcTests',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(qcTestListItemSchema),
  create: {
    schema: qcTestCreateSchema,
    responseSchema: qcTestCreateResponseSchema,
    description: 'Creates a QC test (Chemical/Micro) against a batch stage or GRN reference.',
  },
  update: {
    schema: qcTestResultUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Records a QC test result (pass/fail) with tester and remarks.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a QC test by id.',
  },
})
