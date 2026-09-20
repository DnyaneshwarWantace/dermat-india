'use client'

import type { NotificationTypeDefinition } from '@wantace/shared/modules/notifications/types'
import { notificationTypes } from './notifications'
import { NewOrderRenderer } from './widgets/notifications/NewOrderRenderer'
import { MaterialsShortRenderer } from './widgets/notifications/MaterialsShortRenderer'
import { MaterialsReadyRenderer } from './widgets/notifications/MaterialsReadyRenderer'
import { StageCompletedRenderer } from './widgets/notifications/StageCompletedRenderer'
import { ProductionCompletedRenderer } from './widgets/notifications/ProductionCompletedRenderer'
import { QCPassedRenderer } from './widgets/notifications/QCPassedRenderer'
import { QCFailedRenderer } from './widgets/notifications/QCFailedRenderer'

const rendererMap: Record<string, NotificationTypeDefinition['Renderer']> = {
  'manufacturing.production_order.new_order': NewOrderRenderer,
  'manufacturing.production_order.materials_short': MaterialsShortRenderer,
  'manufacturing.production_order.materials_ready': MaterialsReadyRenderer,
  'manufacturing.production_order.stage_completed': StageCompletedRenderer,
  'manufacturing.production_order.production_completed': ProductionCompletedRenderer,
  'manufacturing.quality_inspection.passed': QCPassedRenderer,
  'manufacturing.quality_inspection.failed': QCFailedRenderer,
}

export const manufacturingNotificationTypes: NotificationTypeDefinition[] = notificationTypes.map((type) => ({
  ...type,
  Renderer: rendererMap[type.type],
}))

export default manufacturingNotificationTypes
