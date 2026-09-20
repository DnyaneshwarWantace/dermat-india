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

type MachineRow = { id: string; name: string; code: string; status: string; work_center_id?: string | null; make_model?: string | null; serial_number?: string | null; created_at: string }
type PagedResponse<T> = { items: T[]; total: number; totalPages: number }

const statusVariantMap: Record<string, 'success' | 'warning' | 'neutral' | 'error'> = { available: 'success', in_use: 'warning', maintenance: 'neutral', retired: 'error' }

export default function MachinesListPage() {
  const t = useT()
  const router = useRouter()
  const { confirm } = useConfirmDialog()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'name', desc: false }])
  const queryKey = React.useMemo(() => ['mfg-machines', page, search, sorting], [page, search, sorting])

  const fetchData = React.useCallback(async () => {
    const sortField = sorting[0]?.id || 'name'
    const sortDir = sorting[0]?.desc ? 'desc' : 'asc'
    const params = new URLSearchParams({ page: String(page), pageSize: '25', sortField, sortDir, ...(search ? { search } : {}) })
    return await apiCallOrThrow(`/api/manufacturing/machines?${params}`) as PagedResponse<MachineRow>
  }, [page, search, sorting])

  const { runMutation: deleteItem } = useGuardedMutation({
    mutationFn: async (id: string) => { await apiCallOrThrow(`/api/manufacturing/machines`, { method: 'DELETE', body: JSON.stringify({ id }) }) },
  })

  const columns = React.useMemo<ColumnDef<MachineRow>[]>(() => [
    { id: 'name', header: t('manufacturing.machines.fields.name', 'Name'), accessorKey: 'name', cell: ({ row }) => <Link href={`/backend/manufacturing/machines/${row.original.id}`} className="font-medium text-primary hover:underline">{row.original.name}</Link> },
    { id: 'code', header: t('manufacturing.machines.fields.code', 'Code'), accessorKey: 'code' },
    { id: 'status', header: t('manufacturing.machines.fields.status', 'Status'), accessorKey: 'status', cell: ({ row }) => <StatusBadge variant={statusVariantMap[row.original.status] ?? 'neutral'}>{t(`manufacturing.machines.status.${row.original.status}`, row.original.status)}</StatusBadge> },
    { id: 'makeModel', header: t('manufacturing.machines.fields.makeModel', 'Make/Model'), accessorKey: 'make_model' },
    { id: 'serialNumber', header: t('manufacturing.machines.fields.serialNumber', 'Serial #'), accessorKey: 'serial_number' },
    { id: 'actions', header: '', cell: ({ row }) => <RowActions id={`mfg.machines.${row.original.id}`} items={[
      { label: t('common.edit', 'Edit'), onClick: () => router.push(`/backend/manufacturing/machines/${row.original.id}`) },
      { label: t('common.delete', 'Delete'), variant: 'destructive' as const, onClick: async () => { if (await confirm({ title: t('manufacturing.machines.deleteConfirm', 'Delete this machine?') })) { await deleteItem(row.original.id); flash.success(t('common.deleted', 'Deleted')) } } },
    ]} /> },
  ], [t, router, confirm, deleteItem])

  return (
    <Page>
      <PageHeader title={t('manufacturing.machines.title', 'Machines')}>
        <Link href="/backend/manufacturing/machines/create"><Button size="sm"><Plus className="mr-1 h-4 w-4" />{t('manufacturing.machines.create', 'New Machine')}</Button></Link>
      </PageHeader>
      <PageBody>
        <DataTable tableId="mfg.machines.list" columns={columns} queryKey={queryKey} queryFn={fetchData} page={page} onPageChange={setPage} search={search} onSearchChange={setSearch} sorting={sorting} onSortingChange={setSorting} />
      </PageBody>
    </Page>
  )
}
