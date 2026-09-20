"use client"

import Link from 'next/link'
import { Page, PageBody, PageHeader } from '@wantace/ui/backend/Page'
import { useT } from '@wantace/shared/lib/i18n/context'
import { apiCall } from '@wantace/ui/backend/utils/apiCall'
import { useQuery } from '@tanstack/react-query'
import { StatusBadge } from '@wantace/ui/primitives/status-badge'

type CountResponse = { total: number }
type PORow = {
  id: string; order_number: string; product_name: string; status: string;
  planned_quantity: string; produced_quantity: string; priority: string; created_at: string
}
type MCRow = {
  id: string; production_order_id: string; product_name: string; product_sku?: string | null;
  planned_quantity: string; status: string; unit_of_measure?: string | null
}

const poStatusVariant: Record<string, 'success' | 'warning' | 'neutral' | 'error' | 'info'> = {
  draft: 'neutral', planned: 'info', in_progress: 'warning', completed: 'success',
  cancelled: 'error', on_hold: 'neutral',
}
const priorityVariant: Record<string, 'success' | 'warning' | 'neutral' | 'error'> = {
  low: 'neutral', normal: 'neutral', high: 'warning', urgent: 'error',
}

function useSummaryCount(url: string) {
  return useQuery({
    queryKey: ['mfg-dashboard-count', url],
    queryFn: async () => {
      const res = await apiCall(url)
      return (res as CountResponse)?.total ?? 0
    },
    staleTime: 30_000,
  })
}

function SummaryCard({ label, count, loading, href, variant }: { label: string; count: number; loading: boolean; href: string; variant: 'neutral' | 'warning' | 'success' | 'error' }) {
  const colorMap = {
    neutral: 'border-border',
    warning: 'border-status-warning-border bg-status-warning-bg/20',
    success: 'border-status-success-border bg-status-success-bg/20',
    error: 'border-status-error-border bg-status-error-bg/20',
  }
  return (
    <Link href={href} className={`block rounded-lg border p-4 transition-colors hover:bg-accent ${colorMap[variant]}`}>
      <div className="text-2xl font-bold tabular-nums">{loading ? '—' : count}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </Link>
  )
}

