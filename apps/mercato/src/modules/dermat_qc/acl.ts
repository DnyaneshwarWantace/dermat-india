export const features = [
  { id: 'dermat_qc.view', title: 'View QC tests and policies', module: 'dermat_qc' },
  {
    id: 'dermat_qc.manage',
    title: 'Manage QC tests and policies',
    module: 'dermat_qc',
    dependsOn: ['dermat_qc.view'],
  },
]

export default features
