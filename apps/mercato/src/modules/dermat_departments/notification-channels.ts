import type { NotificationChannelDefinition } from '@open-mercato/shared/modules/notifications/types'

export const notificationChannels: NotificationChannelDefinition[] = [
  {
    id: 'whatsapp',
    labelKey: 'dermat_departments.whatsapp.channel',
    descriptionKey: 'dermat_departments.whatsapp.channelHint',
    order: 40,
  },
]

export default notificationChannels
