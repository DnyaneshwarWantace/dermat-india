import { hasFeatures, type OrderContext } from './server'
import { STAGE_SEE_FEATURE, STAGE_WORK_FEATURE, sharedFieldKeys, stageList, stepOwners } from './stages'
import type { StageOverrides } from './stageSettings'

export type OrderAccess = {
  full: boolean
  stages: Set<string>
  view: Set<string>
  cards: Set<string>
  accounts: boolean
  dispatch: boolean
}

export async function resolveOrderAccess(ctx: OrderContext): Promise<OrderAccess> {
  const defs = stageList()
  const ownerFeatures = new Set<string>([...Object.values(STAGE_WORK_FEATURE), ...Object.values(STAGE_SEE_FEATURE)])
  for (const def of defs) for (const step of def.steps) for (const feature of stepOwners(def.key, step)) ownerFeatures.add(feature)
  const granted = new Set<string>()
  for (const feature of ownerFeatures) if (await hasFeatures(ctx, [feature])) granted.add(feature)
  const cards = new Set<string>()
  for (const def of defs) for (const step of def.steps) if (stepOwners(def.key, step).some((feature) => granted.has(feature))) cards.add(`${def.key}.${step.key}`)
  if (await hasFeatures(ctx, ['dermat_orders.full'])) {
    const all = new Set(Object.keys(STAGE_WORK_FEATURE))
    return { full: true, stages: all, view: all, cards, accounts: true, dispatch: true }
  }
  const stages = new Set(Object.entries(STAGE_WORK_FEATURE).filter(([, feature]) => granted.has(feature)).map(([key]) => key))
  const view = new Set(stages)
  for (const [key, feature] of Object.entries(STAGE_SEE_FEATURE)) if (granted.has(feature)) view.add(key)
  for (const card of cards) view.add(card.split('.')[0])
  return { full: false, stages, view, cards, accounts: granted.has('dermat_orders.work.accounts'), dispatch: granted.has('dermat_orders.work.dispatch') }
}

export function canReadStage(access: OrderAccess, stageKey: string): boolean {
  return access.full || access.view.has(stageKey)
}

export function visibleStageData(access: OrderAccess, stageKey: string, data: Record<string, unknown>, overrides?: StageOverrides): Record<string, unknown> {
  if (canReadStage(access, stageKey)) return data
  const shared = sharedFieldKeys(stageKey, overrides?.get(stageKey))
  return Object.fromEntries(Object.entries(data).filter(([key]) => shared.has(key) || key === '__started' || key === '__steps'))
}

type StageLike = { key: string; data: Record<string, unknown>; holdReason?: string | null; responsibleName?: string | null; responsibleUserId?: string | null; completedByName?: string | null; holdParty?: string | null }

export function trimStages<T extends StageLike>(access: OrderAccess, stages: T[], overrides?: StageOverrides): Array<T & { locked: boolean }> {
  return stages.map((stage) => {
    const readable = canReadStage(access, stage.key)
    if (readable) return { ...stage, locked: false }
    return { ...stage, locked: true, data: visibleStageData(access, stage.key, stage.data, overrides), responsibleName: null, responsibleUserId: null, completedByName: null, holdReason: null, holdParty: stage.holdParty ?? null }
  })
}

type EventLike = { stageKey: string | null; note: string | null; changes: unknown[]; byName?: string | null }

export function trimEvents<T extends EventLike>(access: OrderAccess, events: T[]): T[] {
  if (access.full) return events
  return events.filter((event) => !event.stageKey || access.view.has(event.stageKey)).map((event) => (event.stageKey ? event : { ...event, note: null, changes: [] }))
}
