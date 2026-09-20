export const metadata = {
  requireAuth: true,
  requireFeatures: ['dermat_bom.manage'],
  pageTitle: 'Create BOM',
  pageTitleKey: 'dermat_bom.create.title',
  pageGroup: 'BOM',
  pageGroupKey: 'dermat-2-bom.nav.group',
  icon: 'layers',
  breadcrumb: [
    { label: 'Bill of Materials', labelKey: 'dermat_bom.list.page.title', href: '/backend/dermat_bom' },
    { label: 'Create BOM', labelKey: 'dermat_bom.create.title' },
  ],
}
