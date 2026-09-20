import type { ModuleInjectionTable } from '@open-mercato/shared/modules/widgets/injection'

/**
 * Injects the "Convert to order" button into the customers module's deal
 * detail header spot (`detail:customers.deal:header`). Cross-module
 * injection into a spot this module doesn't own, without importing
 * customers' business logic directly.
 */
export const injectionTable: ModuleInjectionTable = {
  'detail:customers.deal:header': [
    {
      widgetId: 'dermat_sales_flow.injection.deal-convert-to-order-button',
      priority: 90,
    },
  ],
  'data-table:sales.orders:columns': [
    {
      widgetId: 'dermat_sales_flow.injection.order-deal-stage-column',
      priority: 40,
    },
  ],
}

export default injectionTable
