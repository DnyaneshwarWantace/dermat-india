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
import { useT } from '@wantace/shared/lib/i18n/context'
import { useLocale } from '@wantace/shared/lib/i18n/context'
import { Plus } from 'lucide-react'

type PurchaseOrderRow = {
  id: string
  order_number: string
  supplier_id: string
  status: string
  order_date: string
  expected_delivery_date?: string | null
  total_cents: number
  currency_code?: string | null
  created_at: string
  updated_at?: string | null
}

type PagedResponse<T> = { items: T[]; total: number; totalPages: number }

const STATUS_VARIANTS: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'error'> = {
  draft: 'neutral',
  sent: 'info',
  confirmed: 'info',
  partially_received: 'warning',
  received: 'success',
  cancelled: 'error',
  closed: 'neutral',
}

export default function PurchaseOrdersListPage() {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'orderDate', desc: true }])

  const dateFormatter = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }),
    [locale],
  )

  const currencyFormatter = React.useCallback(
    (cents: number, currency?: string | null) => {
      const amount = cents / 100
      try {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: currency ?? 'USD',
        }).format(amount)
      } catch {
        return `${currency ?? '$'}${amount.toFixed(2)}`
      }
    },
    [locale],
  )

  const queryKey = React.useMemo(
    () => ['purchasing-purchase-orders', page, search, sorting],
    [page, search, sorting],
  )

  const fetchOrders = React.useCallback(async () => {
    const sortField = sorting[0]?.id || 'orderDate'
    const sortDir = sorting[0]?.desc ? 'desc' : 'asc'
    const params = new URLSearchParams({
      page: String(page),
      pageSize: '25',
      sortField,
      sortDir,
      ...(search ? { search } : {}),
    })
    const res = await apiCallOrThrow(`/api/purchasing/purchase-orders?${params}`)
    return res as PagedResponse<PurchaseOrderRow>
  }, [page, search, sorting])

  const columns = React.useMemo<ColumnDef<PurchaseOrderRow>[]>(() => [
    {
      id: 'orderNumber',
      header: t('purchasing.purchaseOrders.fields.orderNumber', 'Order Number'),
      accessorKey: 'order_number',
      cell: ({ row }) => (
        <Link href={`/backend/purchasing/purchase-orders/${row.original.id}`} className="font-medium text-primary hover:underline">
          {row.original.order_number}
        </Link>
      ),
    },
    {
      id: 'status',
      header: t('purchasing.purchaseOrders.fields.status', 'Status'),
      accessorKey: 'status',
      cell: ({ row }) => {
        const status = row.original.status
        return <StatusBadge variant={STATUS_VARIANTS[status] ?? 'neutral'}>{t(`purchasing.purchaseOrders.status.${status}`, status)}</StatusBadge>
      },
    },
    {
      id: 'orderDate',
      header: t('purchasing.purchaseOrders.fields.orderDate', 'Order Date'),
      accessorKey: 'order_date',
      cell: ({ row }) => row.original.order_date ? dateFormatter.format(new Date(row.original.order_date)) : '',
    },
    {
      id: 'expectedDeliveryDate',
      header: t('purchasing.purchaseOrders.fields.expectedDeliveryDate', 'Expected Delivery'),
      accessorKey: 'expected_delivery_date',
      cell: ({ row }) => row.original.expected_delivery_date ? dateFormatter.format(new Date(row.original.expected_delivery_date)) : '',
    },
    {
      id: 'totalCents',
      header: t('purchasing.purchaseOrders.fields.total', 'Total'),
      accessorKey: 'total_cents',
      cell: ({ row }) => currencyFormatter(row.original.total_cents, row.original.currency_code),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <RowActions
          id={`purchasing.purchase-orders.${row.original.id}`}
          items={[
            {
              label: t('common.view', 'View'),
              onClick: () => router.push(`/backend/purchasing/purchase-orders/${row.original.id}`),
            },
          ]}
        />
      ),
    },
  ], [t, router, dateFormatter, currencyFormatter])

  return (
    <Page>
      <PageHeader title={t('purchasing.purchaseOrders.title', 'Purchase Orders')}>
        <Link href="/backend/purchasing/purchase-orders/create">
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" />
            {t('purchasing.purchaseOrders.create', 'New Purchase Order')}
          </Button>
        </Link>
      </PageHeader>
      <PageBody>
        <DataTable
          tableId="purchasing.purchase-orders.list"
          columns={columns}
          queryKey={queryKey}
          queryFn={fetchOrders}
          page={page}
          onPageChange={setPage}
          search={search}
          onSearchChange={setSearch}
          sorting={sorting}
          onSortingChange={setSorting}
        />
      </PageBody>
    </Page>
  )
}
