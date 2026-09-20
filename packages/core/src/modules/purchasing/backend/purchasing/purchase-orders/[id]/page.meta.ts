export const metadata = {
  requireAuth: true,
  requireFeatures: ['purchasing.purchase_orders.view'],
  pageTitle: 'Purchase Order Detail',
  breadcrumb: [
    { label: 'Purchasing', labelKey: 'purchasing.nav.title', href: '/backend/purchasing' },
    { label: 'Purchase Orders', labelKey: 'purchasing.nav.purchaseOrders', href: '/backend/purchasing/purchase-orders' },
    { label: 'Detail' },
  ],
} as const
