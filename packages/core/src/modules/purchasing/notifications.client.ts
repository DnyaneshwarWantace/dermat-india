'use client'

import type { NotificationTypeDefinition } from '@wantace/shared/modules/notifications/types'
import { notificationTypes } from './notifications'
import { POApprovedRenderer } from './widgets/notifications/POApprovedRenderer'
import { GRCompletedRenderer } from './widgets/notifications/GRCompletedRenderer'

const rendererMap: Record<string, NotificationTypeDefinition['Renderer']> = {
  'purchasing.purchase_order.approved': POApprovedRenderer,
  'purchasing.goods_receipt.completed': GRCompletedRenderer,
}

export const purchasingNotificationTypes: NotificationTypeDefinition[] = notificationTypes.map((type) => ({
  ...type,
  Renderer: rendererMap[type.type],
}))

export default purchasingNotificationTypes
