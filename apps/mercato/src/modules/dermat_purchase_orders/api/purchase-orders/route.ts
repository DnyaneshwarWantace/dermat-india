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
import { PurchaseOrder } from '../../data/entities'
import { purchaseOrderCreateSchema, purchaseOrderUpdateSchema, poStatusSchema, poDepartmentSchema } from '../../data/validators'

const listSchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    id: z.string().uuid().optional(),
    bomId: z.string().uuid().optional(),
    vendorId: z.string().uuid().optional(),
    status: z.string().optional(),
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
    entity: PurchaseOrder,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: {
    entityType: (E as { dermat_purchase_orders?: { purchase_order?: string } }).dermat_purchase_orders?.purchase_order
      ?? 'dermat_purchase_orders:purchase_order',
  },
  list: {
    schema: listSchema,
    entityId: (E as { dermat_purchase_orders?: { purchase_order?: string } }).dermat_purchase_orders?.purchase_order
      ?? 'dermat_purchase_orders:purchase_order',
    fields: [
      'id',
      'po_number',
      'department',
      'vendor_id',
      'bom_id',
      'gst_number',
      'payment_terms',
      'po_date',
      'delivery_date',
      'billing_address',
      'delivery_address',
      'status',
      'organization_id',
      'tenant_id',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: {
      poNumber: 'po_number',
      poDate: 'po_date',
      deliveryDate: 'delivery_date',
      status: 'status',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    defaultSort: { field: 'createdAt', dir: 'desc' },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (query.id) filters.id = { $eq: query.id }
      if (query.bomId) filters.bom_id = { $eq: query.bomId }
      if (query.vendorId) filters.vendor_id = { $eq: query.vendorId }
      if (query.status) filters.status = { $eq: query.status }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'dermat_purchase_orders.purchase_orders.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        const scoped = withScopedPayload(raw ?? {}, ctx, translate)
        return purchaseOrderCreateSchema.parse(scoped)
      },
      response: ({ result }) => ({
        id: result?.purchaseOrderId ?? null,
        poNumber: result?.poNumber ?? null,
      }),
      status: 201,
    },
    update: {
      commandId: 'dermat_purchase_orders.purchase_orders.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        const scoped = withScopedPayload(raw ?? {}, ctx, translate, { requireOrganization: false })
        return purchaseOrderUpdateSchema.parse(scoped)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'dermat_purchase_orders.purchase_orders.delete',
      schema: rawBodySchema,
      mapInput: async ({ parsed, ctx }) => {
        const { translate } = await resolveTranslations()
        const id =
          parsed?.body?.id ??
          parsed?.id ??
          parsed?.query?.id ??
          (ctx.request ? new URL(ctx.request.url).searchParams.get('id') : null)
        if (!id) throw new CrudHttpError(400, { error: translate('dermat_purchase_orders.errors.id_required', 'Purchase order id is required') })
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

const purchaseOrderListItemSchema = z.object({
  id: z.string().uuid(),
  po_number: z.string(),
  department: poDepartmentSchema,
  vendor_id: z.string().uuid(),
  bom_id: z.string().uuid().nullable().optional(),
  gst_number: z.string().nullable().optional(),
  payment_terms: z.string().nullable().optional(),
  po_date: z.string(),
  delivery_date: z.string().nullable().optional(),
  billing_address: z.string().nullable().optional(),
  delivery_address: z.string().nullable().optional(),
  status: poStatusSchema,
  organization_id: z.string().uuid().nullable().optional(),
  tenant_id: z.string().uuid().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
})

const purchaseOrderCreateResponseSchema = z.object({
  id: z.string().uuid().nullable(),
  poNumber: z.string().nullable(),
})

export const openApi = buildPoOpenApi({
  resourceName: 'PurchaseOrder',
  pluralName: 'PurchaseOrders',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(purchaseOrderListItemSchema),
  create: {
    schema: purchaseOrderCreateSchema,
    responseSchema: purchaseOrderCreateResponseSchema,
    description: 'Creates a Purchase Order raised against a vendor, optionally from a BOM.',
  },
  update: {
    schema: purchaseOrderUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a Purchase Order.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a Purchase Order by id.',
  },
})
