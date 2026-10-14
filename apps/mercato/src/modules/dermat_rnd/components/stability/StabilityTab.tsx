"use client"

import * as React from 'react'
import { Thermometer } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { SegmentedControl, SegmentedControlItem } from '@open-mercato/ui/primitives/segmented-control'
import { EmptyState } from '@open-mercato/ui/backend/EmptyState'
import { STABILITY_STATUS, dayText } from '../labels'
import { useRdSend } from '../useRdApi'
import type { Trial, TrialAction } from '../types'
import { StabilityDialogs, type StabilityDialog } from './StabilityDialogs'
import { StabilityMatrix } from './StabilityMatrix'

type StabilityTabProps = {
  trials: Trial[]
  selectedId: string | null
  canManage: boolean
  startFor: string | null
  onSelect: (id: string) => void
  onStartHandled: () => void
  onChanged: (select?: string) => Promise<void>
}

const STARTABLE = ['testing', 'passed', 'approved']

export function StabilityTab({ trials, selectedId, canManage, startFor, onSelect, onStartHandled, onChanged }: StabilityTabProps) {
  const t = useT()
  const { send, busy } = useRdSend('dermat-rnd-stability')
  const [dialog, setDialog] = React.useState<StabilityDialog | null>(null)
  const candidates = trials.filter((trial) => trial.stability || STARTABLE.includes(trial.status))
  const trial = candidates.find((entry) => entry.id === selectedId) ?? candidates.find((entry) => entry.stability) ?? candidates[candidates.length - 1] ?? null

  React.useEffect(() => {
    if (!startFor) return
    onSelect(startFor)
    setDialog({ kind: 'start' })
    onStartHandled()
  }, [startFor, onSelect, onStartHandled])

  if (!trial) {
    return <EmptyState icon={<Thermometer className="size-5" aria-hidden="true" />} title={t('dermat_rnd.stability.empty', 'No stability study yet')} description={t('dermat_rnd.stability.emptyHint', 'Send a trial for testing, then start its stability study here.')} />
  }

  const run = async (action: TrialAction, extra: Record<string, unknown>): Promise<boolean> => {
    const done = await send('/api/dermat_rnd/trials/action', 'POST', { id: trial.id, action, ...extra }, { version: trial.updatedAt, resourceKind: 'dermat_rnd.trial', success: t('dermat_rnd.trial.updated', '{code} updated', { code: trial.code }) })
    if (done) await onChanged(trial.id)
    return Boolean(done)
  }

  const study = trial.stability
  const status = STABILITY_STATUS[trial.stabilityStatus]
  const running = trial.stabilityStatus === 'running'

  return (
    <div className="flex flex-col gap-4">
      {candidates.length > 1 ? (
        <SegmentedControl value={trial.id} onValueChange={onSelect} aria-label={t('dermat_rnd.stability.trial', 'Trial')}>
          {candidates.map((entry) => (
            <SegmentedControlItem key={entry.id} value={entry.id}>
              {entry.code}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold">{trial.code}</span>
            <StatusBadge variant={status.variant}>{t(status.key, status.fallback)}</StatusBadge>
          </div>
          {study ? (
            <p className="text-xs text-muted-foreground">
              {t('dermat_rnd.stability.summary', 'Kept on {date} · {conditions} conditions · {readings} readings', { date: dayText(study.startDate), conditions: study.conditions.length, readings: study.readings.length })}
            </p>
          ) : null}
        </div>
        {canManage ? (
          <div className="flex gap-2">
            {trial.stabilityStatus === 'not_started' ? (
              <Button type="button" size="sm" disabled={busy} onClick={() => setDialog({ kind: 'start' })}>
                {t('dermat_rnd.stability.start', 'Start stability')}
              </Button>
            ) : null}
            {running ? (
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setDialog({ kind: 'finish' })}>
                {t('dermat_rnd.stability.finish', 'Finish study')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {study ? <StabilityMatrix study={study} editable={canManage && running} onCell={(condition, day, reading) => setDialog({ kind: 'reading', condition, day, reading })} /> : null}
      {study?.conclusion ? <p className="text-sm">{study.conclusion}</p> : null}
      <StabilityDialogs code={trial.code} dialog={dialog} busy={busy} onClose={() => setDialog(null)} onRun={run} />
    </div>
  )
}
