export const metadata = {
  requireAuth: true,
  requireFeatures: ['purchasing.suppliers.view'],
  pageTitle: 'Suppliers',
  pageTitleKey: 'purchasing.nav.suppliers',
  pageGroup: 'Purchasing',
  pageGroupKey: 'purchasing.nav.title',
  pageOrder: 210,
  navHidden: true,
  breadcrumb: [
    { label: 'Purchasing', labelKey: 'purchasing.nav.title', href: '/backend/purchasing' },
    { label: 'Suppliers', labelKey: 'purchasing.nav.suppliers' },
  ],
  icon: 'truck',
} as const
