'use client'

import * as React from 'react'
import Link from 'next/link'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { ListEmptyState } from '@open-mercato/ui/backend/filters/ListEmptyState'
import type { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { Plus } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall, withScopedApiRequestHeaders } from '@open-mercato/ui/backend/utils/apiCall'
import { buildOptimisticLockHeader } from '@open-mercato/ui/backend/utils/optimisticLock'
import { surfaceRecordConflict } from '@open-mercato/ui/backend/conflicts'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import type { FilterDef, FilterValues } from '@open-mercato/ui/backend/FilterBar'
import { PRODUCTION_BATCH_STATUSES } from '../../data/validators'

type ProductionBatchRow = {
  id: string
  batch_number: string
  order_id: string | null
  product_name: string
  planned_quantity: string | number
  planned_unit: string
  status: string
  created_by: string | null
  organization_id: string
  tenant_id: string
  created_at: string
  updated_at: string
}

type ResponsePayload = {
  items: ProductionBatchRow[]
  total: number
  page: number
  totalPages: number
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  planned: 'outline',
  in_progress: 'default',
  completed: 'secondary',
  cancelled: 'destructive',
}

type EditableField = 'productName' | 'plannedQuantity' | 'plannedUnit'

const FIELD_TO_COLUMN: Record<EditableField, keyof ProductionBatchRow> = {
  productName: 'product_name',
  plannedQuantity: 'planned_quantity',
  plannedUnit: 'planned_unit',
}

function InlineCell({
  row,
  field,
  onCommit,
}: {
  row: ProductionBatchRow
  field: EditableField
  onCommit: (row: ProductionBatchRow, field: EditableField, value: string) => Promise<void>
}) {
  const columnKey = FIELD_TO_COLUMN[field]
  const initial = row[columnKey]
  const [value, setValue] = React.useState(initial == null ? '' : String(initial))
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    setValue(initial == null ? '' : String(initial))
  }, [initial])

  const commit = React.useCallback(async () => {
    const original = initial == null ? '' : String(initial)
    if (value === original) return
    setSaving(true)
    try {
      await onCommit(row, field, value)
    } finally {
      setSaving(false)
    }
  }, [field, initial, onCommit, row, value])

  return (
    <Input
      value={value}
      disabled={saving}
      type={field === 'plannedQuantity' ? 'number' : 'text'}
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          ;(event.target as HTMLInputElement).blur()
        }
        if (event.key === 'Escape') {
          setValue(initial == null ? '' : String(initial))
          ;(event.target as HTMLInputElement).blur()
        }
      }}
      className="h-8 border-transparent bg-transparent px-2 hover:border-input focus:border-input"
    />
  )
}

