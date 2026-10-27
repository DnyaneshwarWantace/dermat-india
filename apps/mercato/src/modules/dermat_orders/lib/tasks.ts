import { loadCustomers, hasFeatures, type OrderContext } from './server'
import { MAIN_CARD, OWNER_NAMES, completeOwners, stageWorkFeatures, stepOwners, stepRequired, stepStates, type StageDef } from './stages'
import { effectiveStageDef, loadStageOverrides } from './stageSettings'

const DAY_MS = 86400000

export type CardPerson = { userId: string; name: string | null }

export function cardPeople(data: Record<string, unknown> | null | undefined): Record<string, CardPerson> {
  const raw = (data ?? {}).__people
  return raw && typeof raw === 'object' ? (raw as Record<string, CardPerson>) : {}
}

export type OpenCard = { key: string; label: string; owners: string[] }

export function openCards(def: StageDef, data: Record<string, unknown> | null | undefined): OpenCard[] {
  if (!def.steps.length) return [{ key: MAIN_CARD, label: def.label, owners: stageWorkFeatures(def.key) }]
  const states = stepStates(data)
  const result: OpenCard[] = []
  let sequentialGiven = false
  for (const step of def.steps) {
    if (states[step.key]?.done) continue
    if (!stepRequired(def, step, data)) continue
    if (step.parallel) {
      result.push({ key: step.key, label: step.label, owners: stepOwners(def.key, step) })
      continue
    }
    if (sequentialGiven) continue
    result.push({ key: step.key, label: step.label, owners: stepOwners(def.key, step) })
    sequentialGiven = true
  }
  if (!result.length) result.push({ key: MAIN_CARD, label: `Complete ${def.label}`, owners: completeOwners(def, data) })
  return result
}

export function cardSince(def: StageDef, data: Record<string, unknown> | null | undefined, cardKey: string, openedAt: Date | string | null): Date | null {
  const states = stepStates(data)
  const index = def.steps.findIndex((step) => step.key === cardKey)
  for (let position = index - 1; position >= 0; position -= 1) {
    const at = states[def.steps[position].key]?.at
    if (at) return new Date(at)
  }
  return openedAt ? new Date(openedAt) : null
}

export type TaskItem = {
  orderId: string
  orderNo: string
  customerName: string
  stageKey: string
  stageLabel: string
  cardKey: string
  cardLabel: string
  ownerNames: string[]
  personName: string | null
  mine: boolean
  status: string
  days: number
  since: string | null
  deliveryDate: string | null
  overdue: boolean
  holdReason: string | null
  href: string
}

type Row = {
  order_id: string
  order_no: string
  customer_id: string
  delivery_date: string | null
  stage_key: string
  status: string
  data: Record<string, unknown> | null
  responsible_user_id: string | null
  responsible_name: string | null
  hold_reason: string | null
  opened_at: Date | string | null
}

export async function taskList(ctx: OrderContext, scope: 'mine' | 'department' | 'all'): Promise<TaskItem[]> {
  const rows = await ctx.em.getConnection().execute<Row[]>(
    `select s.order_id, o.order_no, o.customer_id, o.delivery_date, s.stage_key, s.status, s.data, s.responsible_user_id, s.responsible_name, s.hold_reason, s.opened_at
       from dermat_order_stages s join dermat_orders o on o.id = s.order_id
      where o.tenant_id = ? and o.organization_id = ? and o.deleted_at is null and o.status in ('booked', 'confirmed')
        and s.status in ('open', 'on_hold')
      order by s.opened_at asc nulls last`,
    [ctx.tenantId, ctx.organizationId],
  )
  const overrides = await loadStageOverrides(ctx)
  const granted = new Map<string, boolean>()
  const may = async (feature: string) => {
    if (!granted.has(feature)) granted.set(feature, await hasFeatures(ctx, [feature]))
    return granted.get(feature) as boolean
  }
  const customers = await loadCustomers(ctx, rows.map((row) => row.customer_id))
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const items: TaskItem[] = []
  for (const row of rows) {
    const def = effectiveStageDef(row.stage_key, overrides)
    if (!def || def.key === 'order') continue
    const people = cardPeople(row.data)
    for (const card of openCards(def, row.data)) {
      const person = people[card.key] ?? (row.responsible_user_id ? { userId: row.responsible_user_id, name: row.responsible_name } : null)
      const mine = Boolean(person && person.userId === ctx.userId)
      let department = false
      for (const feature of card.owners) if (!department && (await may(feature))) department = true
      if (scope === 'mine' && !mine) continue
      if (scope === 'department' && !department && !mine) continue
      const since = cardSince(def, row.data, card.key, row.opened_at)
      items.push({
        orderId: row.order_id,
        orderNo: row.order_no,
        customerName: customers.get(row.customer_id)?.name ?? '—',
        stageKey: def.key,
        stageLabel: def.label,
        cardKey: card.key,
        cardLabel: card.label,
        ownerNames: card.owners.map((feature) => OWNER_NAMES[feature] ?? feature),
        personName: person?.name ?? null,
        mine,
        status: row.status,
        days: since ? Math.max(0, Math.floor((Date.now() - since.getTime()) / DAY_MS)) : 0,
        since: since ? since.toISOString() : null,
        deliveryDate: row.delivery_date,
        overdue: Boolean(row.delivery_date && row.delivery_date < today),
        holdReason: row.hold_reason,
        href: `/backend/orders/${row.order_id}/stages/${def.key}${card.key === MAIN_CARD ? '' : `/steps/${card.key}`}`,
      })
    }
  }
  items.sort((a, b) => Number(b.overdue) - Number(a.overdue) || Number(b.status === 'on_hold') - Number(a.status === 'on_hold') || b.days - a.days)
  return items
}
