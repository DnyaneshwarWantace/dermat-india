'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ShoppingCart } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { Button } from '@open-mercato/ui/primitives/button'
import { Checkbox } from '@open-mercato/ui/primitives/checkbox'
import { Input } from '@open-mercato/ui/primitives/input'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useGranted } from '../../dermat_departments/components/useGranted'
import { formatDate, formatQty } from './format'

type Item = { productId: string; title: string; code: string | null; unit: string; quantity: number; onHand: number; onPo: number }
type Po = { id: string; code: string; status: string; vendorName: string | null; poDate: string; lines: Array<{ productId: string; quantity: number; received: number }> }

const PO_WORD: Record<string, { label: string; variant: 'neutral' | 'warning' | 'info' | 'success' | 'error' }> = {
  draft: { label: 'Draft', variant: 'neutral' },
  pending_approval: { label: 'Waiting approval', variant: 'warning' },
  approved: { label: 'Ordered', variant: 'info' },
  partly_received: { label: 'Partly received', variant: 'info' },
  received: { label: 'Received', variant: 'success' },
}

export function PmOrderPanel({ orderId, editable }: { orderId: string; editable: boolean }) {
  const t = useT()
  const router = useRouter()
  const granted = useGranted()
  const [data, setData] = React.useState<{ orderNo: string; items: Item[]; pos: Po[] } | null>(null)
  const [picked, setPicked] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    apiCall<{ orderNo: string; items: Item[]; pos: Po[] }>(`/api/dermat_orders/orders/pm-orders?orderId=${encodeURIComponent(orderId)}`, { headers: { 'x-om-forbidden-redirect': '0' } }, { fallback: { orderNo: '', items: [], pos: [] } }).then((call) => {
      const result = call.result ?? { orderNo: '', items: [], pos: [] }
      setData(result)
      setPicked(Object.fromEntries(result.items.map((item) => [item.productId, String(Math.max(0, Math.ceil(item.quantity - item.onHand - item.onPo)))]).filter(([, qty]) => Number(qty) > 0)))
    })
  }, [orderId])

  if (!data || !data.items.length) return null
  const canRaise = editable && granted.has('dermat_purchase.manage')
  const chosen = Object.entries(picked).filter(([, qty]) => Number(qty) > 0)
  const raise = () => {
    const items = chosen.map(([productId, qty]) => `${productId}:${Number(qty)}`).join(',')
    router.push(`/backend/purchase/orders/new?items=${items}&orders=${orderId}:${encodeURIComponent(data.orderNo)}`)
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <ShoppingCart className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        {t('dermat_orders.pmOrder.title', 'Order packing material')}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              {canRaise ? <th className="w-8 py-1" /> : null}
              <th className="py-1 text-left font-medium">{t('dermat_orders.pmOrder.item', 'Item')}</th>
              <th className="py-1 text-right font-medium">{t('dermat_orders.pmOrder.needed', 'Needed')}</th>
              <th className="py-1 text-right font-medium">{t('dermat_orders.pmOrder.stock', 'In stock')}</th>
              <th className="py-1 text-right font-medium">{t('dermat_orders.pmOrder.onPo', 'On PO')}</th>
              {canRaise ? <th className="py-1 text-right font-medium">{t('dermat_orders.pmOrder.toOrder', 'To order')}</th> : null}
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => {
              const short = item.quantity - item.onHand - item.onPo > 0
              const on = picked[item.productId] !== undefined
              return (
                <tr key={item.productId} className="border-t">
                  {canRaise ? (
                    <td className="py-1.5">
                      <Checkbox
                        id={`pm-pick-${item.productId}`}
                        aria-label={item.title}
                        checked={on}
                        onCheckedChange={(checked) =>
                          setPicked((prev) => {
                            const next = { ...prev }
                            if (checked === true) next[item.productId] = String(Math.max(1, Math.ceil(item.quantity - item.onHand - item.onPo)))
                            else delete next[item.productId]
                            return next
                          })
                        }
                      />
                    </td>
                  ) : null}
                  <td className="py-1.5">
                    <span className="block">{item.title}</span>
                    {item.code ? <span className="block font-mono text-xs text-muted-foreground">{item.code}</span> : null}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{formatQty(item.quantity)} {item.unit}</td>
                  <td className={cn('py-1.5 text-right tabular-nums', short && 'text-status-warning-text')}>{formatQty(item.onHand)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatQty(item.onPo)}</td>
                  {canRaise ? (
                    <td className="py-1.5 text-right">
                      <Input
                        aria-label={t('dermat_orders.pmOrder.qtyFor', 'Quantity to order for {item}', { item: item.title })}
                        className="ml-auto h-8 w-24 text-right"
                        type="number"
                        min="0"
                        disabled={!on}
                        value={picked[item.productId] ?? ''}
                        onChange={(event) => setPicked((prev) => ({ ...prev, [item.productId]: event.target.value }))}
                      />
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {canRaise ? (
        <div className="flex justify-end">
          <Button type="button" size="sm" variant="outline" disabled={!chosen.length} onClick={raise}>
            {t('dermat_orders.pmOrder.raise', 'Make a PO for {count} item(s)', { count: chosen.length })}
          </Button>
        </div>
      ) : editable ? (
        <p className="text-xs text-muted-foreground">{t('dermat_orders.pmOrder.askPurchase', 'Purchase raises the PO for what is short.')}</p>
      ) : null}
      {data.pos.length ? (
        <ul className="divide-y rounded-md border text-sm">
          {data.pos.map((po) => {
            const word = PO_WORD[po.status] ?? { label: po.status, variant: 'neutral' as const }
            const ordered = po.lines.reduce((sum, line) => sum + line.quantity, 0)
            const received = po.lines.reduce((sum, line) => sum + Math.min(line.received, line.quantity), 0)
            return (
              <li key={po.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0">
                  {granted.has('dermat_purchase.view') ? (
                    <Link href={`/backend/purchase/orders/${po.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">
                      {po.code}
                    </Link>
                  ) : (
                    <span className="font-mono text-xs font-semibold">{po.code}</span>
                  )}
                  <span className="block truncate text-xs text-muted-foreground">{[po.vendorName, formatDate(po.poDate), ordered ? `${Math.round((received / ordered) * 100)}% received` : null].filter(Boolean).join(' · ')}</span>
                </span>
                <StatusBadge variant={word.variant}>{word.label}</StatusBadge>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

export default PmOrderPanel
