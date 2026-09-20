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

const logger = createLogger('dermat_sales_flow')

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['sales.orders.view'] },
}

type FormulationRow = {
  id: string
}

type FormulationLineRow = {
  raw_material_id: string | null
  component_name: string
  percent_of_formula: string
}

type OrderLineRow = {
  product_id: string
  quantity: string
}

type Shortfall = {
  rawMaterialId: string
  rawMaterialName: string
  required: number
  onHand: number
  unit: string
}

export async function GET(req: Request, routeCtx: { params: { id: string } }) {
  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromRequest(req)
    const { translate } = await resolveTranslations()
    if (!auth || !auth.tenantId) {
      throw new CrudHttpError(401, { error: translate('dermat_sales_flow.errors.unauthorized', 'Unauthorized') })
    }
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const organizationId = scope?.selectedId ?? auth.orgId ?? null
    if (!organizationId) {
      throw new CrudHttpError(400, { error: translate('dermat_sales_flow.errors.no_organization', 'No organization selected') })
    }
    const tenantId = auth.tenantId

    const orderId = routeCtx.params.id
    const em = container.resolve<EntityManager>('em')

    const orderLines = await em.getConnection().execute<OrderLineRow[]>(
      `select product_id, quantity
       from sales_order_lines
       where order_id = ? and organization_id = ? and tenant_id = ? and product_id is not null`,
      [orderId, organizationId, tenantId],
    )

    const shortfalls: Shortfall[] = []
    const checked = new Set<string>()

    for (const line of orderLines) {
      if (checked.has(line.product_id)) continue
      checked.add(line.product_id)

      const formulations = await em.getConnection().execute<FormulationRow[]>(
        `select id
         from dermat_bom_formulations
         where catalog_product_id = ? and organization_id = ? and tenant_id = ? and deleted_at is null and is_active = true
         order by version desc
         limit 1`,
        [line.product_id, organizationId, tenantId],
      )
      const formulation = formulations[0]
      if (!formulation) continue

      const formulationLines = await em.getConnection().execute<FormulationLineRow[]>(
        `select raw_material_id, component_name, percent_of_formula
         from dermat_bom_formulation_lines
         where formulation_id = ? and organization_id = ? and tenant_id = ? and deleted_at is null and component_type = 'raw_material'`,
        [formulation.id, organizationId, tenantId],
      )
      if (!formulationLines.length) continue

      const orderedQuantity = Number(line.quantity) || 0
      if (orderedQuantity <= 0) continue

      // Formulation percentages are defined per 100% of the finished bulk; the order line
      // quantity is the bulk amount being produced (same unit as base_batch_unit, typically
      // kg), so each raw material's requirement is just its percent share of that quantity —
      // the same percent-of-formula math dermat_bom itself uses (lib/calculateBulk.ts),
      // applied directly instead of through the ml/pack-size breakdown input path (that path
      // exists for a different UI entry point and isn't needed here).
      for (const fl of formulationLines) {
        if (!fl.raw_material_id) continue
        const requiredKg = (Number(fl.percent_of_formula) / 100) * orderedQuantity
        if (requiredKg <= 0) continue

        const rmRows = await em.getConnection().execute<Array<{ name: string; stock: string; unit: string }>>(
          `select name, stock, unit from dermat_rm_master
           where id = ? and organization_id = ? and tenant_id = ? and deleted_at is null`,
          [fl.raw_material_id, organizationId, tenantId],
        )
        const rm = rmRows[0]
        if (!rm) continue

        const onHand = Number(rm.stock) || 0
        if (requiredKg > onHand) {
          shortfalls.push({
            rawMaterialId: fl.raw_material_id,
            rawMaterialName: rm.name,
            required: requiredKg,
            onHand,
            unit: rm.unit,
          })
        }
      }
    }

    return NextResponse.json({ sufficient: shortfalls.length === 0, shortfalls })
  } catch (err) {
    if (isCrudHttpError(err)) {
      return NextResponse.json(err.body, { status: err.status })
    }
    logger.error('dermat_sales_flow.orders.stock_check failed', { err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const shortfallSchema = z.object({
  rawMaterialId: z.string().uuid(),
  rawMaterialName: z.string(),
  required: z.number(),
  onHand: z.number(),
  unit: z.string(),
})

const resultSchema = z.object({
  sufficient: z.boolean(),
  shortfalls: z.array(shortfallSchema),
})

export const openApi: OpenApiRouteDoc = {
  tag: 'DermatSalesFlow',
  summary: 'Check raw-material stock availability for an order',
  methods: {
    GET: {
      summary: 'Stock-availability check',
      description: 'For every finished-good line on the order with a matching BOM formulation, computes the raw material required (via the BOM percent-of-formula math) and compares it against the raw material master\'s on-hand stock. Returns any shortfalls. Read-only — does not block anything itself.',
      responses: [
        { status: 200, description: 'Stock check result', schema: resultSchema },
      ],
    },
  },
}
