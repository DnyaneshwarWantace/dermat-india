import { z } from 'zod'
import { makeCrudRoute } from '@wantace/shared/lib/crud/factory'
import { resolveTranslations } from '@wantace/shared/lib/i18n/server'
import { parseScopedCommandInput, resolveCrudRecordId } from '@wantace/shared/lib/api/scoped'
import { escapeLikePattern } from '@wantace/shared/lib/db/escapeLikePattern'
import { parseBooleanToken } from '@wantace/shared/lib/boolean'
import { Supplier } from '../../data/entities'
import { createSupplierSchema, updateSupplierSchema } from '../../data/validators'
import { createPurchasingCrudOpenApi, createPagedListResponseSchema, defaultOkResponseSchema } from '../openapi'

const F = {
  id: 'id',
  organization_id: 'organization_id',
  tenant_id: 'tenant_id',
  name: 'name',
  code: 'code',
  status: 'status',
  is_active: 'is_active',
  contact_name: 'contact_name',
  contact_email: 'contact_email',
  contact_phone: 'contact_phone',
  city: 'city',
  country: 'country',
  currency_code: 'currency_code',
  payment_terms: 'payment_terms',
  lead_time_days: 'lead_time_days',
  created_at: 'created_at',
  updated_at: 'updated_at',
} as const

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['purchasing.suppliers.view'] },
  POST: { requireAuth: true, requireFeatures: ['purchasing.suppliers.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['purchasing.suppliers.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['purchasing.suppliers.manage'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const listSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(25),
  search: z.string().optional(),
  ids: z.string().optional(),
  id: z.string().uuid().optional(),
  status: z.string().optional(),
  isActive: z.string().optional(),
  country: z.string().optional(),
  sortField: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
}).passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: Supplier,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: 'purchasing:supplier' },
  list: {
    schema: listSchema,
    entityId: 'purchasing:supplier',
    fields: [
      F.id,
      F.organization_id,
      F.tenant_id,
      F.name,
      F.code,
      F.status,
      F.is_active,
      F.contact_name,
      F.contact_email,
      F.contact_phone,
      F.city,
      F.country,
      F.currency_code,
      F.payment_terms,
      F.lead_time_days,
      F.created_at,
      F.updated_at,
    ],
    sortFieldMap: {
      name: F.name,
      code: F.code,
      status: F.status,
      city: F.city,
      country: F.country,
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
      const isActive = parseBooleanToken(query.isActive)
      if (isActive !== null) filters[F.is_active] = { $eq: isActive }
      if (query.status) filters[F.status] = { $eq: query.status }
      if (query.country) filters[F.country] = { $eq: query.country }
      const term = query.search?.trim()
      if (term) {
        const like = `%${escapeLikePattern(term)}%`
        filters.$or = [
          { [F.name]: { $ilike: like } },
          { [F.code]: { $ilike: like } },
          { [F.contact_name]: { $ilike: like } },
          { [F.contact_email]: { $ilike: like } },
          { [F.city]: { $ilike: like } },
        ]
      }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'purchasing.suppliers.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(createSupplierSchema, raw ?? {}, ctx, translate)
      },
      response: ({ result }) => ({ id: result?.supplierId ?? null }),
      status: 201,
    },
    update: {
      commandId: 'purchasing.suppliers.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(updateSupplierSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'purchasing.suppliers.delete',
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

const supplierListItemSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  is_active: z.boolean().nullable().optional(),
  contact_name: z.string().nullable().optional(),
  contact_email: z.string().nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  currency_code: z.string().nullable().optional(),
  payment_terms: z.string().nullable().optional(),
  lead_time_days: z.number().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
})

export const openApi = createPurchasingCrudOpenApi({
  resourceName: 'Supplier',
  pluralName: 'Suppliers',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(supplierListItemSchema),
  create: {
    schema: createSupplierSchema,
    description: 'Creates a new supplier.',
  },
  update: {
    schema: updateSupplierSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a supplier by id.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a supplier by id.',
  },
})
