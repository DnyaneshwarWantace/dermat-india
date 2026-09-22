'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { ListEmptyState } from '@open-mercato/ui/backend/filters/ListEmptyState'
import type { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { Button } from '@open-mercato/ui/primitives/button'
import { IconButton } from '@open-mercato/ui/primitives/icon-button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Tag } from '@open-mercato/ui/primitives/tag'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@open-mercato/ui/primitives/select'
import { Popover, PopoverContent, PopoverTrigger } from '@open-mercato/ui/primitives/popover'
import { Label } from '@open-mercato/ui/primitives/label'
import { Plus, ListFilter, Boxes, Truck, Pencil, Check } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall, withScopedApiRequestHeaders } from '@open-mercato/ui/backend/utils/apiCall'
import { buildOptimisticLockHeader } from '@open-mercato/ui/backend/utils/optimisticLock'
import { surfaceRecordConflict } from '@open-mercato/ui/backend/conflicts'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
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

type VendorOption = { id: string; name: string }
type FilterValues = { unit?: string; category?: string }

type EditableField = 'name' | 'code' | 'stock' | 'unit' | 'makeBrandName' | 'supplier' | 'category' | 'dimensions'

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

const CATEGORY_TAG_VARIANT: Record<string, 'info' | 'success' | 'warning' | 'neutral' | 'brand'> = {
  Carton: 'neutral',
  Bottle: 'info',
  Tube: 'info',
  Label: 'brand',
  Leaflet: 'brand',
  Spatula: 'neutral',
  Seal: 'warning',
  Box: 'neutral',
}

function TextCell({ value }: { value?: string | number | null }) {
  const display = value == null ? '' : String(value).trim()
  if (!display) return <span className="text-xs text-muted-foreground">—</span>
  return <span className="text-sm text-foreground">{display}</span>
}

function TagCell({ value, variant }: { value?: string | null; variant: 'info' | 'success' | 'warning' | 'neutral' | 'brand' }) {
  const display = (value ?? '').trim()
  if (!display) return <span className="text-xs text-muted-foreground">—</span>
  return <Tag variant={variant}>{display}</Tag>
}

