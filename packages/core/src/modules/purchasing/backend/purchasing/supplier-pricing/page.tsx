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

type SupplierPricingRow = {
  id: string
  supplier_id: string
  product_name: string
  product_sku?: string | null
  unit_price_cents: number
  currency_code?: string | null
  min_quantity: string
  lead_time_days?: number | null
  valid_from?: string | null
  valid_to?: string | null
  is_active: boolean
  created_at: string
  updated_at?: string | null
}

type PagedResponse<T> = { items: T[]; total: number; totalPages: number }

function formatCents(cents: number, currency?: string | null): string {
  const value = (cents / 100).toFixed(2)
  return currency ? `${currency} ${value}` : value
}

export default function SupplierPricingListPage() {
  const t = useT()
  const router = useRouter()
  const { confirm } = useConfirmDialog()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'productName', desc: false }])

  const queryKey = React.useMemo(() => ['purchasing-supplier-pricing', page, search, sorting], [page, search, sorting])

  const fetchPricing = React.useCallback(async () => {
    const sortField = sorting[0]?.id || 'productName'
    const sortDir = sorting[0]?.desc ? 'desc' : 'asc'
    const params = new URLSearchParams({
      page: String(page),
      pageSize: '25',
      sortField,
      sortDir,
      ...(search ? { search } : {}),
    })
    const res = await apiCallOrThrow(`/api/purchasing/supplier-pricing?${params}`)
    return res as PagedResponse<SupplierPricingRow>
  }, [page, search, sorting])

  const { runMutation: deletePricing } = useGuardedMutation({
    mutationFn: async (id: string) => {
      await apiCallOrThrow(`/api/purchasing/supplier-pricing`, {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      })
    },
  })

  const columns = React.useMemo<ColumnDef<SupplierPricingRow>[]>(() => [
    {
      id: 'productName',
      header: t('purchasing.supplierPricing.fields.productName', 'Product'),
      accessorKey: 'product_name',
      cell: ({ row }) => (
        <Link href={`/backend/purchasing/supplier-pricing/${row.original.id}`} className="font-medium text-primary hover:underline">
          {row.original.product_name}
        </Link>
      ),
    },
    {
      id: 'productSku',
      header: t('purchasing.supplierPricing.fields.productSku', 'SKU'),
      accessorKey: 'product_sku',
    },
    {
      id: 'unitPriceCents',
      header: t('purchasing.supplierPricing.fields.unitPrice', 'Unit Price'),
      accessorKey: 'unit_price_cents',
      cell: ({ row }) => formatCents(row.original.unit_price_cents, row.original.currency_code),
    },
    {
      id: 'minQuantity',
      header: t('purchasing.supplierPricing.fields.minQuantity', 'Min Qty'),
      accessorKey: 'min_quantity',
    },
    {
      id: 'leadTimeDays',
      header: t('purchasing.supplierPricing.fields.leadTimeDays', 'Lead Time'),
      accessorKey: 'lead_time_days',
      cell: ({ row }) => row.original.lead_time_days != null ? `${row.original.lead_time_days}d` : '—',
    },
    {
      id: 'isActive',
      header: t('purchasing.supplierPricing.fields.isActive', 'Active'),
      accessorKey: 'is_active',
      cell: ({ row }) => (
        <StatusBadge variant={row.original.is_active ? 'success' : 'neutral'}>
          {row.original.is_active ? t('common.yes', 'Yes') : t('common.no', 'No')}
        </StatusBadge>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <RowActions
          id={`purchasing.supplier-pricing.${row.original.id}`}
          items={[
            {
              label: t('common.edit', 'Edit'),
              onClick: () => router.push(`/backend/purchasing/supplier-pricing/${row.original.id}`),
            },
            {
              label: t('common.delete', 'Delete'),
              variant: 'destructive' as const,
              onClick: async () => {
                const confirmed = await confirm({
                  title: t('purchasing.supplierPricing.deleteConfirm', 'Delete this pricing rule?'),
                })
                if (!confirmed) return
                await deletePricing(row.original.id)
                flash.success(t('common.deleted', 'Deleted'))
              },
            },
          ]}
        />
      ),
    },
  ], [t, router, confirm, deletePricing])

  return (
    <Page>
      <PageHeader title={t('purchasing.supplierPricing.title', 'Supplier Pricing')}>
        <Link href="/backend/purchasing/supplier-pricing/create">
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" />
            {t('purchasing.supplierPricing.create', 'New Pricing Rule')}
          </Button>
        </Link>
      </PageHeader>
      <PageBody>
        <DataTable
          tableId="purchasing.supplier-pricing.list"
          columns={columns}
          queryKey={queryKey}
          queryFn={fetchPricing}
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
