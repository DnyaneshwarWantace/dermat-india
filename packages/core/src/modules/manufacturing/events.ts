import { createModuleEvents } from '@wantace/shared/modules/events'

const events = [
  // Work Centers
  { id: 'manufacturing.work_center.created', label: 'Work Center Created', entity: 'work_center', category: 'crud' },
  { id: 'manufacturing.work_center.updated', label: 'Work Center Updated', entity: 'work_center', category: 'crud' },
  { id: 'manufacturing.work_center.deleted', label: 'Work Center Deleted', entity: 'work_center', category: 'crud' },

  // Machines
  { id: 'manufacturing.machine.created', label: 'Machine Created', entity: 'machine', category: 'crud' },
  { id: 'manufacturing.machine.updated', label: 'Machine Updated', entity: 'machine', category: 'crud' },
  { id: 'manufacturing.machine.deleted', label: 'Machine Deleted', entity: 'machine', category: 'crud' },

  // Bill of Materials
  { id: 'manufacturing.bom.created', label: 'BOM Created', entity: 'bom', category: 'crud' },
  { id: 'manufacturing.bom.updated', label: 'BOM Updated', entity: 'bom', category: 'crud' },
  { id: 'manufacturing.bom.deleted', label: 'BOM Deleted', entity: 'bom', category: 'crud' },
  { id: 'manufacturing.bom.activated', label: 'BOM Activated', entity: 'bom', category: 'lifecycle' },
  { id: 'manufacturing.bom.obsoleted', label: 'BOM Obsoleted', entity: 'bom', category: 'lifecycle' },

  // Production Orders
  { id: 'manufacturing.production_order.created', label: 'Production Order Created', entity: 'production_order', category: 'crud' },
  { id: 'manufacturing.production_order.updated', label: 'Production Order Updated', entity: 'production_order', category: 'crud' },
  { id: 'manufacturing.production_order.deleted', label: 'Production Order Deleted', entity: 'production_order', category: 'crud' },
  { id: 'manufacturing.production_order.started', label: 'Production Order Started', entity: 'production_order', category: 'lifecycle' },
  { id: 'manufacturing.production_order.completed', label: 'Production Order Completed', entity: 'production_order', category: 'lifecycle' },
  { id: 'manufacturing.production_order.cancelled', label: 'Production Order Cancelled', entity: 'production_order', category: 'lifecycle' },

  // Production Stages
  { id: 'manufacturing.production_stage.created', label: 'Production Stage Created', entity: 'production_stage', category: 'crud' },
  { id: 'manufacturing.production_stage.updated', label: 'Production Stage Updated', entity: 'production_stage', category: 'crud' },
  { id: 'manufacturing.production_stage.completed', label: 'Production Stage Completed', entity: 'production_stage', category: 'lifecycle' },

  // Material Consumption
  { id: 'manufacturing.material_consumption.created', label: 'Material Consumption Created', entity: 'material_consumption', category: 'crud' },
  { id: 'manufacturing.material_consumption.updated', label: 'Material Consumption Updated', entity: 'material_consumption', category: 'crud' },
  { id: 'manufacturing.material_consumption.issued', label: 'Material Issued', entity: 'material_consumption', category: 'lifecycle' },

  // Quality Inspections
  { id: 'manufacturing.quality_inspection.created', label: 'Quality Inspection Created', entity: 'quality_inspection', category: 'crud' },
  { id: 'manufacturing.quality_inspection.updated', label: 'Quality Inspection Updated', entity: 'quality_inspection', category: 'crud' },
  { id: 'manufacturing.quality_inspection.passed', label: 'Quality Inspection Passed', entity: 'quality_inspection', category: 'lifecycle' },
  { id: 'manufacturing.quality_inspection.failed', label: 'Quality Inspection Failed', entity: 'quality_inspection', category: 'lifecycle' },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'manufacturing',
  events,
})

export const emitManufacturingEvent = eventsConfig.emit
export type ManufacturingEventId = typeof events[number]['id']

export default eventsConfig
