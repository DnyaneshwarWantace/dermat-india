import type { EntityManager } from '@mikro-orm/postgresql'
import type { CommandHandler, CommandBus } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands/registry'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { loadCustomFieldValues } from '@open-mercato/shared/lib/crud/custom-fields'

export type ConvertDealToOrderInput = {
  dealId: string
}

export type ConvertDealToOrderResult = {
  orderId: string
}

/**
 * Manual, staff-triggered conversion of a Deal into a Sales Order (Part 2/3 of the
 * Lead->Order plan). Deliberately NOT auto-invoked from `dealAdvanceReceivedConversion.ts` —
 * creating a real financial document should follow a human confirming line items, not fire
 * silently off a pipeline-stage change.
 */
const convertDealToOrderCommand: CommandHandler<ConvertDealToOrderInput, ConvertDealToOrderResult> = {
  id: 'dermat_sales_flow.deals.convert_to_order',
  async execute(rawInput, ctx) {
    const dealId = rawInput.dealId
    const organizationId = ctx.selectedOrganizationId
    const tenantId = ctx.auth?.tenantId
    if (!dealId || !organizationId || !tenantId) {
      throw new CrudHttpError(400, { error: 'dealId, organizationId and tenantId are required' })
    }

    const em = ctx.container.resolve<EntityManager>('em').fork()

    const dealRows = await em.getConnection().execute<Array<{
      id: string
      title: string
      organization_id: string
      tenant_id: string
    }>>(
      `select id, title, organization_id, tenant_id
       from customer_deals
       where id = ? and organization_id = ? and tenant_id = ? and deleted_at is null`,
      [dealId, organizationId, tenantId],
    )
    const deal = dealRows[0]
    if (!deal) {
      throw new CrudHttpError(404, { error: 'Deal not found' })
    }

    const customFieldValues = await loadCustomFieldValues({
      em,
      entityId: 'customers:customer_deal',
      recordIds: [deal.id],
      tenantFallbacks: [deal.tenant_id],
    })
    const existingOrderId = customFieldValues[deal.id]?.cf_sales_order_id
    if (typeof existingOrderId === 'string' && existingOrderId.length > 0) {
      throw new CrudHttpError(409, { error: 'This deal is already linked to a sales order', orderId: existingOrderId })
    }
    const dealProductId = customFieldValues[deal.id]?.cf_product_id
    const productId = typeof dealProductId === 'string' && dealProductId.length > 0 ? dealProductId : null
    // A deal must carry a real, resolvable product before it can become an order line — the
    // old fallback here silently created an unlinked "New item" line for any deal missing a
    // product, which never appears in the product list and can't be traced back to anything
    // (client-confirmed bug: orders with no matching product). Fail loudly instead.
    if (!productId) {
      throw new CrudHttpError(422, { error: 'Link a product to this deal before converting it to an order' })
    }
    const productRows = await em.getConnection().execute<Array<{ title: string | null }>>(
      `select title from catalog_products where id = ? and organization_id = ? and tenant_id = ? and deleted_at is null`,
      [productId, organizationId, tenantId],
    )
    const productTitle = productRows[0]?.title ?? null
    if (!productTitle) {
      throw new CrudHttpError(422, { error: 'The product linked to this deal no longer exists — relink a valid product before converting' })
    }

    const companyLinkRows = await em.getConnection().execute<Array<{ company_entity_id: string }>>(
      `select company_entity_id from customer_deal_companies where deal_id = ?`,
      [deal.id],
    )
    const companyEntityId = companyLinkRows[0]?.company_entity_id
    if (!companyEntityId) {
      throw new CrudHttpError(422, { error: 'Link a company to this deal before converting it to an order' })
    }

    const commandBus = ctx.container.resolve<CommandBus>('commandBus')

    const orderResult = await commandBus.execute<Record<string, unknown>, { orderId: string | null }>(
      'sales.orders.create',
      {
        input: {
          organizationId,
          tenantId,
          customerEntityId: companyEntityId,
          currencyCode: 'INR',
          customFields: { source_deal_id: deal.id },
          lines: [
            {
              currencyCode: 'INR',
              quantity: '1',
              name: productTitle,
              productId,
            },
          ],
        },
        ctx,
      },
    )
    const orderId = orderResult.result?.orderId
    if (!orderId) {
      throw new CrudHttpError(500, { error: 'Order creation did not return an id' })
    }

    await commandBus.execute<{ id: string; customFields: Record<string, unknown> }, { dealId: string }>(
      'customers.deals.update',
      {
        input: { id: deal.id, customFields: { sales_order_id: orderId } },
        ctx,
      },
    )

    return { orderId }
  },
}

registerCommand(convertDealToOrderCommand)

export default convertDealToOrderCommand
