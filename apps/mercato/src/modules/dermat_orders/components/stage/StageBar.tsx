"use client"

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
          return (
            <li key={stage.key} className={cn('border-r last:border-r-0', active && 'bg-muted')}>
              <Link
                href={`/backend/orders/${order.id}/stages/${stage.key}`}
                aria-current={active ? 'step' : undefined}
                className={cn('flex w-36 flex-col gap-0.5 px-3 py-2 text-xs hover:bg-muted', stage.status === 'waiting' && 'text-muted-foreground')}
              >
                <span className="flex items-center gap-1.5">
                  <span className={cn('size-2 shrink-0 rounded-full', DOT[stage.status])} aria-hidden="true" />
                  <span className="tabular-nums text-muted-foreground">{index + 1}</span>
                  <span className={cn('truncate font-semibold', active && 'text-foreground')}>{stage.label}</span>
                  {stage.locked ? <Lock className="ml-auto size-3 shrink-0 text-muted-foreground" aria-label={t('dermat_orders.locked.with', 'Details with {department}', { department: stage.department })} /> : null}
                </span>
                <span className="truncate text-muted-foreground">
                  {person ??
                    (stage.status === 'skipped'
                      ? t('dermat_orders.rail.skipped', 'Skipped')
                      : stage.status === 'done'
                        ? t('dermat_orders.rail.done', 'Done')
                        : stage.status === 'on_hold'
                          ? t('dermat_orders.rail.onHold', 'On hold')
                          : stage.status === 'open'
                            ? stage.department
                            : t('dermat_orders.rail.waiting', 'Coming'))}
                  {stage.days != null && stage.status !== 'waiting' ? ` · ${formatQty(stage.days, 1)} d` : ''}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