export default function ManufacturingBackendPage() {
  const t = useT()

  const { data: awaitingCount = 0, isLoading: awaitingLoading } = useSummaryCount(
    '/api/manufacturing/production-orders?status=draft,planned&pageSize=1'
  )
  const { data: inProgressCount = 0, isLoading: inProgressLoading } = useSummaryCount(
    '/api/manufacturing/production-orders?status=in_progress&pageSize=1'
  )
  const { data: completedCount = 0, isLoading: completedLoading } = useSummaryCount(
    '/api/manufacturing/production-orders?status=completed&pageSize=1'
  )
  const { data: inspectionsPending = 0, isLoading: inspectionsLoading } = useSummaryCount(
    '/api/manufacturing/quality-inspections?status=pending,in_progress&pageSize=1'
  )

  const { data: recentOrders } = useQuery({
    queryKey: ['mfg-dashboard-recent-orders'],
    queryFn: async () => {
      const res = await apiCall('/api/manufacturing/production-orders?pageSize=5&sort=-createdAt')
      return ((res as { items?: PORow[] })?.items ?? [])
    },
    staleTime: 30_000,
  })

  const { data: pendingMaterials } = useQuery({
    queryKey: ['mfg-dashboard-pending-materials'],
    queryFn: async () => {
      const res = await apiCall('/api/manufacturing/material-consumption?status=planned&pageSize=10&sort=-createdAt')
      return ((res as { items?: MCRow[] })?.items ?? [])
    },
    staleTime: 30_000,
  })

  return (
    <Page>
      <PageHeader title={t('manufacturing.nav.title', 'Manufacturing')} />
      <PageBody>
        {/* KPI Cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard
            label={t('manufacturing.dashboard.awaiting', 'Awaiting Production')}
            count={awaitingCount}
            loading={awaitingLoading}
            href="/backend/manufacturing/production-orders?status=draft,planned"
            variant="warning"
          />
          <SummaryCard
            label={t('manufacturing.dashboard.inProgress', 'In Progress')}
            count={inProgressCount}
            loading={inProgressLoading}
            href="/backend/manufacturing/production-orders?status=in_progress"
            variant="neutral"
          />
          <SummaryCard
            label={t('manufacturing.dashboard.completed', 'Completed')}
            count={completedCount}
            loading={completedLoading}
            href="/backend/manufacturing/production-orders?status=completed"
            variant="success"
          />
          <SummaryCard
            label={t('manufacturing.dashboard.awaitingQC', 'Awaiting QC')}
            count={inspectionsPending}
            loading={inspectionsLoading}
            href="/backend/manufacturing/quality-inspections?status=pending"
            variant="error"
          />
        </div>

        {/* Recent Orders + Pending Materials */}
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Recent Production Orders */}
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">{t('manufacturing.dashboard.recentOrders', 'Recent Production Orders')}</h3>
              <Link href="/backend/manufacturing/production-orders" className="text-xs text-primary hover:underline">
                {t('common.viewAll', 'View all')}
              </Link>
            </div>
            {!recentOrders?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t('manufacturing.dashboard.noOrders', 'No production orders yet.')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 font-medium">{t('manufacturing.dashboard.orderNumber', 'Order')}</th>
                      <th className="pb-2 font-medium">{t('manufacturing.dashboard.product', 'Product')}</th>
                      <th className="pb-2 font-medium text-right tabular-nums">{t('manufacturing.dashboard.progress', 'Progress')}</th>
                      <th className="pb-2 font-medium">{t('manufacturing.dashboard.status', 'Status')}</th>
                      <th className="pb-2 font-medium">{t('manufacturing.dashboard.priority', 'Priority')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((po) => {
                      const planned = parseFloat(po.planned_quantity) || 0
                      const produced = parseFloat(po.produced_quantity) || 0
                      const pct = planned > 0 ? Math.round((produced / planned) * 100) : 0
                      return (
                        <tr key={po.id} className="border-b border-border/50">
                          <td className="py-2">
                            <Link href={`/backend/manufacturing/production-orders/${po.id}`} className="text-primary hover:underline font-mono text-xs">
                              {po.order_number}
                            </Link>
                          </td>
                          <td className="py-2 max-w-[150px] truncate">{po.product_name}</td>
                          <td className="py-2 text-right tabular-nums">
                            <span className={pct >= 100 ? 'text-status-success-text' : ''}>{produced}/{planned}</span>
                            <span className="ml-1 text-muted-foreground text-xs">({pct}%)</span>
                          </td>
                          <td className="py-2">
                            <StatusBadge variant={poStatusVariant[po.status] ?? 'neutral'}>{po.status.replace('_', ' ')}</StatusBadge>
                          </td>
                          <td className="py-2">
                            <StatusBadge variant={priorityVariant[po.priority] ?? 'neutral'}>{po.priority}</StatusBadge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Materials Pending Issue */}
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">{t('manufacturing.dashboard.pendingMaterials', 'Materials Pending Issue')}</h3>
              <Link href="/backend/manufacturing/material-consumption?status=planned" className="text-xs text-primary hover:underline">
                {t('common.viewAll', 'View all')}
              </Link>
            </div>
            {!pendingMaterials?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t('manufacturing.dashboard.noMaterials', 'All materials have been issued.')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 font-medium">{t('manufacturing.dashboard.material', 'Material')}</th>
                      <th className="pb-2 font-medium">{t('manufacturing.dashboard.sku', 'SKU')}</th>
                      <th className="pb-2 font-medium text-right tabular-nums">{t('manufacturing.dashboard.qty', 'Qty Needed')}</th>
                      <th className="pb-2 font-medium">{t('manufacturing.dashboard.forOrder', 'For Order')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingMaterials.map((mc) => (
                      <tr key={mc.id} className="border-b border-border/50">
                        <td className="py-2">
                          <Link href={`/backend/manufacturing/material-consumption/${mc.id}`} className="text-primary hover:underline">
                            {mc.product_name}
                          </Link>
                        </td>
                        <td className="py-2 text-muted-foreground text-xs">{mc.product_sku ?? '—'}</td>
                        <td className="py-2 text-right tabular-nums font-medium">
                          {Number(mc.planned_quantity).toFixed(2)} {mc.unit_of_measure ?? ''}
                        </td>
                        <td className="py-2">
                          <Link href={`/backend/manufacturing/production-orders/${mc.production_order_id}`} className="text-primary hover:underline text-xs">
                            {t('manufacturing.dashboard.viewPO', 'View PO')}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Module Navigation Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/backend/manufacturing/production-orders" className="block rounded-lg border border-border p-6 hover:bg-accent transition-colors">
            <h3 className="text-lg font-semibold">{t('manufacturing.nav.productionOrders', 'Production Orders')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('manufacturing.dashboard.poDesc', 'Plan and track production orders through all stages.')}
            </p>
          </Link>
          <Link href="/backend/manufacturing/bill-of-materials" className="block rounded-lg border border-border p-6 hover:bg-accent transition-colors">
            <h3 className="text-lg font-semibold">{t('manufacturing.nav.bom', 'Bills of Materials')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('manufacturing.dashboard.bomDesc', 'Create and manage product recipes with raw materials and operations.')}
            </p>
          </Link>
          <Link href="/backend/manufacturing/work-centers" className="block rounded-lg border border-border p-6 hover:bg-accent transition-colors">
            <h3 className="text-lg font-semibold">{t('manufacturing.nav.workCenters', 'Work Centers')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('manufacturing.dashboard.wcDesc', 'Manage production areas and their capacity.')}
            </p>
          </Link>
          <Link href="/backend/manufacturing/machines" className="block rounded-lg border border-border p-6 hover:bg-accent transition-colors">
            <h3 className="text-lg font-semibold">{t('manufacturing.nav.machines', 'Machines')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('manufacturing.dashboard.machinesDesc', 'Track machines, maintenance schedules, and assignments.')}
            </p>
          </Link>
          <Link href="/backend/manufacturing/material-consumption" className="block rounded-lg border border-border p-6 hover:bg-accent transition-colors">
            <h3 className="text-lg font-semibold">{t('manufacturing.nav.materialConsumption', 'Material Consumption')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('manufacturing.dashboard.mcDesc', 'Track raw material issues, returns, and wastage.')}
            </p>
          </Link>
          <Link href="/backend/manufacturing/quality-inspections" className="block rounded-lg border border-border p-6 hover:bg-accent transition-colors">
            <h3 className="text-lg font-semibold">{t('manufacturing.nav.qualityInspections', 'Quality Control')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('manufacturing.dashboard.qcDesc', 'Manage quality inspections and check results.')}
            </p>
          </Link>
          <Link href="/backend/manufacturing/production-stage-templates" className="block rounded-lg border border-border p-6 hover:bg-accent transition-colors">
            <h3 className="text-lg font-semibold">{t('manufacturing.nav.stageTemplates', 'Stage Templates')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('manufacturing.dashboard.stDesc', 'Configure the production pipeline stages for your organization.')}
            </p>
          </Link>
        </div>
      </PageBody>
    </Page>
  )
}
