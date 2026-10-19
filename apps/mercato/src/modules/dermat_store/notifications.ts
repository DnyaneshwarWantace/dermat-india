import type { NotificationTypeDefinition } from '@open-mercato/shared/modules/notifications/types'

const openAction = [{ id: 'open', labelKey: 'common.open', variant: 'outline' as const, href: '/backend/store/requests/{sourceEntityId}', icon: 'external-link' }]

export const notificationTypes: NotificationTypeDefinition[] = [
  {
    type: 'dermat_store.request.created',
    module: 'dermat_store',
    titleKey: 'dermat_store.notifications.created.title',
    bodyKey: 'dermat_store.notifications.created.body',
    icon: 'package',
    severity: 'info',
    actions: openAction,
    linkHref: '/backend/store/requests/{sourceEntityId}',
    expiresAfterHours: 168,
  },
  {
    type: 'dermat_store.request.issued',
    module: 'dermat_store',
    titleKey: 'dermat_store.notifications.issued.title',
    bodyKey: 'dermat_store.notifications.issued.body',
    icon: 'package-check',
    severity: 'info',
    actions: openAction,
    linkHref: '/backend/store/requests/{sourceEntityId}',
    expiresAfterHours: 168,
  },
]

export default notificationTypes
