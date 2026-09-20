import { z } from 'zod'
import { makeCrudRoute } from '@wantace/shared/lib/crud/factory'
import { escapeLikePattern } from '@wantace/shared/lib/db/escapeLikePattern'
import { BOMLine } from '../../data/entities'
import { createManufacturingCrudOpenApi, createPagedListResponseSchema } from '../openapi'

const F = {
  id: 'id',
  organization_id: 'organization_id',
  tenant_id: 'tenant_id',
  bom_id: 'bom_id',
  line_number: 'line_number',
  product_variant_id: 'product_variant_id',
  product_name: 'product_name',
  product_sku: 'product_sku',
  quantity: 'quantity',
  unit_of_measure: 'unit_of_measure',
  rm_percent: 'rm_percent',
  wastage_percent: 'wastage_percent',
  unit_cost_cents: 'unit_cost_cents',
  line_total: 'line_total',
  is_critical: 'is_critical',
  sub_bom_id: 'sub_bom_id',
  notes: 'notes',
  created_at: 'created_at',
  updated_at: 'updated_at',
} as const

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['manufacturing.bom.view'] },
}

export const metadata = routeMetadata

const listSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(100),
  search: z.string().optional(),
  ids: z.string().optional(),
  id: z.string().uuid().optional(),
  bomId: z.string().uuid().optional(),
  sortField: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
}).passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: BOMLine,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: 'manufacturing:bom_line' },
  list: {
    schema: listSchema,
    entityId: 'manufacturing:bom_line',
    fields: Object.values(F),
    sortFieldMap: {
      lineNumber: F.line_number,
      productName: F.product_name,
      createdAt: F.created_at,
    },
    defaultSort: { field: F.line_number, dir: 'asc' },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (typeof query.ids === 'string' && query.ids.trim().length > 0) {
        filters[F.id] = {
          $in: query.ids.split(',').map((v: string) => v.trim()).filter((v: string) => v.length > 0),
        }
      }
      if (query.bomId) filters[F.bom_id] = { $eq: query.bomId }
      const term = query.search?.trim()
      if (term) {
        const like = `%${escapeLikePattern(term)}%`
        filters.$or = [
          { [F.product_name]: { $ilike: like } },
          { [F.product_sku]: { $ilike: like } },
        ]
      }
      return filters
    },
  },
  actions: {},
})

export const GET = crud.GET

const bomLineItemSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  bom_id: z.string().uuid().nullable().optional(),
  line_number: z.number().nullable().optional(),
  product_variant_id: z.string().uuid().nullable().optional(),
  product_name: z.string().nullable().optional(),
  product_sku: z.string().nullable().optional(),
  quantity: z.string().nullable().optional(),
  unit_of_measure: z.string().nullable().optional(),
  rm_percent: z.string().nullable().optional(),
  unit_cost_cents: z.number().nullable().optional(),
  wastage_percent: z.string().nullable().optional(),
  line_total: z.number().nullable().optional(),
  is_critical: z.boolean().nullable().optional(),
})

export const openApi = createManufacturingCrudOpenApi({
  resourceName: 'BOMLine',
  pluralName: 'BOMLines',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(bomLineItemSchema),
})
