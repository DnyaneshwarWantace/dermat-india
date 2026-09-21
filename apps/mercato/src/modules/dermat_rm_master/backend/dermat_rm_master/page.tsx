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
import { Plus, ListFilter, FlaskConical, Truck, Beaker, Pencil, Check } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall, withScopedApiRequestHeaders } from '@open-mercato/ui/backend/utils/apiCall'
import { buildOptimisticLockHeader } from '@open-mercato/ui/backend/utils/optimisticLock'
import { surfaceRecordConflict } from '@open-mercato/ui/backend/conflicts'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
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

type VendorOption = { id: string; name: string }
type FilterValues = { unit?: string; benefit?: string; physicalState?: string }

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

const PHYSICAL_STATE_TAG_VARIANT: Record<string, 'info' | 'success' | 'warning' | 'neutral' | 'brand'> = {
  Liquid: 'info',
  Powder: 'neutral',
  Gel: 'brand',
  White: 'neutral',
  Colourless: 'neutral',
  Transparent: 'info',
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
// the row's "Edit" action (client ask: not directly editable by just clicking,
// only after activating edit for that row). Select-backed fields (unit, supplier,
// benefit, physical state) render as real dropdowns while editing.
function InlineCell({
  row,
  field,
  onCommit,
  type = 'text',
  min,
  options,
}: {
  row: RawMaterialRow
  field: EditableField
  onCommit: (row: RawMaterialRow, field: EditableField, value: string) => Promise<void>
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
          flash(t('dermat_rm_master.flash.invalidNumber', 'Enter a valid number of at least {min}', { min: min ?? 0 }), 'error')
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
          <SelectValue placeholder={t('dermat_rm_master.list.selectPlaceholder', 'Select…')} />
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
          <Label className="text-xs">{t('dermat_rm_master.list.filters.unit', 'Unit')}</Label>
          <Select value={draft.unit ?? '__all__'} onValueChange={(v) => setDraft((d) => ({ ...d, unit: v === '__all__' ? undefined : v }))}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('dermat_rm_master.list.filters.all', 'All')}</SelectItem>
              {RM_UNITS.map((unit) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('dermat_rm_master.list.filters.benefit', 'Benefit')}</Label>
          <Select value={draft.benefit ?? '__all__'} onValueChange={(v) => setDraft((d) => ({ ...d, benefit: v === '__all__' ? undefined : v }))}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('dermat_rm_master.list.filters.all', 'All')}</SelectItem>
              {RM_BENEFIT_TAGS.map((benefit) => <SelectItem key={benefit} value={benefit}>{benefit}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('dermat_rm_master.list.filters.physicalState', 'Physical state')}</Label>
          <Select value={draft.physicalState ?? '__all__'} onValueChange={(v) => setDraft((d) => ({ ...d, physicalState: v === '__all__' ? undefined : v }))}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('dermat_rm_master.list.filters.all', 'All')}</SelectItem>
              {RM_PHYSICAL_STATES.map((state) => <SelectItem key={state} value={state}>{state}</SelectItem>)}
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

export default function DermatRmMasterPage() {
  const t = useT()
  const router = useRouter()
  const { confirm: confirmDialog, ConfirmDialogElement } = useConfirmDialog()
  const [rows, setRows] = React.useState<RawMaterialRow[]>([])
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

  const supplierOptions = React.useMemo(() => vendors.map((v) => ({ value: v.name, label: v.name })), [vendors])
  const unitOptions = React.useMemo(() => RM_UNITS.map((u) => ({ value: u, label: u })), [])
  const benefitOptions = React.useMemo(() => RM_BENEFIT_TAGS.map((b) => ({ value: b, label: b })), [])
  const physicalStateOptions = React.useMemo(() => RM_PHYSICAL_STATES.map((s) => ({ value: s, label: s })), [])

  const columns = React.useMemo<ColumnDef<RawMaterialRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('dermat_rm_master.list.columns.name', 'Name'),
        cell: ({ row }) => {
          const editing = editingRowId === row.original.id
          return (
            <div className="flex items-center gap-1.5">
              <FlaskConical className="h-3.5 w-3.5 text-primary shrink-0" />
              {editing ? <InlineCell row={row.original} field="name" onCommit={handleInlineCommit} /> : <TextCell value={row.original.name} />}
            </div>
          )
        },
        meta: { alwaysVisible: true },
      },
      {
        accessorKey: 'inci_name',
        header: t('dermat_rm_master.list.columns.inciName', 'INCI name'),
        cell: ({ row }) => editingRowId === row.original.id
          ? <InlineCell row={row.original} field="inciName" onCommit={handleInlineCommit} />
          : <TextCell value={row.original.inci_name} />,
      },
      {
        accessorKey: 'code',
        header: t('dermat_rm_master.list.columns.code', 'Code'),
        cell: ({ row }) => editingRowId === row.original.id
          ? <InlineCell row={row.original} field="code" onCommit={handleInlineCommit} />
          : <TextCell value={row.original.code} />,
      },
      {
        accessorKey: 'stock',
        header: t('dermat_rm_master.list.columns.stock', 'Stock'),
        cell: ({ row }) => editingRowId === row.original.id
          ? <InlineCell row={row.original} field="stock" type="number" min={0} onCommit={handleInlineCommit} />
          : <TextCell value={row.original.stock} />,
      },
      {
        accessorKey: 'unit',
        header: t('dermat_rm_master.list.columns.unit', 'Unit'),
        cell: ({ row }) => editingRowId === row.original.id
          ? <InlineCell row={row.original} field="unit" onCommit={handleInlineCommit} options={unitOptions} />
          : <TagCell value={row.original.unit} variant="info" />,
      },
      {
        accessorKey: 'make_brand_name',
        header: t('dermat_rm_master.list.columns.makeBrandName', 'Make/brand'),
        cell: ({ row }) => editingRowId === row.original.id
          ? <InlineCell row={row.original} field="makeBrandName" onCommit={handleInlineCommit} />
          : <TextCell value={row.original.make_brand_name} />,
      },
      {
        accessorKey: 'supplier',
        header: t('dermat_rm_master.list.columns.supplier', 'Supplier'),
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
        accessorKey: 'benefit',
        header: t('dermat_rm_master.list.columns.benefit', 'Benefit'),
        cell: ({ row }) => editingRowId === row.original.id
          ? <InlineCell row={row.original} field="benefit" onCommit={handleInlineCommit} options={benefitOptions} />
          : <TagCell value={row.original.benefit} variant="brand" />,
      },
      {
        accessorKey: 'alternate_rm',
        header: t('dermat_rm_master.list.columns.alternateRm', 'Alternate RM'),
        cell: ({ row }) => editingRowId === row.original.id
          ? <InlineCell row={row.original} field="alternateRm" onCommit={handleInlineCommit} />
          : <TextCell value={row.original.alternate_rm} />,
      },
      {
        accessorKey: 'physical_state',
        header: t('dermat_rm_master.list.columns.physicalState', 'Physical state'),
        cell: ({ row }) => {
          const editing = editingRowId === row.original.id
          return (
            <div className="flex items-center gap-1.5">
              <Beaker className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {editing
                ? <InlineCell row={row.original} field="physicalState" onCommit={handleInlineCommit} options={physicalStateOptions} />
                : <TagCell value={row.original.physical_state} variant={PHYSICAL_STATE_TAG_VARIANT[row.original.physical_state ?? ''] ?? 'neutral'} />}
            </div>
          )
        },
      },
    ],
    [t, editingRowId, handleInlineCommit, supplierOptions, unitOptions, benefitOptions, physicalStateOptions]
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
          toolbar={
            <FilterDropdown
              values={filters}
              onApply={(next) => { setFilters(next); setPage(1) }}
              onClear={() => { setFilters({}); setPage(1) }}
            />
          }
          onRowClick={(row) => {
            if (editingRowId === row.id) return
            router.push(`/backend/dermat_rm_master/${row.id}`)
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
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <IconButton
                type="button"
                size="sm"
                variant={editingRowId === row.id ? 'primary' : 'outline'}
                aria-label={editingRowId === row.id
                  ? t('dermat_rm_master.list.actions.done', 'Done editing')
                  : t('dermat_rm_master.list.actions.quickEdit', 'Quick edit')}
                title={editingRowId === row.id
                  ? t('dermat_rm_master.list.actions.done', 'Done editing')
                  : t('dermat_rm_master.list.actions.quickEdit', 'Quick edit')}
                onClick={() => setEditingRowId((current) => (current === row.id ? null : row.id))}
              >
                {editingRowId === row.id ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              </IconButton>
              <RowActions
                items={[
                  {
                    id: 'open',
                    label: t('dermat_rm_master.list.actions.openFull', 'View / open full form'),
                    onSelect: () => router.push(`/backend/dermat_rm_master/${row.id}`),
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
