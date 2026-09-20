export const features = [
  { id: 'purchasing.suppliers.view', title: 'View suppliers', module: 'purchasing' },
  {
    id: 'purchasing.suppliers.manage',
    title: 'Manage suppliers',
    module: 'purchasing',
    dependsOn: ['purchasing.suppliers.view'],
  },
  { id: 'purchasing.purchase_orders.view', title: 'View purchase orders', module: 'purchasing' },
  {
    id: 'purchasing.purchase_orders.manage',
    title: 'Manage purchase orders',
    module: 'purchasing',
    dependsOn: ['purchasing.purchase_orders.view'],
  },
  {
    id: 'purchasing.purchase_orders.approve',
    title: 'Approve purchase orders',
    module: 'purchasing',
    dependsOn: ['purchasing.purchase_orders.view'],
  },
  { id: 'purchasing.goods_receipts.view', title: 'View goods receipts', module: 'purchasing' },
  {
    id: 'purchasing.goods_receipts.manage',
    title: 'Manage goods receipts',
    module: 'purchasing',
    dependsOn: ['purchasing.goods_receipts.view'],
  },
  { id: 'purchasing.supplier_pricing.view', title: 'View supplier pricing', module: 'purchasing' },
  {
    id: 'purchasing.supplier_pricing.manage',
    title: 'Manage supplier pricing',
    module: 'purchasing',
    dependsOn: ['purchasing.supplier_pricing.view'],
  },
  { id: 'purchasing.purchase_invoices.view', title: 'View purchase invoices', module: 'purchasing' },
  {
    id: 'purchasing.purchase_invoices.manage',
    title: 'Manage purchase invoices',
    module: 'purchasing',
    dependsOn: ['purchasing.purchase_invoices.view'],
  },
  {
    id: 'purchasing.purchase_invoices.approve',
    title: 'Approve purchase invoices',
    module: 'purchasing',
    dependsOn: ['purchasing.purchase_invoices.view'],
  },
  { id: 'purchasing.settings.manage', title: 'Manage purchasing settings', module: 'purchasing' },
]

export default features
