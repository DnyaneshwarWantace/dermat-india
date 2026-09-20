import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'dermat_production.batch.created', label: 'Production Batch Created', entity: 'batch', category: 'crud' },
  { id: 'dermat_production.batch.updated', label: 'Production Batch Updated', entity: 'batch', category: 'crud' },
  { id: 'dermat_production.batch.deleted', label: 'Production Batch Deleted', entity: 'batch', category: 'crud' },
  { id: 'dermat_production.batch_stage.updated', label: 'Batch Stage Updated', entity: 'batch_stage', category: 'crud' },
  { id: 'dermat_production.batch_stage.signed_off', label: 'Batch Stage Signed Off', entity: 'batch_stage', category: 'lifecycle' },
] as const

export const eventsConfig = createModuleEvents({ moduleId: 'dermat_production', events })
export const emitDermatProductionEvent = eventsConfig.emit
export type DermatProductionEventId = typeof events[number]['id']
export default eventsConfig
