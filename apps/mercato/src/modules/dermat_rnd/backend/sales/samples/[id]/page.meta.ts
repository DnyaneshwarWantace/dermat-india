export const metadata = {
  requireAuth: true,
  requireFeatures: ['dermat_rnd.view', 'dermat_rnd.request'],
  pageTitle: 'R&D request',
  pageTitleKey: 'dermat_rnd.nav.request',
  pageGroup: 'Sales',
  pageGroupKey: 'dermat-01-sales.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'R&D requests & samples', labelKey: 'dermat_rnd.nav.samples', href: '/backend/sales/samples' },
    { label: 'R&D request', labelKey: 'dermat_rnd.nav.request' },
  ],
}
