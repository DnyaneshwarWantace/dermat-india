"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Checkbox } from '@open-mercato/ui/primitives/checkbox'
import { Input } from '@open-mercato/ui/primitives/input'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useListOptions } from '../../../dermat_lists/components/useListOptions'
import { Field } from '../shared/Field'
import { FormDialog } from '../shared/FormDialog'
import { ParameterInputs, PassFailControl, cleanValues } from '../shared/ParameterInputs'
import { todayIst } from '../labels'
import type { PassFail, Reading, TrialAction } from '../types'

export type StabilityDialog =
  | { kind: 'start' }
  | { kind: 'reading'; condition: string; day: number; reading: Reading | null }
  | { kind: 'finish' }

type StabilityDialogsProps = {
  code: string
  dialog: StabilityDialog | null
  busy: boolean
  onClose: () => void
  onRun: (action: TrialAction, extra: Record<string, unknown>) => Promise<boolean>
}

function CheckList({ idPrefix, options, value, onChange }: { idPrefix: string; options: string[]; value: string[]; onChange: (value: string[]) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((option, index) => (
        <label key={option} htmlFor={`${idPrefix}-${index}`} className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox id={`${idPrefix}-${index}`} checked={value.includes(option)} onCheckedChange={(checked) => onChange(checked === true ? [...value, option] : value.filter((entry) => entry !== option))} />
          {option}
        </label>
      ))}
    </div>
  )
}

export function StabilityDialogs({ code, dialog, busy, onClose, onRun }: StabilityDialogsProps) {
  const t = useT()
  const conditionOptions = useListOptions('rnd_stability_conditions')
  const checkpointOptions = useListOptions('rnd_stability_checkpoints')
  const [conditions, setConditions] = React.useState<string[]>([])
  const [checkpoints, setCheckpoints] = React.useState<string[]>([])
  const [date, setDate] = React.useState(todayIst())
  const [values, setValues] = React.useState<Record<string, string>>({})
  const [result, setResult] = React.useState<PassFail>('pass')
  const [remarks, setRemarks] = React.useState('')

  React.useEffect(() => {
    if (!dialog) return
    setConditions(conditionOptions)
    setCheckpoints(checkpointOptions)
    setDate(dialog.kind === 'reading' && dialog.reading ? dialog.reading.date : todayIst())
    setValues(dialog.kind === 'reading' && dialog.reading ? dialog.reading.values : {})
    setResult(dialog.kind === 'reading' && dialog.reading ? dialog.reading.result : 'pass')
    setRemarks(dialog.kind === 'reading' && dialog.reading ? dialog.reading.remarks ?? '' : '')
  }, [dialog, conditionOptions, checkpointOptions])

  const submit = async () => {
    if (!dialog) return
    let ok = false
    if (dialog.kind === 'start') {
      if (!conditions.length || !checkpoints.length) return flash(t('dermat_rnd.stability.pickBoth', 'Pick at least one condition and one checkpoint'), 'error')
      ok = await onRun('start_stability', { startDate: date, conditions, checkpoints: checkpoints.map(Number).filter((value) => Number.isFinite(value)) })
    } else if (dialog.kind === 'reading') {
      ok = await onRun('record_reading', { condition: dialog.condition, day: dialog.day, readingDate: date, values: cleanValues(values), result, remarks })
    } else {
      ok = await onRun('finish_stability', { result, remarks })
    }
    if (ok) onClose()
  }

  const title =
    dialog?.kind === 'start'
      ? t('dermat_rnd.stability.startTitle', 'Start stability for {code}', { code })
      : dialog?.kind === 'reading'
        ? t('dermat_rnd.stability.readingTitle', '{condition} · day {day}', { condition: dialog.condition, day: dialog.day })
        : t('dermat_rnd.stability.finishTitle', 'Finish stability for {code}', { code })

  return (
    <FormDialog open={Boolean(dialog)} size={dialog?.kind === 'reading' ? 'lg' : 'md'} busy={busy} title={title} submitLabel={t('dermat_rnd.confirm', 'Save')} onClose={onClose} onSubmit={() => void submit()}>
      {dialog?.kind === 'start' ? (
        <>
          <Field id="stab-start" label={t('dermat_rnd.stability.startDate', 'Samples kept on')}>
            <Input id="stab-start" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field id="stab-conditions" label={t('dermat_rnd.stability.conditions', 'Storage conditions')}>
            <CheckList idPrefix="stab-condition" options={conditionOptions} value={conditions} onChange={setConditions} />
          </Field>
          <Field id="stab-checkpoints" label={t('dermat_rnd.stability.checkpoints', 'Check on day')}>
            <CheckList idPrefix="stab-day" options={checkpointOptions} value={checkpoints} onChange={setCheckpoints} />
          </Field>
        </>
      ) : null}
      {dialog?.kind === 'reading' ? (
        <>
          <Field id="stab-date" label={t('dermat_rnd.stability.checkedOn', 'Checked on')}>
            <Input id="stab-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <ParameterInputs idPrefix="stab-value" listKey="rnd_stability_parameters" values={values} onChange={setValues} />
          <PassFailControl value={result} onChange={setResult} />
        </>
      ) : null}
      {dialog?.kind === 'finish' ? <PassFailControl value={result} onChange={setResult} /> : null}
      {dialog?.kind !== 'start' ? (
        <Field id="stab-remarks" label={dialog?.kind === 'finish' ? t('dermat_rnd.stability.conclusion', 'Conclusion') : t('dermat_rnd.remarks', 'Remarks')}>
          <Textarea id="stab-remarks" rows={3} value={remarks} onChange={(event) => setRemarks(event.target.value)} />
        </Field>
      ) : null}
    </FormDialog>
  )
}
