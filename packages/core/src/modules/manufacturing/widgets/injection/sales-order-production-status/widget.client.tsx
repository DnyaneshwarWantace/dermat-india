'use client'

import * as React from 'react'
import Link from 'next/link'
import { Factory } from 'lucide-react'
import { Button } from '@wantace/ui/primitives/button'
import {
  StatusBadge,
  type StatusMap,
} from '@wantace/ui/primitives/status-badge'
import { apiCall } from '@wantace/ui/backend/utils/apiCall'
import { useT } from '@wantace/shared/lib/i18n/context'
import type { InjectionWidgetComponentProps } from '@wantace/shared/modules/widgets/injection'

type ProductionOrderStatus = 'draft' | 'planned' | 'in_progress' | 'completed' | 'cancelled'

type ProductionOrderRow = {
  id: string
  order_number: string
  product_name: string
  status: ProductionOrderStatus
  planned_quantity: string | number
  actual_quantity?: string | number | null
  planned_start_date?: string | null
  planned_end_date?: string | null
}

export type SalesOrderRecord = Record<string, unknown> & {
  id?: string
}

const statusMap: StatusMap<ProductionOrderStatus> = {
  draft: 'neutral',
  planned: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'error',
}

export default function SalesOrderProductionStatusWidget(
  props: InjectionWidgetComponentProps<unknown, SalesOrderRecord>,
) {
  const { data } = props
  const t = useT()
  const orderId = typeof data?.id === 'string' && data.id.length > 0 ? data.id : null

  const [orders, setOrders] = React.useState<ProductionOrderRow[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!orderId) return
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const params = new URLSearchParams({
          salesOrderId: orderId,
          page: '1',
          pageSize: '50',
        })
        const res = await apiCall(`/api/manufacturing/production-orders?${params}`)
        const items = (res as { items?: ProductionOrderRow[] })?.items ?? []
        if (!cancelled) setOrders(items)
      } catch {
        if (!cancelled) setOrders([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [orderId])

  if (!orderId) return null
  if (loading) {
    return (
      <div className="rounded-lg border bg-card px-4 py-3">
        <p className="text-sm text-muted-foreground">
          {t('manufacturing.widgets.salesOrder.loading', 'Loading production status…')}
        </p>
      </div>
    )
  }
  if (orders.length === 0) {
    return (
      <div className="rounded-lg border bg-card px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <Factory className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium">
            {t('manufacturing.widgets.salesOrder.title', 'Production Status')}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('manufacturing.widgets.salesOrder.none', 'No production orders linked to this sales order.')}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/backend/manufacturing/production-orders/create">
            {t('manufacturing.widgets.salesOrder.createAction', 'Create Production Order')}
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card px-4 py-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Factory className="size-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">
              {t('manufacturing.widgets.salesOrder.title', 'Production Status')}
            </p>
            <p className="text-xs text-muted-foreground">
              {orders.length} {t('manufacturing.widgets.salesOrder.orderCount', 'production order(s)')}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {orders.map((po) => (
          <div
            key={po.id}
            className="rounded-md border border-border/70 bg-background px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/backend/manufacturing/production-orders/${encodeURIComponent(po.id)}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                {po.order_number}
              </Link>
              <StatusBadge variant={statusMap[po.status]} dot>
                {t(`manufacturing.productionOrder.status.${po.status}`, po.status)}
              </StatusBadge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{po.product_name}</p>
            <div className="mt-1 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>
                {t('manufacturing.widgets.salesOrder.planned', 'Planned')}{': '}
                {Number(po.planned_quantity)}
              </span>
              {po.actual_quantity != null && Number(po.actual_quantity) > 0 && (
                <span>
                  {t('manufacturing.widgets.salesOrder.actual', 'Actual')}{': '}
                  {Number(po.actual_quantity)}
                </span>
              )}
              {po.planned_start_date && (
                <span>
                  {t('manufacturing.widgets.salesOrder.start', 'Start')}{': '}
                  {new Date(po.planned_start_date).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <Button asChild variant="outline" size="sm">
        <Link href="/backend/manufacturing/production-orders">
          {t('manufacturing.widgets.salesOrder.viewAll', 'View all production orders')}
        </Link>
      </Button>
    </div>
  )
}
