"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Input } from '@open-mercato/ui/primitives/input'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
import { Checkbox } from '@open-mercato/ui/primitives/checkbox'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { MaterialPicker } from '../../../dermat_boms/components/MaterialPicker'
import type { ComponentOption } from '../../../dermat_boms/components/types'
import { Field } from '../shared/Field'
import { FormDialog } from '../shared/FormDialog'
import { ParameterInputs, PassFailControl, cleanValues } from '../shared/ParameterInputs'
import { todayIst } from '../labels'
import type { PassFail, Trial, TrialAction } from '../types'

export type TrialDialogKind = 'record_result' | 'reject' | 'make_bom' | 'micro' | 'details'

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
  const [microRequired, setMicroRequired] = React.useState(true)
  const [testingDate, setTestingDate] = React.useState('')
  const [releasedDate, setReleasedDate] = React.useState('')
  const [productCode, setProductCode] = React.useState('')
  const [receivedBy, setReceivedBy] = React.useState('')

  React.useEffect(() => {
    if (!kind) return
    const micro = kind === 'micro' ? trial.micro : null
    setValues(kind === 'micro' ? micro?.values ?? {} : trial.observations?.values ?? {})
    setResult((kind === 'micro' ? micro?.result : trial.observations?.result) ?? 'pass')
    setRemarks(kind === 'record_result' ? trial.observations?.remarks ?? '' : kind === 'micro' ? micro?.remarks ?? '' : '')
    setProduct(null)
    setMicroRequired(micro ? micro.required : true)
    setTestingDate(micro?.testingDate ?? todayIst())
    setReleasedDate(micro?.releasedDate ?? '')
    setProductCode(trial.productCode ?? '')
    setReceivedBy(trial.sampleReceivedBy ?? '')
  }, [kind, trial.observations, trial.micro, trial.productCode, trial.sampleReceivedBy])

  const submit = async () => {
    if (kind === 'record_result') {
      if (await onRun('record_result', { values: cleanValues(values), result, remarks })) onClose()
    } else if (kind === 'reject') {
      if (!remarks.trim()) return flash(t('dermat_rnd.trial.rejectWhy', 'Write why the trial is rejected'), 'error')
      if (await onRun('reject', { remarks })) onClose()
    } else if (kind === 'micro') {
      const extra = microRequired ? { microRequired: true, values: cleanValues(values), result, remarks, testingDate: testingDate || null, releasedDate: releasedDate || null } : { microRequired: false, remarks }
      if (await onRun('record_micro', extra)) onClose()
    } else if (kind === 'details') {
      if (await onRun('set_details', { productCode, sampleReceivedBy: receivedBy })) onClose()
    } else if (kind === 'make_bom') {
      if (!product) return flash(t('dermat_rnd.trial.pickBulk', 'Pick the Bulk product this formula is for'), 'error')
      if (await onRun('make_bom', { productId: product.id })) onClose()
    }
  }

  const titles: Record<TrialDialogKind, string> = {
    record_result: t('dermat_rnd.trial.resultTitle', 'Lab results for {code}', { code: trial.code }),
    reject: t('dermat_rnd.trial.rejectTitle', 'Reject {code}?', { code: trial.code }),
    make_bom: t('dermat_rnd.trial.bomTitle', 'Make the BOM from {code}', { code: trial.code }),
    micro: t('dermat_rnd.micro.title', 'Microbiology for {code}', { code: trial.code }),
    details: t('dermat_rnd.trial.detailsTitle', 'Development details for {code}', { code: trial.code }),
  }
  const title = kind ? titles[kind] : ''

  return (
    <FormDialog
      open={Boolean(kind)}
      size={kind === 'record_result' || kind === 'micro' ? 'lg' : 'md'}
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
      {kind === 'micro' ? (
        <>
          <label htmlFor="micro-required" className="flex items-center gap-2 text-sm">
            <Checkbox id="micro-required" checked={!microRequired} onCheckedChange={(checked) => setMicroRequired(checked !== true)} />
            {t('dermat_rnd.micro.notRequired', 'Micro not required for this sample')}
          </label>
          {microRequired ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field id="micro-testing" label={t('dermat_rnd.micro.testingDate', 'Testing date')}>
                  <Input id="micro-testing" type="date" value={testingDate} onChange={(event) => setTestingDate(event.target.value)} />
                </Field>
                <Field id="micro-released" label={t('dermat_rnd.micro.releasedDate', 'Released date')}>
                  <Input id="micro-released" type="date" value={releasedDate} onChange={(event) => setReleasedDate(event.target.value)} />
                </Field>
              </div>
              <ParameterInputs idPrefix="micro" listKey="rnd_micro_parameters" values={values} onChange={setValues} />
              <PassFailControl value={result} onChange={setResult} />
            </>
          ) : null}
        </>
      ) : null}
      {kind === 'details' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="trial-product-code" label={t('dermat_rnd.trial.productCode', 'Product code')}>
            <Input id="trial-product-code" value={productCode} onChange={(event) => setProductCode(event.target.value)} />
          </Field>
          <Field id="trial-received-by" label={t('dermat_rnd.trial.receivedBy', 'Sample received by')}>
            <Input id="trial-received-by" value={receivedBy} onChange={(event) => setReceivedBy(event.target.value)} />
          </Field>
        </div>
      ) : null}
      {kind === 'make_bom' ? (
        <Field id="bom-product" label={t('dermat_rnd.trial.bulkProduct', 'Bulk product')} hint={t('dermat_rnd.trial.bulkHint', 'Make the Bulk product first under Products if it does not exist yet.')}>
          <MaterialPicker kinds={['bulk', 'rnd']} variant="field" label={product ? [product.code, product.title].filter(Boolean).join(' · ') : t('dermat_rnd.trial.pickProduct', 'Pick the product')} onSelect={setProduct} />
        </Field>
      ) : null}
      {kind === 'record_result' || kind === 'reject' || kind === 'micro' ? (
        <Field id="trial-remarks" label={kind === 'reject' ? t('dermat_rnd.why', 'Why *') : t('dermat_rnd.remarks', 'Remarks')}>
          <Textarea id="trial-remarks" rows={3} value={remarks} onChange={(event) => setRemarks(event.target.value)} />
        </Field>
      ) : null}
    </FormDialog>
  )
}
