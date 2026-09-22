'use client'

import * as React from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@open-mercato/ui/primitives/card'
import { Button } from '@open-mercato/ui/primitives/button'
import { StatusBadge, type StatusBadgeVariant } from '@open-mercato/ui/primitives/status-badge'
import { KpiCard, TopNTable } from '@open-mercato/ui/backend/charts'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import {
  ShoppingCart,
  FlaskConical,
  FileText,
  Layers,
  Boxes,
  Plus,
  ShieldCheck,
  Truck,
  AlertTriangle,
} from 'lucide-react'

type OrderRow = {
  id: string
  orderNumber?: string | null
  status?: string | null
  placedAt?: string | null
  grandTotalGrossAmount?: number | string | null
  metadata?: { order_stage?: string | null } | null
  customerSnapshot?: { customer?: { displayName?: string | null } | null } | null
}
type PurchaseOrderRow = {
  id: string
  po_number?: string | null
  department?: string | null
  status?: string | null
  delivery_date?: string | null
}
type QcTestRow = { id: string; test_type?: string | null; result?: string | null; reference_type?: string | null }
type BomRow = { id: string; is_active?: boolean | null }
type MaterialRow = { id: string; name?: string | null; code?: string | null; stock?: string | number | null; unit?: string | null; is_active?: boolean | null }

type ListResponse<T> = { items?: T[]; total?: number }

const STAGE_LABELS: Record<string, string> = {
  new: 'New',
  advance_payment: 'Advance Payment',
  verified: 'Verified / Official',
  rnd_sample: 'R&D / Sample',
  artwork_packaging: 'Artwork / Packaging',
  procurement_material: 'Procurement / Material',
  production: 'In Production',
  qc_qa: 'QC / QA',
  billing_payment: 'Billing / Payment',
  ready_to_dispatch: 'Ready to Dispatch',
  dispatched_completed: 'Dispatched / Completed',
  draft: 'New',
  pending: 'New',
  confirmed: 'Verified / Official',
  processing: 'In Production',
  completed: 'Dispatched / Completed',
  cancelled: 'Cancelled',
}

const STAGE_VARIANTS: Record<string, StatusBadgeVariant> = {
  new: 'neutral',
  advance_payment: 'warning',
  verified: 'info',
  rnd_sample: 'info',
  artwork_packaging: 'info',
  procurement_material: 'warning',
  production: 'warning',
  qc_qa: 'warning',
  billing_payment: 'info',
  ready_to_dispatch: 'success',
  dispatched_completed: 'success',
  cancelled: 'error',
}

const PO_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  issued: 'Issued',
  partially_received: 'Partially Received',
  received: 'Received',
  cancelled: 'Cancelled',
}

const quickLinks = [
  { href: '/backend/sales/order-book', label: 'Sales Order Book', icon: ShoppingCart },
  { href: '/backend/dermat_bom', label: 'Bill of Materials', icon: FlaskConical },
  { href: '/backend/dermat_purchase_orders', label: 'Purchase Orders', icon: FileText },
  { href: '/backend/dermat_rm_master', label: 'Raw Material Master', icon: Layers },
  { href: '/backend/dermat_pm_master', label: 'Packaging Master', icon: Boxes },
  { href: '/backend/dermat_qc', label: 'Quality Control', icon: ShieldCheck },
  { href: '/backend/dermat_vendors', label: 'Vendors', icon: Truck },
]

