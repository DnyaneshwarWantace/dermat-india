import type { InjectionWidgetModule } from '@open-mercato/shared/modules/widgets/injection'
import DealConvertToOrderButtonWidget from './widget.client'

const widget: InjectionWidgetModule<Record<string, unknown>, Record<string, unknown>> = {
  metadata: {
    id: 'dermat_sales_flow.injection.deal-convert-to-order-button',
    title: 'Convert Deal to Order Button',
    description:
      'Renders a "Convert to order" button in the deal detail header that creates a linked Sales Order, or a "View order" link if one already exists.',
    features: ['customers.deals.manage'],
    priority: 90,
    enabled: true,
  },
  Widget: DealConvertToOrderButtonWidget,
}

export default widget
