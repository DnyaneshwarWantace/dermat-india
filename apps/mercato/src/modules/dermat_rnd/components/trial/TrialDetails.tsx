"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Input } from '@open-mercato/ui/primitives/input'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@open-mercato/ui/primitives/select'
import { Field } from '../shared/Field'
import { KeyValueList } from '../shared/KeyValueList'
import { dayText, numberText } from '../labels'
import type { Trial } from '../types'

export type TrialDraft = Pick<Trial, 'batchDate' | 'chemistName' | 'batchSize' | 'batchUnit' | 'aim' | 'procedure' | 'formula'>

const UNITS: Trial['batchUnit'][] = ['g', 'kg', 'ml', 'l']

type TrialDetailsProps = { draft: TrialDraft; editable: boolean; onChange: (draft: TrialDraft) => void }

export function TrialDetails({ draft, editable, onChange }: TrialDetailsProps) {
  const t = useT()
  if (!editable) {
    return (
      <KeyValueList
        className="sm:grid-cols-3"
        rows={[
          { label: t('dermat_rnd.trial.batchDate', 'Batch made on'), value: dayText(draft.batchDate) },
          { label: t('dermat_rnd.trial.chemist', 'Chemist'), value: draft.chemistName },
          { label: t('dermat_rnd.trial.batchSize', 'Batch size'), value: draft.batchSize == null ? null : `${numberText(draft.batchSize)} ${draft.batchUnit}` },
          { label: t('dermat_rnd.trial.aim', 'What this trial tries'), value: draft.aim, wide: true },
          { label: t('dermat_rnd.trial.procedure', 'Procedure'), value: draft.procedure, wide: true },
        ]}
      />
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field id="trial-date" label={t('dermat_rnd.trial.batchDate', 'Batch made on')}>
          <Input id="trial-date" type="date" value={draft.batchDate ?? ''} onChange={(event) => onChange({ ...draft, batchDate: event.target.value || null })} />
        </Field>
        <Field id="trial-chemist" label={t('dermat_rnd.trial.chemist', 'Chemist')}>
          <Input id="trial-chemist" value={draft.chemistName ?? ''} onChange={(event) => onChange({ ...draft, chemistName: event.target.value })} />
        </Field>
        <Field id="trial-size" label={t('dermat_rnd.trial.batchSize', 'Batch size')}>
          <Input id="trial-size" type="number" min="0" step="0.001" value={draft.batchSize ?? ''} onChange={(event) => onChange({ ...draft, batchSize: event.target.value === '' ? null : Number(event.target.value) })} />
        </Field>
        <Field id="trial-unit" label={t('dermat_rnd.trial.unit', 'Unit')}>
          <Select value={draft.batchUnit} onValueChange={(value) => onChange({ ...draft, batchUnit: value as Trial['batchUnit'] })}>
            <SelectTrigger id="trial-unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map((unit) => (
                <SelectItem key={unit} value={unit}>
                  {unit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field id="trial-aim" label={t('dermat_rnd.trial.aim', 'What this trial tries')}>
        <Textarea id="trial-aim" rows={2} value={draft.aim ?? ''} placeholder={t('dermat_rnd.trial.aimHint', 'For example: raise fragrance 0.1% → 0.15%, thicker texture')} onChange={(event) => onChange({ ...draft, aim: event.target.value })} />
      </Field>
      <Field id="trial-procedure" label={t('dermat_rnd.trial.procedure', 'Procedure')}>
        <Textarea id="trial-procedure" rows={3} value={draft.procedure ?? ''} placeholder={t('dermat_rnd.trial.procedureHint', 'Order of addition, temperatures, mixing time')} onChange={(event) => onChange({ ...draft, procedure: event.target.value })} />
      </Field>
    </div>
  )
}
