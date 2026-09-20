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

type ProductionStageRow = {
  id: string; production_order_id: string; sequence_number: number; name: string;
  status: string; planned_quantity: string; produced_quantity: string; rejected_quantity: string;
  started_at?: string | null; completed_at?: string | null; created_at: string
}
type PagedResponse<T> = { items: T[]; total: number; totalPages: number }

const statusVariantMap: Record<string, 'success' | 'warning' | 'neutral'> = {
  pending: 'neutral', in_progress: 'warning', completed: 'success', skipped: 'neutral',
}

export default function ProductionStagesListPage() {
  const t = useT()
  const router = useRouter()
  const { confirm } = useConfirmDialog()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'sequenceNumber', desc: false }])
  const queryKey = React.useMemo(() => ['mfg-production-stages', page, search, sorting], [page, search, sorting])

  const fetchData = React.useCallback(async () => {
    const sortField = sorting[0]?.id || 'sequenceNumber'
    const sortDir = sorting[0]?.desc ? 'desc' : 'asc'
    const params = new URLSearchParams({ page: String(page), pageSize: '25', sortField, sortDir, ...(search ? { search } : {}) })
    return await apiCallOrThrow(`/api/manufacturing/production-stages?${params}`) as PagedResponse<ProductionStageRow>
  }, [page, search, sorting])

  const { runMutation: deleteItem } = useGuardedMutation({
    mutationFn: async (id: string) => { await apiCallOrThrow(`/api/manufacturing/production-stages`, { method: 'DELETE', body: JSON.stringify({ id }) }) },
  })

  const columns = React.useMemo<ColumnDef<ProductionStageRow>[]>(() => [
    { id: 'sequenceNumber', header: '#', accessorKey: 'sequence_number' },
    { id: 'name', header: t('manufacturing.productionStages.fields.name', 'Name'), accessorKey: 'name', cell: ({ row }) => <Link href={`/backend/manufacturing/production-stages/${row.original.id}`} className="font-medium text-primary hover:underline">{row.original.name}</Link> },
    { id: 'status', header: t('manufacturing.productionStages.fields.status', 'Status'), accessorKey: 'status', cell: ({ row }) => <StatusBadge variant={statusVariantMap[row.original.status] ?? 'neutral'}>{t(`manufacturing.productionStages.status.${row.original.status}`, row.original.status)}</StatusBadge> },
    { id: 'plannedQty', header: t('manufacturing.productionStages.fields.plannedQuantity', 'Planned'), accessorKey: 'planned_quantity' },
    { id: 'producedQty', header: t('manufacturing.productionStages.fields.producedQuantity', 'Produced'), accessorKey: 'produced_quantity' },
    { id: 'rejectedQty', header: t('manufacturing.productionStages.fields.rejectedQuantity', 'Rejected'), accessorKey: 'rejected_quantity' },
    { id: 'actions', header: '', cell: ({ row }) => <RowActions id={`mfg.production-stages.${row.original.id}`} items={[
      { label: t('common.edit', 'Edit'), onClick: () => router.push(`/backend/manufacturing/production-stages/${row.original.id}`) },
      { label: t('common.delete', 'Delete'), variant: 'destructive' as const, onClick: async () => { if (await confirm({ title: t('manufacturing.productionStages.deleteConfirm', 'Delete this production stage?') })) { await deleteItem(row.original.id); flash.success(t('common.deleted', 'Deleted')) } } },
    ]} /> },
  ], [t, router, confirm, deleteItem])

  return (
    <Page>
      <PageHeader title={t('manufacturing.productionStages.title', 'Production Stages')}>
        <Link href="/backend/manufacturing/production-stages/create"><Button size="sm"><Plus className="mr-1 h-4 w-4" />{t('manufacturing.productionStages.create', 'New Stage')}</Button></Link>
      </PageHeader>
      <PageBody>
        <DataTable tableId="mfg.production-stages.list" columns={columns} queryKey={queryKey} queryFn={fetchData} page={page} onPageChange={setPage} search={search} onSearchChange={setSearch} sorting={sorting} onSortingChange={setSorting} />
      </PageBody>
    </Page>
  )
}
