export const features = [
  { id: 'dermat_purchase_orders.view', title: 'View Purchase Orders', module: 'dermat_purchase_orders' },
  {
    id: 'dermat_purchase_orders.manage',
    title: 'Manage Purchase Orders',
    module: 'dermat_purchase_orders',
    dependsOn: ['dermat_purchase_orders.view'],
  },
]

export default features
