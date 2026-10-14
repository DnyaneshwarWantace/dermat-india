"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy'
import { Plus, Trash2 } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { Button } from '@open-mercato/ui/primitives/button'
import { Tabs, TabsList, TabsTrigger } from '@open-mercato/ui/primitives/tabs'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { IconButton } from '@open-mercato/ui/primitives/icon-button'
import { apiCall, withScopedApiRequestHeaders } from '@open-mercato/ui/backend/utils/apiCall'
import { buildOptimisticLockHeader } from '@open-mercato/ui/backend/utils/optimisticLock'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useGranted } from '../../dermat_departments/components/useGranted'
import { KIND_CONFIG } from '../../dermat_products/lib/kindConfig'
import type { ProductKind } from '../../dermat_products/lib/kinds'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import type { BomKind } from '../lib/bomKinds'
import { STATUS_VARIANT } from './BomEditor'
import { formatQty } from './MaterialPicker'
import type { BomListItem } from './types'
import { ExportButton } from '../../dermat_products/components/ExportButton'
import { downloadCsv, fetchAllPages } from '../../dermat_products/lib/csvExport'

type ListResponse = { items?: BomListItem[]; total?: number; totalPages?: number }

const PAGE_SIZE = 50

export function BomsPage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const kind: BomKind = searchParams?.get('tab') === 'pack' ? 'pack' : 'formula'
  const [rows, setRows] = React.useState<BomListItem[]>([])
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [isLoading, setIsLoading] = React.useState(true)
  const granted = useGranted()
  const canManage = granted.ready && granted.has('dermat_boms.manage')
  const { runMutation } = useGuardedMutation({ contextId: 'dermat-boms-list' })
  const { confirm: confirmDialog, ConfirmDialogElement } = useConfirmDialog()

  React.useEffect(() => {
    setPage(1)
    setSearch('')
  }, [kind])

  React.useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    const params = new URLSearchParams({ kind, page: String(page), pageSize: String(PAGE_SIZE) })
    if (search.trim()) params.set('search', search.trim())
    apiCall<ListResponse>(`/api/dermat_boms/boms?${params.toString()}`, undefined, { fallback: { items: [] } }).then((call) => {
      if (cancelled) return
      if (!call.ok) flash(t('dermat_boms.list.loadError', 'Failed to load BOMs'), 'error')
      setRows(call.result?.items ?? [])
      setTotal(call.result?.total ?? 0)
      setTotalPages(call.result?.totalPages ?? 1)
      setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [kind, page, search, t])

  const deleteBom = async (row: BomListItem) => {
    const confirmed = await confirmDialog({ title: t('dermat_boms.list.confirmDelete', 'Delete the BOM "{name}"?', { name: row.name }), variant: 'destructive' })
    if (!confirmed) return
    const call = await runMutation({
      context: { bomId: row.id, action: 'delete' },
      mutationPayload: { id: row.id },
      operation: () =>
        withScopedApiRequestHeaders(buildOptimisticLockHeader(row.updatedAt), () =>
          apiCall<{ error?: string }>(`/api/dermat_boms/boms?id=${encodeURIComponent(row.id)}`, { method: 'DELETE' }),
        ),
    })
    if (!call.ok) {
      flash(call.result?.error ?? t('dermat_boms.errors.delete', 'Could not delete the BOM.'), 'error')
      return
    }
    flash(t('dermat_boms.flash.deleted', 'BOM deleted'), 'success')
    setRows((current) => current.filter((entry) => entry.id !== row.id))
    setTotal((value) => Math.max(0, value - 1))
  }

  const deleteRef = React.useRef(deleteBom)
  deleteRef.current = deleteBom

  const columns = React.useMemo<ColumnDef<BomListItem>[]>(() => {
    const base: ColumnDef<BomListItem>[] = [
      {
        id: 'name',
        header: t('dermat_boms.list.name', 'BOM name'),
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.name}
            {row.original.orderNo ? (
              <span className="block text-xs font-normal text-muted-foreground">{t('dermat_boms.list.forOrder', 'only {order}', { order: row.original.orderNo })}</span>
            ) : null}
          </span>
        ),
      },
      {
        id: 'product',
        header: t('dermat_boms.list.product', 'Product'),
        cell: ({ row }) => (
          <span>
            <span className="block font-mono text-xs text-primary">{row.original.productCode ?? ''}</span>
            <span>{row.original.productName}</span>
          </span>
        ),
      },
      {
        id: 'category',
        header: t('dermat_boms.list.category', 'Category'),
        cell: ({ row }) => (
          <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs">
            {KIND_CONFIG[row.original.productKind as ProductKind]?.singular ?? row.original.productKind}
          </span>
        ),
      },
      {
        id: 'quantity',
        header: t('dermat_boms.list.quantity', 'Quantity'),
        cell: ({ row }) => <span className="font-mono">{`${formatQty(row.original.batchSize)} ${row.original.batchUnit}`}</span>,
      },
      { id: 'lines', header: t('dermat_boms.list.lines', 'Components'), cell: ({ row }) => row.original.lineCount },
    ]
    const percent: ColumnDef<BomListItem>[] =
      kind === 'formula'
        ? [
            {
              id: 'total',
              header: t('dermat_boms.list.total', 'Total %'),
              cell: ({ row }) => {
                const value = row.original.totalPercent ?? 0
                return (
                  <span className={cn('font-mono', Math.abs(value - 100) > 0.001 && 'text-status-error-text')}>{formatQty(value, 4)} %</span>
                )
              },
            },
          ]
        : []
    const tail: ColumnDef<BomListItem>[] = [
      {
        id: 'status',
        header: t('dermat_boms.list.status', 'Status'),
        cell: ({ row }) => (
          <StatusBadge variant={STATUS_VARIANT[row.original.status] ?? 'neutral'} dot>
            {row.original.status === 'approved' ? t('dermat_boms.status.issued', 'Issued') : t(`dermat_boms.status.${row.original.status}`, row.original.status)}
          </StatusBadge>
        ),
      },
      {
        id: 'created',
        header: t('dermat_boms.list.created', 'Created'),
        cell: ({ row }) => (
          <span className="text-xs">
            {new Date(row.original.createdAt).toLocaleDateString('en-IN')}
            <span className="block text-muted-foreground">{row.original.createdByName ?? ''}</span>
          </span>
        ),
      },
      {
        id: 'delete',
        header: '',
        cell: ({ row }) =>
          canManage && row.original.status === 'draft' ? (
            <IconButton
              type="button"
              variant="ghost"
              size="sm"
              aria-label={t('dermat_boms.delete', 'Delete')}
              onClick={(event) => {
                event.stopPropagation()
                void deleteRef.current(row.original)
              }}
            >
              <Trash2 className="size-4 text-status-error-icon" />
            </IconButton>
          ) : null,
      },
    ]
    return [...base, ...percent, ...tail]
  }, [kind, t, canManage])

  const exportBoms = async () => {
    const params = new URLSearchParams({ kind })
    if (search.trim()) params.set('search', search.trim())
    const items = await fetchAllPages<BomListItem>(`/api/dermat_boms/boms?${params.toString()}`)
    downloadCsv(kind === 'formula' ? 'formulas' : 'pack-boms', [
      { header: 'BOM name', value: (row) => row.name },
      { header: 'Product ID', value: (row) => row.productCode ?? '' },
      { header: 'Product', value: (row) => row.productName },
      { header: 'Only for order', value: (row) => row.orderNo ?? '' },
      { header: 'Version', value: (row) => row.version },
      { header: 'Status', value: (row) => row.status },
      { header: 'Batch size', value: (row) => row.batchSize },
      { header: 'Batch unit', value: (row) => row.batchUnit },
      { header: 'Lines', value: (row) => row.lineCount },
      { header: 'Total %', value: (row) => row.totalPercent ?? '' },
      { header: 'Created by', value: (row) => row.createdByName ?? '' },
      { header: 'Approved by', value: (row) => row.approvedByName ?? '' },
      { header: 'Last changed', value: (row) => row.updatedAt.slice(0, 10) },
    ], items)
  }

  return (
    <Page>
      <PageBody>
        <div className="mb-4">
          <Tabs value={kind} onValueChange={(value) => router.replace(`/backend/boms?tab=${value}`)} variant="underline">
            <TabsList aria-label={t('dermat_boms.list.tabs', 'BOM types')}>
              <TabsTrigger value="formula">{t('dermat_boms.list.formulas', 'Formulas (Bulk & R&D)')}</TabsTrigger>
              <TabsTrigger value="pack">{t('dermat_boms.list.packs', 'Pack BOMs (Finished Goods)')}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <DataTable
          key={`boms-${kind}`}
          perspective={{ tableId: `dermat_boms.${kind}` }}
          title={kind === 'formula' ? t('dermat_boms.list.formulaTitle', 'Formulas') : t('dermat_boms.list.packTitle', 'Pack BOMs')}
          columns={columns}
          data={rows}
          onRowClick={(row) => router.push(`/backend/boms/${row.id}`)}
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          searchPlaceholder={t('dermat_boms.list.search', 'Search by product name or internal ID')}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <ExportButton onExport={exportBoms} />
              <Button asChild>
                <Link href="/backend/boms/new">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('dermat_boms.list.new', 'New Bill of Material')}
                </Link>
              </Button>
            </div>
          }
          pagination={{ page, pageSize: PAGE_SIZE, total, totalPages, onPageChange: setPage }}
          isLoading={isLoading}
        />
        {ConfirmDialogElement}
      </PageBody>
    </Page>
  )
}

export default BomsPage
