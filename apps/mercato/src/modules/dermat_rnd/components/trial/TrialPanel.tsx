"use client"

import * as React from 'react'
import { CheckCircle2, Copy, FileStack, FlaskConical, RotateCcw, Save, Send, XCircle } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Section } from '../shared/Section'
import { STABILITY_STATUS, TRIAL_STATUS } from '../labels'
import { useRdSend } from '../useRdApi'
import type { RdRequest, Trial, TrialAction } from '../types'
import { FormulaEditor } from './FormulaEditor'
import { LabResultsView } from './LabResultsView'
import { TrialDetails, type TrialDraft } from './TrialDetails'
import { TrialDialogs, type TrialDialogKind } from './TrialDialogs'
import { totalsOf } from './formula'

type TrialPanelProps = {
  request: RdRequest
  trial: Trial
  canManage: boolean
  canMakeBom: boolean
  onChanged: (select?: string) => Promise<void>
  onOpenStability: () => void
}

function draftOf(trial: Trial): TrialDraft {
  return { batchDate: trial.batchDate, chemistName: trial.chemistName, batchSize: trial.batchSize, batchUnit: trial.batchUnit, aim: trial.aim, procedure: trial.procedure, formula: trial.formula }
}

export function TrialPanel({ request, trial, canManage, canMakeBom, onChanged, onOpenStability }: TrialPanelProps) {
  const t = useT()
  const { send, busy } = useRdSend(`dermat-rnd-trial-${trial.id}`)
  const [draft, setDraft] = React.useState<TrialDraft>(() => draftOf(trial))
  const [dialog, setDialog] = React.useState<TrialDialogKind | null>(null)
  const editable = canManage && trial.status === 'draft'
  const status = TRIAL_STATUS[trial.status]
  const stability = STABILITY_STATUS[trial.stabilityStatus]

  React.useEffect(() => setDraft(draftOf(trial)), [trial])

  const save = async (quiet = false): Promise<Trial | null> =>
    send<Trial>('/api/dermat_rnd/trials', 'PUT', { id: trial.id, ...draft, formula: draft.formula.map((line) => ({ id: line.id, phase: line.phase, productId: line.productId, code: line.code, name: line.name, function: line.function, percent: line.percent, isBalance: line.isBalance, note: line.note })) }, { version: trial.updatedAt, resourceKind: 'dermat_rnd.trial', success: quiet ? undefined : t('dermat_rnd.trial.saved', '{code} saved', { code: trial.code }) })

  const run = async (action: TrialAction, extra: Record<string, unknown> = {}, version = trial.updatedAt): Promise<boolean> => {
    const done = await send<Trial & { bomId?: string | null }>('/api/dermat_rnd/trials/action', 'POST', { id: trial.id, action, ...extra }, { version, resourceKind: 'dermat_rnd.trial', success: t('dermat_rnd.trial.updated', '{code} updated', { code: trial.code }) })
    if (done) await onChanged(trial.id)
    return Boolean(done)
  }

  const submit = async () => {
    if (!totalsOf(draft.formula).complete) return flash(t('dermat_rnd.formula.must100Long', 'The formula must add up to 100%, or mark one line as the balance (q.s.).'), 'error')
    const saved = await save(true)
    if (saved) await run('submit', {}, saved.updatedAt)
  }

  const copy = async () => {
    const created = await send<Trial>('/api/dermat_rnd/trials', 'POST', { requestId: request.id, copyFrom: trial.id }, { resourceKind: 'dermat_rnd.trial', success: t('dermat_rnd.trial.copied', 'New trial made from {code}', { code: trial.code }) })
    if (created) await onChanged(created.id)
  }

  const actions = canManage ? (
    <>
      {editable ? (
        <>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={async () => { if (await save()) await onChanged(trial.id) }}>
            <Save className="mr-1.5 size-4" aria-hidden="true" />
            {t('dermat_rnd.save', 'Save')}
          </Button>
          <Button type="button" size="sm" disabled={busy} onClick={() => void submit()}>
            <Send className="mr-1.5 size-4" aria-hidden="true" />
            {t('dermat_rnd.trial.submit', 'Send for testing')}
          </Button>
        </>
      ) : null}
      {['testing', 'passed', 'failed'].includes(trial.status) ? (
        <Button type="button" variant={trial.status === 'testing' ? 'default' : 'outline'} size="sm" disabled={busy} onClick={() => setDialog('record_result')}>
          <FlaskConical className="mr-1.5 size-4" aria-hidden="true" />
          {trial.observations ? t('dermat_rnd.trial.editResult', 'Edit lab result') : t('dermat_rnd.trial.recordResult', 'Record lab result')}
        </Button>
      ) : null}
      {trial.status === 'passed' ? (
        <Button type="button" size="sm" disabled={busy} onClick={() => void run('approve')}>
          <CheckCircle2 className="mr-1.5 size-4" aria-hidden="true" />
          {t('dermat_rnd.trial.approve', 'Approve formula')}
        </Button>
      ) : null}
      {trial.status === 'approved' && canMakeBom && request.approvedTrialId === trial.id && !request.bomId ? (
        <Button type="button" size="sm" disabled={busy} onClick={() => setDialog('make_bom')}>
          <FileStack className="mr-1.5 size-4" aria-hidden="true" />
          {t('dermat_rnd.trial.makeBom', 'Make BOM')}
        </Button>
      ) : null}
      {['testing', 'passed', 'approved'].includes(trial.status) && trial.stabilityStatus === 'not_started' ? (
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onOpenStability}>
          {t('dermat_rnd.stability.start', 'Start stability')}
        </Button>
      ) : null}
      {trial.status !== 'draft' ? (
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void copy()}>
          <Copy className="mr-1.5 size-4" aria-hidden="true" />
          {t('dermat_rnd.trial.copy', 'New trial from this')}
        </Button>
      ) : null}
      {['rejected', 'failed', 'testing'].includes(trial.status) ? (
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void run('reopen')}>
          <RotateCcw className="mr-1.5 size-4" aria-hidden="true" />
          {t('dermat_rnd.trial.reopen', 'Back to draft')}
        </Button>
      ) : null}
      {!['approved', 'rejected'].includes(trial.status) ? (
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setDialog('reject')}>
          <XCircle className="mr-1.5 size-4" aria-hidden="true" />
          {t('dermat_rnd.trial.reject', 'Reject')}
        </Button>
      ) : null}
    </>
  ) : null

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-mono text-lg font-semibold">{trial.code}</h2>
          <StatusBadge variant={status.variant}>{t(status.key, status.fallback)}</StatusBadge>
          <StatusBadge variant={stability.variant}>{t('dermat_rnd.stability.label', 'Stability: {status}', { status: t(stability.key, stability.fallback) })}</StatusBadge>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <Section title={t('dermat_rnd.trial.batch', 'Batch')}>
        <TrialDetails draft={draft} editable={editable} onChange={setDraft} />
      </Section>
      <Section title={t('dermat_rnd.trial.formula', 'Formula')} hint={t('dermat_rnd.trial.formulaHint', '% w/w. Mark the water (or main solvent) as the balance so the total stays 100%.')} bodyClassName="p-0">
        <FormulaEditor lines={draft.formula} batchSize={draft.batchSize} unit={draft.batchUnit} editable={editable} onChange={(formula) => setDraft({ ...draft, formula })} />
      </Section>
      <Section title={t('dermat_rnd.trial.lab', 'Lab results')}>
        <LabResultsView observations={trial.observations} />
      </Section>
      <TrialDialogs trial={trial} kind={dialog} busy={busy} onClose={() => setDialog(null)} onRun={run} />
    </div>
  )
}
