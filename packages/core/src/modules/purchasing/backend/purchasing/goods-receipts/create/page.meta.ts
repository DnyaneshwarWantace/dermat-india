export const metadata = {
  requireAuth: true,
  requireFeatures: ['purchasing.goods_receipts.manage'],
  pageTitle: 'New Goods Receipt',
  navHidden: true,
  breadcrumb: [
    { label: 'Purchasing', labelKey: 'purchasing.nav.title', href: '/backend/purchasing' },
    { label: 'Goods Receipts', labelKey: 'purchasing.nav.goodsReceipts', href: '/backend/purchasing/goods-receipts' },
    { label: 'New Goods Receipt', labelKey: 'purchasing.goodsReceipts.create' },
  ],
} as const
