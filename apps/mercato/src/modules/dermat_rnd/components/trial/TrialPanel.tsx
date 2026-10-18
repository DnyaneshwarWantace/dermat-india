"use client"

import * as React from 'react'
import { CheckCircle2, Copy, FileStack, FlaskConical, Microscope, Pencil, Printer, RotateCcw, Save, Send, XCircle } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { AttachmentsSection } from '@open-mercato/ui/backend/detail/AttachmentsSection'
import { KeyValueList } from '../shared/KeyValueList'
import { Section } from '../shared/Section'
import { STABILITY_STATUS, TRIAL_STATUS, dayText } from '../labels'
import { useRdSend } from '../useRdApi'
import type { RdRequest, Trial, TrialAction } from '../types'
import { FormulaEditor } from './FormulaEditor'
import { LabResultsView } from './LabResultsView'
import { TrialDetails, type TrialDraft } from './TrialDetails'
import { TrialDialogs, type TrialDialogKind } from './TrialDialogs'
import { totalsOf } from './formula'
import { MicroView } from './MicroView'
import { openClientSheet, type ClientSheetLabels } from './clientSheet'

const OPEN_REQUEST = ['requested', 'in_progress', 'changes']

type TrialPanelProps = {
  request: RdRequest
  trial: Trial
  canManage: boolean
  canMakeBom: boolean
  canRequest: boolean
  onChanged: (select?: string) => Promise<void>
  onOpenStability: () => void
  onSendSample: (trialId: string) => void
}

function draftOf(trial: Trial): TrialDraft {
  return { batchDate: trial.batchDate, chemistName: trial.chemistName, batchSize: trial.batchSize, batchUnit: trial.batchUnit, aim: trial.aim, procedure: trial.procedure, formula: trial.formula }
}

function fragranceText(trial: Trial): string | null {
  const lines = trial.formula.filter((line) => /fragrance|perfume|parfum/i.test(`${line.function ?? ''} ${line.name}`))
  return lines.length ? lines.map((line) => `${line.name} ${line.percent}%`).join(', ') : null
}

