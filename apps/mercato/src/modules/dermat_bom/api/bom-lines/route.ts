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
import { BomLine } from '../../data/entities'
import {
  bomLineCreateSchema,
  bomLineUpdateSchema,
  bomComponentKindSchema,
} from '../../data/validators'

const listSchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    bomId: z.string().uuid().optional(),
    componentKind: z.string().optional(),
    sortField: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    id: z.string().uuid().optional(),
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
    entity: BomLine,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: {
    entityType: (E as { dermat_bom?: { bom_line?: string } }).dermat_bom?.bom_line ?? 'dermat_bom:bom_line',
  },
  list: {
    schema: listSchema,
    entityId: (E as { dermat_bom?: { bom_line?: string } }).dermat_bom?.bom_line ?? 'dermat_bom:bom_line',
    fields: [
      'id',
      'bom_id',
      'component_kind',
      'raw_material_id',
      'packaging_material_id',
      'component_code',
      'qty_per_unit',
      'quantity',
      'wastage_percent',
      'total_qty',
      'unit',
      'rm_percent',
      'sequence_number',
      'organization_id',
      'tenant_id',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: {
      sequenceNumber: 'sequence_number',
      componentKind: 'component_kind',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    defaultSort: { field: 'sequenceNumber', dir: 'asc' },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (query.id) filters.id = { $eq: query.id }
      if (query.bomId) filters.bom_id = { $eq: query.bomId }
      if (query.componentKind) filters.component_kind = { $eq: query.componentKind }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'dermat_bom.bom_lines.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        const scoped = withScopedPayload(raw ?? {}, ctx, translate)
        return bomLineCreateSchema.parse(scoped)
      },
      response: ({ result }) => ({
        id: result?.bomLineId ?? null,
      }),
      status: 201,
    },
    update: {
      commandId: 'dermat_bom.bom_lines.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        const scoped = withScopedPayload(raw ?? {}, ctx, translate, { requireOrganization: false })
        return bomLineUpdateSchema.parse(scoped)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'dermat_bom.bom_lines.delete',
      schema: rawBodySchema,
      mapInput: async ({ parsed, ctx }) => {
        const { translate } = await resolveTranslations()
        const id =
          parsed?.body?.id ??
          parsed?.id ??
          parsed?.query?.id ??
          (ctx.request ? new URL(ctx.request.url).searchParams.get('id') : null)
        if (!id) throw new CrudHttpError(400, { error: translate('dermat_bom.errors.bom_line_id_required', 'BOM line id is required') })
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

const bomLineListItemSchema = z.object({
  id: z.string().uuid(),
  bom_id: z.string().uuid(),
  component_kind: bomComponentKindSchema,
  raw_material_id: z.string().uuid().nullable().optional(),
  packaging_material_id: z.string().uuid().nullable().optional(),
  component_code: z.string().nullable().optional(),
  qty_per_unit: z.union([z.string(), z.number()]),
  quantity: z.union([z.string(), z.number()]),
  wastage_percent: z.union([z.string(), z.number()]).optional(),
  total_qty: z.union([z.string(), z.number()]),
  unit: z.string().optional(),
  rm_percent: z.union([z.string(), z.number()]).nullable().optional(),
  sequence_number: z.number().optional(),
  organization_id: z.string().uuid().nullable().optional(),
  tenant_id: z.string().uuid().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
})

const bomLineCreateResponseSchema = z.object({
  id: z.string().uuid().nullable(),
})

export const openApi = buildDermatBomCrudOpenApi({
  resourceName: 'BomLine',
  pluralName: 'BomLines',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(bomLineListItemSchema),
  create: {
    schema: bomLineCreateSchema,
    responseSchema: bomLineCreateResponseSchema,
    description: 'Adds a raw material or packaging material line to a BOM.',
  },
  update: {
    schema: bomLineUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a BOM line.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a BOM line by id.',
  },
})