export default function DermatProductionPage() {
  const t = useT()
  const [rows, setRows] = React.useState<ProductionBatchRow[]>([])
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [filters, setFilters] = React.useState<FilterValues>({})
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)
  const scopeVersion = useOrganizationScopeVersion()
  const mutationContextId = 'dermat-production-list:mutation'
  const { runMutation, retryLastMutation } = useGuardedMutation<{
    formId: string
    resourceKind: string
    resourceId: string
    retryLastMutation: () => Promise<boolean>
  }>({
    contextId: mutationContextId,
    blockedMessage: t('ui.forms.flash.saveBlocked', 'Save blocked by validation'),
  })

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('pageSize', '50')
        if (search) params.set('search', search)
        if (filters.status) params.set('status', String(filters.status))

        const fallback: ResponsePayload = { items: [], total: 0, page, totalPages: 1 }
        const call = await apiCall<ResponsePayload>(
          `/api/dermat_production/batches?${params.toString()}`,
          undefined,
          { fallback }
        )

        if (!call.ok) {
          flash(t('dermat_production.list.error.load', 'Failed to load production batches'), 'error')
          return
        }

        const payload = call.result ?? fallback
        if (!cancelled) {
          setRows(Array.isArray(payload.items) ? payload.items : [])
          setTotal(payload.total || 0)
          setTotalPages(payload.totalPages || 1)
        }
      } catch (error) {
        if (!cancelled) {
          flash(t('dermat_production.list.error.load', 'Failed to load production batches'), 'error')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [page, search, filters, reloadToken, scopeVersion, t])

  const handleInlineCommit = React.useCallback(
    async (row: ProductionBatchRow, field: EditableField, value: string) => {
      try {
        const payload: Record<string, unknown> = { id: row.id, [field]: value }
        await runMutation({
          operation: async () => {
            const call = await withScopedApiRequestHeaders(
              buildOptimisticLockHeader(row.updated_at),
              () => apiCall(`/api/dermat_production/batches`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              }),
            )
            if (!call.ok) {
              throw Object.assign(new Error('[internal] dermat_production.update failed'), {
                status: call.status,
                ...((call.result as Record<string, unknown> | null) ?? {}),
              })
            }
            return call
          },
          context: {
            formId: mutationContextId,
            resourceKind: 'dermat_production.batch',
            resourceId: row.id,
            retryLastMutation,
          },
          mutationPayload: payload,
        })

        setReloadToken((tokenValue) => tokenValue + 1)
      } catch (error) {
        if (surfaceRecordConflict(error, t, { onRefresh: () => setReloadToken((tokenValue) => tokenValue + 1) })) return
        flash(t('dermat_production.flash.updateError', 'Failed to update production batch'), 'error')
        setReloadToken((tokenValue) => tokenValue + 1)
      }
    },
    [mutationContextId, retryLastMutation, runMutation, t]
  )

  const columns = React.useMemo<ColumnDef<ProductionBatchRow>[]>(
    () => [
      {
        accessorKey: 'batch_number',
        header: t('dermat_production.list.columns.batchNumber', 'Batch number'),
        cell: ({ row }) => (
          <Link href={`/backend/dermat_production/${row.original.id}`} className="font-medium hover:underline">
            {row.original.batch_number}
          </Link>
        ),
      },
      {
        accessorKey: 'product_name',
        header: t('dermat_production.list.columns.productName', 'Product'),
        cell: ({ row }) => (
          <InlineCell row={row.original} field="productName" onCommit={handleInlineCommit} />
        ),
      },
      {
        accessorKey: 'planned_quantity',
        header: t('dermat_production.list.columns.plannedQuantity', 'Planned qty'),
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <InlineCell row={row.original} field="plannedQuantity" onCommit={handleInlineCommit} />
            <InlineCell row={row.original} field="plannedUnit" onCommit={handleInlineCommit} />
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: t('dermat_production.list.columns.status', 'Status'),
        cell: ({ getValue }) => {
          const value = String(getValue() ?? '')
          return <Badge variant={STATUS_VARIANT[value] ?? 'outline'}>{value.replace(/_/g, ' ')}</Badge>
        },
      },
      {
        accessorKey: 'created_at',
        header: t('dermat_production.list.columns.createdAt', 'Created'),
        cell: ({ getValue }) => {
          const value = getValue()
          return value ? new Date(String(value)).toLocaleDateString() : '—'
        },
      },
    ],
    [t, handleInlineCommit]
  )

  const filterDefs = React.useMemo<FilterDef[]>(
    () => [
      {
        id: 'status',
        label: t('dermat_production.list.filters.status', 'Status'),
        type: 'select',
        options: [
          { label: t('dermat_production.list.filters.all', 'All'), value: '' },
          ...PRODUCTION_BATCH_STATUSES.map((status) => ({ label: status.replace(/_/g, ' '), value: status })),
        ],
      },
    ],
    [t]
  )

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('dermat_production.list.title', 'Production Batches')}
          columns={columns}
          disableRowClick
          data={rows}
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          searchPlaceholder={t('dermat_production.list.searchPlaceholder', 'Search batches')}
          filters={filterDefs}
          filterValues={filters}
          onFiltersApply={(values) => {
            setFilters(values)
            setPage(1)
          }}
          onFiltersClear={() => {
            setFilters({})
            setPage(1)
          }}
          actions={
            <Button asChild>
              <Link href="/backend/dermat_production/create">
                <Plus className="mr-2 h-4 w-4" />
                {t('dermat_production.list.actions.create', 'New batch')}
              </Link>
            </Button>
          }
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  id: 'view',
                  label: t('common.view', 'View'),
                  href: `/backend/dermat_production/${row.id}`,
                },
              ]}
            />
          )}
          emptyState={(
            <ListEmptyState
              entityName={t('dermat_production.list.title', 'Production Batches')}
              createHref="/backend/dermat_production/create"
              createLabel={t('dermat_production.list.actions.create', 'New batch')}
            />
          )}
          pagination={{ page, pageSize: 50, total, totalPages, onPageChange: setPage }}
          isLoading={isLoading}
        />
      </PageBody>
    </Page>
  )
}