function formatDate(value?: string | null): string {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatINR(amount: string | number | null | undefined): string {
  const numeric = Number(amount ?? 0)
  if (!Number.isFinite(numeric)) return '₹0'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(numeric)
}

export default function DermatExecutiveDashboard() {
  const t = useT()

  const [orders, setOrders] = React.useState<OrderRow[] | null>(null)
  const [ordersError, setOrdersError] = React.useState<string | null>(null)
  const [purchaseOrders, setPurchaseOrders] = React.useState<PurchaseOrderRow[] | null>(null)
  const [poError, setPoError] = React.useState<string | null>(null)
  const [qcTests, setQcTests] = React.useState<QcTestRow[] | null>(null)
  const [qcError, setQcError] = React.useState<string | null>(null)
  const [boms, setBoms] = React.useState<BomRow[] | null>(null)
  const [bomsError, setBomsError] = React.useState<string | null>(null)
  const [rmMaterials, setRmMaterials] = React.useState<MaterialRow[] | null>(null)
  const [rmError, setRmError] = React.useState<string | null>(null)
  const [pmMaterials, setPmMaterials] = React.useState<MaterialRow[] | null>(null)
  const [pmError, setPmError] = React.useState<string | null>(null)

  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)

    Promise.all([
      apiCall<ListResponse<OrderRow>>('/api/sales/orders?pageSize=100', undefined, { fallback: { items: [] } })
        .then((res) => {
          if (cancelled) return
          if (!res.ok) { setOrdersError(t('dashboard.orders.error', 'Could not load order data')); return }
          setOrders(res.result?.items ?? [])
        }),
      apiCall<ListResponse<PurchaseOrderRow>>('/api/dermat_purchase_orders/purchase-orders?pageSize=100', undefined, { fallback: { items: [] } })
        .then((res) => {
          if (cancelled) return
          if (!res.ok) { setPoError(t('dashboard.po.error', 'Could not load purchase orders')); return }
          setPurchaseOrders(res.result?.items ?? [])
        }),
      apiCall<ListResponse<QcTestRow>>('/api/dermat_qc/qc-tests?pageSize=100', undefined, { fallback: { items: [] } })
        .then((res) => {
          if (cancelled) return
          if (!res.ok) { setQcError(t('dashboard.qc.error', 'Could not load QC tests')); return }
          setQcTests(res.result?.items ?? [])
        }),
      apiCall<ListResponse<BomRow>>('/api/dermat_bom/boms?pageSize=100', undefined, { fallback: { items: [] } })
        .then((res) => {
          if (cancelled) return
          if (!res.ok) { setBomsError(t('dashboard.bom.error', 'Could not load BOMs')); return }
          setBoms(res.result?.items ?? [])
        }),
      apiCall<ListResponse<MaterialRow>>('/api/dermat_rm_master/rm_master?pageSize=100', undefined, { fallback: { items: [] } })
        .then((res) => {
          if (cancelled) return
          if (!res.ok) { setRmError(t('dashboard.rm.error', 'Could not load raw materials')); return }
          setRmMaterials(res.result?.items ?? [])
        }),
      apiCall<ListResponse<MaterialRow>>('/api/dermat_pm_master/pm_master?pageSize=100', undefined, { fallback: { items: [] } })
        .then((res) => {
          if (cancelled) return
          if (!res.ok) { setPmError(t('dashboard.pm.error', 'Could not load packaging materials')); return }
          setPmMaterials(res.result?.items ?? [])
        }),
    ]).finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [t])

  const ordersTotal = orders?.length ?? 0
  const byStage = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const order of orders ?? []) {
      const key = (order.metadata?.order_stage || order.status || 'new').toLowerCase()
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [orders])
  const dispatched = (byStage.get('dispatched_completed') ?? 0) + (byStage.get('completed') ?? 0)
  const cancelled = (byStage.get('cancelled') ?? 0)
  const openOrders = ordersTotal - dispatched - cancelled

  const recentOrders = React.useMemo(
    () => [...(orders ?? [])].sort((a, b) => {
      const at = a.placedAt ? new Date(a.placedAt).getTime() : 0
      const bt = b.placedAt ? new Date(b.placedAt).getTime() : 0
      return bt - at
    }).slice(0, 8),
    [orders],
  )

  const openPoStatuses = new Set(['draft', 'issued', 'partially_received'])
  const openPurchaseOrders = (purchaseOrders ?? []).filter((po) => openPoStatuses.has((po.status ?? '').toLowerCase()))
  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), [])
  const overduePos = openPurchaseOrders.filter((po) => po.delivery_date && po.delivery_date < today)

  const qcFailures = (qcTests ?? []).filter((q) => (q.result ?? '').toLowerCase() === 'fail')
  const pendingQc = (qcTests ?? []).filter((q) => (q.result ?? '').toLowerCase() === 'pending')
  const activeBoms = (boms ?? []).filter((b) => b.is_active !== false)

  const outOfStockRm = (rmMaterials ?? []).filter((m) => m.is_active !== false && Number(m.stock ?? 0) <= 0)
  const outOfStockPm = (pmMaterials ?? []).filter((m) => m.is_active !== false && Number(m.stock ?? 0) <= 0)

  type AlertRow = { id: string; label: string; detail: string; severity: 'error' | 'warning' }
  const alerts: AlertRow[] = [
    ...outOfStockRm.map((m) => ({ id: `rm-${m.id}`, label: m.name || m.code || 'Raw material', detail: 'Out of stock', severity: 'error' as const })),
    ...outOfStockPm.map((m) => ({ id: `pm-${m.id}`, label: m.name || m.code || 'Packaging material', detail: 'Out of stock', severity: 'error' as const })),
    ...qcFailures.map((q) => ({ id: `qc-${q.id}`, label: q.test_type || 'QC test', detail: 'Failed QC result', severity: 'error' as const })),
    ...overduePos.map((po) => ({ id: `po-${po.id}`, label: po.po_number || 'Purchase order', detail: `Overdue — expected ${formatDate(po.delivery_date)}`, severity: 'warning' as const })),
  ]

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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard title={t('dashboard.kpi.totalOrders', 'Total Orders')} value={loading ? null : ordersTotal} loading={loading} error={ordersError} />
        <KpiCard title={t('dashboard.kpi.openOrders', 'Open Orders')} value={loading ? null : Math.max(openOrders, 0)} loading={loading} error={ordersError} />
        <KpiCard title={t('dashboard.kpi.dispatched', 'Dispatched')} value={loading ? null : dispatched} loading={loading} error={ordersError} />
        <KpiCard title={t('dashboard.kpi.openPos', 'Open Purchase Orders')} value={loading ? null : openPurchaseOrders.length} loading={loading} error={poError} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
          <CardTitle className="text-sm font-semibold">
            {t('dashboard.pipeline.title', 'Orders by Stage')}
          </CardTitle>
          <Button asChild variant="ghost" size="sm" className="text-xs">
            <Link href="/backend/sales/order-book">{t('dashboard.pipeline.viewAll', 'View order book')}</Link>
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading…')}</p>
          ) : ordersTotal === 0 ? (
            <p className="text-sm text-muted-foreground">{t('dashboard.pipeline.empty', 'No orders yet.')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {[...byStage.entries()].map(([stage, count]) => (
                <StatusBadge key={stage} variant={STAGE_VARIANTS[stage] ?? 'neutral'} dot>
                  {STAGE_LABELS[stage] ?? stage} · {count}
                </StatusBadge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            {t('dashboard.alerts.title', 'Alerts')}
            {alerts.length > 0 ? (
              <span className="rounded-full bg-status-error-bg text-status-error-text text-[10px] font-bold px-1.5 py-0.5">{alerts.length}</span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading…')}</p>
          ) : alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('dashboard.alerts.empty', 'No active alerts — everything looks healthy.')}</p>
          ) : (
            <ul className="space-y-2">
              {alerts.slice(0, 10).map((alert) => (
                <li key={alert.id} className="flex items-center justify-between gap-3 rounded-md border p-2.5 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${alert.severity === 'error' ? 'bg-status-error-icon' : 'bg-status-warning-icon'}`} />
                    <span className="font-medium text-foreground truncate">{alert.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{alert.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopNTable<OrderRow>
          title={t('dashboard.recentOrders.title', 'Recent Orders')}
          data={recentOrders}
          loading={loading}
          error={ordersError}
          emptyMessage={t('dashboard.recentOrders.empty', 'No orders yet.')}
          columns={[
            { key: 'orderNumber', header: t('dashboard.recentOrders.col.number', 'Order') },
            {
              key: 'customerSnapshot',
              header: t('dashboard.recentOrders.col.customer', 'Customer'),
              formatter: (_value, row) => row.customerSnapshot?.customer?.displayName ?? '--',
            },
            {
              key: 'metadata',
              header: t('dashboard.recentOrders.col.stage', 'Stage'),
              formatter: (_value, row) => {
                const stage = (row.metadata?.order_stage || row.status || 'new').toLowerCase()
                return STAGE_LABELS[stage] ?? stage
              },
            },
            { key: 'placedAt', header: t('dashboard.recentOrders.col.date', 'Date'), formatter: (value) => formatDate(value as string) },
            { key: 'grandTotalGrossAmount', header: t('dashboard.recentOrders.col.total', 'Total'), align: 'right', formatter: (value) => formatINR(value as number) },
          ]}
        />
        <TopNTable<PurchaseOrderRow>
          title={t('dashboard.po.openTitle', 'Purchase Orders Awaiting Receipt')}
          data={openPurchaseOrders}
          loading={loading}
          error={poError}
          emptyMessage={t('dashboard.po.openEmpty', 'No purchase orders awaiting receipt.')}
          maxRows={8}
          columns={[
            { key: 'po_number', header: t('dashboard.po.col.number', 'PO Number') },
            { key: 'department', header: t('dashboard.po.col.department', 'Department') },
            {
              key: 'status',
              header: t('dashboard.po.col.status', 'Status'),
              formatter: (value) => PO_STATUS_LABELS[String(value ?? '').toLowerCase()] ?? String(value ?? '--'),
            },
            { key: 'delivery_date', header: t('dashboard.po.col.delivery', 'Delivery Date'), formatter: (value) => formatDate(value as string) },
          ]}
        />
      </div>

      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-sm font-semibold">
            {t('dashboard.catalog.title', 'Catalog Health')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">{t('dashboard.catalog.activeBoms', 'Active BOMs')}: </span>
              <strong className="text-foreground">{loading ? '--' : activeBoms.length}</strong>
              <span className="text-muted-foreground"> / {loading ? '--' : (boms?.length ?? 0)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('dashboard.catalog.pendingQc', 'Pending QC')}: </span>
              <strong className="text-foreground">{loading ? '--' : pendingQc.length}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">{t('dashboard.catalog.outOfStockRm', 'Out-of-stock RM')}: </span>
              <strong className="text-foreground">{loading ? '--' : outOfStockRm.length}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">{t('dashboard.catalog.outOfStockPm', 'Out-of-stock PM')}: </span>
              <strong className="text-foreground">{loading ? '--' : outOfStockPm.length}</strong>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3 pt-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('dashboard.quickLinks.title', 'Core Modules')}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
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
