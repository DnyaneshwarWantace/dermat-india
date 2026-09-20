import type { NotificationTypeDefinition } from '@wantace/shared/modules/notifications'

export const notificationTypes: NotificationTypeDefinition[] = [
  {
    type: 'purchasing.purchase_order.approved',
    module: 'purchasing',
    titleKey: 'purchasing.notifications.poApproved.title',
    bodyKey: 'purchasing.notifications.poApproved.body',
    icon: 'check-circle',
    severity: 'success',
    actions: [
      {
        id: 'view-purchase-order',
        labelKey: 'purchasing.notifications.poApproved.viewPurchaseOrder',
        variant: 'outline',
        href: '/backend/purchasing/purchase-orders/{sourceEntityId}',
        icon: 'external-link',
      },
    ],
    linkHref: '/backend/purchasing/purchase-orders/{sourceEntityId}',
    expiresAfterHours: 72,
  },
  {
    type: 'purchasing.goods_receipt.completed',
    module: 'purchasing',
    titleKey: 'purchasing.notifications.grCompleted.title',
    bodyKey: 'purchasing.notifications.grCompleted.body',
    icon: 'package-check',
    severity: 'success',
    actions: [
      {
        id: 'view-goods-receipt',
        labelKey: 'purchasing.notifications.grCompleted.viewGoodsReceipt',
        variant: 'outline',
        href: '/backend/purchasing/goods-receipts/{sourceEntityId}',
        icon: 'external-link',
      },
    ],
    linkHref: '/backend/purchasing/goods-receipts/{sourceEntityId}',
    expiresAfterHours: 48,
  },
]

export default notificationTypes
