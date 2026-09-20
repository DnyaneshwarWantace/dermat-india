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

type PurchaseInvoiceRow = {
  id: string
  invoice_number: string
  supplier_invoice_number?: string | null
  supplier_id: string
  status: string
  invoice_date: string
  due_date?: string | null
  total_cents: number
  paid_cents: number
  balance_cents: number
  currency_code?: string | null
  created_at: string
  updated_at?: string | null
}

type PagedResponse<T> = { items: T[]; total: number; totalPages: number }

function formatCents(cents: number, currency?: string | null): string {
  const value = (cents / 100).toFixed(2)
  return currency ? `${currency} ${value}` : value
}

const statusVariantMap: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  draft: 'neutral',
  pending_approval: 'warning',
  approved: 'info',
  paid: 'success',
  partially_paid: 'warning',
  cancelled: 'error',
}

export default function PurchaseInvoicesListPage() {
  const t = useT()
  const router = useRouter()
  const { confirm } = useConfirmDialog()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'invoiceDate', desc: true }])

  const queryKey = React.useMemo(() => ['purchasing-purchase-invoices', page, search, sorting], [page, search, sorting])

  const fetchInvoices = React.useCallback(async () => {
    const sortField = sorting[0]?.id || 'invoiceDate'
    const sortDir = sorting[0]?.desc ? 'desc' : 'asc'
    const params = new URLSearchParams({
      page: String(page),
      pageSize: '25',
      sortField,
      sortDir,
      ...(search ? { search } : {}),
    })
    const res = await apiCallOrThrow(`/api/purchasing/purchase-invoices?${params}`)
    return res as PagedResponse<PurchaseInvoiceRow>
  }, [page, search, sorting])

  const { runMutation: deleteInvoice } = useGuardedMutation({
    mutationFn: async (id: string) => {
      await apiCallOrThrow(`/api/purchasing/purchase-invoices`, {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      })
    },
  })

  const columns = React.useMemo<ColumnDef<PurchaseInvoiceRow>[]>(() => [
    {
      id: 'invoiceNumber',
      header: t('purchasing.purchaseInvoices.fields.invoiceNumber', 'Invoice #'),
      accessorKey: 'invoice_number',
      cell: ({ row }) => (
        <Link href={`/backend/purchasing/purchase-invoices/${row.original.id}`} className="font-medium text-primary hover:underline">
          {row.original.invoice_number}
        </Link>
      ),
    },
    {
      id: 'supplierInvoiceNumber',
      header: t('purchasing.purchaseInvoices.fields.supplierInvoiceNumber', 'Supplier Inv #'),
      accessorKey: 'supplier_invoice_number',
    },
    {
      id: 'status',
      header: t('purchasing.purchaseInvoices.fields.status', 'Status'),
      accessorKey: 'status',
      cell: ({ row }) => {
        const status = row.original.status
        const variant = statusVariantMap[status] ?? 'neutral'
        return <StatusBadge variant={variant}>{t(`purchasing.purchaseInvoices.status.${status}`, status.replace(/_/g, ' '))}</StatusBadge>
      },
    },
    {
      id: 'invoiceDate',
      header: t('purchasing.purchaseInvoices.fields.invoiceDate', 'Invoice Date'),
      accessorKey: 'invoice_date',
      cell: ({ row }) => row.original.invoice_date ? new Date(row.original.invoice_date).toLocaleDateString() : '—',
    },
    {
      id: 'dueDate',
      header: t('purchasing.purchaseInvoices.fields.dueDate', 'Due Date'),
      accessorKey: 'due_date',
      cell: ({ row }) => row.original.due_date ? new Date(row.original.due_date).toLocaleDateString() : '—',
    },
    {
      id: 'totalCents',
      header: t('purchasing.purchaseInvoices.fields.total', 'Total'),
      accessorKey: 'total_cents',
      cell: ({ row }) => formatCents(row.original.total_cents, row.original.currency_code),
    },
    {
      id: 'balanceCents',
      header: t('purchasing.purchaseInvoices.fields.balance', 'Balance'),
      accessorKey: 'balance_cents',
      cell: ({ row }) => formatCents(row.original.balance_cents, row.original.currency_code),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <RowActions
          id={`purchasing.purchase-invoices.${row.original.id}`}
          items={[
            {
              label: t('common.edit', 'Edit'),
              onClick: () => router.push(`/backend/purchasing/purchase-invoices/${row.original.id}`),
            },
            {
              label: t('common.delete', 'Delete'),
              variant: 'destructive' as const,
              onClick: async () => {
                const confirmed = await confirm({
                  title: t('purchasing.purchaseInvoices.deleteConfirm', 'Delete this purchase invoice?'),
                })
                if (!confirmed) return
                await deleteInvoice(row.original.id)
                flash.success(t('common.deleted', 'Deleted'))
              },
            },
          ]}
        />
      ),
    },
  ], [t, router, confirm, deleteInvoice])

  return (
    <Page>
      <PageHeader title={t('purchasing.purchaseInvoices.title', 'Purchase Invoices')}>
        <Link href="/backend/purchasing/purchase-invoices/create">
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" />
            {t('purchasing.purchaseInvoices.create', 'New Invoice')}
          </Button>
        </Link>
      </PageHeader>
      <PageBody>
        <DataTable
          tableId="purchasing.purchase-invoices.list"
          columns={columns}
          queryKey={queryKey}
          queryFn={fetchInvoices}
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
