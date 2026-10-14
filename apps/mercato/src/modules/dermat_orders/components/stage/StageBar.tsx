"use client"

import * as React from 'react'
import Link from 'next/link'
import { Check, Lock, X } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { formatQty } from '../format'
import type { Order, Stage } from '../types'

const DOT: Record<Stage['status'], string> = {
  done: 'bg-status-success-icon border-status-success-icon text-status-success-bg',
  skipped: 'bg-muted-foreground border-muted-foreground text-muted',
  open: 'bg-status-warning-icon border-status-warning-icon text-status-warning-bg',
  on_hold: 'bg-status-error-icon border-status-error-icon text-status-error-bg',
  waiting: 'bg-card border-border text-muted-foreground',
}

const LINE_DONE: Record<Stage['status'], boolean> = {
  done: true,
  skipped: true,
  open: false,
  on_hold: false,
  waiting: false,
}

function personText(stage: Stage): string | null {
  if (stage.status === 'waiting' || stage.status === 'skipped') return null
  return stage.status === 'done' ? stage.completedByName ?? stage.responsibleName : stage.responsibleName ?? stage.department
}

export function StageBar({ order, current }: { order: Order; current: string }) {
  const t = useT()
  return (
    <nav aria-label={t('dermat_orders.stagePage.map', 'All stages of this order')} className="overflow-x-auto rounded-lg border bg-card px-2 py-3" data-drag-scroll>
      <ol className="flex min-w-max items-start">
        {order.stages.map((stage, index) => {
          const active = stage.key === current
          const person = personText(stage)
          const prev = order.stages[index - 1]
          const lineFilled = prev ? LINE_DONE[prev.status] && LINE_DONE[stage.status] : false
          return (
            <React.Fragment key={stage.key}>
              {index > 0 ? (
                <div className={cn('mt-3.5 h-0.5 w-6 shrink-0', lineFilled ? 'bg-status-success-icon' : 'bg-border')} aria-hidden="true" />
              ) : null}
              <li className="flex w-28 shrink-0 flex-col items-center text-center">
                <Link
                  href={`/backend/orders/${order.id}/stages/${stage.key}`}
                  aria-current={active ? 'step' : undefined}
                  className="group flex flex-col items-center gap-1.5"
                >
                  <span
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-transform group-hover:scale-105',
                      DOT[stage.status],
                      active && 'ring-2 ring-offset-2 ring-offset-card ring-primary',
                    )}
                  >
                    {stage.status === 'done' ? <Check className="size-3.5" aria-hidden="true" /> : stage.status === 'skipped' ? <X className="size-3.5" aria-hidden="true" /> : index + 1}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className={cn('truncate text-xs font-semibold', active ? 'text-foreground' : 'text-muted-foreground')}>{stage.label}</span>
                    {stage.locked ? <Lock className="size-3 shrink-0 text-muted-foreground" aria-label={t('dermat_orders.locked.with', 'Details with {department}', { department: stage.department })} /> : null}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {person ?? (stage.status === 'skipped' ? t('dermat_orders.rail.skipped', 'Skipped') : t('dermat_orders.rail.waiting', 'Coming'))}
                    {stage.days != null && stage.status !== 'waiting' ? ` · ${formatQty(stage.days, 1)} d` : ''}
                  </span>
                </Link>
              </li>
            </React.Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
