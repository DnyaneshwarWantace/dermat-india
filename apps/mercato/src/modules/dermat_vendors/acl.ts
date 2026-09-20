export const features = [
  { id: 'dermat_vendors.view', title: 'View vendors', module: 'dermat_vendors' },
  {
    id: 'dermat_vendors.manage',
    title: 'Manage vendors',
    module: 'dermat_vendors',
    dependsOn: ['dermat_vendors.view'],
  },
]

export default features
