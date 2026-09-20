import { z } from 'zod'
import { makeCrudRoute } from '@wantace/shared/lib/crud/factory'
import { resolveTranslations } from '@wantace/shared/lib/i18n/server'
import { parseScopedCommandInput, resolveCrudRecordId } from '@wantace/shared/lib/api/scoped'
import { escapeLikePattern } from '@wantace/shared/lib/db/escapeLikePattern'
import { PurchaseInvoice } from '../../data/entities'
import { createPurchaseInvoiceSchema, updatePurchaseInvoiceSchema } from '../../data/validators'
import { createPurchasingCrudOpenApi, createPagedListResponseSchema, defaultOkResponseSchema } from '../openapi'

const F = {
  id: 'id',
  organization_id: 'organization_id',
  tenant_id: 'tenant_id',
  invoice_number: 'invoice_number',
  supplier_invoice_number: 'supplier_invoice_number',
  supplier_id: 'supplier_id',
  purchase_order_id: 'purchase_order_id',
  goods_receipt_id: 'goods_receipt_id',
  status: 'status',
  invoice_date: 'invoice_date',
  due_date: 'due_date',
  currency_code: 'currency_code',
  subtotal_cents: 'subtotal_cents',
  tax_cents: 'tax_cents',
  total_cents: 'total_cents',
  paid_cents: 'paid_cents',
  balance_cents: 'balance_cents',
  payment_terms: 'payment_terms',
  approved_by_user_id: 'approved_by_user_id',
  approved_at: 'approved_at',
  created_at: 'created_at',
  updated_at: 'updated_at',
} as const

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['purchasing.purchase_invoices.view'] },
  POST: { requireAuth: true, requireFeatures: ['purchasing.purchase_invoices.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['purchasing.purchase_invoices.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['purchasing.purchase_invoices.manage'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const listSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(25),
  search: z.string().optional(),
  ids: z.string().optional(),
  id: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  purchaseOrderId: z.string().uuid().optional(),
  status: z.string().optional(),
  sortField: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
}).passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: PurchaseInvoice,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: 'purchasing:purchase_invoice' },
  list: {
    schema: listSchema,
    entityId: 'purchasing:purchase_invoice',
    fields: [
      F.id,
      F.organization_id,
      F.tenant_id,
      F.invoice_number,
      F.supplier_invoice_number,
      F.supplier_id,
      F.purchase_order_id,
      F.goods_receipt_id,
      F.status,
      F.invoice_date,
      F.due_date,
      F.currency_code,
      F.subtotal_cents,
      F.tax_cents,
      F.total_cents,
      F.paid_cents,
      F.balance_cents,
      F.payment_terms,
      F.approved_by_user_id,
      F.approved_at,
      F.created_at,
      F.updated_at,
    ],
    sortFieldMap: {
      invoiceNumber: F.invoice_number,
      status: F.status,
      invoiceDate: F.invoice_date,
      dueDate: F.due_date,
      totalCents: F.total_cents,
      balanceCents: F.balance_cents,
      createdAt: F.created_at,
      updatedAt: F.updated_at,
    },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (typeof query.ids === 'string' && query.ids.trim().length > 0) {
        filters[F.id] = {
          $in: query.ids.split(',').map((v: string) => v.trim()).filter((v: string) => v.length > 0),
        }
      }
      if (query.supplierId) filters[F.supplier_id] = { $eq: query.supplierId }
      if (query.purchaseOrderId) filters[F.purchase_order_id] = { $eq: query.purchaseOrderId }
      if (query.status) filters[F.status] = { $eq: query.status }
      const term = query.search?.trim()
      if (term) {
        const like = `%${escapeLikePattern(term)}%`
        filters.$or = [
          { [F.invoice_number]: { $ilike: like } },
          { [F.supplier_invoice_number]: { $ilike: like } },
        ]
      }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'purchasing.purchase_invoices.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(createPurchaseInvoiceSchema, raw ?? {}, ctx, translate)
      },
      response: ({ result }) => ({ id: result?.purchaseInvoiceId ?? null }),
      status: 201,
    },
    update: {
      commandId: 'purchasing.purchase_invoices.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(updatePurchaseInvoiceSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'purchasing.purchase_invoices.delete',
      schema: rawBodySchema,
      mapInput: async ({ parsed, ctx }) => {
        const { translate } = await resolveTranslations()
        return { id: resolveCrudRecordId(parsed, ctx, translate) }
      },
      response: () => ({ ok: true }),
    },
  },
})

export const GET = crud.GET
export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE

const purchaseInvoiceListItemSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  invoice_number: z.string().nullable().optional(),
  supplier_invoice_number: z.string().nullable().optional(),
  supplier_id: z.string().uuid().nullable().optional(),
  purchase_order_id: z.string().uuid().nullable().optional(),
  goods_receipt_id: z.string().uuid().nullable().optional(),
  status: z.string().nullable().optional(),
  invoice_date: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  currency_code: z.string().nullable().optional(),
  subtotal_cents: z.number().nullable().optional(),
  tax_cents: z.number().nullable().optional(),
  total_cents: z.number().nullable().optional(),
  paid_cents: z.number().nullable().optional(),
  balance_cents: z.number().nullable().optional(),
  payment_terms: z.string().nullable().optional(),
  approved_by_user_id: z.string().uuid().nullable().optional(),
  approved_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
})

export const openApi = createPurchasingCrudOpenApi({
  resourceName: 'PurchaseInvoice',
  pluralName: 'PurchaseInvoices',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(purchaseInvoiceListItemSchema),
  create: {
    schema: createPurchaseInvoiceSchema,
    description: 'Creates a new purchase invoice.',
  },
  update: {
    schema: updatePurchaseInvoiceSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a purchase invoice by id.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a purchase invoice by id.',
  },
})
