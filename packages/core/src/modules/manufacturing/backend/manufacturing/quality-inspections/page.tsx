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

type QualityInspectionRow = {
  id: string; inspection_number: string; inspection_type: string; status: string;
  product_name: string; inspected_quantity: string; passed_quantity: string; failed_quantity: string;
  overall_result?: string | null; created_at: string
}
type PagedResponse<T> = { items: T[]; total: number; totalPages: number }

const statusVariantMap: Record<string, 'success' | 'warning' | 'neutral' | 'error'> = {
  pending: 'neutral', in_progress: 'warning', passed: 'success', failed: 'error', on_hold: 'neutral',
}
const resultVariantMap: Record<string, 'success' | 'warning' | 'error'> = {
  pass: 'success', fail: 'error', conditional: 'warning',
}

export default function QualityInspectionsListPage() {
  const t = useT()
  const router = useRouter()
  const { confirm } = useConfirmDialog()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'inspectionNumber', desc: true }])
  const queryKey = React.useMemo(() => ['mfg-quality-inspections', page, search, sorting], [page, search, sorting])

  const fetchData = React.useCallback(async () => {
    const sortField = sorting[0]?.id || 'inspectionNumber'
    const sortDir = sorting[0]?.desc ? 'desc' : 'asc'
    const params = new URLSearchParams({ page: String(page), pageSize: '25', sortField, sortDir, ...(search ? { search } : {}) })
    return await apiCallOrThrow(`/api/manufacturing/quality-inspections?${params}`) as PagedResponse<QualityInspectionRow>
  }, [page, search, sorting])

  const { runMutation: deleteItem } = useGuardedMutation({
    mutationFn: async (id: string) => { await apiCallOrThrow(`/api/manufacturing/quality-inspections`, { method: 'DELETE', body: JSON.stringify({ id }) }) },
  })

  const columns = React.useMemo<ColumnDef<QualityInspectionRow>[]>(() => [
    { id: 'inspectionNumber', header: t('manufacturing.qualityInspections.fields.inspectionNumber', 'Inspection #'), accessorKey: 'inspection_number', cell: ({ row }) => <Link href={`/backend/manufacturing/quality-inspections/${row.original.id}`} className="font-medium text-primary hover:underline">{row.original.inspection_number}</Link> },
    { id: 'productName', header: t('manufacturing.qualityInspections.fields.productName', 'Product'), accessorKey: 'product_name' },
    { id: 'inspectionType', header: t('manufacturing.qualityInspections.fields.inspectionType', 'Type'), accessorKey: 'inspection_type', cell: ({ row }) => t(`manufacturing.qualityInspections.type.${row.original.inspection_type}`, row.original.inspection_type) },
    { id: 'status', header: t('manufacturing.qualityInspections.fields.status', 'Status'), accessorKey: 'status', cell: ({ row }) => <StatusBadge variant={statusVariantMap[row.original.status] ?? 'neutral'}>{t(`manufacturing.qualityInspections.status.${row.original.status}`, row.original.status)}</StatusBadge> },
    { id: 'inspectedQty', header: t('manufacturing.qualityInspections.fields.inspectedQuantity', 'Inspected'), accessorKey: 'inspected_quantity' },
    { id: 'passedQty', header: t('manufacturing.qualityInspections.fields.passedQuantity', 'Passed'), accessorKey: 'passed_quantity' },
    { id: 'failedQty', header: t('manufacturing.qualityInspections.fields.failedQuantity', 'Failed'), accessorKey: 'failed_quantity' },
    { id: 'result', header: t('manufacturing.qualityInspections.fields.overallResult', 'Result'), accessorKey: 'overall_result', cell: ({ row }) => row.original.overall_result ? <StatusBadge variant={resultVariantMap[row.original.overall_result] ?? 'neutral'}>{t(`manufacturing.qualityInspections.result.${row.original.overall_result}`, row.original.overall_result)}</StatusBadge> : '—' },
    { id: 'actions', header: '', cell: ({ row }) => <RowActions id={`mfg.quality-inspections.${row.original.id}`} items={[
      { label: t('common.edit', 'Edit'), onClick: () => router.push(`/backend/manufacturing/quality-inspections/${row.original.id}`) },
      { label: t('common.delete', 'Delete'), variant: 'destructive' as const, onClick: async () => { if (await confirm({ title: t('manufacturing.qualityInspections.deleteConfirm', 'Delete this inspection?') })) { await deleteItem(row.original.id); flash.success(t('common.deleted', 'Deleted')) } } },
    ]} /> },
  ], [t, router, confirm, deleteItem])

  return (
    <Page>
      <PageHeader title={t('manufacturing.qualityInspections.title', 'Quality Inspections')}>
        <Link href="/backend/manufacturing/quality-inspections/create"><Button size="sm"><Plus className="mr-1 h-4 w-4" />{t('manufacturing.qualityInspections.create', 'New Inspection')}</Button></Link>
      </PageHeader>
      <PageBody>
        <DataTable tableId="mfg.quality-inspections.list" columns={columns} queryKey={queryKey} queryFn={fetchData} page={page} onPageChange={setPage} search={search} onSearchChange={setSearch} sorting={sorting} onSortingChange={setSorting} />
      </PageBody>
    </Page>
  )
}
