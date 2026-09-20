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
import { Plus } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall, withScopedApiRequestHeaders } from '@open-mercato/ui/backend/utils/apiCall'
import { buildOptimisticLockHeader } from '@open-mercato/ui/backend/utils/optimisticLock'
import { surfaceRecordConflict } from '@open-mercato/ui/backend/conflicts'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import type { FilterDef, FilterValues } from '@open-mercato/ui/backend/FilterBar'
import { PM_CATEGORIES, PM_UNITS } from '../../data/validators'

type PackagingMaterialRow = {
  id: string
  name: string
  code: string
  stock: string | number | null
  unit: string
  make_brand_name: string | null
  supplier: string | null
  category: string | null
  dimensions: string | null
  is_active: boolean
  organization_id: string
  tenant_id: string
  created_at: string
  updated_at: string
}

type ResponsePayload = {
  items: PackagingMaterialRow[]
  total: number
  page: number
  totalPages: number
}

type EditableField =
  | 'name'
  | 'code'
  | 'stock'
  | 'unit'
  | 'makeBrandName'
  | 'supplier'
  | 'category'
  | 'dimensions'

const FIELD_TO_COLUMN: Record<EditableField, keyof PackagingMaterialRow> = {
  name: 'name',
  code: 'code',
  stock: 'stock',
  unit: 'unit',
  makeBrandName: 'make_brand_name',
  supplier: 'supplier',
  category: 'category',
  dimensions: 'dimensions',
}

