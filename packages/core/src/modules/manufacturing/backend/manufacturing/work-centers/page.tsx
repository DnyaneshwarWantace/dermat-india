"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy'
import type { SortingState } from '@tanstack/react-table'
import { Page, PageBody, PageHeader } from '@wantace/ui/backend/Page'
import { DataTable } from '@wantace/ui/backend/DataTable'
import { RowActions } from '@wantace/ui/backend/RowActions'
import { Button } from '@wantace/ui/primitives/button'
import { StatusBadge } from '@wantace/ui/primitives/status-badge'
import { apiCallOrThrow } from '@wantace/ui/backend/utils/apiCall'
import { useGuardedMutation } from '@wantace/ui/backend/injection/useGuardedMutation'
import { flash } from '@wantace/ui/backend/FlashMessages'
import { useT } from '@wantace/shared/lib/i18n/context'
import { useConfirmDialog } from '@wantace/ui/backend/confirm-dialog'
import { Plus } from 'lucide-react'

type WorkCenterRow = { id: string; name: string; code: string; status: string; cost_per_hour_cents: number; location?: string | null; created_at: string }
type PagedResponse<T> = { items: T[]; total: number; totalPages: number }

const statusVariantMap: Record<string, 'success' | 'warning' | 'neutral'> = { active: 'success', inactive: 'neutral', maintenance: 'warning' }

export default function WorkCentersListPage() {
  const t = useT()
  const router = useRouter()
  const { confirm } = useConfirmDialog()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'name', desc: false }])
  const queryKey = React.useMemo(() => ['mfg-work-centers', page, search, sorting], [page, search, sorting])

  const fetchData = React.useCallback(async () => {
    const sortField = sorting[0]?.id || 'name'
    const sortDir = sorting[0]?.desc ? 'desc' : 'asc'
    const params = new URLSearchParams({ page: String(page), pageSize: '25', sortField, sortDir, ...(search ? { search } : {}) })
    return await apiCallOrThrow(`/api/manufacturing/work-centers?${params}`) as PagedResponse<WorkCenterRow>
  }, [page, search, sorting])

  const { runMutation: deleteItem } = useGuardedMutation({
    mutationFn: async (id: string) => { await apiCallOrThrow(`/api/manufacturing/work-centers`, { method: 'DELETE', body: JSON.stringify({ id }) }) },
  })

  const columns = React.useMemo<ColumnDef<WorkCenterRow>[]>(() => [
    { id: 'name', header: t('manufacturing.workCenters.fields.name', 'Name'), accessorKey: 'name', cell: ({ row }) => <Link href={`/backend/manufacturing/work-centers/${row.original.id}`} className="font-medium text-primary hover:underline">{row.original.name}</Link> },
    { id: 'code', header: t('manufacturing.workCenters.fields.code', 'Code'), accessorKey: 'code' },
    { id: 'status', header: t('manufacturing.workCenters.fields.status', 'Status'), accessorKey: 'status', cell: ({ row }) => <StatusBadge variant={statusVariantMap[row.original.status] ?? 'neutral'}>{t(`manufacturing.workCenters.status.${row.original.status}`, row.original.status)}</StatusBadge> },
    { id: 'costPerHour', header: t('manufacturing.workCenters.fields.costPerHour', 'Cost/Hr'), accessorKey: 'cost_per_hour_cents', cell: ({ row }) => (row.original.cost_per_hour_cents / 100).toFixed(2) },
    { id: 'location', header: t('manufacturing.workCenters.fields.location', 'Location'), accessorKey: 'location' },
    { id: 'actions', header: '', cell: ({ row }) => <RowActions id={`mfg.work-centers.${row.original.id}`} items={[
      { label: t('common.edit', 'Edit'), onClick: () => router.push(`/backend/manufacturing/work-centers/${row.original.id}`) },
      { label: t('common.delete', 'Delete'), variant: 'destructive' as const, onClick: async () => { if (await confirm({ title: t('manufacturing.workCenters.deleteConfirm', 'Delete this work center?') })) { await deleteItem(row.original.id); flash.success(t('common.deleted', 'Deleted')) } } },
    ]} /> },
  ], [t, router, confirm, deleteItem])

  return (
    <Page>
      <PageHeader title={t('manufacturing.workCenters.title', 'Work Centers')}>
        <Link href="/backend/manufacturing/work-centers/create"><Button size="sm"><Plus className="mr-1 h-4 w-4" />{t('manufacturing.workCenters.create', 'New Work Center')}</Button></Link>
      </PageHeader>
      <PageBody>
        <DataTable tableId="mfg.work-centers.list" columns={columns} queryKey={queryKey} queryFn={fetchData} page={page} onPageChange={setPage} search={search} onSearchChange={setSearch} sorting={sorting} onSortingChange={setSorting} />
      </PageBody>
    </Page>
  )
}
