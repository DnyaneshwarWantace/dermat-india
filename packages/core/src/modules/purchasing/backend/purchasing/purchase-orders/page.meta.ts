export const metadata = {
  requireAuth: true,
  requireFeatures: ['purchasing.purchase_orders.view'],
  pageTitle: 'Purchase Orders',
  pageTitleKey: 'purchasing.nav.purchaseOrders',
  pageGroup: 'Purchasing',
  pageGroupKey: 'purchasing.nav.title',
  pageOrder: 220,
  navHidden: true,
  breadcrumb: [
    { label: 'Purchasing', labelKey: 'purchasing.nav.title', href: '/backend/purchasing' },
    { label: 'Purchase Orders', labelKey: 'purchasing.nav.purchaseOrders' },
  ],
  icon: 'file-text',
} as const
