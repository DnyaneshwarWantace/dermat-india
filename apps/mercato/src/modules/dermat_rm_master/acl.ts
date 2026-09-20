export const features = [
  { id: 'dermat_rm_master.view', title: 'View raw materials', module: 'dermat_rm_master' },
  {
    id: 'dermat_rm_master.manage',
    title: 'Manage raw materials',
    module: 'dermat_rm_master',
    dependsOn: ['dermat_rm_master.view'],
  },
]

export default features
