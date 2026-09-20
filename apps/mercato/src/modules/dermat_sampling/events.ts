import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'dermat_sampling.sample.created', label: 'Sample Requested', entity: 'sample', category: 'crud' },
  { id: 'dermat_sampling.sample.updated', label: 'Sample Updated', entity: 'sample', category: 'crud' },
  {
    id: 'dermat_sampling.sample.approved',
    label: 'Sample Approved',
    entity: 'sample',
    category: 'lifecycle',
    description: 'Fired when a customer approves an R&D sample, so other modules (e.g. Production) can react.',
  },
  {
    id: 'dermat_sampling.sample.rejected',
    label: 'Sample Rejected',
    entity: 'sample',
    category: 'lifecycle',
    description: 'Fired when a customer rejects an R&D sample.',
  },
] as const

export const eventsConfig = createModuleEvents({ moduleId: 'dermat_sampling', events })
export const emitDermatSamplingEvent = eventsConfig.emit
export type DermatSamplingEventId = typeof events[number]['id']
export default eventsConfig
