export const metadata = {
  requireAuth: true,
  requireFeatures: ['purchasing.suppliers.view'],
  pageTitle: 'Supplier Detail',
  breadcrumb: [
    { label: 'Purchasing', labelKey: 'purchasing.nav.title', href: '/backend/purchasing' },
    { label: 'Suppliers', labelKey: 'purchasing.nav.suppliers', href: '/backend/purchasing/suppliers' },
    { label: 'Detail' },
  ],
} as const
