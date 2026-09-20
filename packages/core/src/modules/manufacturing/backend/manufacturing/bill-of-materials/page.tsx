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

type BOMRow = { id: string; name: string; code: string; product_name?: string | null; status: string; version: number; is_default: boolean; total_cost_cents: number; created_at: string }
type PagedResponse<T> = { items: T[]; total: number; totalPages: number }

const statusVariantMap: Record<string, 'success' | 'warning' | 'neutral'> = { draft: 'neutral', active: 'success', obsolete: 'warning' }

export default function BOMListPage() {
  const t = useT()
  const router = useRouter()
  const { confirm } = useConfirmDialog()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'name', desc: false }])
  const queryKey = React.useMemo(() => ['mfg-bom', page, search, sorting], [page, search, sorting])

  const fetchData = React.useCallback(async () => {
    const sortField = sorting[0]?.id || 'name'
    const sortDir = sorting[0]?.desc ? 'desc' : 'asc'
    const params = new URLSearchParams({ page: String(page), pageSize: '25', sortField, sortDir, ...(search ? { search } : {}) })
    return await apiCallOrThrow(`/api/manufacturing/bill-of-materials?${params}`) as PagedResponse<BOMRow>
  }, [page, search, sorting])

  const { runMutation: deleteItem } = useGuardedMutation({
    mutationFn: async (id: string) => { await apiCallOrThrow(`/api/manufacturing/bill-of-materials`, { method: 'DELETE', body: JSON.stringify({ id }) }) },
  })

  const formatCents = (cents: number) => (cents / 100).toFixed(2)

  const columns = React.useMemo<ColumnDef<BOMRow>[]>(() => [
    { id: 'name', header: t('manufacturing.bom.fields.name', 'Name'), accessorKey: 'name', cell: ({ row }) => <Link href={`/backend/manufacturing/bill-of-materials/${row.original.id}`} className="font-medium text-primary hover:underline">{row.original.name}</Link> },
    { id: 'code', header: t('manufacturing.bom.fields.code', 'Code'), accessorKey: 'code' },
    { id: 'productName', header: t('manufacturing.bom.fields.productName', 'Product'), accessorKey: 'product_name' },
    { id: 'status', header: t('manufacturing.bom.fields.status', 'Status'), accessorKey: 'status', cell: ({ row }) => <StatusBadge variant={statusVariantMap[row.original.status] ?? 'neutral'}>{t(`manufacturing.bom.status.${row.original.status}`, row.original.status)}</StatusBadge> },
    { id: 'version', header: t('manufacturing.bom.fields.version', 'Ver'), accessorKey: 'version' },
    { id: 'isDefault', header: t('manufacturing.bom.fields.isDefault', 'Default'), accessorKey: 'is_default', cell: ({ row }) => row.original.is_default ? <StatusBadge variant="success">Yes</StatusBadge> : <span className="text-muted-foreground">No</span> },
    { id: 'totalCost', header: t('manufacturing.bom.fields.totalCost', 'Total Cost'), accessorKey: 'total_cost_cents', cell: ({ row }) => formatCents(row.original.total_cost_cents) },
    { id: 'actions', header: '', cell: ({ row }) => <RowActions id={`mfg.bom.${row.original.id}`} items={[
      { label: t('common.edit', 'Edit'), onClick: () => router.push(`/backend/manufacturing/bill-of-materials/${row.original.id}`) },
      { label: t('common.delete', 'Delete'), variant: 'destructive' as const, onClick: async () => { if (await confirm({ title: t('manufacturing.bom.deleteConfirm', 'Delete this BOM?') })) { await deleteItem(row.original.id); flash.success(t('common.deleted', 'Deleted')) } } },
    ]} /> },
  ], [t, router, confirm, deleteItem])

  return (
    <Page>
      <PageHeader title={t('manufacturing.bom.title', 'Bills of Materials')}>
        <Link href="/backend/manufacturing/bill-of-materials/create"><Button size="sm"><Plus className="mr-1 h-4 w-4" />{t('manufacturing.bom.create', 'New BOM')}</Button></Link>
      </PageHeader>
      <PageBody>
        <DataTable tableId="mfg.bom.list" columns={columns} queryKey={queryKey} queryFn={fetchData} page={page} onPageChange={setPage} search={search} onSearchChange={setSearch} sorting={sorting} onSortingChange={setSorting} />
      </PageBody>
    </Page>
  )
}
