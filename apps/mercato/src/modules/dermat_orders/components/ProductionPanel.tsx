"use client"

import * as React from 'react'
import { Clock, FlaskConical, Gauge } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { formatQty } from './format'
import { productionLimits } from '../lib/stages'
import { useListOptions } from '../../dermat_lists/components/useListOptions'

type Plan = { lineId: string; fgId: string; pieces: number; bulkId: string; bulkUnit: string; kgPerPiece: number; plannedKg: number }
type Batch = { bulkId: string; lotNumber: string; onHand: number; manufacturedAt: string | null }

const USE_EXISTING = 'Use bulk already made'

type StepTimes = Record<string, { done?: boolean; at?: string | null }>


function minutesBetween(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start) return null
  const from = new Date(start).getTime()
  const to = end ? new Date(end).getTime() : Date.now()
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return null
  return Math.round((to - from) / 60000)
}

function clock(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'
}

export function ProductionPanel({
  orderId,
  stageKey,
  values,
  steps = {},
  editable,
  onChange,
}: {
  orderId: string
  stageKey: 'manufacturing' | 'filling'
  values: Record<string, string>
  steps?: StepTimes
  editable: boolean
  onChange: (key: string, value: string) => void
}) {
  const t = useT()
  const [plan, setPlan] = React.useState<Plan[] | null>(null)
  const [batches, setBatches] = React.useState<Batch[]>([])

  React.useEffect(() => {
    apiCall<{ plan: Plan[]; batches: Batch[] }>(`/api/dermat_orders/orders/bulk?orderId=${encodeURIComponent(orderId)}`, undefined, { fallback: { plan: [], batches: [] } }).then((call) => {
      setPlan(call.result?.plan ?? [])
      setBatches(call.result?.batches ?? [])
    })
  }, [orderId])

  const limits = productionLimits(useListOptions('production_limits'))
  const plannedTotal = plan ? plan.reduce((sum, entry) => sum + entry.plannedKg, 0) : 0
  React.useEffect(() => {
    if (stageKey === 'manufacturing' && editable && plannedTotal > 0 && !values.planned_kg) onChange('planned_kg', String(Math.round(plannedTotal * 1000) / 1000))
  }, [stageKey, editable, plannedTotal, values.planned_kg, onChange])

  if (!plan) return null
  const planned = Number(values.planned_kg) || plannedTotal
  const unit = plan[0]?.bulkUnit ?? 'kg'

  if (stageKey === 'filling') {
    const filled = Number(values.filled_units) || 0
    const pieces = plan.reduce((sum, entry) => sum + entry.pieces, 0) || 1
    const uses = plan.reduce((sum, entry) => sum + entry.kgPerPiece * entry.pieces * (filled / pieces), 0)
    return (
      <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">{t('dermat_orders.production.fillUses', 'Bulk this filling uses')}</p>
          <p className="font-semibold tabular-nums">
            {formatQty(uses || planned, 3)} {unit}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t('dermat_orders.production.perPiece', 'Per piece (fill size × SG)')}</p>
          <p className="font-semibold tabular-nums">
            {formatQty(plan[0]?.kgPerPiece ?? 0, 4)} {unit}
          </p>
        </div>
      </div>
    )
  }

  const made = Number(values.batch_size) || 0
  const wastage = Number(values.wastage_kg) || 0
  const minutes = minutesBetween(steps.started?.at, steps.manufactured?.at)
  const yieldPercent = planned > 0 && made > 0 ? Math.round((made / planned) * 1000) / 10 : null
  const reusing = values.bulk_source === USE_EXISTING

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <FlaskConical className="h-3 w-3" aria-hidden="true" />
            {t('dermat_orders.production.planned', 'Planned (BOM)')}
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums">
            {formatQty(planned, 3)} {unit}
          </p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Gauge className="h-3 w-3" aria-hidden="true" />
            {t('dermat_orders.production.yield', 'Yield')}
          </p>
          <p className={cn('mt-0.5 text-sm font-semibold tabular-nums', yieldPercent !== null && (yieldPercent < limits.yieldLow || yieldPercent > limits.yieldHigh) && 'text-status-warning-text')}>
            {yieldPercent === null ? '—' : `${yieldPercent}%`}
            {wastage ? <span className="ml-1 text-xs font-normal text-muted-foreground">· {formatQty(wastage, 2)} {unit} waste</span> : null}
          </p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {t('dermat_orders.production.duration', 'Machine time')}
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums">{minutes === null ? '—' : `${Math.floor(minutes / 60)} h ${minutes % 60} m`}</p>
          <p className="text-xs text-muted-foreground">{clock(steps.started?.at)} → {steps.manufactured?.at ? clock(steps.manufactured.at) : t('dermat_orders.production.running', 'running')}</p>
        </div>
      </div>
      {yieldPercent !== null && (yieldPercent > limits.yieldHigh || yieldPercent < limits.yieldLow) ? (
        <p className="rounded-md border border-status-warning-border bg-status-warning-bg px-3 py-2 text-xs text-status-warning-text">
          {t('dermat_orders.production.yieldOut', 'Yield {value}% is outside {low}–{high}%. Write the reason in Remarks (water loss, evaporation, spillage).', { value: yieldPercent, low: limits.yieldLow, high: limits.yieldHigh })}
        </p>
      ) : null}
      {reusing ? (
        <div className="rounded-lg border border-status-info-border bg-status-info-bg p-3">
          <p className="text-xs font-medium text-status-info-text">
            {t('dermat_orders.production.reuseHint', 'Pick a QC-approved bulk batch in PRODUCTION. This order skips its own store request and bulk QC.')}
          </p>
          {batches.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {batches.map((batch) => {
                const enough = batch.onHand >= planned - 0.0001
                const active = values.batch_no === batch.lotNumber
                return (
                  <button
                    key={`${batch.bulkId}-${batch.lotNumber}`}
                    type="button"
                    disabled={!editable || !enough}
                    onClick={() => {
                      onChange('batch_no', batch.lotNumber)
                      onChange('batch_size', String(Math.round(planned * 1000) / 1000))
                    }}
                    className={cn(
                      'rounded-md border bg-card px-2.5 py-1.5 text-left text-xs transition-colors',
                      active ? 'border-primary ring-1 ring-primary' : 'border-border hover:bg-muted',
                      !enough && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    <span className="block font-mono font-semibold">{batch.lotNumber}</span>
                    <span className="text-muted-foreground">
                      {formatQty(batch.onHand, 3)} {unit} {t('dermat_orders.production.left', 'left')}
                      {!enough ? ` · ${t('dermat_orders.production.notEnough', 'not enough')}` : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">{t('dermat_orders.production.noBatches', 'No approved bulk of this product is in PRODUCTION.')}</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
