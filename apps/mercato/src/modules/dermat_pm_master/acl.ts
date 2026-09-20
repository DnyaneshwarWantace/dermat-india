export const features = [
  { id: 'dermat_pm_master.view', title: 'View packaging materials', module: 'dermat_pm_master' },
  {
    id: 'dermat_pm_master.manage',
    title: 'Manage packaging materials',
    module: 'dermat_pm_master',
    dependsOn: ['dermat_pm_master.view'],
  },
]

export default features
