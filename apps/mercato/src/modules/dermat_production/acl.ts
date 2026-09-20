export const features = [
  { id: 'dermat_production.view', title: 'View production batches', module: 'dermat_production' },
  {
    id: 'dermat_production.manage',
    title: 'Manage production batches and stages',
    module: 'dermat_production',
    dependsOn: ['dermat_production.view'],
  },
  {
    id: 'dermat_production.sign_off',
    title: 'Sign off production stages',
    module: 'dermat_production',
    dependsOn: ['dermat_production.view'],
  },
]

export default features
