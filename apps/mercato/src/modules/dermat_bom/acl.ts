export const features = [
  { id: 'dermat_bom.view', title: 'View BOM', module: 'dermat_bom' },
  {
    id: 'dermat_bom.manage',
    title: 'Manage BOM',
    module: 'dermat_bom',
    dependsOn: ['dermat_bom.view'],
  },
]

export default features
