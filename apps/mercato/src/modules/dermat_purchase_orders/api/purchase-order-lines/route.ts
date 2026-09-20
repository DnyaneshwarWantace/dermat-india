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
import { PurchaseOrderLine } from '../../data/entities'
import {
  purchaseOrderLineCreateSchema,
  purchaseOrderLineUpdateSchema,
  poLineKindSchema,
} from '../../data/validators'

const listSchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    id: z.string().uuid().optional(),
    purchaseOrderId: z.string().uuid().optional(),
    lineKind: z.string().optional(),
    sortField: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
  })
  .passthrough()

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['dermat_purchase_orders.view'] },
  POST: { requireAuth: true, requireFeatures: ['dermat_purchase_orders.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['dermat_purchase_orders.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['dermat_purchase_orders.manage'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: PurchaseOrderLine,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: {
    entityType: (E as { dermat_purchase_orders?: { purchase_order_line?: string } }).dermat_purchase_orders?.purchase_order_line
      ?? 'dermat_purchase_orders:purchase_order_line',
  },
  list: {
    schema: listSchema,
    entityId: (E as { dermat_purchase_orders?: { purchase_order_line?: string } }).dermat_purchase_orders?.purchase_order_line
      ?? 'dermat_purchase_orders:purchase_order_line',
    fields: [
      'id',
      'purchase_order_id',
      'line_kind',
      'raw_material_id',
      'packaging_material_id',
      'component_code',
      'quantity',
      'pack',
      'free_quantity',
      'mrp',
      'unit',
      'received_quantity',
      'qc_approved',
      'qc_approved_at',
      'qc_approved_by',
      'sequence_number',
      'organization_id',
      'tenant_id',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: {
      sequenceNumber: 'sequence_number',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    defaultSort: { field: 'sequenceNumber', dir: 'asc' },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (query.id) filters.id = { $eq: query.id }
      if (query.purchaseOrderId) filters.purchase_order_id = { $eq: query.purchaseOrderId }
      if (query.lineKind) filters.line_kind = { $eq: query.lineKind }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'dermat_purchase_orders.purchase_order_lines.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        const scoped = withScopedPayload(raw ?? {}, ctx, translate)
        return purchaseOrderLineCreateSchema.parse(scoped)
      },
      response: ({ result }) => ({
        id: result?.purchaseOrderLineId ?? null,
      }),
      status: 201,
    },
    update: {
      commandId: 'dermat_purchase_orders.purchase_order_lines.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        const scoped = withScopedPayload(raw ?? {}, ctx, translate, { requireOrganization: false })
        return purchaseOrderLineUpdateSchema.parse(scoped)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'dermat_purchase_orders.purchase_order_lines.delete',
      schema: rawBodySchema,
      mapInput: async ({ parsed, ctx }) => {
        const { translate } = await resolveTranslations()
        const id =
          parsed?.body?.id ??
          parsed?.id ??
          parsed?.query?.id ??
          (ctx.request ? new URL(ctx.request.url).searchParams.get('id') : null)
        if (!id) throw new CrudHttpError(400, { error: translate('dermat_purchase_orders.errors.line_id_required', 'Purchase order line id is required') })
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

const buildPoOpenApi = createCrudOpenApiFactory({
  defaultTag: 'DermatPurchaseOrders',
})

const purchaseOrderLineListItemSchema = z.object({
  id: z.string().uuid(),
  purchase_order_id: z.string().uuid(),
  line_kind: poLineKindSchema,
  raw_material_id: z.string().uuid().nullable().optional(),
  packaging_material_id: z.string().uuid().nullable().optional(),
  component_code: z.string().nullable().optional(),
  quantity: z.union([z.string(), z.number()]),
  pack: z.union([z.string(), z.number()]).nullable().optional(),
  free_quantity: z.union([z.string(), z.number()]).optional(),
  mrp: z.union([z.string(), z.number()]).nullable().optional(),
  unit: z.string().optional(),
  received_quantity: z.union([z.string(), z.number()]).optional(),
  qc_approved: z.boolean().optional(),
  qc_approved_at: z.string().nullable().optional(),
  qc_approved_by: z.string().nullable().optional(),
  sequence_number: z.number().optional(),
  organization_id: z.string().uuid().nullable().optional(),
  tenant_id: z.string().uuid().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
})

const purchaseOrderLineCreateResponseSchema = z.object({
  id: z.string().uuid().nullable(),
})

export const openApi = buildPoOpenApi({
  resourceName: 'PurchaseOrderLine',
  pluralName: 'PurchaseOrderLines',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(purchaseOrderLineListItemSchema),
  create: {
    schema: purchaseOrderLineCreateSchema,
    responseSchema: purchaseOrderLineCreateResponseSchema,
    description: 'Adds a raw material or packaging material line to a Purchase Order.',
  },
  update: {
    schema: purchaseOrderLineUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a Purchase Order line, including receipt quantity and QC approval.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a Purchase Order line by id.',
  },
})
