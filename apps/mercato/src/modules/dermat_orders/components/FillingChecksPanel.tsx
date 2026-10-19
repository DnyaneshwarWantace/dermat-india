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
import type { Stage } from './types'

type Check = { at: string; by: string | null; weightOk: boolean; leakOk: boolean; weightG: number | null; note: string | null }

function clock(value: string): string {
  return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export function FillingChecksPanel({ stage, editable, busy, onCheck }: { stage: Stage; editable: boolean; busy: boolean; onCheck: (data: Record<string, string | number | null>, note: string) => Promise<boolean> }) {
  const t = useT()
  const limits = productionLimits(useListOptions('production_limits'))
  const steps = stepStates(stage.data)
  const checks = (Array.isArray(stage.data?.__checks) ? (stage.data?.__checks as Check[]) : []).slice().reverse()
  const [weight, setWeight] = React.useState<'ok' | 'not_ok'>('ok')
  const [leak, setLeak] = React.useState<'ok' | 'not_ok'>('ok')
  const [grams, setGrams] = React.useState('')
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
  const failed = checks.filter((check) => !check.weightOk || !check.leakOk).length

  const add = async () => {
    const ok = await onCheck({ weight_ok: weight, leak_ok: leak, weight_g: grams.trim() === '' ? null : Number(grams) }, note.trim())
    if (ok) {
      setWeight('ok')
      setLeak('ok')
      setGrams('')
      setNote('')
    }
  }

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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>{t('dermat_orders.fillChecks.weight', 'Fill weight')}</Label>
              <SegmentedControl value={weight} onValueChange={(value) => setWeight(value as typeof weight)} aria-label={t('dermat_orders.fillChecks.weight', 'Fill weight')}>
                <SegmentedControlItem value="ok">OK</SegmentedControlItem>
                <SegmentedControlItem value="not_ok">{t('dermat_orders.fillChecks.notOk', 'Not OK')}</SegmentedControlItem>
              </SegmentedControl>
            </div>
            <div className="space-y-1.5">
              <Label>{t('dermat_orders.fillChecks.leak', 'Leak test')}</Label>
              <SegmentedControl value={leak} onValueChange={(value) => setLeak(value as typeof leak)} aria-label={t('dermat_orders.fillChecks.leak', 'Leak test')}>
                <SegmentedControlItem value="ok">OK</SegmentedControlItem>
                <SegmentedControlItem value="not_ok">{t('dermat_orders.fillChecks.notOk', 'Not OK')}</SegmentedControlItem>
              </SegmentedControl>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fill-grams">{t('dermat_orders.fillChecks.grams', 'Weight (g)')}</Label>
              <Input id="fill-grams" type="number" inputMode="decimal" step="any" value={grams} onChange={(event) => setGrams(event.target.value)} />
            </div>
          </div>
          {weight === 'not_ok' || leak === 'not_ok' ? (
            <div className="space-y-1.5">
              <Label htmlFor="fill-note">{t('dermat_orders.fillChecks.what', 'What was wrong and what was done *')}</Label>
              <Input id="fill-note" value={note} onChange={(event) => setNote(event.target.value)} />
            </div>
          ) : null}
          <Button type="button" size="sm" className="w-full sm:w-auto" disabled={busy || ((weight === 'not_ok' || leak === 'not_ok') && !note.trim())} onClick={() => void add()}>
            {t('dermat_orders.fillChecks.add', 'Save check')}
          </Button>
        </div>
      ) : null}
      {checks.length ? (
        <ul className="divide-y rounded-md border text-xs">
          {checks.map((check, index) => {
            const ok = check.weightOk && check.leakOk
            return (
              <li key={`${check.at}-${index}`} className="flex items-start gap-2 px-2.5 py-1.5">
                {ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-success-icon" aria-hidden="true" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-error-icon" aria-hidden="true" />}
                <span className="min-w-0 flex-1">
                  <span className="font-medium tabular-nums">{clock(check.at)}</span>
                  {' · '}
                  {t('dermat_orders.fillChecks.line', 'weight {weight}{grams} · leak {leak}', { weight: check.weightOk ? 'OK' : 'NOT OK', grams: check.weightG !== null ? ` (${check.weightG} g)` : '', leak: check.leakOk ? 'OK' : 'NOT OK' })}
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
