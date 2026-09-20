import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { CrudHttpError, isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { createLogger } from '@open-mercato/shared/lib/logger'

const logger = createLogger('dermat_bom')

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['dermat_bom.view'] },
}

type OrderLineRow = {
  quantity: string
  quantity_unit: string | null
  order_number: string
}

export async function GET(req: Request) {
  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromRequest(req)
    const { translate } = await resolveTranslations()
    if (!auth || !auth.tenantId) {
      throw new CrudHttpError(401, { error: translate('dermat_bom.errors.unauthorized', 'Unauthorized') })
    }
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const organizationId = scope?.selectedId ?? auth.orgId ?? null
    if (!organizationId) {
      throw new CrudHttpError(400, { error: translate('dermat_bom.errors.no_organization', 'No organization selected') })
    }
    const tenantId = auth.tenantId

    const url = new URL(req.url)
    const productId = url.searchParams.get('productId')
    if (!productId) {
      throw new CrudHttpError(400, { error: translate('dermat_bom.errors.product_id_required', 'productId is required') })
    }

    const em = container.resolve<EntityManager>('em')

    // Most recent order line for this product — the "how much does the
    // customer want" quantity a new BOM's batch size should start from.
    const rows = await em.getConnection().execute<OrderLineRow[]>(
      `select ol.quantity, ol.quantity_unit, so.order_number
       from sales_order_lines ol
       join sales_orders so on so.id = ol.order_id
       where ol.product_id = ? and ol.organization_id = ? and ol.tenant_id = ?
         and so.organization_id = ? and so.tenant_id = ? and so.deleted_at is null
       order by so.created_at desc
       limit 1`,
      [productId, organizationId, tenantId, organizationId, tenantId],
    )
    const row = rows[0]
    if (!row) {
      return NextResponse.json({ found: false })
    }

    return NextResponse.json({
      found: true,
      quantity: Number(row.quantity) || 0,
      unit: row.quantity_unit || null,
      orderNumber: row.order_number,
    })
  } catch (err) {
    if (isCrudHttpError(err)) {
      return NextResponse.json(err.body, { status: err.status })
    }
    logger.error('dermat_bom.order_quantity failed', { err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const resultSchema = z.object({
  found: z.boolean(),
  quantity: z.number().optional(),
  unit: z.string().nullable().optional(),
  orderNumber: z.string().optional(),
})

export const openApi: OpenApiRouteDoc = {
  tag: 'DermatBom',
  summary: 'Look up the most recent order quantity for a product',
  methods: {
    GET: {
      summary: 'Order quantity for product',
      description: 'Returns the quantity from the most recent sales order line referencing this product, so a new BOM can default its batch size to what the customer actually ordered instead of an arbitrary placeholder.',
      responses: [
        { status: 200, description: 'Lookup result', schema: resultSchema },
      ],
    },
  },
}
