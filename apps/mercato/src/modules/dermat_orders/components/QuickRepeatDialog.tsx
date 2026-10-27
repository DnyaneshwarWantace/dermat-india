'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Repeat } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { Checkbox } from '@open-mercato/ui/primitives/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@open-mercato/ui/primitives/dialog'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { formatQty } from './format'
import type { Order } from './types'

export function QuickRepeatDialog({ order }: { order: Order }) {
  const t = useT()
  const router = useRouter()
  const { runMutation } = useGuardedMutation({ contextId: `dermat-quick-repeat-${order.id}` })
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [quantities, setQuantities] = React.useState<Record<string, string>>({})
  const [delivery, setDelivery] = React.useState('')
  const [poRef, setPoRef] = React.useState('')
  const [paid, setPaid] = React.useState(false)
  const [amount, setAmount] = React.useState('')
  const [reference, setReference] = React.useState('')

  const start = () => {
    setQuantities(Object.fromEntries(order.lines.map((line) => [line.id, String(line.quantity)])))
    setDelivery('')
    setPoRef('')
    setPaid(false)
    setAmount('')
    setReference('')
    setOpen(true)
  }

  const total = Object.values(quantities).reduce((sum, value) => sum + (Number(value) || 0), 0)
  const ready = total > 0 && (!paid || Number(amount) > 0)

  const book = async () => {
    if (!ready || busy) return
    setBusy(true)
    try {
      const body = {
        repeatFrom: order.id,
        deliveryDate: delivery || null,
        customerPoRef: poRef.trim() || null,
        lines: order.lines.map((line) => ({ lineId: line.id, quantity: Number(quantities[line.id]) || 0 })),
        advanceReceived: paid ? { amount: Number(amount), reference: reference.trim() || null } : null,
      }
      const call = await runMutation({
        context: { orderId: order.id, action: 'quick_repeat' },
        mutationPayload: body,
        operation: () => apiCall<{ id?: string; orderNo?: string; error?: string }>('/api/dermat_orders/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
      })
      if (!call.ok || !call.result?.id) {
        flash(call.result?.error ?? t('dermat_orders.quickRepeat.error', 'Could not book the repeat order.'), 'error')
        return
      }
      flash(t('dermat_orders.quickRepeat.done', 'Repeat order {no} booked', { no: call.result.orderNo ?? '' }), 'success')
      setOpen(false)
      router.push(`/backend/orders/${call.result.id}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={start}>
        <Repeat className="mr-1.5 h-4 w-4" aria-hidden="true" />
        {t('dermat_orders.quickRepeat.open', 'Quick repeat')}
      </Button>
      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent
          className="max-h-screen overflow-y-auto sm:max-w-lg"
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault()
              void book()
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('dermat_orders.quickRepeat.title', 'Repeat {no}', { no: order.orderNo })}</DialogTitle>
            <DialogDescription>{t('dermat_orders.quickRepeat.lede', 'Same products, specs, prices and addresses as this order. Change the quantities and book. Set a quantity to 0 to leave a product out.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <ul className="divide-y rounded-md border">
              {order.lines.map((line) => (
                <li key={line.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{line.brandName ?? line.product?.title ?? '—'}</span>
                    <span className="block truncate text-xs text-muted-foreground">{[line.packSize, t('dermat_orders.quickRepeat.last', 'last time {qty}', { qty: formatQty(line.quantity) })].filter(Boolean).join(' · ')}</span>
                  </span>
                  <Input
                    id={`repeat-qty-${line.id}`}
                    className="w-28 shrink-0 text-right"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    aria-label={t('dermat_orders.quickRepeat.qtyFor', 'Quantity for {item}', { item: line.brandName ?? line.product?.title ?? '' })}
                    value={quantities[line.id] ?? ''}
                    onChange={(event) => setQuantities({ ...quantities, [line.id]: event.target.value })}
                  />
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="repeat-delivery">{t('dermat_orders.quickRepeat.delivery', 'Delivery date')}</Label>
                <Input id="repeat-delivery" type="date" value={delivery} onChange={(event) => setDelivery(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="repeat-po">{t('dermat_orders.quickRepeat.po', 'Customer PO no.')}</Label>
                <Input id="repeat-po" value={poRef} onChange={(event) => setPoRef(event.target.value)} />
              </div>
            </div>
            <div className="space-y-3 rounded-md border p-3">
              <label htmlFor="repeat-paid" className="flex items-center gap-2 text-sm font-medium">
                <Checkbox id="repeat-paid" checked={paid} onCheckedChange={(checked) => setPaid(checked === true)} />
                {t('dermat_orders.quickRepeat.paid', 'Advance already received')}
              </label>
              {paid ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="repeat-amount">{t('dermat_orders.quickRepeat.amount', 'Amount (₹)')}</Label>
                    <Input id="repeat-amount" type="number" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="repeat-ref">{t('dermat_orders.quickRepeat.ref', 'UTR / reference')}</Label>
                    <Input id="repeat-ref" value={reference} onChange={(event) => setReference(event.target.value)} />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="button" disabled={!ready || busy} onClick={() => void book()}>
              {t('dermat_orders.quickRepeat.book', 'Book repeat order')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default QuickRepeatDialog
