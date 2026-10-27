import type { NotificationChannelDefinition } from '@open-mercato/shared/modules/notifications/types'

export const notificationChannels: NotificationChannelDefinition[] = [
  {
    id: 'whatsapp',
    labelKey: 'dermat_departments.whatsapp.channel',
    descriptionKey: 'dermat_departments.whatsapp.channelHint',
    order: 40,
  },
  {
    id: 'phone',
    labelKey: 'dermat_departments.push.channel',
    descriptionKey: 'dermat_departments.push.channelHint',
    order: 45,
  },
]

export default notificationChannels
