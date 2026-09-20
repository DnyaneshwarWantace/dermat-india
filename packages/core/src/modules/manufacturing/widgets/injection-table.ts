import type { ModuleInjectionTable } from '@wantace/shared/modules/widgets/injection'

export const injectionTable: ModuleInjectionTable = {
  'sales.document.detail.order:details': [
    {
      widgetId: 'manufacturing.injection.sales-order-production-status',
      kind: 'group',
      column: 2,
      groupLabel: 'manufacturing.widgets.salesOrder.title',
      priority: 200,
    },
  ],
}

export default injectionTable
