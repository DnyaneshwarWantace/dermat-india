"use client"

import Link from 'next/link'
import { Page, PageBody, PageHeader } from '@wantace/ui/backend/Page'
import { useT } from '@wantace/shared/lib/i18n/context'
import { apiCall } from '@wantace/ui/backend/utils/apiCall'
import { useQuery } from '@tanstack/react-query'

type CountResponse = { total: number }

function useSummaryCount(url: string) {
  return useQuery({
    queryKey: ['purchasing-dashboard-count', url],
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

export default function PurchasingBackendPage() {
  const t = useT()

  const { data: draftCount = 0, isLoading: draftLoading } = useSummaryCount(
    '/api/purchasing/purchase-orders?status=draft&pageSize=1'
  )
  const { data: pendingCount = 0, isLoading: pendingLoading } = useSummaryCount(
    '/api/purchasing/purchase-orders?status=sent,confirmed&pageSize=1'
  )
  const { data: receiptsPending = 0, isLoading: receiptsLoading } = useSummaryCount(
    '/api/purchasing/goods-receipts?status=draft&pageSize=1'
  )

  return (
    <Page>
      <PageHeader title={t('purchasing.nav.title', 'Purchasing')} />
      <PageBody>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <SummaryCard
            label={t('purchasing.dashboard.draftPOs', 'Draft POs')}
            count={draftCount}
            loading={draftLoading}
            href="/backend/purchasing/purchase-orders?status=draft"
            variant="warning"
          />
          <SummaryCard
            label={t('purchasing.dashboard.activePOs', 'Sent / Confirmed')}
            count={pendingCount}
            loading={pendingLoading}
            href="/backend/purchasing/purchase-orders?status=sent,confirmed"
            variant="neutral"
          />
          <SummaryCard
            label={t('purchasing.dashboard.pendingReceipts', 'Pending Receipts')}
            count={receiptsPending}
            loading={receiptsLoading}
            href="/backend/purchasing/goods-receipts?status=draft"
            variant="error"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/backend/purchasing/purchase-orders" className="block rounded-lg border border-border p-6 hover:bg-accent transition-colors">
            <h3 className="text-lg font-semibold">{t('purchasing.nav.purchaseOrders', 'Purchase Orders')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('purchasing.dashboard.poDesc', 'Create, track, and manage purchase orders.')}
            </p>
          </Link>
          <Link href="/backend/purchasing/goods-receipts" className="block rounded-lg border border-border p-6 hover:bg-accent transition-colors">
            <h3 className="text-lg font-semibold">{t('purchasing.nav.goodsReceipts', 'Goods Receipts')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('purchasing.dashboard.grDesc', 'Receive and inspect incoming goods.')}
            </p>
          </Link>
          <Link href="/backend/purchasing/supplier-pricing" className="block rounded-lg border border-border p-6 hover:bg-accent transition-colors">
            <h3 className="text-lg font-semibold">{t('purchasing.nav.supplierPricing', 'Supplier Pricing')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('purchasing.dashboard.spDesc', 'Manage per-supplier pricing and quantity breaks.')}
            </p>
          </Link>
          <Link href="/backend/purchasing/purchase-invoices" className="block rounded-lg border border-border p-6 hover:bg-accent transition-colors">
            <h3 className="text-lg font-semibold">{t('purchasing.nav.purchaseInvoices', 'Purchase Invoices')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('purchasing.dashboard.piDesc', 'Track and approve supplier invoices.')}
            </p>
          </Link>
        </div>
      </PageBody>
    </Page>
  )
}
