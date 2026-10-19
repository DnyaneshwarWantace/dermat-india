'use client'

import * as React from 'react'
import { Boxes, CircleAlert } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { Order } from './types'

export function PackingSetPanel({ order }: { order: Order }) {
  const t = useT()
  const sets = order.packingSets ?? []
  if (!sets.length) return null
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Boxes className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        {t('dermat_orders.packSet.title', 'Packing code for each product')}
      </p>
      <ul className="space-y-2 text-sm">
        {sets.map((set) => (
          <li key={set.lineId} className="space-y-0.5">
            <p className="font-medium">{set.product}</p>
            {set.code && set.name ? (
              <>
                <p className="text-xs">
                  <span className="mr-1 rounded-sm bg-muted px-1.5 py-0.5 font-mono">{set.code}</span>
                  {[set.name, set.size].filter(Boolean).join(' · ')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[...set.parts.map((part) => (part.qty === 1 ? part.name : `${part.qty} × ${part.name}`)), ...set.printed.map((item) => `${item} (printed for this product)`)].join(' + ')}
                </p>
                {set.specs ? <p className="text-xs text-muted-foreground">{set.specs}</p> : null}
              </>
            ) : (
              <p className="flex items-center gap-1 text-xs text-status-warning-text">
                <CircleAlert className="h-3 w-3" aria-hidden="true" />
                {set.code ? t('dermat_orders.packSet.unknown', '{code} is not in Masters → Packaging codes', { code: set.code }) : t('dermat_orders.packSet.none', 'No packing code on this product yet')}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default PackingSetPanel
