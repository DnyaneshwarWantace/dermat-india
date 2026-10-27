import { hasFeatures, type OrderContext } from './server'
import { MAIN_CARD, STAGE_WORK_FEATURE, cardKeys, fieldCard, sharedFieldKeys, stageDef, stageList, stageSeeFeatures, stageWorkFeatures, stepOwners, type StageDef } from './stages'
import { effectiveStageDef, type StageOverrides } from './stageSettings'

export type CardLevel = 'none' | 'read' | 'work'

export type OrderAccess = {
  full: boolean
  stages: Set<string>
  view: Set<string>
  see: Set<string>
  cards: Set<string>
  accounts: boolean
  dispatch: boolean
}

const STEP_PRIVATE_DATA: Record<string, Record<string, string>> = {
  artwork: { __qa_art: 'qa_final', __approval: 'client_approved' },
  sampling: { __rounds: 'client_ok' },
}

export async function resolveOrderAccess(ctx: OrderContext): Promise<OrderAccess> {
  const defs = stageList()
  const stageKeys = Object.keys(STAGE_WORK_FEATURE)
  const ownerFeatures = new Set<string>(stageKeys.flatMap((key) => [...stageWorkFeatures(key), ...stageSeeFeatures(key)]))
  for (const def of defs) for (const step of def.steps) for (const feature of stepOwners(def.key, step)) ownerFeatures.add(feature)
  const any = (features: string[]) => features.some((feature) => granted.has(feature))
  const granted = new Set<string>()
  for (const feature of ownerFeatures) if (await hasFeatures(ctx, [feature])) granted.add(feature)
  const cards = new Set<string>()
  for (const def of defs) {
    if (!def.steps.length && any(stageWorkFeatures(def.key))) cards.add(`${def.key}.${MAIN_CARD}`)
    for (const step of def.steps) if (stepOwners(def.key, step).some((feature) => granted.has(feature))) cards.add(`${def.key}.${step.key}`)
  }
  const accounts = granted.has('dermat_orders.work.accounts')
  const dispatch = granted.has('dermat_orders.work.dispatch')
  if (await hasFeatures(ctx, ['dermat_orders.full'])) {
    const all = new Set(Object.keys(STAGE_WORK_FEATURE))
    return { full: true, stages: all, view: all, see: all, cards, accounts: true, dispatch: true }
  }
  const stages = new Set(stageKeys.filter((key) => any(stageWorkFeatures(key))))
  const see = new Set(stageKeys.filter((key) => any(stageSeeFeatures(key))))
  const view = new Set([...stages, ...see])
  for (const card of cards) view.add(card.split('.')[0])
  return { full: false, stages, view, see, cards, accounts, dispatch }
}

export function canReadStage(access: OrderAccess, stageKey: string): boolean {
  return access.full || access.view.has(stageKey)
}

export function seesWholeStage(access: OrderAccess, stageKey: string): boolean {
  return access.full || access.see.has(stageKey)
}

export function cardLevel(access: OrderAccess, stageKey: string, cardKey: string): CardLevel {
  if (access.cards.has(`${stageKey}.${cardKey}`)) return 'work'
  if (seesWholeStage(access, stageKey)) return 'read'
  return 'none'
}

function defFor(stageKey: string, overrides?: StageOverrides): StageDef | undefined {
  return overrides ? effectiveStageDef(stageKey, overrides) : stageDef(stageKey)
}

export function cardLevels(access: OrderAccess, stageKey: string, overrides?: StageOverrides): Record<string, CardLevel> {
  const def = defFor(stageKey, overrides)
  if (!def) return {}
  return Object.fromEntries(cardKeys(def).map((key) => [key, canReadStage(access, stageKey) ? cardLevel(access, stageKey, key) : 'none']))
}

function readableFieldKeys(access: OrderAccess, def: StageDef, overrides?: StageOverrides): Set<string> {
  const keys = new Set(sharedFieldKeys(def.key, overrides?.get(def.key)))
  for (const field of def.fields) if (cardLevel(access, def.key, fieldCard(def, field.key)) !== 'none') keys.add(field.key)
  return keys
}

export function visibleStageData(access: OrderAccess, stageKey: string, data: Record<string, unknown>, overrides?: StageOverrides): Record<string, unknown> {
  if (seesWholeStage(access, stageKey)) return data
  if (!canReadStage(access, stageKey)) {
    const shared = sharedFieldKeys(stageKey, overrides?.get(stageKey))
    return Object.fromEntries(Object.entries(data).filter(([key]) => shared.has(key) || key === '__started' || key === '__steps'))
  }
  const def = defFor(stageKey, overrides)
  if (!def) return data
  const readable = readableFieldKeys(access, def, overrides)
  const fieldKeys = new Set(def.fields.map((field) => field.key))
  const privateData = STEP_PRIVATE_DATA[stageKey] ?? {}
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => {
      if (privateData[key]) return cardLevel(access, stageKey, privateData[key]) !== 'none'
      if (fieldKeys.has(key)) return readable.has(key)
      return true
    }),
  )
}

type StageLike = { key: string; data: Record<string, unknown>; holdReason?: string | null; responsibleName?: string | null; responsibleUserId?: string | null; completedByName?: string | null; holdParty?: string | null }

export function trimStages<T extends StageLike>(access: OrderAccess, stages: T[], overrides?: StageOverrides): Array<T & { locked: boolean; partial: boolean; cardAccess: Record<string, CardLevel> }> {
  return stages.map((stage) => {
    const readable = canReadStage(access, stage.key)
    const cardAccess = cardLevels(access, stage.key, overrides)
    if (readable) return { ...stage, locked: false, partial: !seesWholeStage(access, stage.key), data: visibleStageData(access, stage.key, stage.data, overrides), cardAccess }
    return { ...stage, locked: true, partial: false, cardAccess, data: visibleStageData(access, stage.key, stage.data, overrides), responsibleName: null, responsibleUserId: null, completedByName: null, holdReason: null, holdParty: stage.holdParty ?? null }
  })
}

type EventLike = { stageKey: string | null; stepKey?: string | null; note: string | null; changes: Array<{ key: string }>; byName?: string | null }

export function trimEvents<T extends EventLike>(access: OrderAccess, events: T[], overrides?: StageOverrides): T[] {
  if (access.full) return events
  return events
    .filter((event) => !event.stageKey || access.view.has(event.stageKey))
    .map((event) => {
      if (!event.stageKey) return { ...event, note: null, changes: [] }
      if (seesWholeStage(access, event.stageKey)) return event
      const def = defFor(event.stageKey, overrides)
      if (!def) return event
      if (event.stepKey && cardLevel(access, event.stageKey, event.stepKey) === 'none') {
        const label = def.steps.find((step) => step.key === event.stepKey)?.label ?? null
        return { ...event, note: label, changes: [] }
      }
      const readable = readableFieldKeys(access, def, overrides)
      return { ...event, changes: event.changes.filter((change) => readable.has(change.key)) }
    })
}
