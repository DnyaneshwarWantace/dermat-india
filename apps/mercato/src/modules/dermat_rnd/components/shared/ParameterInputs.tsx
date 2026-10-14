"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Input } from '@open-mercato/ui/primitives/input'
import { SegmentedControl, SegmentedControlItem } from '@open-mercato/ui/primitives/segmented-control'
import { useListOptions } from '../../../dermat_lists/components/useListOptions'
import type { PassFail } from '../types'
import { Field } from './Field'

type ParameterInputsProps = { idPrefix: string; listKey: string; values: Record<string, string>; onChange: (values: Record<string, string>) => void }

export function ParameterInputs({ idPrefix, listKey, values, onChange }: ParameterInputsProps) {
  const parameters = useListOptions(listKey)
  const extra = Object.keys(values).filter((key) => !parameters.includes(key))
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[...parameters, ...extra].map((parameter, index) => (
        <Field key={parameter} id={`${idPrefix}-${index}`} label={parameter}>
          <Input id={`${idPrefix}-${index}`} value={values[parameter] ?? ''} onChange={(event) => onChange({ ...values, [parameter]: event.target.value })} />
        </Field>
      ))}
    </div>
  )
}

export function PassFailControl({ value, onChange }: { value: PassFail; onChange: (value: PassFail) => void }) {
  const t = useT()
  return (
    <SegmentedControl value={value} onValueChange={(next) => onChange(next as PassFail)} aria-label={t('dermat_rnd.result', 'Result')}>
      <SegmentedControlItem value="pass">{t('dermat_rnd.pass', 'Pass')}</SegmentedControlItem>
      <SegmentedControlItem value="fail">{t('dermat_rnd.fail', 'Fail')}</SegmentedControlItem>
    </SegmentedControl>
  )
}

export function cleanValues(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value))
}
