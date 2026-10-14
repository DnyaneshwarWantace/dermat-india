"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { BarChart3, Plus } from 'lucide-react'
import type { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { Button } from '@open-mercato/ui/primitives/button'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { SegmentedControl, SegmentedControlItem } from '@open-mercato/ui/primitives/segmented-control'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useGranted } from '../../dermat_departments/components/useGranted'
import { REQUEST_STATUS, TRIAL_STATUS, dayText } from './labels'
import { RequestFormDialog } from './request/RequestFormDialog'
import { EMPTY_REQUEST_FORM, type RequestForm } from './request/requestForm'
import type { RdRequest, TrialStatus } from './types'

type View = 'open' | 'samples' | 'approved' | 'closed' | 'all'
type Row = RdRequest & { trialCount: number; latestTrialStatus: TrialStatus | null }

export function RdRequestsPage({ defaultView = 'open', title, detailBase = '/backend/rnd/requests' }: { defaultView?: View; title?: string; detailBase?: string }) {
  const t = useT()
  const router = useRouter()
  const params = useSearchParams()
  const granted = useGranted()
  const [view, setView] = React.useState<View>(defaultView)
  const [search, setSearch] = React.useState('')
  const [rows, setRows] = React.useState<Row[]>([])
  const [counts, setCounts] = React.useState<Record<string, number>>({})
  const [loading, setLoading] = React.useState(true)
  const [form, setForm] = React.useState<RequestForm | null>(null)

  React.useEffect(() => {
    let cancelled = false
    const handle = window.setTimeout(async () => {
      setLoading(true)
      const query = new URLSearchParams({ view })
      if (search.trim()) query.set('search', search.trim())
      const call = await apiCall<{ items?: Row[]; counts?: Record<string, number> }>(`/api/dermat_rnd/requests?${query.toString()}`, undefined, { fallback: { items: [] } })
      if (cancelled) return
      if (!call.ok) flash(t('dermat_rnd.loadError', 'Could not load R&D requests.'), 'error')
      setRows(call.result?.items ?? [])
      setCounts(call.result?.counts ?? {})
      setLoading(false)
    }, search ? 250 : 0)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [view, search, t])

  React.useEffect(() => {
    const orderId = params?.get('orderId')
    if (params?.get('new') && orderId) setForm({ ...EMPTY_REQUEST_FORM, orderId, productName: params.get('product') ?? '' })
  }, [params])

  const columns = React.useMemo<ColumnDef<Row>[]>(
    () => [
      { accessorKey: 'code', header: t('dermat_rnd.col.code', 'R&D no.'), cell: ({ row }) => <Link href={`${detailBase}/${row.original.id}`} className="font-mono font-semibold text-primary hover:underline">{row.original.code}</Link> },
      { accessorKey: 'productName', header: t('dermat_rnd.col.product', 'Product'), cell: ({ row }) => <span className="font-medium">{[row.original.productName, row.original.brand].filter(Boolean).join(' · ')}</span> },
      { accessorKey: 'customerName', header: t('dermat_rnd.col.client', 'Client'), cell: ({ row }) => <span className="text-sm">{row.original.customerName ?? (row.original.kind === 'npd' ? t('dermat_rnd.npd', 'New product') : '—')}</span> },
      {
        accessorKey: 'status',
        header: t('dermat_rnd.col.status', 'Status'),
        cell: ({ row }) => {
          const status = REQUEST_STATUS[row.original.status]
          return <StatusBadge variant={status.variant}>{t(status.key, status.fallback)}</StatusBadge>
        },
      },
      {
        accessorKey: 'trialCount',
        header: t('dermat_rnd.col.trials', 'Trials'),
        cell: ({ row }) => {
          const latest = row.original.latestTrialStatus ? TRIAL_STATUS[row.original.latestTrialStatus] : null
          return (
            <span className="flex items-center gap-2 text-sm tabular-nums">
              {row.original.trialCount}
              {latest ? <StatusBadge variant={latest.variant}>{t(latest.key, latest.fallback)}</StatusBadge> : null}
            </span>
          )
        },
      },
      { accessorKey: 'rounds', header: t('dermat_rnd.col.samples', 'Samples sent'), cell: ({ row }) => <span className="text-sm tabular-nums">{row.original.rounds.length}</span> },
      { accessorKey: 'dueDate', header: t('dermat_rnd.col.due', 'Sample due'), cell: ({ row }) => <span className="text-sm">{dayText(row.original.dueDate)}</span> },
      { accessorKey: 'assignedName', header: t('dermat_rnd.col.with', 'With'), cell: ({ row }) => <span className="text-sm">{row.original.assignedName ?? '—'}</span> },
      { accessorKey: 'orderNo', header: t('dermat_rnd.col.order', 'Order'), cell: ({ row }) => <span className="font-mono text-xs">{row.original.orderNo ?? '—'}</span> },
    ],
    [t, detailBase],
  )

  const openCount = (counts.requested ?? 0) + (counts.in_progress ?? 0) + (counts.changes ?? 0)

  return (
    <Page>
      <PageBody>
        <div className="flex flex-col gap-4">
          <SegmentedControl value={view} onValueChange={(value) => setView(value as View)} aria-label={t('dermat_rnd.show', 'Show')}>
            <SegmentedControlItem value="open">{t('dermat_rnd.open', 'Open ({count})', { count: openCount })}</SegmentedControlItem>
            <SegmentedControlItem value="samples">{t('dermat_rnd.samples', 'Samples with clients ({count})', { count: counts.sample_sent ?? 0 })}</SegmentedControlItem>
            <SegmentedControlItem value="approved">{t('dermat_rnd.approvedCount', 'Approved ({count})', { count: counts.approved ?? 0 })}</SegmentedControlItem>
            <SegmentedControlItem value="closed">{t('dermat_rnd.dropped', 'Dropped')}</SegmentedControlItem>
            <SegmentedControlItem value="all">{t('dermat_rnd.all', 'All')}</SegmentedControlItem>
          </SegmentedControl>
          <DataTable
            perspective={{ tableId: 'dermat_rnd.requests' }}
            title={title ?? t('dermat_rnd.title', 'R&D requests')}
            columns={columns}
            data={rows}
            isLoading={loading}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={t('dermat_rnd.search', 'R&D no., product, client, brand, order')}
            onRowClick={(row) => router.push(`${detailBase}/${row.id}`)}
            actions={
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href="/backend/rnd/report">
                    <BarChart3 className="mr-2 size-4" aria-hidden="true" />
                    {t('dermat_rnd.report.open', 'Monthly report')}
                  </Link>
                </Button>
                {granted.has('dermat_rnd.request') ? (
                  <Button type="button" onClick={() => setForm({ ...EMPTY_REQUEST_FORM })}>
                    <Plus className="mr-2 size-4" aria-hidden="true" />
                    {t('dermat_rnd.new', 'New R&D request')}
                  </Button>
                ) : null}
              </div>
            }
            emptyState={t('dermat_rnd.empty', 'No R&D requests here.')}
          />
        </div>
        <RequestFormDialog
          form={form}
          editing={null}
          onChange={setForm}
          onClose={() => setForm(null)}
          onSaved={(saved) => {
            setForm(null)
            router.push(`${detailBase}/${saved.id}`)
          }}
        />
      </PageBody>
    </Page>
  )
}

export default RdRequestsPage
