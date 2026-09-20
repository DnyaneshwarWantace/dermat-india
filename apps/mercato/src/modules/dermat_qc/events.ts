import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'dermat_qc.qc_test.created', label: 'QC Test Created', entity: 'qc_test', category: 'crud' },
  { id: 'dermat_qc.qc_test.updated', label: 'QC Test Updated', entity: 'qc_test', category: 'crud' },
  { id: 'dermat_qc.qc_policy.created', label: 'QC Policy Created', entity: 'qc_policy', category: 'crud' },
  { id: 'dermat_qc.qc_policy.updated', label: 'QC Policy Updated', entity: 'qc_policy', category: 'crud' },
  {
    id: 'dermat_qc.test.completed',
    label: 'QC Test Completed',
    entity: 'qc_test',
    category: 'lifecycle',
    description: 'Fired after a QC test result is recorded, so other modules (e.g. Production) can react to policy-complete pass/fail outcomes.',
  },
] as const

export const eventsConfig = createModuleEvents({ moduleId: 'dermat_qc', events })
export const emitDermatQcEvent = eventsConfig.emit
export type DermatQcEventId = typeof events[number]['id']
export default eventsConfig
