export const metadata = {
  requireAuth: true,
  requireFeatures: ['purchasing.purchase_invoices.manage'],
  pageTitle: 'New Purchase Invoice',
  navHidden: true,
  breadcrumb: [
    { label: 'Purchasing', labelKey: 'purchasing.nav.title', href: '/backend/purchasing' },
    { label: 'Purchase Invoices', labelKey: 'purchasing.nav.purchaseInvoices', href: '/backend/purchasing/purchase-invoices' },
    { label: 'New Purchase Invoice', labelKey: 'purchasing.purchaseInvoices.create' },
  ],
} as const
