'use client'

import * as React from 'react'
import { Printer, Tags } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { openLabels, shipperBoxes, type LabelInfo } from './shipperLabels'
import type { Order, Stage } from '../types'

export function ShipperLabelsPanel({ order, stage }: { order: Order; stage: Stage }) {
  const t = useT()
  const packed = Number(stage.data?.packed_qty) || 0
  const ordered = order.lines.reduce((sum, line) => sum + line.quantity, 0)
  const [total, setTotal] = React.useState(String(packed || ordered || ''))
  const [perBox, setPerBox] = React.useState(String(stage.data?.pcs_per_shipper ?? '48'))
  const [busy, setBusy] = React.useState(false)
  const boxes = shipperBoxes(Number(total), Number(perBox))

  const print = async () => {
    setBusy(true)
    try {
      const call = await apiCall<LabelInfo & { error?: string }>('/api/dermat_orders/shipper-labels', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId: order.id }) })
      if (!call.ok || !call.result?.token) {
        flash(call.result?.error ?? t('dermat_orders.labels.failed', 'Could not prepare the labels.'), 'error')
        return
      }
      if (!openLabels(call.result, boxes)) flash(t('dermat_orders.labels.popup', 'Allow pop-ups for this site to print the labels.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Tags className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        {t('dermat_orders.labels.title', 'Shipper labels')}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="labels-total">{t('dermat_orders.labels.total', 'Pieces to ship')}</Label>
          <Input id="labels-total" type="number" inputMode="numeric" min="1" value={total} onChange={(event) => setTotal(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="labels-per">{t('dermat_orders.labels.perBox', 'Pieces per shipper')}</Label>
          <Input id="labels-per" type="number" inputMode="numeric" min="1" value={perBox} onChange={(event) => setPerBox(event.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {boxes.length
            ? t('dermat_orders.labels.count', '{count} labels · last box has {last} pcs', { count: boxes.length, last: boxes[boxes.length - 1] })
            : t('dermat_orders.labels.enter', 'Enter the pieces and pieces per shipper')}
        </p>
        <Button type="button" size="sm" variant="outline" disabled={busy || !boxes.length} onClick={() => void print()}>
          <Printer className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t('dermat_orders.labels.print', 'Print {count} labels', { count: boxes.length })}
        </Button>
      </div>
    </div>
  )
}

export default ShipperLabelsPanel
