"use client"

import * as React from 'react'
import { Lock, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { Button } from '@open-mercato/ui/primitives/button'
import { Checkbox } from '@open-mercato/ui/primitives/checkbox'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@open-mercato/ui/primitives/select'
import { apiCall, withScopedApiRequestHeaders } from '@open-mercato/ui/backend/utils/apiCall'
import { buildOptimisticLockHeader } from '@open-mercato/ui/backend/utils/optimisticLock'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { reloadStageSettings } from './useStageSettings'

type FieldType = 'text' | 'number' | 'date' | 'textarea' | 'select'
type BaseStage = {
  key: string
  label: string
  department: string
  hint: string
  dayLimit: number | null
  reopenHours: number
  steps: Array<{ key: string; label: string; optional?: boolean; locked: boolean; owners: string[] }>
  fields: Array<{ key: string; label: string; type: string; required: boolean; shared: boolean; card: string }>
  documents: Array<{ key: string; label: string; required: 'always' | 'eway' | null; card: string }>
}
type ExtraStep = { key: string; label: string; after: string | null; optional?: boolean }
type CardSettings = { owners?: Record<string, string[]>; people?: Record<string, { userId: string; name: string | null }>; fields?: Record<string, string>; documents?: Record<string, string>; labels?: Record<string, string>; extraSteps?: ExtraStep[] }
type Cards = { owners: Record<string, string[]>; people: Record<string, { userId: string; name: string | null }>; fields: Record<string, string>; documents: Record<string, string>; labels: Record<string, string>; extraSteps: ExtraStep[] }
type CardStep = { key: string; label: string; optional?: boolean; locked: boolean; extra: boolean; defaultOwners: string[] }

function cardSteps(stage: BaseStage, cards: Cards, hidden: string[], stageOwner: string[]): CardStep[] {
  const result: CardStep[] = stage.steps.map((step) => ({ key: step.key, label: step.label, optional: step.optional, locked: step.locked, extra: false, defaultOwners: step.owners }))
  for (const step of cards.extraSteps) {
    const at = step.after ? result.findIndex((entry) => entry.key === step.after) : -1
    const added: CardStep = { key: step.key, label: step.label, optional: step.optional, locked: false, extra: true, defaultOwners: stageOwner }
    if (at >= 0) result.splice(at + 1, 0, added)
    else result.push(added)
  }
  return result.filter((step) => !hidden.includes(step.key))
}
type ExtraField = { key: string; label: string; type: FieldType; options?: string[]; required?: boolean }
type ExtraDoc = { key: string; label: string; required: boolean }
type Override = { stageKey: string; label: string | null; dayLimit: number | null; reopenHours: number | null; hiddenSteps: string[]; requiredFields: string[]; sharedFields: string[] | null; extraFields: ExtraField[]; documents: Record<string, 'always' | 'optional'>; extraDocuments: ExtraDoc[]; cardSettings?: CardSettings | null; updatedAt: string; updatedByName: string | null }
type Payload = { stages: BaseStage[]; overrides: Override[]; fieldTypes: FieldType[]; owners: Array<{ feature: string; label: string }> }
type Draft = { label: string; dayLimit: string; reopenHours: string; hiddenSteps: string[]; requiredFields: string[]; sharedFields: string[]; extraFields: Array<ExtraField & { optionsText: string }>; documents: Record<string, 'always' | 'optional'>; extraDocuments: ExtraDoc[]; cards: Cards }

function cardsFor(stage: BaseStage, saved: CardSettings | null | undefined): Cards {
  return {
    owners: Object.fromEntries(stage.steps.map((step) => [step.key, saved?.owners?.[step.key] ?? step.owners])),
    people: { ...(saved?.people ?? {}) },
    fields: Object.fromEntries(stage.fields.map((field) => [field.key, saved?.fields?.[field.key] ?? field.card])),
    documents: Object.fromEntries(stage.documents.map((doc) => [doc.key, saved?.documents?.[doc.key] ?? doc.card])),
    labels: { ...(saved?.labels ?? {}) },
    extraSteps: [...(saved?.extraSteps ?? [])],
  }
}

function changedCards(stage: BaseStage, cards: Cards): CardSettings {
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((entry) => b.includes(entry))
  return {
    owners: Object.fromEntries(Object.entries(cards.owners).filter(([key, value]) => value.length && (cards.extraSteps.some((step) => step.key === key) || !same(value, stage.steps.find((step) => step.key === key)?.owners ?? [])))),
    people: cards.people,
    fields: Object.fromEntries(Object.entries(cards.fields).filter(([key, value]) => value !== stage.fields.find((field) => field.key === key)?.card)),
    documents: Object.fromEntries(Object.entries(cards.documents).filter(([key, value]) => value !== stage.documents.find((doc) => doc.key === key)?.card)),
    labels: Object.fromEntries(Object.entries(cards.labels).filter(([key, value]) => value.trim() && value.trim() !== stage.steps.find((step) => step.key === key)?.label)),
    extraSteps: cards.extraSteps.map((step) => ({ ...step, label: step.label.trim() })),
  }
}

const TYPE_LABEL: Record<FieldType, string> = { text: 'Text', number: 'Number', date: 'Date', textarea: 'Long text', select: 'Dropdown' }

function slug(label: string): string {
  return `x_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 36) || 'field'}`
}

function draftFor(stage: BaseStage, override: Override | undefined): Draft {
  return {
    label: override?.label ?? stage.label,
    dayLimit: String(override?.dayLimit ?? stage.dayLimit ?? ''),
    reopenHours: String(override?.reopenHours ?? stage.reopenHours),
    hiddenSteps: override?.hiddenSteps ?? [],
    requiredFields: override?.requiredFields ?? [],
    sharedFields: override?.sharedFields ?? stage.fields.filter((field) => field.shared).map((field) => field.key),
    extraFields: (override?.extraFields ?? []).map((field) => ({ ...field, optionsText: (field.options ?? []).join(', ') })),
    documents: override?.documents ?? {},
    extraDocuments: override?.extraDocuments ?? [],
    cards: cardsFor(stage, override?.cardSettings),
  }
}

export function StageSettingsPage() {
  const t = useT()
  const { runMutation } = useGuardedMutation({ contextId: 'dermat-stage-settings' })
  const [data, setData] = React.useState<Payload | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<string>('advance')
  const [draft, setDraft] = React.useState<Draft | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [people, setPeople] = React.useState<Array<{ id: string; name: string }>>([])

  React.useEffect(() => {
    apiCall<{ items?: Array<{ id: string; name: string }> }>('/api/dermat_orders/people', undefined, { fallback: { items: [] } }).then((call) => setPeople(call.result?.items ?? []))
  }, [])

  const apply = React.useCallback((payload: Payload, key: string) => {
    setData(payload)
    const stage = payload.stages.find((entry) => entry.key === key) ?? payload.stages[0]
    setSelected(stage.key)
    setDraft(draftFor(stage, payload.overrides.find((entry) => entry.stageKey === stage.key)))
  }, [])

  React.useEffect(() => {
    ;(async () => {
      const call = await apiCall<Payload & { error?: string }>('/api/dermat_orders/stage-settings')
      if (!call.ok || !call.result) {
        setError(call.result?.error ?? t('dermat_orders.stageSettings.loadError', 'Could not load the workflow stages.'))
        return
      }
      apply(call.result, 'advance')
    })()
  }, [apply, t])

  if (error) return <Page><PageBody><ErrorMessage label={error} /></PageBody></Page>
  if (!data || !draft) return <Page><PageBody><LoadingMessage label={t('dermat_orders.stageSettings.loading', 'Loading workflow stages…')} /></PageBody></Page>

  const stage = data.stages.find((entry) => entry.key === selected)!
  const override = data.overrides.find((entry) => entry.stageKey === selected)
  const patch = (value: Partial<Draft>) => setDraft((prev) => (prev ? { ...prev, ...value } : prev))
  const stageOwner = stage.steps[0]?.owners.slice(0, 1) ?? []

  const choose = (key: string) => {
    const next = data.stages.find((entry) => entry.key === key)!
    setSelected(key)
    setDraft(draftFor(next, data.overrides.find((entry) => entry.stageKey === key)))
  }

  const send = async (method: 'PUT' | 'DELETE') => {
    setBusy(true)
    try {
      const body = {
        stageKey: stage.key,
        label: draft.label.trim() || null,
        dayLimit: Number(draft.dayLimit) || null,
        reopenHours: draft.reopenHours.trim() === '' ? null : Number(draft.reopenHours),
        hiddenSteps: draft.hiddenSteps,
        requiredFields: draft.requiredFields,
        sharedFields: draft.sharedFields,
        extraFields: draft.extraFields.map((field) => ({ key: field.key, label: field.label.trim(), type: field.type, required: Boolean(field.required), ...(field.type === 'select' ? { options: field.optionsText.split(',').map((option) => option.trim()).filter(Boolean) } : {}) })),
        documents: draft.documents,
        extraDocuments: draft.extraDocuments.map((doc) => ({ ...doc, label: doc.label.trim() })),
        cardSettings: stage.steps.length ? changedCards(stage, draft.cards) : null,
      }
      const url = method === 'PUT' ? '/api/dermat_orders/stage-settings' : `/api/dermat_orders/stage-settings?stageKey=${stage.key}`
      const request = () => apiCall<Payload & { error?: string }>(url, { method, headers: { 'content-type': 'application/json' }, body: method === 'PUT' ? JSON.stringify(body) : undefined })
      const call = await runMutation({
        context: { resourceKind: 'dermat_orders.stage_setting', resourceId: stage.key },
        mutationPayload: method === 'PUT' ? body : { stageKey: stage.key },
        operation: () => (override?.updatedAt ? withScopedApiRequestHeaders(buildOptimisticLockHeader(override.updatedAt), request) : request()),
      })
      if (!call.ok || !call.result?.stages) {
        flash(call.result?.error ?? t('dermat_orders.stageSettings.saveError', 'Could not save the stage.'), 'error')
        return
      }
      apply(call.result, stage.key)
      await reloadStageSettings()
      flash(method === 'PUT' ? t('dermat_orders.stageSettings.saved', '{stage} saved. Open orders use it right away.', { stage: draft.label || stage.label }) : t('dermat_orders.stageSettings.reset', '{stage} is back to the default.', { stage: stage.label }), 'success')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page>
      <PageBody>
        <div className="flex flex-col gap-5">
          <header className="space-y-1 border-b pb-4">
            <h1 className="text-2xl font-bold tracking-tight">{t('dermat_orders.stageSettings.title', 'Workflow stages')}</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">{t('dermat_orders.stageSettings.lede', 'Rename a stage, change how many days it may take, hide steps you do not use, add your own fields and required documents. Steps marked with a lock drive stock and QC and always stay.')}</p>
          </header>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
            <nav aria-label={t('dermat_orders.stageSettings.stages', 'Stages')} className="flex flex-col gap-1 rounded-lg border bg-card p-2">
              {data.stages.map((entry) => {
                const changed = data.overrides.some((item) => item.stageKey === entry.key)
                const own = data.overrides.find((item) => item.stageKey === entry.key)
                return (
                  <button key={entry.key} type="button" onClick={() => choose(entry.key)} className={cn('flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted', selected === entry.key && 'bg-muted font-medium')}>
                    <span className="min-w-0">
                      <span className="block truncate">{own?.label ?? entry.label}</span>
                      <span className="block text-xs text-muted-foreground">{entry.department}</span>
                    </span>
                    {changed ? <StatusBadge variant="info">{t('dermat_orders.stageSettings.changed', 'Changed')}</StatusBadge> : null}
                  </button>
                )
              })}
            </nav>

            <div className="flex flex-col gap-4 lg:col-span-3">
              <section className="grid grid-cols-1 gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="stage-label">{t('dermat_orders.stageSettings.name', 'Stage name')}</Label>
                  <Input id="stage-label" value={draft.label} onChange={(event) => patch({ label: event.target.value })} />
                  <p className="text-xs text-muted-foreground">{stage.hint}</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="stage-days">{t('dermat_orders.stageSettings.days', 'Days allowed')}</Label>
                  <Input id="stage-days" type="number" min={1} max={365} value={draft.dayLimit} onChange={(event) => patch({ dayLimit: event.target.value })} />
                  <p className="text-xs text-muted-foreground">{t('dermat_orders.stageSettings.daysHint', 'After this the stage shows as late and its team is alerted.')}</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="stage-reopen">{t('dermat_orders.stageSettings.reopen', 'Can be reopened for (hours)')}</Label>
                  <Input id="stage-reopen" type="number" min={0} max={720} value={draft.reopenHours} onChange={(event) => patch({ reopenHours: event.target.value })} />
                  <p className="text-xs text-muted-foreground">{t('dermat_orders.stageSettings.reopenHint', 'After a stage is done, its department can reopen it for this long, as long as the next team has not started. 0 = never. Later only a manager can reopen.')}</p>
                </div>
              </section>

              {stage.steps.length ? (
                <section className="rounded-lg border bg-card p-4">
                  <h2 className="mb-2 text-sm font-semibold">{t('dermat_orders.stageSettings.steps', 'Steps (untick to hide)')}</h2>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {stage.steps.map((step) => (
                      <label key={step.key} htmlFor={`step-${step.key}`} className={cn('flex items-center gap-2 text-sm', step.locked ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer')}>
                        <Checkbox id={`step-${step.key}`} checked={!draft.hiddenSteps.includes(step.key)} disabled={step.locked} onCheckedChange={(checked) => patch({ hiddenSteps: checked === true ? draft.hiddenSteps.filter((key) => key !== step.key) : [...draft.hiddenSteps, step.key] })} />
                        <span className="flex-1">{step.label}{step.optional ? <span className="text-xs text-muted-foreground"> ({t('dermat_orders.stageSettings.optional', 'optional')})</span> : null}</span>
                        {step.locked ? <Lock className="h-3.5 w-3.5" aria-label={t('dermat_orders.stageSettings.locked', 'Always on')} /> : null}
                      </label>
                    ))}
                  </div>
                </section>
              ) : null}

              {stage.steps.length ? (
                <section className="rounded-lg border bg-card p-4">
                  <h2 className="text-sm font-semibold">{t('dermat_orders.stageSettings.cards', 'Who does each step')}</h2>
                  <p className="mb-3 text-xs text-muted-foreground">{t('dermat_orders.stageSettings.cardsHint', 'Each step is a card with its own person. Only the ticked departments can finish it; the default person gets it as soon as it opens.')}</p>
                  <div className="space-y-3">
                    {cardSteps(stage, draft.cards, draft.hiddenSteps, stageOwner).map((step, index) => {
                      const owners = draft.cards.owners[step.key] ?? step.defaultOwners
                      const person = draft.cards.people[step.key]
                      const setCards = (value: Partial<Cards>) => patch({ cards: { ...draft.cards, ...value } })
                      return (
                        <div key={step.key} className="space-y-2 rounded-md border p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="flex min-w-0 flex-1 items-center gap-2">
                              <span className="text-sm font-medium tabular-nums">{index + 1}.</span>
                              <Input
                                aria-label={t('dermat_orders.stageSettings.stepName', 'Step name')}
                                className="h-8 max-w-sm"
                                value={step.extra ? step.label : draft.cards.labels[step.key] ?? step.label}
                                onChange={(event) =>
                                  step.extra
                                    ? setCards({ extraSteps: draft.cards.extraSteps.map((entry) => (entry.key === step.key ? { ...entry, label: event.target.value } : entry)) })
                                    : setCards({ labels: { ...draft.cards.labels, [step.key]: event.target.value } })
                                }
                              />
                              {step.extra ? (
                                <Button type="button" variant="ghost" size="sm" aria-label={t('dermat_orders.stageSettings.removeStep', 'Remove this step')} onClick={() => setCards({ extraSteps: draft.cards.extraSteps.filter((entry) => entry.key !== step.key && entry.after !== step.key) })}>
                                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </Button>
                              ) : null}
                            </span>
                            <Select
                              value={person?.userId ?? '__none'}
                              onValueChange={(value) =>
                                setCards({
                                  people:
                                    value === '__none'
                                      ? Object.fromEntries(Object.entries(draft.cards.people).filter(([key]) => key !== step.key))
                                      : { ...draft.cards.people, [step.key]: { userId: value, name: people.find((entry) => entry.id === value)?.name ?? null } },
                                })
                              }
                            >
                              <SelectTrigger className="h-8 w-auto min-w-48 text-xs" aria-label={t('dermat_orders.stageSettings.defaultPerson', 'Default person for {step}', { step: step.label })}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none">{t('dermat_orders.stageSettings.anyone', 'Anyone in the department')}</SelectItem>
                                {people.map((entry) => (
                                  <SelectItem key={entry.id} value={entry.id}>
                                    {entry.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {data.owners.map((owner) => (
                              <label key={owner.feature} htmlFor={`own-${step.key}-${owner.feature}`} className="flex items-center gap-1.5 text-xs">
                                <Checkbox
                                  id={`own-${step.key}-${owner.feature}`}
                                  checked={owners.includes(owner.feature)}
                                  onCheckedChange={(checked) => setCards({ owners: { ...draft.cards.owners, [step.key]: checked === true ? [...owners, owner.feature] : owners.filter((entry) => entry !== owner.feature) } })}
                                />
                                {owner.label}
                              </label>
                            ))}
                          </div>
                          {!owners.length ? <p className="text-xs text-status-warning-text">{t('dermat_orders.stageSettings.noOwner', 'Tick at least one department, or the stage department keeps it.')}</p> : null}
                        </div>
                      )
                    })}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      const visible = cardSteps(stage, draft.cards, draft.hiddenSteps, stageOwner)
                      let n = draft.cards.extraSteps.length + 1
                      while (draft.cards.extraSteps.some((entry) => entry.key === `x_step_${n}`)) n += 1
                      patch({ cards: { ...draft.cards, extraSteps: [...draft.cards.extraSteps, { key: `x_step_${n}`, label: '', after: visible[visible.length - 1]?.key ?? null }] } })
                    }}
                  >
                    <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                    {t('dermat_orders.stageSettings.addStep', 'Add a step')}
                  </Button>
                  <div className="mt-4 grid grid-cols-1 gap-2 border-t pt-3 sm:grid-cols-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-2">{t('dermat_orders.stageSettings.whichCard', 'Which step asks each field and file')}</h3>
                    {[...stage.fields.map((field) => ({ kind: 'fields' as const, key: field.key, label: field.label })), ...stage.documents.map((doc) => ({ kind: 'documents' as const, key: doc.key, label: `${doc.label} (${t('dermat_orders.stageSettings.file', 'file')})` }))].map((entry) => (
                      <div key={`${entry.kind}-${entry.key}`} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">{entry.label}</span>
                        <Select value={draft.cards[entry.kind][entry.key]} onValueChange={(value) => patch({ cards: { ...draft.cards, [entry.kind]: { ...draft.cards[entry.kind], [entry.key]: value } } })}>
                          <SelectTrigger className="h-8 w-48 shrink-0 text-xs" aria-label={t('dermat_orders.stageSettings.cardFor', 'Step for {name}', { name: entry.label })}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {cardSteps(stage, draft.cards, draft.hiddenSteps, stageOwner).map((step) => (
                              <SelectItem key={step.key} value={step.key}>
                                {step.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="rounded-lg border bg-card p-4">
                <h2 className="mb-2 text-sm font-semibold">{t('dermat_orders.stageSettings.fields', 'Form fields')}</h2>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {stage.fields.map((field) => (
                    <label key={field.key} htmlFor={`field-${field.key}`} className={cn('flex items-center gap-2 text-sm', field.required ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer')}>
                      <Checkbox id={`field-${field.key}`} checked={field.required || draft.requiredFields.includes(field.key)} disabled={field.required} onCheckedChange={(checked) => patch({ requiredFields: checked === true ? [...draft.requiredFields, field.key] : draft.requiredFields.filter((key) => key !== field.key) })} />
                      <span className="flex-1">{field.label}</span>
                      <span className="text-xs text-muted-foreground">{field.required ? t('dermat_orders.stageSettings.alwaysRequired', 'always required') : t('dermat_orders.stageSettings.required', 'required')}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-4 space-y-2 border-t pt-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('dermat_orders.stageSettings.shared', 'Shown to other departments')}</h3>
                  <p className="text-xs text-muted-foreground">{t('dermat_orders.stageSettings.sharedHint', 'Ticked fields are shown to every department on this order. Everything else stays with {department}, Sales and managers.', { department: stage.department })}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {stage.fields.map((field) => (
                      <label key={field.key} htmlFor={`shared-${field.key}`} className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox id={`shared-${field.key}`} checked={draft.sharedFields.includes(field.key)} onCheckedChange={(checked) => patch({ sharedFields: checked === true ? [...draft.sharedFields, field.key] : draft.sharedFields.filter((key) => key !== field.key) })} />
                        <span className="flex-1">{field.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="mt-4 space-y-2 border-t pt-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('dermat_orders.stageSettings.extraFields', 'Your own fields')}</h3>
                  {draft.extraFields.map((field, index) => (
                    <div key={field.key} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-12">
                      <Input aria-label={t('dermat_orders.stageSettings.fieldName', 'Field name')} className="sm:col-span-4" value={field.label} onChange={(event) => patch({ extraFields: draft.extraFields.map((entry, position) => (position === index ? { ...entry, label: event.target.value } : entry)) })} />
                      <div className="sm:col-span-2">
                        <Select value={field.type} onValueChange={(value) => patch({ extraFields: draft.extraFields.map((entry, position) => (position === index ? { ...entry, type: value as FieldType } : entry)) })}>
                          <SelectTrigger aria-label={t('dermat_orders.stageSettings.fieldType', 'Field type')}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {data.fieldTypes.map((type) => <SelectItem key={type} value={type}>{TYPE_LABEL[type]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input aria-label={t('dermat_orders.stageSettings.choices', 'Choices')} className="sm:col-span-3" disabled={field.type !== 'select'} placeholder={field.type === 'select' ? t('dermat_orders.stageSettings.choicesHint', 'Choice 1, Choice 2') : ''} value={field.optionsText} onChange={(event) => patch({ extraFields: draft.extraFields.map((entry, position) => (position === index ? { ...entry, optionsText: event.target.value } : entry)) })} />
                      <label htmlFor={`extra-req-${field.key}`} className="flex items-center gap-1.5 text-sm sm:col-span-2">
                        <Checkbox id={`extra-req-${field.key}`} checked={Boolean(field.required)} onCheckedChange={(checked) => patch({ extraFields: draft.extraFields.map((entry, position) => (position === index ? { ...entry, required: checked === true } : entry)) })} />
                        {t('dermat_orders.stageSettings.required', 'required')}
                      </label>
                      <Button type="button" variant="ghost" size="sm" className="sm:col-span-1" onClick={() => patch({ extraFields: draft.extraFields.filter((_, position) => position !== index) })} aria-label={t('dermat_orders.stageSettings.removeField', 'Remove field')}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const base = slug(`field ${draft.extraFields.length + 1}`)
                      let key = base
                      let n = 2
                      while (draft.extraFields.some((entry) => entry.key === key)) key = `${base}_${n++}`
                      patch({ extraFields: [...draft.extraFields, { key, label: '', type: 'text', required: false, optionsText: '' }] })
                    }}
                  >
                    <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                    {t('dermat_orders.stageSettings.addField', 'Add field')}
                  </Button>
                </div>
              </section>

              <section className="rounded-lg border bg-card p-4">
                <h2 className="mb-2 text-sm font-semibold">{t('dermat_orders.stageSettings.documents', 'Documents to upload')}</h2>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {stage.documents.length ? stage.documents.map((doc) => {
                    const eway = doc.required === 'eway'
                    const required = eway ? true : draft.documents[doc.key] ? draft.documents[doc.key] === 'always' : doc.required === 'always'
                    return (
                      <label key={doc.key} htmlFor={`doc-${doc.key}`} className={cn('flex items-center gap-2 text-sm', eway ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer')}>
                        <Checkbox id={`doc-${doc.key}`} checked={required} disabled={eway} onCheckedChange={(checked) => patch({ documents: { ...draft.documents, [doc.key]: checked === true ? 'always' : 'optional' } })} />
                        <span className="flex-1">{doc.label}</span>
                        <span className="text-xs text-muted-foreground">{eway ? t('dermat_orders.stageSettings.ewayRule', 'above ₹50,000') : t('dermat_orders.stageSettings.mustUpload', 'must upload')}</span>
                      </label>
                    )
                  }) : <p className="text-sm text-muted-foreground">{t('dermat_orders.stageSettings.noDocs', 'No documents on this stage yet.')}</p>}
                </div>
                <div className="mt-4 space-y-2 border-t pt-3">
                  {draft.extraDocuments.map((doc, index) => (
                    <div key={doc.key} className="flex flex-wrap items-center gap-2">
                      <Input aria-label={t('dermat_orders.stageSettings.docName', 'Document name')} className="max-w-sm" value={doc.label} onChange={(event) => patch({ extraDocuments: draft.extraDocuments.map((entry, position) => (position === index ? { ...entry, label: event.target.value } : entry)) })} />
                      <label htmlFor={`xdoc-${doc.key}`} className="flex items-center gap-1.5 text-sm">
                        <Checkbox id={`xdoc-${doc.key}`} checked={doc.required} onCheckedChange={(checked) => patch({ extraDocuments: draft.extraDocuments.map((entry, position) => (position === index ? { ...entry, required: checked === true } : entry)) })} />
                        {t('dermat_orders.stageSettings.mustUpload', 'must upload')}
                      </label>
                      <Button type="button" variant="ghost" size="sm" onClick={() => patch({ extraDocuments: draft.extraDocuments.filter((_, position) => position !== index) })} aria-label={t('dermat_orders.stageSettings.removeDoc', 'Remove document')}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      let n = draft.extraDocuments.length + 1
                      while (draft.extraDocuments.some((entry) => entry.key === `x_doc_${n}`)) n += 1
                      patch({ extraDocuments: [...draft.extraDocuments, { key: `x_doc_${n}`, label: '', required: false }] })
                    }}
                  >
                    <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                    {t('dermat_orders.stageSettings.addDoc', 'Add document')}
                  </Button>
                </div>
              </section>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">{override ? t('dermat_orders.stageSettings.lastChange', 'Last changed by {name}', { name: override.updatedByName ?? '—' }) : t('dermat_orders.stageSettings.default', 'Using the default setup')}</p>
                <div className="flex gap-2">
                  {override ? (
                    <Button type="button" variant="outline" onClick={() => void send('DELETE')} disabled={busy}>
                      <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
                      {t('dermat_orders.stageSettings.resetButton', 'Back to default')}
                    </Button>
                  ) : null}
                  <Button type="button" onClick={() => void send('PUT')} disabled={busy}>
                    {busy ? t('dermat_orders.stageSettings.saving', 'Saving…') : t('dermat_orders.stageSettings.save', 'Save stage')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageBody>
    </Page>
  )
}
