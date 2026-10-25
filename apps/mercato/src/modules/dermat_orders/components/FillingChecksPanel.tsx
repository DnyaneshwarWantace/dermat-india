'use client'

import * as React from 'react'
import { AlarmClock, CheckCircle2, ClipboardCheck, XCircle } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { SegmentedControl, SegmentedControlItem } from '@open-mercato/ui/primitives/segmented-control'
import { productionLimits, stepStates } from '../lib/stages'
import { useListOptions } from '../../dermat_lists/components/useListOptions'
import { weightLimits, type FillingCheck } from '../lib/bpr'
import type { Stage } from './types'

function clock(value: string): string {
  return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export function FillingChecksPanel({ stage, editable, busy, onCheck }: { stage: Stage; editable: boolean; busy: boolean; onCheck: (data: Record<string, string | number | null>, note: string) => Promise<boolean> }) {
  const t = useT()
  const limits = productionLimits(useListOptions('production_limits'))
  const steps = stepStates(stage.data)
  const checks = (Array.isArray(stage.data?.__checks) ? (stage.data?.__checks as FillingCheck[]) : []).slice().reverse()
  const range = weightLimits(stage.data)
  const [weights, setWeights] = React.useState(['', '', '', ''])
  const [weight, setWeight] = React.useState<'ok' | 'not_ok'>('ok')
  const [bottle, setBottle] = React.useState<'ok' | 'not_ok'>('ok')
  const [cap, setCap] = React.useState<'ok' | 'not_ok'>('ok')
  const [temp, setTemp] = React.useState('')
  const [rh, setRh] = React.useState('')
  const [note, setNote] = React.useState('')
  const [now, setNow] = React.useState(() => Date.now())

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  if (!steps.started?.done) return null
  const running = !steps.filled?.done
  const last = checks[0]?.at ?? steps.started.at ?? null
  const dueAt = last ? new Date(last).getTime() + limits.checkMinutes * 60_000 : null
  const overdue = running && dueAt !== null && now > dueAt
  const isOk = (check: FillingCheck) => check.weightOk && check.bottleOk !== false && check.capOk !== false && check.leakOk !== false
  const failed = checks.filter((check) => !isOk(check)).length
  const typed = weights.map((value) => value.trim()).filter(Boolean).map(Number)
  const outside = range ? typed.some((value) => value < range.min || value > range.max) : weight === 'not_ok'
  const anyBad = outside || bottle === 'not_ok' || cap === 'not_ok'

  const add = async () => {
    const data: Record<string, string | number | null> = { bottle_ok: bottle, cap_ok: cap, temp: temp.trim() === '' ? null : Number(temp), rh: rh.trim() === '' ? null : Number(rh) }
    weights.forEach((value, index) => {
      data[`w${index + 1}`] = value.trim() === '' ? null : Number(value)
    })
    if (!range || !typed.length) data.weight_ok = weight
    const ok = await onCheck(data, note.trim())
    if (ok) {
      setWeights(['', '', '', ''])
      setWeight('ok')
      setBottle('ok')
      setCap('ok')
      setNote('')
    }
  }

  const toggle = (label: string, value: 'ok' | 'not_ok', set: (next: 'ok' | 'not_ok') => void) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <SegmentedControl value={value} onValueChange={(next) => set(next as 'ok' | 'not_ok')} aria-label={label}>
        <SegmentedControlItem value="ok">OK</SegmentedControlItem>
        <SegmentedControlItem value="not_ok">{t('dermat_orders.fillChecks.notOk', 'Not OK')}</SegmentedControlItem>
      </SegmentedControl>
    </div>
  )

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <ClipboardCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {t('dermat_orders.fillChecks.title', 'Checks every {minutes} minutes', { minutes: limits.checkMinutes })}
        </p>
        <span className="text-xs text-muted-foreground">
          {t('dermat_orders.fillChecks.count', '{count} checks', { count: checks.length })}
          {failed ? <span className="ml-1 text-status-error-text">· {t('dermat_orders.fillChecks.failed', '{count} not OK', { count: failed })}</span> : null}
        </span>
      </div>
      {running && dueAt ? (
        <p className={cn('flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs', overdue ? 'bg-status-warning-bg font-semibold text-status-warning-text' : 'bg-muted/40 text-muted-foreground')}>
          <AlarmClock className="h-3.5 w-3.5" aria-hidden="true" />
          {overdue ? t('dermat_orders.fillChecks.overdue', 'Check is due now (was due {time})', { time: clock(new Date(dueAt).toISOString()) }) : t('dermat_orders.fillChecks.next', 'Next check at {time}', { time: clock(new Date(dueAt).toISOString()) })}
        </p>
      ) : null}
      {running && editable ? (
        <div className="space-y-3 rounded-md bg-muted/30 p-3">
          <div className="space-y-1.5">
            <Label>
              {range
                ? t('dermat_orders.fillChecks.weightsRange', 'Weights of 4 pieces (g) · allowed {min}–{max} g', { min: range.min, max: range.max })
                : t('dermat_orders.fillChecks.weights', 'Weights of 4 pieces (g)')}
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {weights.map((value, index) => (
                <Input
                  key={index}
                  id={`fill-w${index + 1}`}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  aria-label={t('dermat_orders.fillChecks.weightN', 'Weight {n}', { n: index + 1 })}
                  value={value}
                  onChange={(event) => setWeights((current) => current.map((entry, position) => (position === index ? event.target.value : entry)))}
                />
              ))}
            </div>
            {range ? null : <p className="text-xs text-muted-foreground">{t('dermat_orders.fillChecks.noRange', 'Fill in the empty and filled bottle weight and the allowed % under "Filling started" to check weights automatically.')}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {range && typed.length ? null : toggle(t('dermat_orders.fillChecks.weight', 'Fill weight'), weight, setWeight)}
            {toggle(t('dermat_orders.fillChecks.bottle', 'Bottle / tube quality'), bottle, setBottle)}
            {toggle(t('dermat_orders.fillChecks.cap', 'Capping / crimping'), cap, setCap)}
            <div className="space-y-1.5">
              <Label htmlFor="fill-temp">{t('dermat_orders.fillChecks.temp', 'Area °C')}</Label>
              <Input id="fill-temp" type="number" inputMode="decimal" step="any" value={temp} onChange={(event) => setTemp(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fill-rh">{t('dermat_orders.fillChecks.rh', '% RH')}</Label>
              <Input id="fill-rh" type="number" inputMode="decimal" step="any" value={rh} onChange={(event) => setRh(event.target.value)} />
            </div>
          </div>
          {anyBad ? (
            <div className="space-y-1.5">
              <Label htmlFor="fill-note">{t('dermat_orders.fillChecks.what', 'What was wrong and what was done *')}</Label>
              <Input id="fill-note" value={note} onChange={(event) => setNote(event.target.value)} />
            </div>
          ) : null}
          <Button type="button" size="sm" className="w-full sm:w-auto" disabled={busy || (anyBad && !note.trim())} onClick={() => void add()}>
            {t('dermat_orders.fillChecks.add', 'Save check')}
          </Button>
        </div>
      ) : null}
      {checks.length ? (
        <ul className="divide-y rounded-md border text-xs">
          {checks.map((check, index) => {
            const ok = isOk(check)
            return (
              <li key={`${check.at}-${index}`} className="flex items-start gap-2 px-2.5 py-1.5">
                {ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-success-icon" aria-hidden="true" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-error-icon" aria-hidden="true" />}
                <span className="min-w-0 flex-1">
                  <span className="font-medium tabular-nums">{clock(check.at)}</span>
                  {' · '}
                  {[
                    `${t('dermat_orders.fillChecks.weightShort', 'weight')} ${check.weightOk ? 'OK' : 'NOT OK'}${check.weights?.length ? ` (${check.weights.join(', ')} · avg ${check.avg} g)` : check.weightG != null ? ` (${check.weightG} g)` : ''}`,
                    check.bottleOk === undefined ? null : `${t('dermat_orders.fillChecks.bottleShort', 'bottle')} ${check.bottleOk ? 'OK' : 'NOT OK'}`,
                    check.capOk === undefined ? null : `${t('dermat_orders.fillChecks.capShort', 'capping')} ${check.capOk ? 'OK' : 'NOT OK'}`,
                    check.leakOk === undefined ? null : `${t('dermat_orders.fillChecks.leakShort', 'leak')} ${check.leakOk ? 'OK' : 'NOT OK'}`,
                    check.temp != null ? `${check.temp} °C` : null,
                    check.rh != null ? `${check.rh}% RH` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  {check.note ? <span className="block text-muted-foreground">{check.note}</span> : null}
                </span>
                <span className="shrink-0 text-muted-foreground">{check.by ?? ''}</span>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

export default FillingChecksPanel
