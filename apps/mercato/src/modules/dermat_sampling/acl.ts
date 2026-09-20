export const features = [
  { id: 'dermat_sampling.view', title: 'View R&D samples', module: 'dermat_sampling' },
  {
    id: 'dermat_sampling.manage',
    title: 'Manage R&D samples',
    module: 'dermat_sampling',
    dependsOn: ['dermat_sampling.view'],
  },
]

export default features
