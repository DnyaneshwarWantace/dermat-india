export const metadata = {
  requireAuth: true,
  requireFeatures: ['purchasing.supplier_pricing.view'],
  pageTitle: 'Supplier Pricing',
  pageTitleKey: 'purchasing.nav.supplierPricing',
  pageGroup: 'Purchasing',
  pageGroupKey: 'purchasing.nav.title',
  navHidden: true,
  breadcrumb: [
    { label: 'Purchasing', labelKey: 'purchasing.nav.title', href: '/backend/purchasing' },
    { label: 'Supplier Pricing', labelKey: 'purchasing.nav.supplierPricing' },
  ],
} as const
