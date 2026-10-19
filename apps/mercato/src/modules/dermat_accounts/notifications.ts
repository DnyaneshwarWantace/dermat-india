import type { NotificationTypeDefinition } from '@open-mercato/shared/modules/notifications/types'

export const notificationTypes: NotificationTypeDefinition[] = [
  {
    type: 'dermat_accounts.registration.submitted',
    module: 'dermat_accounts',
    titleKey: 'dermat_accounts.notifications.registration.title',
    bodyKey: 'dermat_accounts.notifications.registration.body',
    icon: 'user-plus',
    severity: 'info',
    actions: [{ id: 'open', labelKey: 'common.open', variant: 'outline' as const, href: '/backend/accounts/registrations', icon: 'external-link' }],
    linkHref: '/backend/accounts/registrations',
    expiresAfterHours: 336,
  },
]

export default notificationTypes
