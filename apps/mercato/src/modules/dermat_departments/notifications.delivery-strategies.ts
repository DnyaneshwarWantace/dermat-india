import type { EntityManager } from '@mikro-orm/postgresql'
import type { NotificationDeliveryStrategy } from '@open-mercato/core/modules/notifications/lib/deliveryStrategies'
import { WHATSAPP_CHANNEL, deliverToUser, whatsappReady } from './lib/whatsapp'
import { PHONE_CHANNEL, pushReady, pushToUser } from './lib/webPush'

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

const phoneDeliveryStrategy: NotificationDeliveryStrategy = {
  id: PHONE_CHANNEL,
  label: 'Phone pop-up',
  defaultEnabled: true,
  isConfigured: () => pushReady(),
  async deliver(ctx) {
    const em = (ctx.resolve('em') as EntityManager).fork()
    await pushToUser(em, { tenantId: ctx.notification.tenantId, userId: ctx.notification.recipientUserId }, { title: ctx.title, body: ctx.body, link: ctx.notification.linkHref ?? null, tag: ctx.notification.id })
  },
}

export const deliveryStrategies: NotificationDeliveryStrategy[] = [whatsappDeliveryStrategy, phoneDeliveryStrategy]

export default deliveryStrategies
