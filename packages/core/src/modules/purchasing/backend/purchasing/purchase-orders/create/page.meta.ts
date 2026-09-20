export const metadata = {
  requireAuth: true,
  requireFeatures: ['purchasing.purchase_orders.manage'],
  pageTitle: 'New Purchase Order',
  navHidden: true,
  breadcrumb: [
    { label: 'Purchasing', labelKey: 'purchasing.nav.title', href: '/backend/purchasing' },
    { label: 'Purchase Orders', labelKey: 'purchasing.nav.purchaseOrders', href: '/backend/purchasing/purchase-orders' },
    { label: 'New Purchase Order', labelKey: 'purchasing.purchaseOrders.create' },
  ],
} as const
