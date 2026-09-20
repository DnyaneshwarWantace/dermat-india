export const metadata = {
  requireAuth: true,
  requireFeatures: ['purchasing.purchase_invoices.view'],
  pageTitle: 'Purchase Invoices',
  pageTitleKey: 'purchasing.nav.purchaseInvoices',
  pageGroup: 'Purchasing',
  pageGroupKey: 'purchasing.nav.title',
  navHidden: true,
  breadcrumb: [
    { label: 'Purchasing', labelKey: 'purchasing.nav.title', href: '/backend/purchasing' },
    { label: 'Purchase Invoices', labelKey: 'purchasing.nav.purchaseInvoices' },
  ],
} as const
