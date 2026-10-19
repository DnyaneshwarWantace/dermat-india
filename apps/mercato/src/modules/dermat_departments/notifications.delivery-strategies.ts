import type { EntityManager } from '@mikro-orm/postgresql'
import type { NotificationDeliveryStrategy } from '@open-mercato/core/modules/notifications/lib/deliveryStrategies'
import { WHATSAPP_CHANNEL, deliverToUser, whatsappReady } from './lib/whatsapp'

const whatsappDeliveryStrategy: NotificationDeliveryStrategy = {
  id: WHATSAPP_CHANNEL,
  label: 'WhatsApp',
  defaultEnabled: true,
  isConfigured: () => whatsappReady(),
  supports: (notification) => notification.type.startsWith('dermat_'),
  async deliver(ctx) {
    const em = (ctx.resolve('em') as EntityManager).fork()
    await deliverToUser(em, { tenantId: ctx.notification.tenantId, userId: ctx.notification.recipientUserId }, { title: ctx.title, body: ctx.body, link: ctx.notification.linkHref ?? null })
  },
}

export const deliveryStrategies: NotificationDeliveryStrategy[] = [whatsappDeliveryStrategy]

export default deliveryStrategies
