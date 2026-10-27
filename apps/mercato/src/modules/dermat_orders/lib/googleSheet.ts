import { createSign } from 'node:crypto'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { ModuleConfigService } from '@open-mercato/core/modules/configs/lib/module-config-service'
import { DermatOrder, DermatOrderLine, DermatOrderStage } from '../data/entities'
import { loadCustomers, loadProducts, type OrderContext } from './server'
import { stageList } from './stages'
import { withStageOverrides } from './stageSettings'

const MODULE_ID = 'dermat_orders'
const SETTING_KEY = 'google_sheet'
const TAB = 'Order book'
const STATUS_WORD: Record<string, string> = { waiting: 'Coming', open: 'In progress', on_hold: 'On hold', done: 'Done', skipped: 'Skipped' }

export const GOOGLE_ENV = ['GOOGLE_SHEETS_CLIENT_EMAIL', 'GOOGLE_SHEETS_PRIVATE_KEY'] as const

export type SheetSetting = { sheetId: string | null; lastSyncAt: string | null; rows: number | null; error: string | null }

type Scope = { em: EntityManager; tenantId: string; organizationId: string; container: { resolve: (name: string) => unknown } }

export function googleCredentials() {
  const email = process.env.GOOGLE_SHEETS_CLIENT_EMAIL?.trim() || null
  const key = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n').trim() || null
  return email && key ? { email, key } : null
}

export function sheetIdFrom(value: string): string | null {
  const trimmed = value.trim()
  const fromUrl = trimmed.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/)
  if (fromUrl) return fromUrl[1]
  return /^[A-Za-z0-9_-]{20,}$/.test(trimmed) ? trimmed : null
}

export async function readSheetSetting(scope: Pick<Scope, 'container' | 'tenantId'>): Promise<SheetSetting> {
  const service = scope.container.resolve('moduleConfigService') as ModuleConfigService
  const value = await service.getValue<Partial<SheetSetting>>(MODULE_ID, SETTING_KEY, { defaultValue: {}, scope: { tenantId: scope.tenantId } })
  return { sheetId: value?.sheetId ?? null, lastSyncAt: value?.lastSyncAt ?? null, rows: value?.rows ?? null, error: value?.error ?? null }
}

export async function writeSheetSetting(scope: Pick<Scope, 'container' | 'tenantId'>, next: SheetSetting): Promise<void> {
  const service = scope.container.resolve('moduleConfigService') as ModuleConfigService
  await service.setValue(MODULE_ID, SETTING_KEY, next, { tenantId: scope.tenantId })
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url')
}

