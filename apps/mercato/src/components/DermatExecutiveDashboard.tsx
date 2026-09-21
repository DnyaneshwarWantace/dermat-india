'use client'

import * as React from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@open-mercato/ui/primitives/card'
import { Button } from '@open-mercato/ui/primitives/button'
import { KpiCard, BarChart, PieChart, TopNTable } from '@open-mercato/ui/backend/charts'
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
} from 'lucide-react'

type OrderRow = { id: string; status?: string | null }
type PurchaseOrderRow = {
  id: string
  po_number?: string | null
  department?: string | null
  status?: string | null
  delivery_date?: string | null
}
type BatchRow = {
  id: string
  batch_number?: string | null
  product_name?: string | null
  planned_quantity?: string | number | null
  planned_unit?: string | null
  status?: string | null
  created_at?: string | null
}
type QcTestRow = { id: string; result?: string | null }
type BomRow = { id: string; is_active?: boolean | null }

type ListResponse<T> = { items?: T[]; total?: number }

const STAGE_LABELS: Record<string, string> = {
  draft: 'New',
  pending: 'New',
  confirmed: 'Verified / Official',
  processing: 'In Production',
  completed: 'Dispatched / Completed',
  cancelled: 'Cancelled',
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

export default function DermatExecutiveDashboard() {
  const t = useT()

  const [orders, setOrders] = React.useState<OrderRow[] | null>(null)
  const [ordersError, setOrdersError] = React.useState<string | null>(null)
  const [purchaseOrders, setPurchaseOrders] = React.useState<PurchaseOrderRow[] | null>(null)
  const [poError, setPoError] = React.useState<string | null>(null)
  const [batches, setBatches] = React.useState<BatchRow[] | null>(null)
  const [batchesError, setBatchesError] = React.useState<string | null>(null)
  const [qcTests, setQcTests] = React.useState<QcTestRow[] | null>(null)
  const [qcError, setQcError] = React.useState<string | null>(null)
  const [boms, setBoms] = React.useState<BomRow[] | null>(null)
  const [bomsError, setBomsError] = React.useState<string | null>(null)

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
      apiCall<ListResponse<BatchRow>>('/api/dermat_production/batches?pageSize=100', undefined, { fallback: { items: [] } })
        .then((res) => {
          if (cancelled) return
          if (!res.ok) { setBatchesError(t('dashboard.batches.error', 'Could not load production batches')); return }
          setBatches(res.result?.items ?? [])
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
    ]).finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [t])

  const ordersTotal = orders?.length ?? 0
  const byStatus = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const order of orders ?? []) {
      const key = (order.status ?? 'draft').toLowerCase()
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [orders])
  const openOrders = ordersTotal - (byStatus.get('completed') ?? 0) - (byStatus.get('cancelled') ?? 0)
  const dispatched = byStatus.get('completed') ?? 0

  const stageChartData = React.useMemo(
    () => [...byStatus.entries()].map(([status, count]) => ({
      status: STAGE_LABELS[status] ?? status,
      count,
    })),
    [byStatus],
  )

  const openPoStatuses = new Set(['draft', 'issued', 'partially_received'])
  const openPurchaseOrders = (purchaseOrders ?? []).filter((po) => openPoStatuses.has((po.status ?? '').toLowerCase()))

  const poStatusChartData = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const po of purchaseOrders ?? []) {
      const key = (po.status ?? 'draft').toLowerCase()
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return [...counts.entries()].map(([status, value]) => ({ name: PO_STATUS_LABELS[status] ?? status, value }))
  }, [purchaseOrders])

  const batchesInProgress = (batches ?? []).filter((b) => (b.status ?? '').toLowerCase() === 'in_progress')
  const pendingQc = (qcTests ?? []).filter((q) => (q.result ?? '').toLowerCase() === 'pending')
  const activeBoms = (boms ?? []).filter((b) => b.is_active !== false)

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t('dashboard.title', 'Dermat India — Operations')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('dashboard.subtitle', 'Sales, purchasing, production and QC at a glance.')}
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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          title={t('dashboard.kpi.totalOrders', 'Total Orders')}
          value={loading ? null : ordersTotal}
          loading={loading}
          error={ordersError}
        />
        <KpiCard
          title={t('dashboard.kpi.openOrders', 'Open Orders')}
          value={loading ? null : Math.max(openOrders, 0)}
          loading={loading}
          error={ordersError}
        />
        <KpiCard
          title={t('dashboard.kpi.dispatched', 'Dispatched')}
          value={loading ? null : dispatched}
          loading={loading}
          error={ordersError}
        />
        <KpiCard
          title={t('dashboard.kpi.openPos', 'Open Purchase Orders')}
          value={loading ? null : openPurchaseOrders.length}
          loading={loading}
          error={poError}
        />
        <KpiCard
          title={t('dashboard.kpi.batchesInProgress', 'Batches In Production')}
          value={loading ? null : batchesInProgress.length}
          loading={loading}
          error={batchesError}
        />
        <KpiCard
          title={t('dashboard.kpi.pendingQc', 'Pending QC Tests')}
          value={loading ? null : pendingQc.length}
          loading={loading}
          error={qcError}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BarChart
          title={t('dashboard.pipeline.title', 'Orders by Stage')}
          data={stageChartData}
          index="status"
          categories={['count']}
          layout="horizontal"
          showLegend={false}
          loading={loading}
          error={ordersError}
          emptyMessage={t('dashboard.pipeline.empty', 'No orders yet.')}
        />
        <PieChart
          title={t('dashboard.po.statusTitle', 'Purchase Orders by Status')}
          data={poStatusChartData}
          loading={loading}
          error={poError}
          emptyMessage={t('dashboard.po.empty', 'No purchase orders yet.')}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopNTable<BatchRow>
          title={t('dashboard.batches.title', 'Batches In Production')}
          data={batchesInProgress}
          loading={loading}
          error={batchesError}
          emptyMessage={t('dashboard.batches.empty', 'No batches currently in production.')}
          maxRows={8}
          columns={[
            { key: 'batch_number', header: t('dashboard.batches.col.batch', 'Batch') },
            { key: 'product_name', header: t('dashboard.batches.col.product', 'Product') },
            {
              key: 'planned_quantity',
              header: t('dashboard.batches.col.qty', 'Planned Qty'),
              align: 'right',
              formatter: (value, row) => `${value ?? '--'} ${row.planned_unit ?? ''}`.trim(),
            },
            { key: 'created_at', header: t('dashboard.batches.col.started', 'Started'), formatter: (value) => formatDate(value as string) },
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
