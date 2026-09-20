export const metadata = {
  requireAuth: true,
  requireFeatures: ['dermat_purchase_orders.manage'],
  pageTitle: 'New Purchase Order',
  pageTitleKey: 'dermat_purchase_orders.create.title',
  pageGroup: 'Purchase Orders',
  pageGroupKey: 'dermat-7-purchase-orders.nav.group',
  icon: 'shopping-cart',
  breadcrumb: [
    { label: 'Purchase Orders', labelKey: 'dermat_purchase_orders.list.title', href: '/backend/dermat_purchase_orders' },
    { label: 'New Purchase Order', labelKey: 'dermat_purchase_orders.create.title' },
  ],
}
