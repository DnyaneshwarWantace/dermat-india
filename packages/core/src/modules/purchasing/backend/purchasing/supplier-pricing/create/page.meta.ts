export const metadata = {
  requireAuth: true,
  requireFeatures: ['purchasing.supplier_pricing.manage'],
  pageTitle: 'New Supplier Pricing',
  navHidden: true,
  breadcrumb: [
    { label: 'Purchasing', labelKey: 'purchasing.nav.title', href: '/backend/purchasing' },
    { label: 'Supplier Pricing', labelKey: 'purchasing.nav.supplierPricing', href: '/backend/purchasing/supplier-pricing' },
    { label: 'New Supplier Pricing', labelKey: 'purchasing.supplierPricing.create' },
  ],
} as const
