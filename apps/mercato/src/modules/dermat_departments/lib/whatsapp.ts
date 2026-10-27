import type { EntityManager } from '@mikro-orm/postgresql'
import { createLogger } from '@open-mercato/shared/lib/logger'
import { WhatsappNumber } from '../data/entities'

const logger = createLogger('dermat_departments').child({ component: 'whatsapp' })
const API_VERSION = 'v21.0'

export const WHATSAPP_CHANNEL = 'whatsapp'
export const WHATSAPP_ENV = ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN'] as const

export function whatsappSettings() {
  return {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || null,
    token: process.env.WHATSAPP_ACCESS_TOKEN?.trim() || null,
    template: process.env.WHATSAPP_TEMPLATE?.trim() || 'dermat_work_update',
    language: process.env.WHATSAPP_TEMPLATE_LANG?.trim() || 'en',
    appUrl: (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '') || null,
  }
}

export function whatsappReady(): boolean {
  const settings = whatsappSettings()
  return Boolean(settings.phoneNumberId && settings.token)
}

export function phoneDigits(phone: string): string {
  return phone.replace(/[^0-9]/g, '')
}

function clip(value: string, max: number): string {
  const flat = value.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat || '—'
}

export type WhatsappMessage = { title: string; body: string | null; link: string | null }

export async function sendWhatsapp(phone: string, message: WhatsappMessage): Promise<{ ok: true } | { ok: false; error: string }> {
  const settings = whatsappSettings()
  if (!settings.phoneNumberId || !settings.token) return { ok: false, error: 'WhatsApp is not set up' }
  const link = message.link ? (message.link.startsWith('http') ? message.link : settings.appUrl ? `${settings.appUrl}${message.link}` : message.link) : settings.appUrl ?? ''
  try {
    const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${settings.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${settings.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phoneDigits(phone),
        type: 'template',
        template: {
          name: settings.template,
          language: { code: settings.language },
          components: [{ type: 'body', parameters: [{ type: 'text', text: clip(message.title, 200) }, { type: 'text', text: clip(message.body ?? '', 400) }, { type: 'text', text: clip(link, 300) }] }],
        },
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (response.ok) return { ok: true }
    const text = await response.text().catch(() => '')
    let detail = `HTTP ${response.status}`
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } }
      if (parsed.error?.message) detail = parsed.error.message
    } catch {
      if (text) detail = text.slice(0, 200)
    }
    return { ok: false, error: detail }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not reach WhatsApp' }
  }
}

export async function deliverToUser(em: EntityManager, scope: { tenantId: string; userId: string }, message: WhatsappMessage): Promise<void> {
  const row = await em.findOne(WhatsappNumber, { tenantId: scope.tenantId, userId: scope.userId, enabled: true })
  if (!row) return
  const result = await sendWhatsapp(row.phone, message)
  row.lastSentAt = new Date()
  if (result.ok) {
    row.sentCount += 1
    row.lastError = null
  } else {
    row.lastError = result.error.slice(0, 400)
    logger.warn('WhatsApp message not sent', { userId: scope.userId, error: result.error })
  }
  await em.flush()
}
