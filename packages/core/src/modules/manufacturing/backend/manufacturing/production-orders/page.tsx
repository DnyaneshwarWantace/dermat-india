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

type ProductionOrderRow = {
  id: string; order_number: string;
  sales_order_id?: string | null; sales_order_number?: string | null;
  bom_name: string; product_name: string;
  planned_quantity: string; produced_quantity: string; rejected_quantity: string;
  status: string; priority: string; planned_start_date?: string | null;
  planned_end_date?: string | null; total_cost_cents: number; created_at: string
}
type PagedResponse<T> = { items: T[]; total: number; totalPages: number }

const statusVariantMap: Record<string, 'success' | 'warning' | 'neutral' | 'error'> = {
  draft: 'neutral', planned: 'warning', in_progress: 'warning', completed: 'success', cancelled: 'error', on_hold: 'neutral',
}
const priorityVariantMap: Record<string, 'success' | 'warning' | 'neutral' | 'error'> = {
  low: 'neutral', normal: 'success', high: 'warning', urgent: 'error',
}

export default function ProductionOrdersListPage() {
  const t = useT()
  const router = useRouter()
  const { confirm } = useConfirmDialog()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'orderNumber', desc: true }])
  const queryKey = React.useMemo(() => ['mfg-production-orders', page, search, sorting], [page, search, sorting])

  const fetchData = React.useCallback(async () => {
    const sortField = sorting[0]?.id || 'orderNumber'
    const sortDir = sorting[0]?.desc ? 'desc' : 'asc'
    const params = new URLSearchParams({ page: String(page), pageSize: '25', sortField, sortDir, ...(search ? { search } : {}) })
    return await apiCallOrThrow(`/api/manufacturing/production-orders?${params}`) as PagedResponse<ProductionOrderRow>
  }, [page, search, sorting])

  const { runMutation: deleteItem } = useGuardedMutation({
    mutationFn: async (id: string) => { await apiCallOrThrow(`/api/manufacturing/production-orders`, { method: 'DELETE', body: JSON.stringify({ id }) }) },
  })

  const columns = React.useMemo<ColumnDef<ProductionOrderRow>[]>(() => [
    { id: 'orderNumber', header: t('manufacturing.productionOrders.fields.orderNumber', 'Order #'), accessorKey: 'order_number', cell: ({ row }) => <Link href={`/backend/manufacturing/production-orders/${row.original.id}`} className="font-medium text-primary hover:underline">{row.original.order_number}</Link> },
    { id: 'productName', header: t('manufacturing.productionOrders.fields.productName', 'Product'), accessorKey: 'product_name' },
    { id: 'bomName', header: t('manufacturing.productionOrders.fields.bomName', 'BOM'), accessorKey: 'bom_name' },
    { id: 'salesOrder', header: t('manufacturing.productionOrders.fields.salesOrder', 'Sales Order'), accessorKey: 'sales_order_number', cell: ({ row }) => row.original.sales_order_number ? <Link href={`/backend/sales/documents/${row.original.sales_order_id}`} className="text-primary hover:underline">{row.original.sales_order_number}</Link> : <span className="text-muted-foreground">—</span> },
    { id: 'plannedQty', header: t('manufacturing.productionOrders.fields.plannedQuantity', 'Planned Qty'), accessorKey: 'planned_quantity' },
    { id: 'producedQty', header: t('manufacturing.productionOrders.fields.producedQuantity', 'Produced'), accessorKey: 'produced_quantity' },
    { id: 'status', header: t('manufacturing.productionOrders.fields.status', 'Status'), accessorKey: 'status', cell: ({ row }) => <StatusBadge variant={statusVariantMap[row.original.status] ?? 'neutral'}>{t(`manufacturing.productionOrders.status.${row.original.status}`, row.original.status)}</StatusBadge> },
    { id: 'priority', header: t('manufacturing.productionOrders.fields.priority', 'Priority'), accessorKey: 'priority', cell: ({ row }) => <StatusBadge variant={priorityVariantMap[row.original.priority] ?? 'neutral'}>{t(`manufacturing.productionOrders.priority.${row.original.priority}`, row.original.priority)}</StatusBadge> },
    { id: 'actions', header: '', cell: ({ row }) => <RowActions id={`mfg.production-orders.${row.original.id}`} items={[
      { label: t('manufacturing.tracking.title', 'Track'), onClick: () => router.push(`/backend/manufacturing/production-orders/${row.original.id}/tracking`) },
      { label: t('common.edit', 'Edit'), onClick: () => router.push(`/backend/manufacturing/production-orders/${row.original.id}`) },
      { label: t('common.delete', 'Delete'), variant: 'destructive' as const, onClick: async () => { if (await confirm({ title: t('manufacturing.productionOrders.deleteConfirm', 'Delete this production order?') })) { await deleteItem(row.original.id); flash.success(t('common.deleted', 'Deleted')) } } },
    ]} /> },
  ], [t, router, confirm, deleteItem])

  return (
    <Page>
      <PageHeader title={t('manufacturing.productionOrders.title', 'Production Orders')}>
        <Link href="/backend/manufacturing/production-orders/create"><Button size="sm"><Plus className="mr-1 h-4 w-4" />{t('manufacturing.productionOrders.create', 'New Production Order')}</Button></Link>
      </PageHeader>
      <PageBody>
        <DataTable tableId="mfg.production-orders.list" columns={columns} queryKey={queryKey} queryFn={fetchData} page={page} onPageChange={setPage} search={search} onSearchChange={setSearch} sorting={sorting} onSortingChange={setSorting} />
      </PageBody>
    </Page>
  )
}
