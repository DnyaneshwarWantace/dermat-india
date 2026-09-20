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
import { RM_BENEFIT_TAGS, RM_PHYSICAL_STATES, RM_UNITS } from '../../data/validators'

type RawMaterialRow = {
  id: string
  name: string
  inci_name: string | null
  code: string
  stock: string | number | null
  unit: string
  make_brand_name: string | null
  supplier: string | null
  benefit: string | null
  alternate_rm: string | null
  physical_state: string | null
  is_active: boolean
  organization_id: string
  tenant_id: string
  created_at: string
  updated_at: string
}

type ResponsePayload = {
  items: RawMaterialRow[]
  total: number
  page: number
  totalPages: number
}

type EditableField =
  | 'name'
  | 'inciName'
  | 'code'
  | 'stock'
  | 'unit'
  | 'makeBrandName'
  | 'supplier'
  | 'benefit'
  | 'alternateRm'
  | 'physicalState'

const FIELD_TO_COLUMN: Record<EditableField, keyof RawMaterialRow> = {
  name: 'name',
  inciName: 'inci_name',
  code: 'code',
  stock: 'stock',
  unit: 'unit',
  makeBrandName: 'make_brand_name',
  supplier: 'supplier',
  benefit: 'benefit',
  alternateRm: 'alternate_rm',
  physicalState: 'physical_state',
}

