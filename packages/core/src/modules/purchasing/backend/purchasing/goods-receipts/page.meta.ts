export const metadata = {
  requireAuth: true,
  requireFeatures: ['purchasing.goods_receipts.view'],
  pageTitle: 'Goods Receipts',
  pageTitleKey: 'purchasing.nav.goodsReceipts',
  pageGroup: 'Purchasing',
  pageGroupKey: 'purchasing.nav.title',
  pageOrder: 230,
  navHidden: true,
  breadcrumb: [
    { label: 'Purchasing', labelKey: 'purchasing.nav.title', href: '/backend/purchasing' },
    { label: 'Goods Receipts', labelKey: 'purchasing.nav.goodsReceipts' },
  ],
  icon: 'package-check',
} as const