// Quick Excel-style inline edit — only live once a row is put into edit mode via
// the row's "Quick edit" action. Select-backed fields (unit, supplier, category)
// render as real dropdowns while editing.
function InlineCell({
  row,
  field,
  onCommit,
  type = 'text',
  min,
  options,
}: {
  row: PackagingMaterialRow
  field: EditableField
  onCommit: (row: PackagingMaterialRow, field: EditableField, value: string) => Promise<void>
  type?: 'text' | 'number'
  min?: number
  options?: { value: string; label: string }[]
}) {
  const t = useT()
  const columnKey = FIELD_TO_COLUMN[field]
  const initial = row[columnKey]
  const [value, setValue] = React.useState(initial == null ? '' : String(initial))
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    setValue(initial == null ? '' : String(initial))
  }, [initial])

  const commit = React.useCallback(
    async (nextValue: string) => {
      const original = initial == null ? '' : String(initial)
      if (nextValue === original) return
      if (type === 'number' && nextValue.trim().length) {
        const numeric = Number(nextValue)
        if (Number.isNaN(numeric) || (min != null && numeric < min)) {
          flash(t('dermat_pm_master.flash.invalidNumber', 'Enter a valid number of at least {min}', { min: min ?? 0 }), 'error')
          setValue(original)
          return
        }
      }
      setSaving(true)
      try {
        await onCommit(row, field, nextValue)
      } finally {
        setSaving(false)
      }
    },
    [field, initial, min, onCommit, row, type],
  )

  if (options) {
    return (
      <Select
        value={value}
        onValueChange={(next) => {
          setValue(next)
          void commit(next)
        }}
      >
        <SelectTrigger className="h-8 bg-background" onClick={(e) => e.stopPropagation()}>
          <SelectValue placeholder={t('dermat_pm_master.list.selectPlaceholder', 'Select…')} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return (
    <Input
      type={type}
      min={min}
      value={value}
      disabled={saving}
      onClick={(e) => e.stopPropagation()}
      onChange={(event) => setValue(event.target.value)}
      onBlur={(event) => void commit(event.target.value)}
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
      className="h-8 bg-background"
    />
  )
}

function FilterDropdown({
  values,
  onApply,
  onClear,
}: {
  values: FilterValues
  onApply: (values: FilterValues) => void
  onClear: () => void
}) {
  const t = useT()
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<FilterValues>(values)

  React.useEffect(() => {
    if (open) setDraft(values)
  }, [open, values])

  const activeCount = Object.values(values).filter(Boolean).length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="default">
          <ListFilter className="mr-1.5 h-4 w-4" />
          {t('ui.filters.title', 'Filters')}
          {activeCount > 0 ? (
            <span className="ml-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5">{activeCount}</span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-4 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('dermat_pm_master.list.filters.unit', 'Unit')}</Label>
          <Select value={draft.unit ?? '__all__'} onValueChange={(v) => setDraft((d) => ({ ...d, unit: v === '__all__' ? undefined : v }))}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('dermat_pm_master.list.filters.all', 'All')}</SelectItem>
              {PM_UNITS.map((unit) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('dermat_pm_master.list.filters.category', 'Category')}</Label>
          <Select value={draft.category ?? '__all__'} onValueChange={(v) => setDraft((d) => ({ ...d, category: v === '__all__' ? undefined : v }))}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('dermat_pm_master.list.filters.all', 'All')}</SelectItem>
              {PM_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between pt-1">
          <Button type="button" variant="outline" size="sm" onClick={() => { setDraft({}); onClear(); setOpen(false) }}>
            {t('ui.filters.actions.clear', 'Clear')}
          </Button>
          <Button type="button" size="sm" onClick={() => { onApply(draft); setOpen(false) }}>
            {t('ui.filters.actions.apply', 'Apply')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default function DermatPmMasterPage() {
  const t = useT()
  const router = useRouter()
  const { confirm: confirmDialog, ConfirmDialogElement } = useConfirmDialog()
  const [rows, setRows] = React.useState<PackagingMaterialRow[]>([])
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [filters, setFilters] = React.useState<FilterValues>({})
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)
  const [editingRowId, setEditingRowId] = React.useState<string | null>(null)
  const [vendors, setVendors] = React.useState<VendorOption[]>([])
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
    apiCall<{ items?: Array<{ id: string; name: string; is_active?: boolean }> }>('/api/dermat_vendors/vendors?pageSize=100', undefined, { fallback: { items: [] } })
      .then((res) => {
        if (!res.ok) return
        const items = (res.result?.items ?? []).filter((v) => v.is_active !== false)
        setVendors(items.map((v) => ({ id: v.id, name: v.name })))
      })
  }, [])

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

  const supplierOptions = React.useMemo(() => vendors.map((v) => ({ value: v.name, label: v.name })), [vendors])
  const unitOptions = React.useMemo(() => PM_UNITS.map((u) => ({ value: u, label: u })), [])
  const categoryOptions = React.useMemo(() => PM_CATEGORIES.map((c) => ({ value: c, label: c })), [])

  const columns = React.useMemo<ColumnDef<PackagingMaterialRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('dermat_pm_master.list.columns.name', 'Name'),
        cell: ({ row }) => {
          const editing = editingRowId === row.original.id
          return (
            <div className="flex items-center gap-1.5">
              <Boxes className="h-3.5 w-3.5 text-primary shrink-0" />
              {editing ? <InlineCell row={row.original} field="name" onCommit={handleInlineCommit} /> : <TextCell value={row.original.name} />}
            </div>
          )
        },
        meta: { alwaysVisible: true },
      },
      {
        accessorKey: 'code',
        header: t('dermat_pm_master.list.columns.code', 'Code'),
        cell: ({ row }) => editingRowId === row.original.id
          ? <InlineCell row={row.original} field="code" onCommit={handleInlineCommit} />
          : <TextCell value={row.original.code} />,
      },
      {
        accessorKey: 'stock',
        header: t('dermat_pm_master.list.columns.stock', 'Stock'),
        cell: ({ row }) => editingRowId === row.original.id
          ? <InlineCell row={row.original} field="stock" type="number" min={0} onCommit={handleInlineCommit} />
          : <TextCell value={row.original.stock} />,
      },
      {
        accessorKey: 'unit',
        header: t('dermat_pm_master.list.columns.unit', 'Unit'),
        cell: ({ row }) => editingRowId === row.original.id
          ? <InlineCell row={row.original} field="unit" onCommit={handleInlineCommit} options={unitOptions} />
          : <TagCell value={row.original.unit} variant="info" />,
      },
      {
        accessorKey: 'make_brand_name',
        header: t('dermat_pm_master.list.columns.makeBrandName', 'Make/brand'),
        cell: ({ row }) => editingRowId === row.original.id
          ? <InlineCell row={row.original} field="makeBrandName" onCommit={handleInlineCommit} />
          : <TextCell value={row.original.make_brand_name} />,
      },
      {
        accessorKey: 'supplier',
        header: t('dermat_pm_master.list.columns.supplier', 'Supplier'),
        cell: ({ row }) => {
          const editing = editingRowId === row.original.id
          return (
            <div className="flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {editing
                ? <InlineCell row={row.original} field="supplier" onCommit={handleInlineCommit} options={supplierOptions} />
                : <TextCell value={row.original.supplier} />}
            </div>
          )
        },
      },
      {
        accessorKey: 'category',
        header: t('dermat_pm_master.list.columns.category', 'Category'),
        cell: ({ row }) => editingRowId === row.original.id
          ? <InlineCell row={row.original} field="category" onCommit={handleInlineCommit} options={categoryOptions} />
          : <TagCell value={row.original.category} variant={CATEGORY_TAG_VARIANT[row.original.category ?? ''] ?? 'neutral'} />,
      },
      {
        accessorKey: 'dimensions',
        header: t('dermat_pm_master.list.columns.dimensions', 'Dimensions'),
        cell: ({ row }) => editingRowId === row.original.id
          ? <InlineCell row={row.original} field="dimensions" onCommit={handleInlineCommit} />
          : <TextCell value={row.original.dimensions} />,
      },
    ],
    [t, editingRowId, handleInlineCommit, supplierOptions, unitOptions, categoryOptions]
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
          toolbar={
            <FilterDropdown
              values={filters}
              onApply={(next) => { setFilters(next); setPage(1) }}
              onClear={() => { setFilters({}); setPage(1) }}
            />
          }
          onRowClick={(row) => {
            if (editingRowId === row.id) return
            router.push(`/backend/dermat_pm_master/${row.id}`)
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
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <IconButton
                type="button"
                size="sm"
                variant={editingRowId === row.id ? 'primary' : 'outline'}
                aria-label={editingRowId === row.id
                  ? t('dermat_pm_master.list.actions.done', 'Done editing')
                  : t('dermat_pm_master.list.actions.quickEdit', 'Quick edit')}
                title={editingRowId === row.id
                  ? t('dermat_pm_master.list.actions.done', 'Done editing')
                  : t('dermat_pm_master.list.actions.quickEdit', 'Quick edit')}
                onClick={() => setEditingRowId((current) => (current === row.id ? null : row.id))}
              >
                {editingRowId === row.id ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              </IconButton>
              <RowActions
                items={[
                  {
                    id: 'open',
                    label: t('dermat_pm_master.list.actions.openFull', 'View / open full form'),
                    onSelect: () => router.push(`/backend/dermat_pm_master/${row.id}`),
                  },
                  {
                    id: 'delete',
                    label: t('common.delete', 'Delete'),
                    destructive: true,
                    onSelect: () => handleDelete(row),
                  },
                ]}
              />
            </div>
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
