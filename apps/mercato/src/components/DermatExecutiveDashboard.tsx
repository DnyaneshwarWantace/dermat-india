'use client'

import * as React from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@open-mercato/ui/primitives/card'
import { Button } from '@open-mercato/ui/primitives/button'
import { StatusBadge, type StatusBadgeVariant } from '@open-mercato/ui/primitives/status-badge'
import { KpiCard } from '@open-mercato/ui/backend/charts'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import {
  ShoppingCart,
  FlaskConical,
  FileText,
  Layers,
  Boxes,
  ArrowRight,
  Plus,
} from 'lucide-react'

type OrderRow = {
  id: string
  status?: string | null
}

type OrdersResponse = { items?: OrderRow[]; total?: number }

const STAGE_LABELS: Record<string, string> = {
  draft: 'New',
  pending: 'New',
  confirmed: 'Verified / Official',
  processing: 'In Production',
  completed: 'Dispatched / Completed',
  cancelled: 'Cancelled',
}

const STAGE_VARIANTS: Record<string, StatusBadgeVariant> = {
  draft: 'neutral',
  pending: 'neutral',
  confirmed: 'info',
  processing: 'warning',
  completed: 'success',
  cancelled: 'error',
}

const quickLinks = [
  { href: '/backend/sales/order-book', label: 'Sales Order Book', icon: ShoppingCart },
  { href: '/backend/dermat_bom', label: 'Bill of Materials', icon: FlaskConical },
  { href: '/backend/dermat_purchase_orders', label: 'Purchase Orders', icon: FileText },
  { href: '/backend/dermat_rm_master', label: 'Raw Material Master', icon: Layers },
  { href: '/backend/dermat_pm_master', label: 'Packaging Master', icon: Boxes },
]

export default function DermatExecutiveDashboard() {
  const t = useT()
  const [orders, setOrders] = React.useState<OrderRow[] | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    apiCall<OrdersResponse>('/api/sales/orders?pageSize=100', undefined, { fallback: { items: [] } })
      .then((res) => {
        if (cancelled) return
        if (!res.ok) {
          setError(t('dashboard.orders.error', 'Could not load order data'))
          return
        }
        setOrders(res.result?.items ?? [])
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [t])

  const total = orders?.length ?? 0
  const byStatus = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const order of orders ?? []) {
      const key = (order.status ?? 'draft').toLowerCase()
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [orders])

  const openOrders = total - (byStatus.get('completed') ?? 0) - (byStatus.get('cancelled') ?? 0)
  const dispatched = byStatus.get('completed') ?? 0

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t('dashboard.title', 'Dermat India — Operations')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('dashboard.subtitle', 'Order pipeline overview and quick access to core modules.')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm">
          <Link href="/backend/sales/order-book">
            <ShoppingCart className="mr-1.5 h-4 w-4" />
            {t('dashboard.actions.orderBook', 'Order Book')}
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/backend/dermat_bom">
            <FlaskConical className="mr-1.5 h-4 w-4" />
            {t('dashboard.actions.bom', 'BOM Recipes')}
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/backend/dermat_purchase_orders/create">
            <Plus className="mr-1.5 h-4 w-4" />
            {t('dashboard.actions.issuePo', 'Issue P.O.')}
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          title={t('dashboard.kpi.totalOrders', 'Total Orders')}
          value={loading ? null : total}
          loading={loading}
          error={error}
        />
        <KpiCard
          title={t('dashboard.kpi.openOrders', 'Open Orders')}
          value={loading ? null : Math.max(openOrders, 0)}
          loading={loading}
          error={error}
        />
        <KpiCard
          title={t('dashboard.kpi.dispatched', 'Dispatched')}
          value={loading ? null : dispatched}
          loading={loading}
          error={error}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
          <CardTitle className="text-sm font-semibold">
            {t('dashboard.pipeline.title', 'Orders by Stage')}
          </CardTitle>
          <Button asChild variant="ghost" size="sm" className="text-xs">
            <Link href="/backend/sales/order-book">
              {t('dashboard.pipeline.viewAll', 'View order book')}
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading…')}</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : total === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('dashboard.pipeline.empty', 'No orders yet.')}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {[...byStatus.entries()].map(([status, count]) => (
                <StatusBadge key={status} variant={STAGE_VARIANTS[status] ?? 'neutral'} dot>
                  {STAGE_LABELS[status] ?? status} · {count}
                </StatusBadge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3 pt-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('dashboard.quickLinks.title', 'Core Modules')}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {quickLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col justify-between gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon className="h-4.5 w-4.5" />
              </div>
              <p className="text-xs font-medium text-foreground">{label}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
