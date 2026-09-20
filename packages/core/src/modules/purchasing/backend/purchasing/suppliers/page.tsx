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
import { apiCall, apiCallOrThrow } from '@wantace/ui/backend/utils/apiCall'
import { useGuardedMutation } from '@wantace/ui/backend/injection/useGuardedMutation'
import { flash } from '@wantace/ui/backend/FlashMessages'
import { useT } from '@wantace/shared/lib/i18n/context'
import { useConfirmDialog } from '@wantace/ui/backend/confirm-dialog'
import { Plus } from 'lucide-react'

type SupplierRow = {
  id: string
  name: string
  code: string
  status: string
  contact_name?: string | null
  contact_email?: string | null
  city?: string | null
  country?: string | null
  created_at: string
  updated_at?: string | null
}

type PagedResponse<T> = { items: T[]; total: number; totalPages: number }

export default function SuppliersListPage() {
  const t = useT()
  const router = useRouter()
  const { confirm } = useConfirmDialog()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'name', desc: false }])

  const queryKey = React.useMemo(() => ['purchasing-suppliers', page, search, sorting], [page, search, sorting])

  const fetchSuppliers = React.useCallback(async () => {
    const sortField = sorting[0]?.id || 'name'
    const sortDir = sorting[0]?.desc ? 'desc' : 'asc'
    const params = new URLSearchParams({
      page: String(page),
      pageSize: '25',
      sortField,
      sortDir,
      ...(search ? { search } : {}),
    })
    const res = await apiCallOrThrow(`/api/purchasing/suppliers?${params}`)
    return res as PagedResponse<SupplierRow>
  }, [page, search, sorting])

  const { runMutation: deleteSupplier } = useGuardedMutation({
    mutationFn: async (id: string) => {
      await apiCallOrThrow(`/api/purchasing/suppliers`, {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      })
    },
  })

  const columns = React.useMemo<ColumnDef<SupplierRow>[]>(() => [
    {
      id: 'name',
      header: t('purchasing.suppliers.fields.name', 'Name'),
      accessorKey: 'name',
      cell: ({ row }) => (
        <Link href={`/backend/purchasing/suppliers/${row.original.id}`} className="font-medium text-primary hover:underline">
          {row.original.name}
        </Link>
      ),
    },
    {
      id: 'code',
      header: t('purchasing.suppliers.fields.code', 'Code'),
      accessorKey: 'code',
    },
    {
      id: 'status',
      header: t('purchasing.suppliers.fields.status', 'Status'),
      accessorKey: 'status',
      cell: ({ row }) => {
        const status = row.original.status
        const variant = status === 'active' ? 'success' : status === 'blocked' ? 'error' : 'neutral'
        return <StatusBadge variant={variant}>{t(`purchasing.suppliers.status.${status}`, status)}</StatusBadge>
      },
    },
    {
      id: 'contactName',
      header: t('purchasing.suppliers.fields.contactName', 'Contact'),
      accessorKey: 'contact_name',
    },
    {
      id: 'city',
      header: t('purchasing.suppliers.fields.city', 'City'),
      accessorKey: 'city',
    },
    {
      id: 'country',
      header: t('purchasing.suppliers.fields.country', 'Country'),
      accessorKey: 'country',
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <RowActions
          id={`purchasing.suppliers.${row.original.id}`}
          items={[
            {
              label: t('common.edit', 'Edit'),
              onClick: () => router.push(`/backend/purchasing/suppliers/${row.original.id}`),
            },
            {
              label: t('common.delete', 'Delete'),
              variant: 'destructive' as const,
              onClick: async () => {
                const confirmed = await confirm({
                  title: t('purchasing.suppliers.deleteConfirm', 'Are you sure you want to delete this supplier?'),
                })
                if (!confirmed) return
                await deleteSupplier(row.original.id)
                flash.success(t('common.deleted', 'Deleted'))
              },
            },
          ]}
        />
      ),
    },
  ], [t, router, confirm, deleteSupplier])

  return (
    <Page>
      <PageHeader title={t('purchasing.suppliers.title', 'Suppliers')}>
        <Link href="/backend/purchasing/suppliers/create">
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" />
            {t('purchasing.suppliers.create', 'New Supplier')}
          </Button>
        </Link>
      </PageHeader>
      <PageBody>
        <DataTable
          tableId="purchasing.suppliers.list"
          columns={columns}
          queryKey={queryKey}
          queryFn={fetchSuppliers}
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
