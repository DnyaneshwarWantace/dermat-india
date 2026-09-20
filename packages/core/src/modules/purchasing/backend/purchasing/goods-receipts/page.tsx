"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import type { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy'
import type { SortingState } from '@tanstack/react-table'
import { Page, PageBody, PageHeader } from '@wantace/ui/backend/Page'
import { DataTable } from '@wantace/ui/backend/DataTable'
import { StatusBadge } from '@wantace/ui/primitives/status-badge'
import { Button } from '@wantace/ui/primitives/button'
import { apiCallOrThrow } from '@wantace/ui/backend/utils/apiCall'
import { useT } from '@wantace/shared/lib/i18n/context'
import { useLocale } from '@wantace/shared/lib/i18n/context'

type GoodsReceiptRow = {
  id: string
  receipt_number: string
  purchase_order_id: string
  status: string
  receipt_date: string
  created_at: string
}

type PagedResponse<T> = { items: T[]; total: number; totalPages: number }

export default function GoodsReceiptsListPage() {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'receiptDate', desc: true }])

  const dateFormatter = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }),
    [locale],
  )

  const queryKey = React.useMemo(
    () => ['purchasing-goods-receipts', page, search, sorting],
    [page, search, sorting],
  )

  const fetchReceipts = React.useCallback(async () => {
    const sortField = sorting[0]?.id || 'receiptDate'
    const sortDir = sorting[0]?.desc ? 'desc' : 'asc'
    const params = new URLSearchParams({
      page: String(page),
      pageSize: '25',
      sortField,
      sortDir,
      ...(search ? { search } : {}),
    })
    const res = await apiCallOrThrow(`/api/purchasing/goods-receipts?${params}`)
    return res as PagedResponse<GoodsReceiptRow>
  }, [page, search, sorting])

  const columns = React.useMemo<ColumnDef<GoodsReceiptRow>[]>(() => [
    {
      id: 'receiptNumber',
      header: t('purchasing.goodsReceipts.fields.receiptNumber', 'Receipt Number'),
      accessorKey: 'receipt_number',
      cell: ({ row }) => (
        <Link href={`/backend/purchasing/goods-receipts/${row.original.id}`} className="font-medium text-accent-foreground hover:underline">
          {row.original.receipt_number}
        </Link>
      ),
    },
    {
      id: 'status',
      header: t('purchasing.goodsReceipts.fields.status', 'Status'),
      accessorKey: 'status',
      cell: ({ row }) => {
        const status = row.original.status
        const variant = status === 'completed' ? 'success' : status === 'cancelled' ? 'error' : 'neutral'
        return <StatusBadge variant={variant}>{t(`purchasing.goodsReceipts.status.${status}`, status)}</StatusBadge>
      },
    },
    {
      id: 'receiptDate',
      header: t('purchasing.goodsReceipts.fields.receiptDate', 'Receipt Date'),
      accessorKey: 'receipt_date',
      cell: ({ row }) => row.original.receipt_date ? dateFormatter.format(new Date(row.original.receipt_date)) : '',
    },
  ], [t, dateFormatter])

  return (
    <Page>
      <PageHeader title={t('purchasing.goodsReceipts.title', 'Goods Receipts')}>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/backend/purchasing/goods-receipts/create">
            <Plus className="mr-1 size-3.5" />
            {t('purchasing.goodsReceipts.create', 'New Goods Receipt')}
          </Link>
        </Button>
      </PageHeader>
      <PageBody>
        <DataTable
          tableId="purchasing.goods-receipts.list"
          columns={columns}
          queryKey={queryKey}
          queryFn={fetchReceipts}
          page={page}
          onPageChange={setPage}
          search={search}
          onSearchChange={setSearch}
          sorting={sorting}
          onSortingChange={setSorting}
          onRowClick={(row) => router.push(`/backend/purchasing/goods-receipts/${row.id}`)}
        />
      </PageBody>
    </Page>
  )
}
