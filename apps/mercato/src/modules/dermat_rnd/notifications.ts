import type { NotificationTypeDefinition } from '@open-mercato/shared/modules/notifications/types'

export const notificationTypes: NotificationTypeDefinition[] = [
  {
    type: 'dermat_rnd.stability.failed',
    module: 'dermat_rnd',
    titleKey: 'dermat_rnd.notifications.stabilityFailed.title',
    bodyKey: 'dermat_rnd.notifications.stabilityFailed.body',
    icon: 'alert-triangle',
    severity: 'warning',
    actions: [{ id: 'open', labelKey: 'common.open', variant: 'outline', href: '/backend/rnd/requests/{sourceEntityId}', icon: 'external-link' }],
    linkHref: '/backend/rnd/requests/{sourceEntityId}',
    expiresAfterHours: 720,
  },
]

export default notificationTypes
