'use client'

import * as React from 'react'
import Link from 'next/link'
import { Check, CheckCircle2, Clock, FileText, Lock, MinusCircle, Undo2, UserRound } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { Button } from '@open-mercato/ui/primitives/button'
import { Label } from '@open-mercato/ui/primitives/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@open-mercato/ui/primitives/select'
import { MAIN_CARD, OWNER_NAMES, cardFieldKeys, documentCard, stageWorkFeature, stepOwners, type StageDef, type StageField } from '../lib/stages'
import { useGranted } from '../../dermat_departments/components/useGranted'
import { StageDocuments } from './StageDocuments'
import { formatDate, formatDateTime, formatQty } from './format'
import { subStages, type SubStage } from './subStages'
import type { Order, Stage, StageDocumentStatus } from './types'

type StepCardsProps = {
  order: Order
  stage: Stage
  def: StageDef
  editable: boolean
  busy: boolean
  fields: StageField[]
  renderInput: (field: StageField) => React.ReactNode
  payloadFor: (keys: string[]) => Record<string, string | number | null>
  onStep: (stepKey: string, done: boolean, data?: Record<string, string | number | null>) => Promise<boolean>
  onSave: (stepKey: string, data: Record<string, string | number | null>) => Promise<boolean>
  onCompleteMain: (data: Record<string, string | number | null>) => Promise<boolean>
  completeLabel: string
  extras?: Record<string, React.ReactNode>
  people?: Array<{ id: string; name: string }>
  canAssign?: boolean
  onAssign?: (stepKey: string, userId: string | null) => Promise<boolean>
}

function shown(field: StageField, value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  if (field.type === 'date') return formatDate(String(value))
  if (field.type === 'number') return formatQty(Number(value), 2)
  return String(value)
}

