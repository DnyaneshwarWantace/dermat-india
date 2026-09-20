import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  {
    id: 'dermat_sales_flow.order.stage_changed',
    label: 'Order Stage Changed',
    entity: 'order',
    category: 'lifecycle',
    description: 'Fired whenever the Kanban stage-gate mechanism moves an order to a new pipeline stage (dermat_sales_flow.orders.transition_stage).',
  },
  {
    id: 'dermat_sales_flow.order.verified',
    label: 'Order Verified',
    entity: 'order',
    category: 'lifecycle',
    description: 'Fired when an order is verified/confirmed via the stage-gate mechanism (New -> Verified/Official). R&D auto-creates its case off this event, no manual re-entry.',
  },
] as const

export const eventsConfig = createModuleEvents({ moduleId: 'dermat_sales_flow', events })
export const emitDermatSalesFlowEvent = eventsConfig.emit
export type DermatSalesFlowEventId = typeof events[number]['id']
export default eventsConfig
