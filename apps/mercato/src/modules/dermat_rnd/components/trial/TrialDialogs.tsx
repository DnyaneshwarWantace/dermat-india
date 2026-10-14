"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { MaterialPicker } from '../../../dermat_boms/components/MaterialPicker'
import type { ComponentOption } from '../../../dermat_boms/components/types'
import { Field } from '../shared/Field'
import { FormDialog } from '../shared/FormDialog'
import { ParameterInputs, PassFailControl, cleanValues } from '../shared/ParameterInputs'
import type { PassFail, Trial, TrialAction } from '../types'

export type TrialDialogKind = 'record_result' | 'reject' | 'make_bom'

type TrialDialogsProps = {
  trial: Trial
  kind: TrialDialogKind | null
  busy: boolean
  onClose: () => void
  onRun: (action: TrialAction, extra: Record<string, unknown>) => Promise<boolean>
}

export function TrialDialogs({ trial, kind, busy, onClose, onRun }: TrialDialogsProps) {
  const t = useT()
  const [values, setValues] = React.useState<Record<string, string>>({})
  const [result, setResult] = React.useState<PassFail>('pass')
  const [remarks, setRemarks] = React.useState('')
  const [product, setProduct] = React.useState<ComponentOption | null>(null)

  React.useEffect(() => {
    if (!kind) return
    setValues(trial.observations?.values ?? {})
    setResult(trial.observations?.result ?? 'pass')
    setRemarks(kind === 'record_result' ? trial.observations?.remarks ?? '' : '')
    setProduct(null)
  }, [kind, trial.observations])

  const submit = async () => {
    if (kind === 'record_result') {
      if (await onRun('record_result', { values: cleanValues(values), result, remarks })) onClose()
    } else if (kind === 'reject') {
      if (!remarks.trim()) return flash(t('dermat_rnd.trial.rejectWhy', 'Write why the trial is rejected'), 'error')
      if (await onRun('reject', { remarks })) onClose()
    } else if (kind === 'make_bom') {
      if (!product) return flash(t('dermat_rnd.trial.pickBulk', 'Pick the Bulk product this formula is for'), 'error')
      if (await onRun('make_bom', { productId: product.id })) onClose()
    }
  }

  const title = kind === 'record_result' ? t('dermat_rnd.trial.resultTitle', 'Lab results for {code}', { code: trial.code }) : kind === 'reject' ? t('dermat_rnd.trial.rejectTitle', 'Reject {code}?', { code: trial.code }) : t('dermat_rnd.trial.bomTitle', 'Make the BOM from {code}', { code: trial.code })

  return (
    <FormDialog
      open={Boolean(kind)}
      size={kind === 'record_result' ? 'lg' : 'md'}
      busy={busy}
      title={title}
      description={kind === 'make_bom' ? t('dermat_rnd.trial.bomHint', 'Creates a draft formula BOM per 100 kg with the same % lines. R&D approves it on the BOM page.') : undefined}
      submitLabel={kind === 'reject' ? t('dermat_rnd.trial.reject', 'Reject') : kind === 'make_bom' ? t('dermat_rnd.trial.makeBom', 'Make BOM') : t('dermat_rnd.confirm', 'Save')}
      destructive={kind === 'reject'}
      onClose={onClose}
      onSubmit={() => void submit()}
    >
      {kind === 'record_result' ? (
        <>
          <ParameterInputs idPrefix="lab" listKey="rnd_test_parameters" values={values} onChange={setValues} />
          <PassFailControl value={result} onChange={setResult} />
        </>
      ) : null}
      {kind === 'make_bom' ? (
        <Field id="bom-product" label={t('dermat_rnd.trial.bulkProduct', 'Bulk product')} hint={t('dermat_rnd.trial.bulkHint', 'Make the Bulk product first under Products if it does not exist yet.')}>
          <MaterialPicker kinds={['bulk', 'rnd']} variant="field" label={product ? [product.code, product.title].filter(Boolean).join(' · ') : t('dermat_rnd.trial.pickProduct', 'Pick the product')} onSelect={setProduct} />
        </Field>
      ) : null}
      {kind === 'record_result' || kind === 'reject' ? (
        <Field id="trial-remarks" label={kind === 'reject' ? t('dermat_rnd.why', 'Why *') : t('dermat_rnd.remarks', 'Remarks')}>
          <Textarea id="trial-remarks" rows={3} value={remarks} onChange={(event) => setRemarks(event.target.value)} />
        </Field>
      ) : null}
    </FormDialog>
  )
}
