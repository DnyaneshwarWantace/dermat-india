"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { daysUntil, formatDate, formatQty } from '../format'
import type { Order } from '../types'

function Kpi({ label, value, note, tone }: { label: string; value: string; note?: string | null; tone?: 'bad' | 'warn' }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 border-r px-4 py-3 last:border-r-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('truncate text-base font-semibold tabular-nums', tone === 'bad' && 'text-status-error-text', tone === 'warn' && 'text-status-warning-text')}>{value}</span>
      {note ? <span className="truncate text-xs text-muted-foreground">{note}</span> : null}
    </div>
  )
}

export function OrderKpis({ order }: { order: Order }) {
  const t = useT()
  const done = order.stages.filter((stage) => stage.status === 'done' || stage.status === 'skipped').length
  const current = order.stages.filter((stage) => stage.status === 'open' || stage.status === 'on_hold')
  const left = daysUntil(order.deliveryDate)
  const finished = order.status === 'completed' || order.status === 'cancelled'
  const pieces = order.lines.reduce((sum, line) => sum + line.quantity, 0)
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-lg border bg-card md:grid-cols-5">
      <Kpi label={t('dermat_orders.kpi.progress', 'Stages done')} value={`${done} / ${order.stages.length}`} />
      <Kpi
        label={t('dermat_orders.kpi.now', 'Now at')}
        value={current.map((stage) => stage.label).join(' + ') || (finished ? t(`dermat_orders.status.${order.status}`, order.status) : '—')}
        note={current.map((stage) => [stage.responsibleName, stage.days != null ? `${formatQty(stage.days, 1)} d` : null].filter(Boolean).join(' · ')).join(' + ')}
        tone={current.some((stage) => stage.status === 'on_hold') ? 'bad' : undefined}
      />
      <Kpi
        label={t('dermat_orders.kpi.delivery', 'Delivery')}
        value={formatDate(order.deliveryDate)}
        note={left !== null && !finished ? (left < 0 ? t('dermat_orders.view.late', '{days} d late', { days: -left }) : t('dermat_orders.view.left', '{days} d left', { days: left })) : null}
        tone={left !== null && left < 0 && !finished ? 'bad' : undefined}
      />
      <Kpi label={t('dermat_orders.kpi.pieces', 'Pieces')} value={formatQty(pieces, 0)} note={order.lines.map((line) => line.product?.code ?? line.product?.title).filter(Boolean).join(', ')} />
      {order.totals && order.payments ? (
        <Kpi label={t('dermat_orders.kpi.value', 'Value · balance')} value={`₹${formatQty(order.totals.total, 0)}`} note={t('dermat_orders.kpi.balance', '₹{amount} still due', { amount: formatQty(Math.max(0, order.payments.due), 0) })} tone={order.payments.due > 0.5 ? 'warn' : undefined} />
      ) : (
        <Kpi label={t('dermat_orders.kpi.batch', 'Batch')} value={order.lines.map((line) => line.batchNo).filter(Boolean).join(', ') || '—'} />
      )}
    </div>
  )
}
