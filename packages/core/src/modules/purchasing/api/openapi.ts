import { type ZodTypeAny } from 'zod'
import type { OpenApiRouteDoc } from '@wantace/shared/lib/openapi'
import {
  createCrudOpenApiFactory,
  createPagedListResponseSchema as createSharedPagedListResponseSchema,
  defaultCreateResponseSchema as sharedDefaultCreateResponseSchema,
  defaultOkResponseSchema as sharedDefaultOkResponseSchema,
  type CrudOpenApiOptions,
} from '@wantace/shared/lib/openapi/crud'

export const defaultCreateResponseSchema = sharedDefaultCreateResponseSchema
export const defaultOkResponseSchema = sharedDefaultOkResponseSchema

export function createPagedListResponseSchema(itemSchema: ZodTypeAny) {
  return createSharedPagedListResponseSchema(itemSchema, { paginationMetaOptional: true })
}

const buildPurchasingCrudOpenApi = createCrudOpenApiFactory({
  defaultTag: 'Purchasing',
  defaultCreateResponseSchema,
  defaultOkResponseSchema,
  makeListDescription: ({ pluralLower }) =>
    `Returns a paginated collection of ${pluralLower} scoped to the authenticated organization.`,
})

export function createPurchasingCrudOpenApi(options: CrudOpenApiOptions): OpenApiRouteDoc {
  return buildPurchasingCrudOpenApi(options)
}
