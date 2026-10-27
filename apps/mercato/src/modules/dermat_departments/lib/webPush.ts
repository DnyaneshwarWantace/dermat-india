import webpush from 'web-push'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createLogger } from '@open-mercato/shared/lib/logger'
import { PushSubscriptionRecord } from '../data/entities'

const logger = createLogger('dermat_departments').child({ component: 'web-push' })

export const PHONE_CHANNEL = 'phone'

export function pushPublicKey(): string | null {
  return process.env.DERMAT_PUSH_PUBLIC_KEY?.trim() || null
}

export function pushReady(): boolean {
  return Boolean(pushPublicKey() && process.env.DERMAT_PUSH_PRIVATE_KEY?.trim())
}

let configured = false
function configure(): boolean {
  if (!pushReady()) return false
  if (!configured) {
    webpush.setVapidDetails(process.env.DERMAT_PUSH_SUBJECT?.trim() || 'mailto:admin@localhost', pushPublicKey() as string, process.env.DERMAT_PUSH_PRIVATE_KEY?.trim() as string)
    configured = true
  }
  return true
}

export type PushMessage = { title: string; body: string | null; link: string | null; tag?: string | null }

export async function pushToUser(em: EntityManager, scope: { tenantId: string; userId: string }, message: PushMessage): Promise<number> {
  if (!configure()) return 0
  const rows = await em.find(PushSubscriptionRecord, { tenantId: scope.tenantId, userId: scope.userId })
  let sent = 0
  const payload = JSON.stringify({ title: message.title, body: message.body ?? '', url: message.link ?? '/backend/my-work', tag: message.tag ?? null })
  for (const row of rows) {
    try {
      await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload, { TTL: 60 * 60 * 24 })
      row.lastSentAt = new Date()
      sent += 1
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) em.remove(row)
      else logger.warn('Phone pop-up not sent', { userId: scope.userId, status, error: error instanceof Error ? error.message : String(error) })
    }
  }
  await em.flush()
  return sent
}