function InlineCell({
  row,
  field,
  onCommit,
  type = 'text',
  min,
}: {
  row: RawMaterialRow
  field: EditableField
  onCommit: (row: RawMaterialRow, field: EditableField, value: string) => Promise<void>
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
        flash(t('dermat_rm_master.flash.invalidNumber', 'Enter a valid number of at least {min}', { min: min ?? 0 }), 'error')
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

export default function DermatRmMasterPage() {
  const t = useT()
  const { confirm: confirmDialog, ConfirmDialogElement } = useConfirmDialog()
  const [rows, setRows] = React.useState<RawMaterialRow[]>([])
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [filters, setFilters] = React.useState<FilterValues>({})
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)
  const scopeVersion = useOrganizationScopeVersion()
  const mutationContextId = 'dermat-rm-master-list:mutation'
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
        if (filters.benefit) params.set('benefit', String(filters.benefit))
        if (filters.physicalState) params.set('physicalState', String(filters.physicalState))

        const fallback: ResponsePayload = { items: [], total: 0, page, totalPages: 1 }
        const call = await apiCall<ResponsePayload>(
          `/api/dermat_rm_master/rm_master?${params.toString()}`,
          undefined,
          { fallback }
        )

        if (!call.ok) {
          flash(t('dermat_rm_master.list.error.load', 'Failed to load raw materials'), 'error')
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
          flash(t('dermat_rm_master.list.error.load', 'Failed to load raw materials'), 'error')
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
    async (row: RawMaterialRow, field: EditableField, value: string) => {
      try {
        const payload: Record<string, unknown> = { id: row.id, [field]: value }
        await runMutation({
          operation: async () => {
            const call = await withScopedApiRequestHeaders(
              buildOptimisticLockHeader(row.updated_at),
              () => apiCall(`/api/dermat_rm_master/rm_master`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              }),
            )
            if (!call.ok) {
              throw Object.assign(new Error('[internal] dermat_rm_master.update failed'), {
                status: call.status,
                ...((call.result as Record<string, unknown> | null) ?? {}),
              })
            }
            return call
          },
          context: {
            formId: mutationContextId,
            resourceKind: 'dermat_rm_master.raw_material',
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
        flash(t('dermat_rm_master.flash.updateError', 'Failed to update raw material'), 'error')
        setReloadToken((tokenValue) => tokenValue + 1)
      }
    },
    [mutationContextId, retryLastMutation, runMutation, t]
  )

  const handleDelete = React.useCallback(
    async (row: RawMaterialRow) => {
      const confirmed = await confirmDialog({
        title: t('dermat_rm_master.list.confirmDelete', 'Delete {name}?', { name: row.name }),
        variant: 'destructive',
      })
      if (!confirmed) return

      try {
        await runMutation({
          operation: async () => {
            const call = await withScopedApiRequestHeaders(
              buildOptimisticLockHeader(row.updated_at),
              () => apiCall(`/api/dermat_rm_master/rm_master`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: row.id, organizationId: row.organization_id, tenantId: row.tenant_id }),
              }),
            )
            if (!call.ok) {
              throw Object.assign(new Error('[internal] dermat_rm_master.delete failed'), {
                status: call.status,
                ...((call.result as Record<string, unknown> | null) ?? {}),
              })
            }
            return call
          },
          context: {
            formId: mutationContextId,
            resourceKind: 'dermat_rm_master.raw_material',
            resourceId: row.id,
            retryLastMutation,
          },
          mutationPayload: { id: row.id },
        })

        flash(t('dermat_rm_master.flash.deleted', 'Raw material deleted'), 'success')
        setReloadToken((tokenValue) => tokenValue + 1)
      } catch (error) {
        if (surfaceRecordConflict(error, t, { onRefresh: () => setReloadToken((tokenValue) => tokenValue + 1) })) return
        flash(t('dermat_rm_master.flash.deleteError', 'Failed to delete raw material'), 'error')
      }
    },
    [t, confirmDialog, mutationContextId, retryLastMutation, runMutation]
  )

  const columns = React.useMemo<ColumnDef<RawMaterialRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('dermat_rm_master.list.columns.name', 'Name'),
        cell: ({ row }) => (
          <InlineCell row={row.original} field="name" onCommit={handleInlineCommit} />
        ),
        meta: { alwaysVisible: true },
      },
      {
        accessorKey: 'inci_name',
        header: t('dermat_rm_master.list.columns.inciName', 'INCI name'),
        cell: ({ row }) => (
          <InlineCell row={row.original} field="inciName" onCommit={handleInlineCommit} />
        ),
      },
      {
        accessorKey: 'code',
        header: t('dermat_rm_master.list.columns.code', 'Code'),
        cell: ({ row }) => (
          <InlineCell row={row.original} field="code" onCommit={handleInlineCommit} />
        ),
      },
      {
        accessorKey: 'stock',
        header: t('dermat_rm_master.list.columns.stock', 'Stock'),
        cell: ({ row }) => (
          <InlineCell row={row.original} field="stock" type="number" min={0} onCommit={handleInlineCommit} />
        ),
      },
      {
        accessorKey: 'unit',
        header: t('dermat_rm_master.list.columns.unit', 'Unit'),
        cell: ({ row }) => (
          <InlineCell row={row.original} field="unit" onCommit={handleInlineCommit} />
        ),
      },
      {
        accessorKey: 'make_brand_name',
        header: t('dermat_rm_master.list.columns.makeBrandName', 'Make/brand'),
        cell: ({ row }) => (
          <InlineCell row={row.original} field="makeBrandName" onCommit={handleInlineCommit} />
        ),
      },
      {
        accessorKey: 'supplier',
        header: t('dermat_rm_master.list.columns.supplier', 'Supplier'),
        cell: ({ row }) => (
          <InlineCell row={row.original} field="supplier" onCommit={handleInlineCommit} />
        ),
      },
      {
        accessorKey: 'benefit',
        header: t('dermat_rm_master.list.columns.benefit', 'Benefit'),
        cell: ({ row }) => (
          <InlineCell row={row.original} field="benefit" onCommit={handleInlineCommit} />
        ),
      },
      {
        accessorKey: 'alternate_rm',
        header: t('dermat_rm_master.list.columns.alternateRm', 'Alternate RM'),
        cell: ({ row }) => (
          <InlineCell row={row.original} field="alternateRm" onCommit={handleInlineCommit} />
        ),
      },
      {
        accessorKey: 'physical_state',
        header: t('dermat_rm_master.list.columns.physicalState', 'Physical state'),
        cell: ({ row }) => (
          <InlineCell row={row.original} field="physicalState" onCommit={handleInlineCommit} />
        ),
      },
    ],
    [t, handleInlineCommit]
  )

  const filterDefs = React.useMemo<FilterDef[]>(
    () => [
      {
        id: 'unit',
        label: t('dermat_rm_master.list.filters.unit', 'Unit'),
        type: 'select',
        options: [
          { label: t('dermat_rm_master.list.filters.all', 'All'), value: '' },
          ...RM_UNITS.map((unit) => ({ label: unit, value: unit })),
        ],
      },
      {
        id: 'benefit',
        label: t('dermat_rm_master.list.filters.benefit', 'Benefit'),
        type: 'select',
        options: [
          { label: t('dermat_rm_master.list.filters.all', 'All'), value: '' },
          ...RM_BENEFIT_TAGS.map((benefit) => ({ label: benefit, value: benefit })),
        ],
      },
      {
        id: 'physicalState',
        label: t('dermat_rm_master.list.filters.physicalState', 'Physical state'),
        type: 'select',
        options: [
          { label: t('dermat_rm_master.list.filters.all', 'All'), value: '' },
          ...RM_PHYSICAL_STATES.map((state) => ({ label: state, value: state })),
        ],
      },
    ],
    [t]
  )

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('dermat_rm_master.list.title', 'Raw Materials')}
          columns={columns}
          columnChooser={{ auto: true }}
          perspective={{ tableId: 'dermat-rm-master-list' }}
          data={rows}
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          searchPlaceholder={t('dermat_rm_master.list.searchPlaceholder', 'Search raw materials')}
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
              <Link href="/backend/dermat_rm_master/create">
                <Plus className="mr-2 h-4 w-4" />
                {t('dermat_rm_master.list.actions.create', 'New raw material')}
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
              entityName={t('dermat_rm_master.list.title', 'Raw Materials')}
              createHref="/backend/dermat_rm_master/create"
              createLabel={t('dermat_rm_master.list.actions.create', 'New raw material')}
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