export function TrialPanel({ request, trial, canManage, canMakeBom, canRequest, onChanged, onOpenStability, onSendSample }: TrialPanelProps) {
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

  const printForClient = () => {
    const labels: ClientSheetLabels = {
      title: t('dermat_rnd.sheet.title', 'Sample details for client'),
      client: t('dermat_rnd.sheet.client', 'Client'),
      brand: t('dermat_rnd.sheet.brand', 'Brand'),
      product: t('dermat_rnd.sheet.product', 'Product'),
      sampleNo: t('dermat_rnd.sheet.sampleNo', 'Sample no.'),
      packSize: t('dermat_rnd.sheet.packSize', 'Pack size'),
      sentOn: t('dermat_rnd.sheet.sentOn', 'Sample sent on'),
      request: t('dermat_rnd.sheet.request', 'What was asked'),
      texture: t('dermat_rnd.sheet.texture', 'Texture'),
      fragrance: t('dermat_rnd.sheet.fragrance', 'Fragrance'),
      colour: t('dermat_rnd.sheet.colour', 'Colour'),
      claims: t('dermat_rnd.sheet.claims', 'Claims'),
      ingredients: t('dermat_rnd.sheet.ingredients', 'Key ingredients'),
      instruction: t('dermat_rnd.sheet.instruction', 'Client instruction'),
      results: t('dermat_rnd.sheet.results', 'Lab results'),
      parameter: t('dermat_rnd.sheet.parameter', 'Parameter'),
      value: t('dermat_rnd.sheet.value', 'Observation'),
      result: t('dermat_rnd.sheet.result', 'Result'),
      pass: t('dermat_rnd.pass', 'Pass'),
      fail: t('dermat_rnd.fail', 'Fail'),
      remarks: t('dermat_rnd.remarks', 'Remarks'),
      note: t('dermat_rnd.sheet.note', 'Lab sample for evaluation only. Final product may vary slightly in colour and fragrance.'),
      preparedBy: t('dermat_rnd.sheet.preparedBy', 'R&D, Dermat India'),
      receivedBy: t('dermat_rnd.sheet.receivedBy', 'Received by (client)'),
      newProduct: t('dermat_rnd.sheet.newProduct', 'New product'),
    }
    if (!openClientSheet(request, trial, labels)) flash(t('dermat_rnd.sheet.blocked', 'Allow pop-ups for this site to print the sheet.'), 'error')
  }

  const makeBom = () => {
    if (!trial.approvalProofs) return flash(t('dermat_rnd.trial.proofMissing', 'Upload the approval proof (photo or screenshot of the client approval) under Approval proof first.'), 'error')
    setDialog('make_bom')
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
        <Button type="button" size="sm" disabled={busy} onClick={makeBom}>
          <FileStack className="mr-1.5 size-4" aria-hidden="true" />
          {t('dermat_rnd.trial.makeBom', 'Make BOM')}
        </Button>
      ) : null}
      {['testing', 'passed', 'approved'].includes(trial.status) && OPEN_REQUEST.includes(request.status) ? (
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => onSendSample(trial.id)}>
          <Send className="mr-1.5 size-4" aria-hidden="true" />
          {t('dermat_rnd.trial.sendSample', 'Send sample to client')}
        </Button>
      ) : null}
      {trial.status !== 'draft' ? (
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setDialog('micro')}>
          <Microscope className="mr-1.5 size-4" aria-hidden="true" />
          {trial.micro ? t('dermat_rnd.micro.edit', 'Edit micro result') : t('dermat_rnd.micro.record', 'Micro result')}
        </Button>
      ) : null}
      <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setDialog('details')}>
        <Pencil className="mr-1.5 size-4" aria-hidden="true" />
        {t('dermat_rnd.trial.editDetails', 'Product code / received by')}
      </Button>
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
        {actions || canRequest ? (
          <div className="flex flex-wrap gap-2">
            {actions}
            {(canManage || canRequest) && trial.status !== 'draft' ? (
              <Button type="button" variant="outline" size="sm" onClick={printForClient}>
                <Printer className="mr-1.5 size-4" aria-hidden="true" />
                {t('dermat_rnd.trial.printClient', 'Print for client')}
              </Button>
            ) : null}
          </div>
        ) : null}
        {trial.stabilityStatus === 'running' && OPEN_REQUEST.includes(request.status) && trial.status !== 'draft' ? (
          <p className="text-xs text-muted-foreground">{t('dermat_rnd.trial.sendWhileStability', 'Stability is still running. The sample can go to the client now; the formula can be approved before stability ends.')}</p>
        ) : null}
      </div>
      <Section title={t('dermat_rnd.trial.development', 'Product development details')}>
        <div className="flex flex-col gap-4">
          <TrialDetails draft={draft} editable={editable} onChange={setDraft} />
          <KeyValueList
            className="sm:grid-cols-3"
            rows={[
              { label: t('dermat_rnd.trial.productCode', 'Product code'), value: trial.productCode },
              { label: t('dermat_rnd.trial.receivedBy', 'Sample received by'), value: trial.sampleReceivedBy },
              { label: t('dermat_rnd.trial.briefBy', 'Brief by'), value: request.requestedByName },
              { label: t('dermat_rnd.trial.fragrance', 'Fragrance name & %'), value: fragranceText(trial) ?? request.fragrance },
            ]}
          />
        </div>
      </Section>
      <Section title={t('dermat_rnd.trial.formula', 'Formula')} hint={t('dermat_rnd.trial.formulaHint', '% w/w. Mark the water (or main solvent) as the balance so the total stays 100%.')} bodyClassName="p-0">
        <FormulaEditor lines={draft.formula} batchSize={draft.batchSize} unit={draft.batchUnit} editable={editable} onChange={(formula) => setDraft({ ...draft, formula })} />
      </Section>
      <Section title={t('dermat_rnd.trial.quality', 'Quality evaluation & stability')}>
        <div className="flex flex-col gap-4">
          <LabResultsView observations={trial.observations} />
          <KeyValueList
            className="sm:grid-cols-3"
            rows={[
              { label: t('dermat_rnd.trial.stabilityStart', 'Stability start'), value: trial.stability?.startDate ? dayText(trial.stability.startDate) : null },
              { label: t('dermat_rnd.trial.stabilityEnd', 'Stability end'), value: trial.stability?.endDate ? dayText(trial.stability.endDate) : null },
              { label: t('dermat_rnd.trial.stabilityStatus', 'Stability status'), value: t(stability.key, stability.fallback) },
            ]}
          />
        </div>
      </Section>
      {['passed', 'approved'].includes(trial.status) ? (
        <Section title={t('dermat_rnd.trial.proof', 'Approval proof')} hint={t('dermat_rnd.trial.proofHint', 'Photo of the sample or screenshot of the client approval. Needed before Make BOM.')}>
          <AttachmentsSection entityId="dermat_rnd:trial" recordId={`${trial.id}:approval`} showHeader={false} compact onChanged={() => void onChanged(trial.id)} />
        </Section>
      ) : null}
      <Section title={t('dermat_rnd.micro.section', 'Microbiological parameters')} hint={t('dermat_rnd.micro.hint', 'Can be skipped for quick samples.')}>
        <MicroView micro={trial.micro} />
      </Section>
      <TrialDialogs trial={trial} kind={dialog} busy={busy} onClose={() => setDialog(null)} onRun={run} />
    </div>
  )
}
