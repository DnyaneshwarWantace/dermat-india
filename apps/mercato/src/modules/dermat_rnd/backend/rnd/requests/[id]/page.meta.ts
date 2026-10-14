export const metadata = {
  requireAuth: true,
  requireFeatures: ['dermat_rnd.view', 'dermat_rnd.manage'],
  pageTitle: 'R&D request',
  pageTitleKey: 'dermat_rnd.nav.request',
  pageGroup: 'R&D',
  pageGroupKey: 'dermat-03-rnd.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'R&D requests', labelKey: 'dermat_rnd.nav.requests', href: '/backend/rnd/requests' },
    { label: 'R&D request', labelKey: 'dermat_rnd.nav.request' },
  ],
}
