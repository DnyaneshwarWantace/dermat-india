"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Input } from '@open-mercato/ui/primitives/input'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
import { SegmentedControl, SegmentedControlItem } from '@open-mercato/ui/primitives/segmented-control'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@open-mercato/ui/primitives/select'
import { Checkbox } from '@open-mercato/ui/primitives/checkbox'
import { Field } from '../shared/Field'
import { IngredientPicker } from './IngredientPicker'
import { FormDialog } from '../shared/FormDialog'
import { todayIst } from '../labels'
import { useRdSend } from '../useRdApi'
import type { IngredientRef, RdRequest, Trial } from '../types'

export type RequestActionKind = 'sample_sent' | 'feedback' | 'drop'

type RequestActionDialogProps = {
  request: RdRequest
  action: RequestActionKind | null
  trials: Trial[]
  presetTrialId?: string | null
  onClose: () => void
  onDone: () => void
}

type FeedbackResult = 'approved' | 'changes' | 'rejected'

const NO_TRIAL = 'none'

export function RequestActionDialog({ request, action, trials, presetTrialId, onClose, onDone }: RequestActionDialogProps) {
  const t = useT()
  const { send, busy } = useRdSend('dermat-rnd-request-action')
  const sendable = trials.filter((trial) => ['testing', 'passed', 'approved'].includes(trial.status))
  const defaultTrial = presetTrialId ?? request.approvedTrialId ?? sendable[sendable.length - 1]?.id ?? NO_TRIAL
  const lastRound = request.rounds[request.rounds.length - 1] ?? null
  const roundTrial = (lastRound?.trialId ? trials.find((trial) => trial.id === lastRound.trialId) : null) ?? trials[trials.length - 1] ?? null
  const nextCode = `${request.code}-${String((trials[trials.length - 1]?.trialNo ?? 0) + 1).padStart(2, '0')}`
  const [sentOn, setSentOn] = React.useState(todayIst())
  const [sentVia, setSentVia] = React.useState('')
  const [trialId, setTrialId] = React.useState<string>(NO_TRIAL)
  const [result, setResult] = React.useState<FeedbackResult>('approved')
  const [nextStep, setNextStep] = React.useState<'new' | 'same'>('new')
  const [addActives, setAddActives] = React.useState<IngredientRef[]>([])
  const [removeActives, setRemoveActives] = React.useState<string[]>([])
  const [text, setText] = React.useState('')

  React.useEffect(() => {
    if (!action) return
    setSentOn(todayIst())
    setSentVia('')
    setTrialId(defaultTrial)
    setResult('approved')
    setNextStep('new')
    setAddActives([])
    setRemoveActives([])
    setText('')
  }, [action, defaultTrial])

  const submit = async () => {
    if (!action) return
    const extra =
      action === 'sample_sent'
        ? { sentOn, sentVia, trialId: trialId === NO_TRIAL ? null : trialId }
        : action === 'feedback'
          ? { result, feedback: text, ...(result === 'approved' ? {} : { nextStep: result === 'rejected' ? 'new' : nextStep, addActives, removeActives }) }
          : { note: text }
    const done = await send('/api/dermat_rnd/requests/action', 'POST', { id: request.id, action, ...extra }, { version: request.updatedAt, success: t('dermat_rnd.updated', '{code} updated', { code: request.code }) })
    if (done) onDone()
  }

  const title =
    action === 'sample_sent'
      ? t('dermat_rnd.sentTitle', 'Sample sent for {code}', { code: request.code })
      : action === 'feedback'
        ? t('dermat_rnd.feedbackTitle', 'Client feedback on {code}', { code: request.code })
        : t('dermat_rnd.dropTitle', 'Drop {code}?', { code: request.code })

  return (
    <FormDialog
      open={Boolean(action)}
      title={title}
      description={action === 'feedback' ? t('dermat_rnd.feedbackHint', 'Approved closes the request. Changes or Rejected send it back to R&D with your comments.') : undefined}
      submitLabel={action === 'drop' ? t('dermat_rnd.drop', 'Drop') : t('dermat_rnd.confirm', 'Save')}
      destructive={action === 'drop'}
      busy={busy}
      onClose={onClose}
      onSubmit={() => void submit()}
    >
      {action === 'sample_sent' ? (
        <>
          <Field id="rd-sent-trial" label={t('dermat_rnd.sentTrial', 'Sample from trial')}>
            <Select value={trialId} onValueChange={setTrialId}>
              <SelectTrigger id="rd-sent-trial">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TRIAL}>{t('dermat_rnd.noTrial', 'Not from a recorded trial')}</SelectItem>
                {sendable.map((trial) => (
                  <SelectItem key={trial.id} value={trial.id}>
                    {trial.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="rd-sent-on" label={t('dermat_rnd.sentOnLabel', 'Sent on')}>
              <Input id="rd-sent-on" type="date" value={sentOn} onChange={(event) => setSentOn(event.target.value)} />
            </Field>
            <Field id="rd-sent-via" label={t('dermat_rnd.via', 'Sent via')}>
              <Input id="rd-sent-via" value={sentVia} placeholder={t('dermat_rnd.viaPlaceholder', 'Courier / hand delivery, docket no.')} onChange={(event) => setSentVia(event.target.value)} />
            </Field>
          </div>
        </>
      ) : null}
      {action === 'feedback' ? (
        <>
          <SegmentedControl value={result} onValueChange={(value) => setResult(value as FeedbackResult)} aria-label={t('dermat_rnd.result', 'Result')}>
            <SegmentedControlItem value="approved">{t('dermat_rnd.approvedOpt', 'Client approved')}</SegmentedControlItem>
            <SegmentedControlItem value="changes">{t('dermat_rnd.changesOpt', 'Changes needed')}</SegmentedControlItem>
            <SegmentedControlItem value="rejected">{t('dermat_rnd.rejectedOpt', 'Rejected')}</SegmentedControlItem>
          </SegmentedControl>
          {result === 'changes' && roundTrial ? (
            <Field id="rd-next-step" label={t('dermat_rnd.nextStep', 'What R&D should do')}>
              <SegmentedControl value={nextStep} onValueChange={(value) => setNextStep(value as 'new' | 'same')} aria-label={t('dermat_rnd.nextStep', 'What R&D should do')}>
                <SegmentedControlItem value="new">{t('dermat_rnd.nextNew', 'New sample {code}', { code: nextCode })}</SegmentedControlItem>
                <SegmentedControlItem value="same">{t('dermat_rnd.nextSame', 'Change {code}', { code: roundTrial.code })}</SegmentedControlItem>
              </SegmentedControl>
            </Field>
          ) : null}
          {result === 'rejected' ? <p className="text-xs text-muted-foreground">{t('dermat_rnd.rejectedHint', 'R&D gets a new sample {code} to work on, with your comments.', { code: nextCode })}</p> : null}
          {result !== 'approved' ? (
            <>
              <Field id="rd-add-actives" label={t('dermat_rnd.addActives', 'Actives to add (optional)')}>
                <IngredientPicker value={addActives} onChange={setAddActives} />
              </Field>
              {roundTrial?.formula.length ? (
                <Field id="rd-remove-actives" label={t('dermat_rnd.removeActives', 'Ingredients to take out (optional)')}>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {roundTrial.formula.filter((line) => !line.isBalance).map((line) => (
                      <label key={line.id} htmlFor={`rd-remove-${line.id}`} className="flex items-center gap-1.5 text-sm">
                        <Checkbox
                          id={`rd-remove-${line.id}`}
                          checked={removeActives.includes(line.name)}
                          onCheckedChange={(checked) => setRemoveActives(checked === true ? [...removeActives, line.name] : removeActives.filter((name) => name !== line.name))}
                        />
                        {line.name}
                      </label>
                    ))}
                  </div>
                </Field>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
      {action === 'feedback' || action === 'drop' ? (
        <Field id="rd-action-text" label={action === 'feedback' ? (result === 'approved' ? t('dermat_rnd.whatSaid', 'What the client said') : t('dermat_rnd.whatSaidRequired', 'What the client said *')) : t('dermat_rnd.why', 'Why *')}>
          <Textarea id="rd-action-text" rows={3} value={text} onChange={(event) => setText(event.target.value)} />
        </Field>
      ) : null}
    </FormDialog>
  )
}
