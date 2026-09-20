export const features = [
  { id: 'manufacturing.work_centers.view', title: 'View work centers', module: 'manufacturing' },
  {
    id: 'manufacturing.work_centers.manage',
    title: 'Manage work centers',
    module: 'manufacturing',
    dependsOn: ['manufacturing.work_centers.view'],
  },
  { id: 'manufacturing.machines.view', title: 'View machines', module: 'manufacturing' },
  {
    id: 'manufacturing.machines.manage',
    title: 'Manage machines',
    module: 'manufacturing',
    dependsOn: ['manufacturing.machines.view'],
  },
  { id: 'manufacturing.bom.view', title: 'View bills of materials', module: 'manufacturing' },
  {
    id: 'manufacturing.bom.manage',
    title: 'Manage bills of materials',
    module: 'manufacturing',
    dependsOn: ['manufacturing.bom.view'],
  },
  { id: 'manufacturing.settings.manage', title: 'Manage manufacturing settings', module: 'manufacturing' },
  { id: 'manufacturing.production_orders.view', title: 'View production orders', module: 'manufacturing' },
  {
    id: 'manufacturing.production_orders.manage',
    title: 'Manage production orders',
    module: 'manufacturing',
    dependsOn: ['manufacturing.production_orders.view'],
  },
  { id: 'manufacturing.production_stages.view', title: 'View production stages', module: 'manufacturing' },
  {
    id: 'manufacturing.production_stages.manage',
    title: 'Manage production stages',
    module: 'manufacturing',
    dependsOn: ['manufacturing.production_stages.view'],
  },
  { id: 'manufacturing.material_consumption.view', title: 'View material consumption', module: 'manufacturing' },
  {
    id: 'manufacturing.material_consumption.manage',
    title: 'Manage material consumption',
    module: 'manufacturing',
    dependsOn: ['manufacturing.material_consumption.view'],
  },
  { id: 'manufacturing.quality_inspections.view', title: 'View quality inspections', module: 'manufacturing' },
  {
    id: 'manufacturing.quality_inspections.manage',
    title: 'Manage quality inspections',
    module: 'manufacturing',
    dependsOn: ['manufacturing.quality_inspections.view'],
  },
  { id: 'manufacturing.stage_templates.view', title: 'View production stage templates', module: 'manufacturing' },
  {
    id: 'manufacturing.stage_templates.manage',
    title: 'Manage production stage templates',
    module: 'manufacturing',
    dependsOn: ['manufacturing.stage_templates.view'],
  },
]

export default features
