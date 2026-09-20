export const metadata = {
  requireAuth: true,
  requireFeatures: ['purchasing.suppliers.manage'],
  pageTitle: 'New Supplier',
  navHidden: true,
  breadcrumb: [
    { label: 'Purchasing', labelKey: 'purchasing.nav.title', href: '/backend/purchasing' },
    { label: 'Suppliers', labelKey: 'purchasing.nav.suppliers', href: '/backend/purchasing/suppliers' },
    { label: 'New Supplier', labelKey: 'purchasing.suppliers.create' },
  ],
} as const
