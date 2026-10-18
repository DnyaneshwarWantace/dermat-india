"use client"

import * as React from 'react'
import { FlaskConical } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { EmptyState } from '@open-mercato/ui/backend/EmptyState'
import type { RdRequest, Trial } from '../types'
import { TrialList } from './TrialList'
import { TrialPanel } from './TrialPanel'

type TrialsTabProps = {
  request: RdRequest
  trials: Trial[]
  selectedId: string | null
  canManage: boolean
  canMakeBom: boolean
  canRequest: boolean
  busy: boolean
  onSelect: (id: string) => void
  onNewTrial: () => void
  onChanged: (select?: string) => Promise<void>
  onOpenStability: (trialId: string) => void
  onSendSample: (trialId: string) => void
}

export function TrialsTab({ request, trials, selectedId, canManage, canMakeBom, canRequest, busy, onSelect, onNewTrial, onChanged, onOpenStability, onSendSample }: TrialsTabProps) {
  const t = useT()
  const selected = trials.find((trial) => trial.id === selectedId) ?? trials[trials.length - 1] ?? null
  if (!selected) {
    return (
      <EmptyState
        icon={<FlaskConical className="size-5" aria-hidden="true" />}
        title={t('dermat_rnd.trials.empty', 'No trial batches yet')}
        description={t('dermat_rnd.trials.emptyHint', 'Each lab batch R&D makes for this request is a trial: its formula, its lab results and its stability study.')}
        actions={canManage ? <Button type="button" onClick={onNewTrial} disabled={busy}>{t('dermat_rnd.newTrialFirst', 'Make the first trial')}</Button> : undefined}
      />
    )
  }
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
      <aside className="flex flex-col gap-2 lg:col-span-3">
        <TrialList trials={trials} selectedId={selected.id} approvedId={request.approvedTrialId} onSelect={onSelect} />
      </aside>
      <div className="lg:col-span-9">
        <TrialPanel key={selected.id} request={request} trial={selected} canManage={canManage} canMakeBom={canMakeBom} canRequest={canRequest} onChanged={onChanged} onOpenStability={() => onOpenStability(selected.id)} onSendSample={onSendSample} />
      </div>
    </div>
  )
}
