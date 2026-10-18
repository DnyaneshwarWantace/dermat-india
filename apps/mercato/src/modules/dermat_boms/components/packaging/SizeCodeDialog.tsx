"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Input } from '@open-mercato/ui/primitives/input'
import { SegmentedControl, SegmentedControlItem } from '@open-mercato/ui/primitives/segmented-control'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { Field } from '../../../dermat_rnd/components/shared/Field'
import { FormDialog } from '../../../dermat_rnd/components/shared/FormDialog'
import { sizedCode, sizedName } from '../../../dermat_products/lib/sizeNames'
import type { PackagingCodeView } from '../types'

type PartChoice = { mode: 'same' | 'new'; size: string }

type SizeCodeDialogProps = { source: PackagingCodeView | null; onClose: () => void; onSaved: () => void }

export function SizeCodeDialog({ source, onClose, onSaved }: SizeCodeDialogProps) {
  const t = useT()
  const { runMutation } = useGuardedMutation({ contextId: 'dermat-packaging-size' })
  const [code, setCode] = React.useState('')
  const [size, setSize] = React.useState('')
  const [name, setName] = React.useState('')
  const [choices, setChoices] = React.useState<Record<string, PartChoice>>({})
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!source) return
    setCode('')
    setSize('')
    setName(source.name)
    setChoices(Object.fromEntries(source.components.map((part, index) => [part.productId, { mode: index === 0 ? 'new' : 'same', size: '' }])))
  }, [source])

  const changeSize = (value: string) => {
    setSize(value)
    if (source) setName(sizedName(source.name, value))
  }

  const submit = async () => {
    if (!source) return
    if (!code.trim() || !size.trim()) return flash(t('dermat_boms.sizeCode.required', 'Enter the new code and the new size.'), 'error')
    setBusy(true)
    try {
      const components: Array<{ productId: string; qty: number }> = []
      for (const part of source.components) {
        const choice = choices[part.productId] ?? { mode: 'same', size: '' }
        if (choice.mode === 'same') {
          components.push({ productId: part.productId, qty: part.qty })
          continue
        }
        const partSize = (choice.size || size).trim()
        const body = { productId: part.productId, size: partSize, title: sizedName(part.name, partSize), itemCode: sizedCode(part.code ?? '', partSize) || null }
        const call = await runMutation({
          context: { packagingSize: source.code, productId: part.productId },
          mutationPayload: body,
          operation: () => apiCall<{ id?: string; error?: string }>('/api/dermat_products/size-variant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
        })
        if (!call.ok || !call.result?.id) {
          flash(call.result?.error ?? t('dermat_boms.sizeCode.partError', 'Could not create the new size of {name}.', { name: part.name }), 'error')
          return
        }
        components.push({ productId: call.result.id, qty: part.qty })
      }
      const body = { code: code.trim(), name: name.trim() || source.name, kind: source.kind, size: size.trim(), specs: source.specs, notes: source.notes, components, printedItems: source.printedItems }
      const saved = await runMutation({
        context: { packagingSize: source.code },
        mutationPayload: body,
        operation: () => apiCall<{ id?: string; error?: string }>('/api/dermat_boms/packaging-codes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
      })
      if (!saved.ok) {
        flash(saved.result?.error ?? t('dermat_boms.packaging.saveError', 'Could not save the packaging code.'), 'error')
        return
      }
      flash(t('dermat_boms.packaging.saved', 'Packaging code {code} saved', { code: body.code.toUpperCase() }), 'success')
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <FormDialog
      open={Boolean(source)}
      size="lg"
      busy={busy}
      title={t('dermat_boms.sizeCode.title', 'New size from {code}', { code: source?.code ?? '' })}
      description={t('dermat_boms.sizeCode.hint', 'For each part, keep the same item (for example the same cap) or make a new size of it. New items copy the type, colours, vendor and specs; stock is not copied.')}
      submitLabel={t('dermat_boms.sizeCode.create', 'Create code')}
      onClose={onClose}
      onSubmit={() => void submit()}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field id="size-code-code" label={t('dermat_boms.sizeCode.code', 'New code *')}>
          <Input id="size-code-code" value={code} placeholder="CT 12" onChange={(event) => setCode(event.target.value)} />
        </Field>
        <Field id="size-code-size" label={t('dermat_boms.sizeCode.size', 'New size *')}>
          <Input id="size-code-size" value={size} placeholder="30 g" onChange={(event) => changeSize(event.target.value)} />
        </Field>
        <Field id="size-code-name" label={t('dermat_boms.sizeCode.name', 'Name')}>
          <Input id="size-code-name" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
      </div>
      <div className="flex flex-col divide-y rounded-md border">
        {(source?.components ?? []).map((part) => {
          const choice = choices[part.productId] ?? { mode: 'same', size: '' }
          const setChoice = (patch: Partial<PartChoice>) => setChoices((prev) => ({ ...prev, [part.productId]: { ...choice, ...patch } }))
          return (
            <div key={part.productId} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{part.name}</p>
                {choice.mode === 'new' ? <p className="truncate text-xs text-muted-foreground">{t('dermat_boms.sizeCode.willCreate', 'Will create: {name}', { name: sizedName(part.name, choice.size || size || '…') })}</p> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SegmentedControl value={choice.mode} onValueChange={(value) => setChoice({ mode: value as PartChoice['mode'] })} aria-label={part.name}>
                  <SegmentedControlItem value="same">{t('dermat_boms.sizeCode.same', 'Use same')}</SegmentedControlItem>
                  <SegmentedControlItem value="new">{t('dermat_boms.sizeCode.new', 'New size')}</SegmentedControlItem>
                </SegmentedControl>
                {choice.mode === 'new' ? (
                  <Input id={`size-part-${part.productId}`} aria-label={t('dermat_boms.sizeCode.partSize', 'Size of this part')} className="w-28" value={choice.size} placeholder={size || '30 g'} onChange={(event) => setChoice({ size: event.target.value })} />
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </FormDialog>
  )
}
