export const metadata = {
  requireAuth: true,
  requireFeatures: ['purchasing.goods_receipts.view'],
  pageTitle: 'Goods Receipt Detail',
  breadcrumb: [
    { label: 'Purchasing', labelKey: 'purchasing.nav.title', href: '/backend/purchasing' },
    { label: 'Goods Receipts', labelKey: 'purchasing.nav.goodsReceipts', href: '/backend/purchasing/goods-receipts' },
    { label: 'Detail' },
  ],
} as const