function InlineCell({
  row,
  field,
  onCommit,
  type = 'text',
  min,
}: {
  row: PackagingMaterialRow
  field: EditableField
  onCommit: (row: PackagingMaterialRow, field: EditableField, value: string) => Promise<void>
  type?: 'text' | 'number'
  min?: number
}) {
  const t = useT()
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
    if (type === 'number' && value.trim().length) {
      const numeric = Number(value)
      if (Number.isNaN(numeric) || (min != null && numeric < min)) {
        flash(t('dermat_pm_master.flash.invalidNumber', 'Enter a valid number of at least {min}', { min: min ?? 0 }), 'error')
        setValue(original)
        return
      }
    }
    setSaving(true)
    try {
      await onCommit(row, field, value)
    } finally {
      setSaving(false)
    }
  }, [field, initial, min, onCommit, row, type, value])

  return (
    <Input
      type={type}
      min={min}
      value={value}
      disabled={saving}
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

export default function DermatPmMasterPage() {
  const t = useT()
  const { confirm: confirmDialog, ConfirmDialogElement } = useConfirmDialog()
  const [rows, setRows] = React.useState<PackagingMaterialRow[]>([])
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [filters, setFilters] = React.useState<FilterValues>({})
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)
  const scopeVersion = useOrganizationScopeVersion()
  const mutationContextId = 'dermat-pm-master-list:mutation'
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
        if (filters.unit) params.set('unit', String(filters.unit))
        if (filters.category) params.set('category', String(filters.category))

        const fallback: ResponsePayload = { items: [], total: 0, page, totalPages: 1 }
        const call = await apiCall<ResponsePayload>(
          `/api/dermat_pm_master/pm_master?${params.toString()}`,
          undefined,
          { fallback }
        )

        if (!call.ok) {
          flash(t('dermat_pm_master.list.error.load', 'Failed to load packaging materials'), 'error')
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
          flash(t('dermat_pm_master.list.error.load', 'Failed to load packaging materials'), 'error')
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
    async (row: PackagingMaterialRow, field: EditableField, value: string) => {
      try {
        const payload: Record<string, unknown> = { id: row.id, [field]: value }
        await runMutation({
          operation: async () => {
            const call = await withScopedApiRequestHeaders(
              buildOptimisticLockHeader(row.updated_at),
              () => apiCall(`/api/dermat_pm_master/pm_master`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              }),
            )
            if (!call.ok) {
              throw Object.assign(new Error('[internal] dermat_pm_master.update failed'), {
                status: call.status,
                ...((call.result as Record<string, unknown> | null) ?? {}),
              })
            }
            return call
          },
          context: {
            formId: mutationContextId,
            resourceKind: 'dermat_pm_master.packaging_material',
            resourceId: row.id,
            retryLastMutation,
          },
          mutationPayload: payload,
        })

        // Patch local state immediately (including updated_at) so a second inline edit on the
        // same row, committed before the async reload resolves, doesn't send a stale
        // optimistic-lock timestamp and 409 against its own just-applied write.
        const columnKey = FIELD_TO_COLUMN[field]
        const now = new Date().toISOString()
        setRows((current) =>
          current.map((existing) =>
            existing.id === row.id ? { ...existing, [columnKey]: value, updated_at: now } : existing,
          ),
        )
      } catch (error) {
        if (surfaceRecordConflict(error, t, { onRefresh: () => setReloadToken((tokenValue) => tokenValue + 1) })) return
        flash(t('dermat_pm_master.flash.updateError', 'Failed to update packaging material'), 'error')
        setReloadToken((tokenValue) => tokenValue + 1)
      }
    },
    [mutationContextId, retryLastMutation, runMutation, t]
  )

  const handleDelete = React.useCallback(
    async (row: PackagingMaterialRow) => {
      const confirmed = await confirmDialog({
        title: t('dermat_pm_master.list.confirmDelete', 'Delete {name}?', { name: row.name }),
        variant: 'destructive',
      })
      if (!confirmed) return

      try {
        await runMutation({
          operation: async () => {
            const call = await withScopedApiRequestHeaders(
              buildOptimisticLockHeader(row.updated_at),
              () => apiCall(`/api/dermat_pm_master/pm_master`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: row.id, organizationId: row.organization_id, tenantId: row.tenant_id }),
              }),
            )
            if (!call.ok) {
              throw Object.assign(new Error('[internal] dermat_pm_master.delete failed'), {
                status: call.status,
                ...((call.result as Record<string, unknown> | null) ?? {}),
              })
            }
            return call
          },
          context: {
            formId: mutationContextId,
            resourceKind: 'dermat_pm_master.packaging_material',
            resourceId: row.id,
            retryLastMutation,
          },
          mutationPayload: { id: row.id },
        })

        flash(t('dermat_pm_master.flash.deleted', 'Packaging material deleted'), 'success')
        setReloadToken((tokenValue) => tokenValue + 1)
      } catch (error) {
        if (surfaceRecordConflict(error, t, { onRefresh: () => setReloadToken((tokenValue) => tokenValue + 1) })) return
        flash(t('dermat_pm_master.flash.deleteError', 'Failed to delete packaging material'), 'error')
      }
    },
    [t, confirmDialog, mutationContextId, retryLastMutation, runMutation]
  )

  const columns = React.useMemo<ColumnDef<PackagingMaterialRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('dermat_pm_master.list.columns.name', 'Name'),
        cell: ({ row }) => (
          <InlineCell row={row.original} field="name" onCommit={handleInlineCommit} />
        ),
        meta: { alwaysVisible: true },
      },
      {
        accessorKey: 'code',
        header: t('dermat_pm_master.list.columns.code', 'Code'),
        cell: ({ row }) => (
          <InlineCell row={row.original} field="code" onCommit={handleInlineCommit} />
        ),
      },
      {
        accessorKey: 'stock',
        header: t('dermat_pm_master.list.columns.stock', 'Stock'),
        cell: ({ row }) => (
          <InlineCell row={row.original} field="stock" type="number" min={0} onCommit={handleInlineCommit} />
        ),
      },
      {
        accessorKey: 'unit',
        header: t('dermat_pm_master.list.columns.unit', 'Unit'),
        cell: ({ row }) => (
          <InlineCell row={row.original} field="unit" onCommit={handleInlineCommit} />
        ),
      },
      {
        accessorKey: 'make_brand_name',
        header: t('dermat_pm_master.list.columns.makeBrandName', 'Make/brand'),
        cell: ({ row }) => (
          <InlineCell row={row.original} field="makeBrandName" onCommit={handleInlineCommit} />
        ),
      },
      {
        accessorKey: 'supplier',
        header: t('dermat_pm_master.list.columns.supplier', 'Supplier'),
        cell: ({ row }) => (
          <InlineCell row={row.original} field="supplier" onCommit={handleInlineCommit} />
        ),
      },
      {
        accessorKey: 'category',
        header: t('dermat_pm_master.list.columns.category', 'Category'),
        cell: ({ row }) => (
          <InlineCell row={row.original} field="category" onCommit={handleInlineCommit} />
        ),
      },
      {
        accessorKey: 'dimensions',
        header: t('dermat_pm_master.list.columns.dimensions', 'Dimensions'),
        cell: ({ row }) => (
          <InlineCell row={row.original} field="dimensions" onCommit={handleInlineCommit} />
        ),
      },
    ],
    [t, handleInlineCommit]
  )

  const filterDefs = React.useMemo<FilterDef[]>(
    () => [
      {
        id: 'unit',
        label: t('dermat_pm_master.list.filters.unit', 'Unit'),
        type: 'select',
        options: [
          { label: t('dermat_pm_master.list.filters.all', 'All'), value: '' },
          ...PM_UNITS.map((unit) => ({ label: unit, value: unit })),
        ],
      },
      {
        id: 'category',
        label: t('dermat_pm_master.list.filters.category', 'Category'),
        type: 'select',
        options: [
          { label: t('dermat_pm_master.list.filters.all', 'All'), value: '' },
          ...PM_CATEGORIES.map((category) => ({ label: category, value: category })),
        ],
      },
    ],
    [t]
  )

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('dermat_pm_master.list.title', 'Packaging Materials')}
          columns={columns}
          columnChooser={{ auto: true }}
          perspective={{ tableId: 'dermat-pm-master-list' }}
          data={rows}
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          searchPlaceholder={t('dermat_pm_master.list.searchPlaceholder', 'Search packaging materials')}
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
          stickyActionsColumn
          actions={
            <Button asChild>
              <Link href="/backend/dermat_pm_master/create">
                <Plus className="mr-2 h-4 w-4" />
                {t('dermat_pm_master.list.actions.create', 'New packaging material')}
              </Link>
            </Button>
          }
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  id: 'delete',
                  label: t('common.delete', 'Delete'),
                  destructive: true,
                  onSelect: () => handleDelete(row),
                },
              ]}
            />
          )}
          emptyState={(
            <ListEmptyState
              entityName={t('dermat_pm_master.list.title', 'Packaging Materials')}
              createHref="/backend/dermat_pm_master/create"
              createLabel={t('dermat_pm_master.list.actions.create', 'New packaging material')}
            />
          )}
          pagination={{ page, pageSize: 50, total, totalPages, onPageChange: setPage }}
          isLoading={isLoading}
        />
      </PageBody>
      {ConfirmDialogElement}
    </Page>
  )
}
