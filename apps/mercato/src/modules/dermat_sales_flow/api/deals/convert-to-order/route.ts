import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext, CommandBus } from '@open-mercato/shared/lib/commands'
import { CrudHttpError, isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { readJsonSafe } from '@open-mercato/shared/lib/http/readJsonSafe'
import { createLogger } from '@open-mercato/shared/lib/logger'
import type { ConvertDealToOrderInput, ConvertDealToOrderResult } from '../../../commands/convertDealToOrder'

const logger = createLogger('dermat_sales_flow')

const requestSchema = z.object({
  dealId: z.string().uuid(),
})

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['customers.deals.manage'] },
}

export async function POST(req: Request) {
  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromRequest(req)
    const { translate } = await resolveTranslations()
    if (!auth || !auth.tenantId) {
      throw new CrudHttpError(401, { error: translate('dermat_sales_flow.errors.unauthorized', 'Unauthorized') })
    }
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const ctx: CommandRuntimeContext = {
      container,
      auth,
      organizationScope: scope,
      selectedOrganizationId: scope?.selectedId ?? auth.orgId ?? null,
      organizationIds: scope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
      request: req,
    }

    const body = await readJsonSafe<Record<string, unknown>>(req, {})
    const parsed = requestSchema.parse(body)

    const commandBus = ctx.container.resolve<CommandBus>('commandBus')
    const result = await commandBus.execute<ConvertDealToOrderInput, ConvertDealToOrderResult>(
      'dermat_sales_flow.deals.convert_to_order',
      { input: { dealId: parsed.dealId }, ctx },
    )

    return NextResponse.json(result.result ?? result)
  } catch (err) {
    if (isCrudHttpError(err)) {
      return NextResponse.json(err.body, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.issues }, { status: 400 })
    }
    logger.error('dermat_sales_flow.deals.convert_to_order failed', { err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const resultSchema = z.object({ orderId: z.string() })
const errorSchema = z.object({ error: z.string() })

export const openApi: OpenApiRouteDoc = {
  tag: 'DermatSalesFlow',
  summary: 'Convert a Deal into a Sales Order',
  methods: {
    POST: {
      summary: 'Convert deal to order',
      description: 'Creates a Sales Order linked to the deal (source_deal_id) and records the order id back on the deal (sales_order_id). Requires a company already linked to the deal.',
      requestBody: { contentType: 'application/json', schema: requestSchema },
      responses: [
        { status: 200, description: 'Order created', schema: resultSchema },
      ],
      errors: [
        { status: 400, description: 'Validation failed', schema: errorSchema },
        { status: 401, description: 'Unauthorized', schema: errorSchema },
        { status: 404, description: 'Deal not found', schema: errorSchema },
        { status: 409, description: 'Deal already linked to an order', schema: errorSchema },
        { status: 422, description: 'Deal has no linked company', schema: errorSchema },
      ],
    },
  },
}
