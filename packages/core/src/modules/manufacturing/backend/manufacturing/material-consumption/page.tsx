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

type MaterialConsumptionRow = {
  id: string; production_order_id: string; product_name: string; product_sku?: string | null;
  planned_quantity: string; actual_quantity: string; wastage_quantity: string;
  unit_of_measure?: string | null; unit_cost_cents: number; status: string; created_at: string
}
type PagedResponse<T> = { items: T[]; total: number; totalPages: number }

const statusVariantMap: Record<string, 'success' | 'warning' | 'neutral' | 'error'> = {
  planned: 'neutral', issued: 'success', returned: 'warning', scrapped: 'error',
}

export default function MaterialConsumptionListPage() {
  const t = useT()
  const router = useRouter()
  const { confirm } = useConfirmDialog()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'productName', desc: false }])
  const queryKey = React.useMemo(() => ['mfg-material-consumption', page, search, sorting], [page, search, sorting])

  const fetchData = React.useCallback(async () => {
    const sortField = sorting[0]?.id || 'productName'
    const sortDir = sorting[0]?.desc ? 'desc' : 'asc'
    const params = new URLSearchParams({ page: String(page), pageSize: '25', sortField, sortDir, ...(search ? { search } : {}) })
    return await apiCallOrThrow(`/api/manufacturing/material-consumption?${params}`) as PagedResponse<MaterialConsumptionRow>
  }, [page, search, sorting])

  const { runMutation: deleteItem } = useGuardedMutation({
    mutationFn: async (id: string) => { await apiCallOrThrow(`/api/manufacturing/material-consumption`, { method: 'DELETE', body: JSON.stringify({ id }) }) },
  })

  const columns = React.useMemo<ColumnDef<MaterialConsumptionRow>[]>(() => [
    { id: 'productName', header: t('manufacturing.materialConsumption.fields.productName', 'Material'), accessorKey: 'product_name', cell: ({ row }) => <Link href={`/backend/manufacturing/material-consumption/${row.original.id}`} className="font-medium text-primary hover:underline">{row.original.product_name}</Link> },
    { id: 'productSku', header: t('manufacturing.materialConsumption.fields.productSku', 'SKU'), accessorKey: 'product_sku' },
    { id: 'plannedQty', header: t('manufacturing.materialConsumption.fields.plannedQuantity', 'Planned'), accessorKey: 'planned_quantity' },
    { id: 'actualQty', header: t('manufacturing.materialConsumption.fields.actualQuantity', 'Actual'), accessorKey: 'actual_quantity' },
    { id: 'wastageQty', header: t('manufacturing.materialConsumption.fields.wastageQuantity', 'Wastage'), accessorKey: 'wastage_quantity' },
    { id: 'status', header: t('manufacturing.materialConsumption.fields.status', 'Status'), accessorKey: 'status', cell: ({ row }) => <StatusBadge variant={statusVariantMap[row.original.status] ?? 'neutral'}>{t(`manufacturing.materialConsumption.status.${row.original.status}`, row.original.status)}</StatusBadge> },
    { id: 'actions', header: '', cell: ({ row }) => <RowActions id={`mfg.material-consumption.${row.original.id}`} items={[
      { label: t('common.edit', 'Edit'), onClick: () => router.push(`/backend/manufacturing/material-consumption/${row.original.id}`) },
      { label: t('common.delete', 'Delete'), variant: 'destructive' as const, onClick: async () => { if (await confirm({ title: t('manufacturing.materialConsumption.deleteConfirm', 'Delete this consumption record?') })) { await deleteItem(row.original.id); flash.success(t('common.deleted', 'Deleted')) } } },
    ]} /> },
  ], [t, router, confirm, deleteItem])

  return (
    <Page>
      <PageHeader title={t('manufacturing.materialConsumption.title', 'Material Consumption')}>
        <Link href="/backend/manufacturing/material-consumption/create"><Button size="sm"><Plus className="mr-1 h-4 w-4" />{t('manufacturing.materialConsumption.create', 'New Consumption')}</Button></Link>
      </PageHeader>
      <PageBody>
        <DataTable tableId="mfg.material-consumption.list" columns={columns} queryKey={queryKey} queryFn={fetchData} page={page} onPageChange={setPage} search={search} onSearchChange={setSearch} sorting={sorting} onSortingChange={setSorting} />
      </PageBody>
    </Page>
  )
}
