export const metadata = {
  requireAuth: true,
  requireFeatures: ['catalog.variants.manage'],
  pageGroup: 'Products',
  pageGroupKey: 'catalog.nav.group',
  navHidden: true,
  breadcrumb: [
    {
      label: 'Products',
      labelKey: 'catalog.products.page.title',
      href: '/backend/catalog/products',
    },
  ],
}
