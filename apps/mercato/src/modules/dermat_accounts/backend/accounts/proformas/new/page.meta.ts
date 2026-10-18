export const metadata = {
  requireAuth: true,
  requireFeatures: ['dermat_accounts.record'],
  pageTitle: 'New proforma invoice',
  pageTitleKey: 'dermat_accounts.nav.newProforma',
  pageGroup: 'Accounts',
  pageGroupKey: 'dermat-02-accounts.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Proforma invoices', labelKey: 'dermat_accounts.nav.proformas', href: '/backend/accounts/proformas' },
    { label: 'New proforma invoice', labelKey: 'dermat_accounts.nav.newProforma' },
  ],
}
