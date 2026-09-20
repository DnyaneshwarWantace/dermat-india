export const metadata = {
  requireAuth: true,
  requireFeatures: ['sales.orders.view'],
  pageTitle: 'Orders',
  pageTitleKey: 'dermat_sales_flow.orderBook.list.title',
  pageGroup: 'Sales',
  pageGroupKey: 'customers~sales.nav.group',
  pageOrder: 10,
  icon: 'receipt',
  breadcrumb: [{ label: 'Orders', labelKey: 'dermat_sales_flow.orderBook.list.title' }],
} as const
