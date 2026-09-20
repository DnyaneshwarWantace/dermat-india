export const features = [
  { id: 'dermat_departments.view', title: 'View departments', module: 'dermat_departments' },
  {
    id: 'dermat_departments.manage',
    title: 'Manage departments',
    module: 'dermat_departments',
    dependsOn: ['dermat_departments.view'],
  },
]

export default features
