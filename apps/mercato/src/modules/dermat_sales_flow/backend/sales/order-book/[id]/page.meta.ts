export const metadata = {
  requireAuth: true,
  requireFeatures: ['sales.orders.view'],
  pageTitle: 'Order',
  pageTitleKey: 'dermat_sales_flow.orderBook.detail.title',
  pageGroup: 'Sales',
  pageGroupKey: 'customers~sales.nav.group',
  breadcrumb: [
    { label: 'Orders', labelKey: 'dermat_sales_flow.orderBook.list.title', href: '/backend/sales/order-book' },
    { label: 'Order', labelKey: 'dermat_sales_flow.orderBook.detail.title' },
  ],
} as const
