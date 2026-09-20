import type { InjectionWidgetModule } from '@wantace/shared/modules/widgets/injection'
import SalesOrderProductionStatusWidget, { type SalesOrderRecord } from './widget.client'

const widget: InjectionWidgetModule<unknown, SalesOrderRecord> = {
  metadata: {
    id: 'manufacturing.injection.sales-order-production-status',
    title: 'Production status',
    description: 'Shows linked production orders and their status on sales order detail',
    features: ['manufacturing.production_orders.view'],
    priority: 200,
  },
  Widget: SalesOrderProductionStatusWidget,
}

export default widget
