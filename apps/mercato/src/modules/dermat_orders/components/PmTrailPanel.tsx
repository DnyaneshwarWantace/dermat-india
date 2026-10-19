'use client'

import * as React from 'react'
import { PackageSearch } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { formatQty } from './format'

type Row = { productId: string; title: string; code: string | null; unit: string; primary: boolean; perPiece: number; needed: number; issued: number; received: number; used: number; rejected: number; returned: number; unaccounted: number; notReceived: number }
type Trail = { pieces: number; filled: number; fillRejected: number; handedToPacking: number; packed: number; packRejected: number; items: Row[] }

export function PmTrailPanel({ orderId, mode, refreshKey }: { orderId: string; mode: 'pack' | 'trail'; refreshKey?: string }) {
  const t = useT()
  const [trail, setTrail] = React.useState<Trail | null>(null)

  React.useEffect(() => {
    apiCall<Trail>(`/api/dermat_orders/orders/pm-trail?orderId=${encodeURIComponent(orderId)}`, { headers: { 'x-om-forbidden-redirect': '0' } }, { fallback: null as unknown as Trail }).then((call) => setTrail(call.ok ? call.result ?? null : null))
  }, [orderId, refreshKey])

  if (!trail || !trail.items.length) return null
  const rows = mode === 'pack' ? [...trail.items].sort((a, b) => Number(a.primary) - Number(b.primary)) : trail.items
  const flagged = trail.items.filter((row) => row.unaccounted > 0.0001)

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <PackageSearch className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {mode === 'pack' ? t('dermat_orders.trail.packTitle', 'What to pack') : t('dermat_orders.trail.title', 'Where every packing item went')}
        </p>
        <span className="text-xs text-muted-foreground">
          {t('dermat_orders.trail.summary', 'Filled {filled} · rejected {rejected} · to packing {handed} · packed {packed}', { filled: formatQty(trail.filled), rejected: formatQty(trail.fillRejected), handed: formatQty(trail.handedToPacking), packed: formatQty(trail.packed) })}
        </span>
      </div>
      {flagged.length ? (
        <p className="rounded-md bg-status-error-bg px-2 py-1.5 text-xs font-medium text-status-error-text">
          {t('dermat_orders.trail.flag', 'Not accounted for: {list}. QA and the store must explain.', { list: flagged.map((row) => `${row.title} ${formatQty(row.unaccounted)} ${row.unit}`).join(', ') })}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 pr-2 text-left font-medium">{t('dermat_orders.trail.item', 'Item')}</th>
              <th className="px-2 py-1 text-right font-medium">{t('dermat_orders.trail.perPiece', 'Per pc')}</th>
              <th className="px-2 py-1 text-right font-medium">{t('dermat_orders.trail.needed', 'Needed')}</th>
              <th className="px-2 py-1 text-right font-medium">{t('dermat_orders.trail.issued', 'Issued')}</th>
              <th className="px-2 py-1 text-right font-medium">{t('dermat_orders.trail.received', 'Received')}</th>
              <th className="px-2 py-1 text-right font-medium">{t('dermat_orders.trail.used', 'Used')}</th>
              <th className="px-2 py-1 text-right font-medium">{t('dermat_orders.trail.rejected', 'Rejected')}</th>
              <th className="px-2 py-1 text-right font-medium">{t('dermat_orders.trail.returned', 'Returned')}</th>
              <th className="py-1 pl-2 text-right font-medium">{t('dermat_orders.trail.missing', 'Missing')}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((row) => (
              <tr key={row.productId} className="border-t">
                <td className="py-1.5 pr-2">
                  <span className="block font-medium">{row.title}</span>
                  <span className="text-muted-foreground">{row.primary ? t('dermat_orders.trail.primary', 'Filling (bottle / tube / label)') : t('dermat_orders.trail.secondary', 'Packing (carton / shipper)')}</span>
                </td>
                <td className="px-2 py-1.5 text-right">{formatQty(row.perPiece, 4)}</td>
                <td className="px-2 py-1.5 text-right">{formatQty(row.needed)}</td>
                <td className="px-2 py-1.5 text-right">{formatQty(row.issued)}</td>
                <td className={cn('px-2 py-1.5 text-right', row.notReceived > 0.0001 && 'text-status-warning-text')}>{formatQty(row.received)}</td>
                <td className="px-2 py-1.5 text-right">{formatQty(row.used)}</td>
                <td className="px-2 py-1.5 text-right">{formatQty(row.rejected)}</td>
                <td className="px-2 py-1.5 text-right">{formatQty(row.returned)}</td>
                <td className={cn('py-1.5 pl-2 text-right', row.unaccounted > 0.0001 ? 'font-semibold text-status-error-text' : 'text-muted-foreground')}>{row.unaccounted > 0.0001 ? formatQty(row.unaccounted) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default PmTrailPanel