export function StepCards({ order, stage, def, editable, busy, fields, renderInput, payloadFor, onStep, onSave, onCompleteMain, completeLabel, extras = {}, people = [], canAssign = false, onAssign }: StepCardsProps) {
  const t = useT()
  const granted = useGranted()
  const allDocs = order.documents?.[stage.key] ?? []
  const working = stage.status === 'open' || stage.status === 'on_hold'
  const fieldByKey = new Map(fields.map((field) => [field.key, field]))

  const ownersOf = (key: string) => (key === MAIN_CARD ? [] : stepOwners(def.key, def.steps.find((step) => step.key === key) ?? { key }))
  const canDo = (key: string) => {
    if (!editable) return false
    if (key === MAIN_CARD) return granted.has(stageWorkFeature(def.key))
    return ownersOf(key).some((feature) => granted.has(feature))
  }
  const ownerText = (key: string) => {
    const owners = ownersOf(key).map((feature) => OWNER_NAMES[feature] ?? feature)
    return owners.length ? owners.join(' / ') : def.department
  }

  if (!def.steps.length) {
    const keys = fields.map((field) => field.key)
    const finished = stage.status === 'done' || stage.status === 'skipped'
    return (
      <Card
        index={1}
        title={def.label}
        owner={def.department}
        state={finished ? 'done' : working ? 'current' : 'pending'}
        stamp={finished ? [stage.completedByName, stage.completedAt ? formatDateTime(stage.completedAt) : null].filter(Boolean).join(' · ') : null}
      >
        <CardBody
          stage={stage}
          order={order}
          keys={keys}
          fieldByKey={fieldByKey}
          docs={allDocs}
          active={canDo(MAIN_CARD) && working}
          renderInput={renderInput}
        />
        {canDo(MAIN_CARD) && stage.status === 'open' ? (
          <div className="flex justify-end">
            <Button type="button" size="sm" disabled={busy} onClick={() => void onCompleteMain(payloadFor(keys))}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {completeLabel}
            </Button>
          </div>
        ) : null}
      </Card>
    )
  }

  const cardPeople = (stage.data?.__people as Record<string, { userId: string; name: string | null }> | undefined) ?? {}
  const personOf = (key: string) => cardPeople[key]?.name ?? stage.responsibleName ?? null
  const items = subStages(order, stage)
  const lastDone = [...items].reverse().find((item) => item.kind === 'step' && item.status === 'done')
  const counted = items.filter((item) => item.status !== 'na' && !item.optional)
  const doneCount = counted.filter((item) => item.status === 'done').length

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        {t('dermat_orders.cards.title', 'Steps of this stage · {done} of {total} done', { done: doneCount, total: counted.length })}
      </p>
      <ol className="space-y-2">
        {items.map((item, index) => {
          if (item.kind !== 'step') return <AutoCard key={item.key} item={item} index={index + 1} />
          const keys = cardFieldKeys(def, item.key)
          const docs = allDocs.filter((doc) => documentCard(def, doc) === item.key)
          const mine = canDo(item.key)
          const active = item.status === 'current' || (item.optional && item.status === 'pending' && working)
          const isLast = index === items.length - 1 || items.slice(index + 1).every((next) => next.status === 'na' || next.optional || next.kind !== 'step')
          return (
            <Card
              key={item.key}
              index={index + 1}
              title={item.label}
              owner={ownerText(item.key)}
              optional={item.optional}
              state={item.status === 'done' ? 'done' : item.status === 'na' ? 'na' : active ? 'current' : 'pending'}
              stamp={item.status === 'done' ? [item.by, item.at ? formatDateTime(item.at) : null].filter(Boolean).join(' · ') : null}
              waiting={active && !mine ? t('dermat_orders.cards.withOwner', 'With {owner}{person}', { owner: ownerText(item.key), person: personOf(item.key) ? ` · ${personOf(item.key)}` : '' }) : null}
              person={
                active || item.status === 'pending' ? (
                  canAssign && onAssign && working ? (
                    <Select value={cardPeople[item.key]?.userId ?? '__none'} onValueChange={(value) => void onAssign(item.key, value === '__none' ? null : value)}>
                      <SelectTrigger className="h-7 w-auto min-w-36 text-xs" aria-label={t('dermat_orders.cards.person', 'Person for {card}', { card: item.label })}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">{stage.responsibleName ? t('dermat_orders.cards.stagePerson', 'Stage person ({name})', { name: stage.responsibleName }) : t('dermat_orders.sheet.nobody', 'Not assigned')}</SelectItem>
                        {people.map((person) => (
                          <SelectItem key={person.id} value={person.id}>
                            {person.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : personOf(item.key) && !(active && !mine) ? (
                    <span className="text-xs text-muted-foreground">{personOf(item.key)}</span>
                  ) : null
                ) : null
              }
              action={
                item.status === 'done' && mine && lastDone?.key === item.key && stage.status !== 'done' ? (
                  <Button type="button" variant="ghost" size="sm" className="h-7" disabled={busy} onClick={() => void onStep(item.key, false)}>
                    <Undo2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                    {t('dermat_orders.sub.undo', 'Undo')}
                  </Button>
                ) : null
              }
            >
              {item.status === 'done' || (active && (keys.length || docs.length)) ? (
                <CardBody stage={stage} order={order} keys={keys} fieldByKey={fieldByKey} docs={docs} active={active && mine} renderInput={renderInput} />
              ) : null}
              {(active || item.status === 'done') && extras[item.key] ? extras[item.key] : null}
              {active && mine ? (
                <div className="flex flex-wrap justify-end gap-2">
                  {keys.length ? (
                    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void onSave(item.key, payloadFor(keys))}>
                      {t('dermat_orders.sheet.save', 'Save')}
                    </Button>
                  ) : null}
                  <Button type="button" size="sm" disabled={busy} onClick={() => void onStep(item.key, true, payloadFor(keys))}>
                    <Check className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    {isLast ? t('dermat_orders.cards.doneLast', 'Done — finish {stage}', { stage: def.label }) : t('dermat_orders.cards.done', 'Done')}
                  </Button>
                </div>
              ) : null}
            </Card>
          )
        })}
      </ol>
    </div>
  )
}

type CardState = 'done' | 'current' | 'pending' | 'na'

function Card({ index, title, owner, optional, state, stamp, waiting, action, person, children }: { index: number; title: string; owner: string; optional?: boolean; state: CardState; stamp: string | null; waiting?: string | null; action?: React.ReactNode; person?: React.ReactNode; children?: React.ReactNode }) {
  const t = useT()
  const icon =
    state === 'done' ? (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-status-success-icon text-white">
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    ) : state === 'current' ? (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-status-warning-icon text-xs font-bold text-white">{index}</span>
    ) : state === 'na' ? (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <MinusCircle className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    ) : (
      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-border bg-card text-muted-foreground">
        <Lock className="h-3 w-3" aria-hidden="true" />
      </span>
    )
  return (
    <li className={cn('rounded-lg border bg-card', state === 'current' && 'border-status-warning-border', state === 'pending' && 'opacity-70')}>
      <div className="flex items-start gap-3 p-3">
        <span className="shrink-0">{icon}</span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={cn('text-sm', state === 'current' ? 'font-semibold' : 'font-medium')}>
              {title}
              {optional ? <span className="ml-1 text-xs font-normal text-muted-foreground">{t('dermat_orders.sheet.optional', '(if needed)')}</span> : null}
            </p>
            <span className="flex items-center gap-2">
              {person}
              {action}
            </span>
          </div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <UserRound className="h-3 w-3" aria-hidden="true" />
              {owner}
            </span>
            {stamp ? (
              <span className="inline-flex items-center gap-1 text-status-success-text">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                {stamp}
              </span>
            ) : null}
            {waiting ? (
              <span className="inline-flex items-center gap-1 text-status-warning-text">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {waiting}
              </span>
            ) : null}
          </p>
        </div>
      </div>
      {React.Children.toArray(children).length ? <div className="space-y-3 border-t px-3 pb-3 pt-3 sm:pl-12">{children}</div> : null}
    </li>
  )
}

function CardBody({ stage, order, keys, fieldByKey, docs, active, renderInput }: { stage: Stage; order: Order; keys: string[]; fieldByKey: Map<string, StageField>; docs: StageDocumentStatus[]; active: boolean; renderInput: (field: StageField) => React.ReactNode }) {
  const fieldsHere = keys.map((key) => fieldByKey.get(key)).filter((field): field is StageField => Boolean(field))
  const readOnly = fieldsHere.map((field) => ({ field, value: shown(field, stage.data?.[field.key]) })).filter((entry) => entry.value !== null)
  return (
    <>
      {active ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fieldsHere.map((field) => (
            <div key={field.key} className={cn('space-y-1.5', field.type === 'textarea' && 'sm:col-span-2')}>
              <Label className="text-xs text-muted-foreground">
                {field.label}
                {field.required ? ' *' : ''}
              </Label>
              {renderInput(field)}
            </div>
          ))}
        </div>
      ) : readOnly.length ? (
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          {readOnly.map(({ field, value }) => (
            <div key={field.key} className="flex flex-col">
              <dt className="text-xs text-muted-foreground">{field.label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {docs.length && stage.status !== 'waiting' ? (
        active ? (
          <StageDocuments orderId={order.id} stageKey={stage.key} documents={docs} editable showOther={false} />
        ) : (
          <ul className="flex flex-wrap gap-2 text-xs">
            {docs.map((doc) => (
              <li key={doc.key} className={cn('inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5', doc.count ? 'bg-status-success-bg text-status-success-text' : 'bg-muted text-muted-foreground')}>
                <FileText className="h-3 w-3" aria-hidden="true" />
                {doc.label} · {doc.count}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </>
  )
}

function AutoCard({ item, index }: { item: SubStage; index: number }) {
  const t = useT()
  return (
    <Card
      index={index}
      title={item.label}
      owner={item.kind === 'store' ? t('dermat_orders.sub.byStoreLong', 'Store (from the store request)') : t('dermat_orders.sub.byQcLong', 'QC (from the QC check)')}
      state={item.status === 'done' ? 'done' : item.status === 'na' ? 'na' : item.status === 'current' ? 'current' : 'pending'}
      stamp={null}
    >
      {item.detail || item.links.length ? (
        <div className="space-y-1 text-xs">
          {item.detail ? <p className="text-muted-foreground">{item.detail}</p> : null}
          {item.links.length && item.status !== 'na' ? (
            <p className="flex flex-wrap gap-2">
              {item.links.map((link) => (
                <Link key={link.href} href={link.href} className="font-mono text-primary hover:underline">
                  {link.label} →
                </Link>
              ))}
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  )
}

export default StepCards
