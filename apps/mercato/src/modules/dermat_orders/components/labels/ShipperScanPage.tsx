'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { PackageCheck } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Spinner } from '@open-mercato/ui/primitives/spinner'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

type Shipment = { orderNo: string; batchNo: string | null; mfgDate: string | null; mfgMonth: string | null; expiryMonth: string | null; packedQty: number | null; products: Array<{ title: string; brandName: string | null; packSize: string | null; quantity: number }> }

export function ShipperScanPage({ token }: { token: string }) {
  const t = useT()
  const params = useSearchParams()
  const [data, setData] = React.useState<Shipment | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    apiCall<Shipment & { error?: string }>(`/api/dermat_orders/shipper-scan?token=${encodeURIComponent(token)}`, { headers: { 'x-om-forbidden-redirect': '0' } }).then((call) => {
      if (call.ok && call.result) setData(call.result)
      else setError(call.result?.error ?? t('dermat_orders.scan.unknown', 'This label is not known.'))
    })
  }, [token, t])

  const box = params?.get('box')
  const of = params?.get('of')
  const pcs = params?.get('pcs')
  const rows: Array<[string, string | null]> = data
    ? [
        [t('dermat_orders.scan.order', 'Order'), data.orderNo],
        [t('dermat_orders.scan.batch', 'Batch'), data.batchNo],
        [t('dermat_orders.scan.mfg', 'Manufactured'), data.mfgMonth ?? data.mfgDate],
        [t('dermat_orders.scan.expiry', 'Expiry'), data.expiryMonth],
        [t('dermat_orders.scan.box', 'Box'), box && of ? `${box} of ${of}` : null],
        [t('dermat_orders.scan.pieces', 'Pieces in this box'), pcs],
        [t('dermat_orders.scan.packed', 'Packed in total'), data.packedQty !== null ? String(data.packedQty) : null],
      ]
    : []

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <header className="border-b pb-3">
          <p className="text-lg font-extrabold tracking-wider">DERMAT INDIA</p>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{t('dermat_orders.scan.kicker', 'Shipment')}</p>
        </header>
        {error ? <p className="rounded-md border border-status-error-border bg-status-error-bg p-4 text-sm text-status-error-text">{error}</p> : null}
        {!data && !error ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : null}
        {data ? (
          <section className="space-y-3 rounded-lg border bg-card p-4">
            {data.products.map((product, index) => (
              <p key={index} className="flex items-start gap-2 text-base font-semibold">
                <PackageCheck className="mt-0.5 h-5 w-5 shrink-0 text-status-success-icon" aria-hidden="true" />
                <span>
                  {product.title}
                  <span className="block text-sm font-normal text-muted-foreground">{[product.brandName, product.packSize].filter(Boolean).join(' · ')}</span>
                </span>
              </p>
            ))}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {rows
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="font-medium">{value}</dd>
                  </div>
                ))}
            </dl>
          </section>
        ) : null}
      </div>
    </main>
  )
}

export default ShipperScanPage
