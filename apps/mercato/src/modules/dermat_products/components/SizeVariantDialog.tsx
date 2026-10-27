"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Input } from '@open-mercato/ui/primitives/input'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { Field } from '../../dermat_rnd/components/shared/Field'
import { FormDialog } from '../../dermat_rnd/components/shared/FormDialog'
import { sizedCode, sizedName } from '../lib/sizeNames'

type SizeVariantDialogProps = { open: boolean; productId: string; title: string; code: string | null; onClose: () => void }

export function SizeVariantDialog({ open, productId, title, code, onClose }: SizeVariantDialogProps) {
  const t = useT()
  const router = useRouter()
  const { runMutation } = useGuardedMutation({ contextId: `dermat-size-variant-${productId}` })
  const [size, setSize] = React.useState('')
  const [name, setName] = React.useState('')
  const [itemCode, setItemCode] = React.useState('')
  const [nameTouched, setNameTouched] = React.useState(false)
  const [codeTouched, setCodeTouched] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setSize('')
    setName(title)
    setItemCode('')
    setNameTouched(false)
    setCodeTouched(false)
  }, [open, title])

  const changeSize = (value: string) => {
    setSize(value)
    if (!nameTouched) setName(sizedName(title, value))
    if (!codeTouched) setItemCode(sizedCode(code ?? '', value))
  }

  const submit = async () => {
    if (!size.trim()) return flash(t('dermat_products.size.needSize', 'Enter the new size, for example 30 g or 100 ml.'), 'error')
    if (!name.trim()) return flash(t('dermat_products.size.needName', 'Enter the name of the new item.'), 'error')
    const body = { productId, size: size.trim(), title: name.trim(), itemCode: itemCode.trim() || null }
    setBusy(true)
    try {
      const call = await runMutation({
        context: { productId, action: 'size_variant' },
        mutationPayload: body,
        operation: () => apiCall<{ id?: string; error?: string }>('/api/dermat_products/size-variant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
      })
      if (!call.ok || !call.result?.id) {
        flash(call.result?.error ?? t('dermat_products.size.failed', 'Could not create the new size.'), 'error')
        return
      }
      flash(t('dermat_products.size.created', '{name} created', { name: body.title }), 'success')
      onClose()
      router.push(`/backend/products/${call.result.id}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <FormDialog
      open={open}
      busy={busy}
      title={t('dermat_products.size.title', 'Add a size of {name}', { name: title })}
      description={t('dermat_products.size.hint', 'Makes a new packing material with the same type, colours, vendor and specs. Stock is not copied.')}
      submitLabel={t('dermat_products.size.create', 'Create new size')}
      onClose={onClose}
      onSubmit={() => void submit()}
    >
      <Field id="size-new" label={t('dermat_products.size.size', 'New size *')}>
        <Input id="size-new" value={size} placeholder="30 g" autoFocus onChange={(event) => changeSize(event.target.value)} />
      </Field>
      <Field id="size-name" label={t('dermat_products.size.name', 'Name *')}>
        <Input
          id="size-name"
          value={name}
          onChange={(event) => {
            setNameTouched(true)
            setName(event.target.value)
          }}
        />
      </Field>
      <Field id="size-code" label={t('dermat_products.size.code', 'Code')}>
        <Input
          id="size-code"
          value={itemCode}
          onChange={(event) => {
            setCodeTouched(true)
            setItemCode(event.target.value)
          }}
        />
      </Field>
    </FormDialog>
  )
}