async function accessToken(credentials: { email: string; key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(JSON.stringify({ iss: credentials.email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }))
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claims}`)
  const assertion = `${header}.${claims}.${base64url(signer.sign(credentials.key))}`
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    signal: AbortSignal.timeout(15_000),
  })
  const json = (await response.json().catch(() => ({}))) as { access_token?: string; error_description?: string; error?: string }
  if (!response.ok || !json.access_token) throw new Error(`Google sign-in failed: ${json.error_description ?? json.error ?? response.status}`)
  return json.access_token
}

async function google<T>(token: string, url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(url, {
    method: init.method ?? 'GET',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(30_000),
  })
  const json = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } }
  if (!response.ok) throw new Error(json.error?.message ?? `Google Sheets error ${response.status}`)
  return json
}

function day(value: Date | string | null | undefined): string {
  if (!value) return ''
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

export async function orderBookRows(scope: Scope): Promise<Array<Array<string | number>>> {
  const ctx = scope as unknown as OrderContext
  return withStageOverrides(ctx, async () => {
    const orders = await scope.em.find(DermatOrder, { tenantId: scope.tenantId, organizationId: scope.organizationId, deletedAt: null }, { orderBy: { createdAt: 'desc' }, limit: 5000 })
    const ids = orders.map((order) => order.id)
    const [lines, stages] = await Promise.all([
      ids.length ? scope.em.find(DermatOrderLine, { orderId: { $in: ids } }, { orderBy: { position: 'asc' } }) : Promise.resolve([] as DermatOrderLine[]),
      ids.length ? scope.em.find(DermatOrderStage, { orderId: { $in: ids } }) : Promise.resolve([] as DermatOrderStage[]),
    ])
    const [customers, products] = await Promise.all([loadCustomers(ctx, orders.map((order) => order.customerId)), loadProducts(ctx, lines.map((line) => line.productId))])
    const defs = stageList().filter((def) => def.key !== 'order')
    const header = ['Order', 'Order date', 'Delivery', 'Customer', 'Customer PO', 'Order status', 'Brand / product', 'Pack size', 'Qty (pcs)', 'Batch no.', 'Now at', 'Packing material', ...defs.map((def) => def.label)]
    const rows: Array<Array<string | number>> = [header]
    for (const order of orders) {
      const own = stages.filter((stage) => stage.orderId === order.id)
      const stageOf = (key: string) => own.find((stage) => stage.stageKey === key)
      const now = defs.filter((def) => ['open', 'on_hold'].includes(stageOf(def.key)?.status ?? '')).map((def) => `${def.label}${stageOf(def.key)?.status === 'on_hold' ? ' (on hold)' : ''}`).join(' + ')
      const pmRaw = stageOf('artwork')?.data?.__pm
      const pm = pmRaw && typeof pmRaw === 'object' ? Object.values(pmRaw as Record<string, { status?: string }>) : []
      const pmText = !pm.length ? '' : pm.every((entry) => entry.status === 'PM OK') ? 'PM complete' : `${pm.filter((entry) => entry.status === 'PM OK').length} of ${pm.length} PM OK`
      const stageCells = defs.map((def) => {
        const stage = stageOf(def.key)
        const word = STATUS_WORD[stage?.status ?? 'waiting'] ?? ''
        return stage?.status === 'done' && stage.completedAt ? `${word} ${day(stage.completedAt)}` : word
      })
      const orderLines = lines.filter((line) => line.orderId === order.id)
      for (const [index, line] of (orderLines.length ? orderLines : [null]).entries()) {
        const product = line ? products.get(line.productId) : null
        rows.push([
          order.orderNo,
          index === 0 ? day(order.orderDate) : '',
          index === 0 ? day(order.deliveryDate) : '',
          index === 0 ? (customers.get(order.customerId)?.name ?? '') : '',
          index === 0 ? (order.customerPoRef ?? '') : '',
          index === 0 ? order.status : '',
          line ? [line.brandName, product?.title].filter(Boolean).join(' · ') : '',
          line?.packSize ?? '',
          line ? Number(line.quantity) : '',
          line?.batchNo ?? '',
          index === 0 ? now : '',
          index === 0 ? pmText : '',
          ...(index === 0 ? stageCells : defs.map(() => '')),
        ])
      }
    }
    return rows
  })
}

function column(index: number): string {
  let name = ''
  let rest = index + 1
  while (rest > 0) {
    const mod = (rest - 1) % 26
    name = String.fromCharCode(65 + mod) + name
    rest = Math.floor((rest - 1) / 26)
  }
  return name
}

export async function syncGoogleSheet(scope: Scope): Promise<SheetSetting> {
  const setting = await readSheetSetting(scope)
  const credentials = googleCredentials()
  if (!credentials) throw new Error('Google Sheets is not set up on the server')
  if (!setting.sheetId) throw new Error('Paste the Google Sheet link first')
  try {
    const rows = await orderBookRows(scope)
    const token = await accessToken(credentials)
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${setting.sheetId}`
    const meta = await google<{ sheets?: Array<{ properties?: { title?: string; sheetId?: number } }> }>(token, `${base}?fields=sheets.properties`)
    let tab = meta.sheets?.find((sheet) => sheet.properties?.title === TAB)?.properties?.sheetId
    if (tab === undefined) {
      const added = await google<{ replies?: Array<{ addSheet?: { properties?: { sheetId?: number } } }> }>(token, `${base}:batchUpdate`, { method: 'POST', body: { requests: [{ addSheet: { properties: { title: TAB, gridProperties: { frozenRowCount: 1, frozenColumnCount: 1 } } } }] } })
      tab = added.replies?.[0]?.addSheet?.properties?.sheetId
    }
    const range = `'${TAB}'!A1:${column(Math.max(...rows.map((row) => row.length)) - 1)}${rows.length}`
    await google(token, `${base}/values/${encodeURIComponent(`'${TAB}'`)}:clear`, { method: 'POST', body: {} })
    await google(token, `${base}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, { method: 'PUT', body: { range, majorDimension: 'ROWS', values: rows } })
    if (tab !== undefined) {
      await google(token, `${base}:batchUpdate`, {
        method: 'POST',
        body: { requests: [{ repeatCell: { range: { sheetId: tab, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.91, green: 0.9, blue: 0.89 } } }, fields: 'userEnteredFormat(textFormat,backgroundColor)' } }] },
      })
    }
    const next = { ...setting, lastSyncAt: new Date().toISOString(), rows: rows.length - 1, error: null }
    await writeSheetSetting(scope, next)
    return next
  } catch (error) {
    const next = { ...setting, error: error instanceof Error ? error.message.slice(0, 300) : 'Sync failed' }
    await writeSheetSetting(scope, next)
    throw error
  }
}
