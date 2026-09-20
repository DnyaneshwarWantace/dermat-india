'use client'

import * as React from 'react'
import { ComboboxInput, type ComboboxOption } from '@open-mercato/ui/backend/inputs/ComboboxInput'
import { apiCall, withScopedApiRequestHeaders } from '@open-mercato/ui/backend/utils/apiCall'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { buildOptimisticLockHeader } from '@open-mercato/ui/backend/utils/optimisticLock'
import { surfaceRecordConflict } from '@open-mercato/ui/backend/conflicts'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Pencil } from 'lucide-react'
import { cn } from '@open-mercato/shared/lib/utils'

/**
 * Excel-style inline-editable cells for the order register table (client request: "click a
 * cell, a dropdown opens, pick a different value — don't navigate elsewhere or retype a full
 * record"). Both cells below follow the same shape: static text by default, click to reveal a
 * ComboboxInput, commit on selection via the same optimistic-locked `updateCrud` pattern the
 * rest of this page already uses for its onBlur-autosave fields.
 */

function InlineCellShell({
  displayValue,
  editing,
  onStartEdit,
  saving,
  interactive = true,
  children,
}: {
  displayValue: React.ReactNode
  editing: boolean
  onStartEdit: () => void
  saving: boolean
  interactive?: boolean
  children: React.ReactNode
}) {
  // Read-only rendering: bulk-edit mode owns these cells' interactivity (client ask: these
  // cells should only become clickable while the table-wide "Edit Table" toggle is on — outside
  // of it they render as plain text, same as every other read-only column).
  if (!interactive) {
    return <span className="truncate">{displayValue}</span>
  }
  if (!editing) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onStartEdit()
        }}
        className="group flex w-full items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-muted/60"
        disabled={saving}
      >
        <span className="truncate">{displayValue}</span>
        <Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
      </button>
    )
  }
  return (
    <div className="min-w-[160px]" onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  )
}

export function InlineCustomerCell({
  orderId,
  updatedAt,
  currentCustomerId,
  currentCustomerName,
  onSaved,
  interactive = true,
}: {
  orderId: string
  updatedAt: string
  currentCustomerId: string | null
  currentCustomerName: string
  onSaved: () => void
  interactive?: boolean
}) {
  const t = useT()
  const [editing, setEditing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [value, setValue] = React.useState(currentCustomerId ?? '')
  const [seedOptions, setSeedOptions] = React.useState<ComboboxOption[]>(
    currentCustomerId ? [{ value: currentCustomerId, label: currentCustomerName }] : [],
  )

  const loadSuggestions = React.useCallback(async (query?: string) => {
    const params = new URLSearchParams()
    params.set('pageSize', '50')
    if (query) params.set('search', query)
    const call = await apiCall<{ items?: Array<{ id: string; display_name?: string }> }>(
      `/api/customers/companies?${params.toString()}`,
      undefined,
      { fallback: { items: [] } },
    )
    const items = Array.isArray(call.result?.items) ? call.result!.items! : []
    return items.map((item) => ({ value: item.id, label: item.display_name || t('dermat_sales_flow.orderBook.unnamedCustomer', 'Unnamed company') }))
  }, [t])

  const commit = React.useCallback(
    async (nextCustomerId: string) => {
      if (!nextCustomerId || nextCustomerId === currentCustomerId) {
        setEditing(false)
        return
      }
      setSaving(true)
      try {
        await withScopedApiRequestHeaders(buildOptimisticLockHeader(updatedAt), () =>
          updateCrud('sales/orders', { id: orderId, customerEntityId: nextCustomerId }),
        )
        flash(t('dermat_sales_flow.orderBook.customerUpdated', 'Customer updated'), 'success')
        onSaved()
      } catch (err) {
        if (surfaceRecordConflict(err, t, { onRefresh: onSaved })) {
          setEditing(false)
          setSaving(false)
          return
        }
        flash(t('dermat_sales_flow.orderBook.customerUpdateFailed', 'Failed to update customer'), 'error')
      } finally {
        setSaving(false)
        setEditing(false)
      }
    },
    [orderId, updatedAt, currentCustomerId, onSaved, t],
  )

  return (
    <InlineCellShell
      displayValue={currentCustomerName}
      editing={editing}
      saving={saving}
      interactive={interactive}
      onStartEdit={() => {
        setValue(currentCustomerId ?? '')
        setSeedOptions(currentCustomerId ? [{ value: currentCustomerId, label: currentCustomerName }] : [])
        setEditing(true)
      }}
    >
      <ComboboxInput
        value={value}
        onChange={(next) => {
          setValue(next)
          void commit(next)
        }}
        seedOptions={seedOptions}
        loadSuggestions={loadSuggestions}
        allowCustomValues={false}
        clearable={false}
        autoFocus
        placeholder={t('dermat_sales_flow.orderBook.selectCustomer', 'Select customer...')}
      />
    </InlineCellShell>
  )
}

const UOM_CHOICES: ComboboxOption[] = [
  { value: 'ml', label: 'ml (Milliliter)' },
  { value: 'gm', label: 'gm (Gram)' },
  { value: 'kg', label: 'kg (Kilogram)' },
  { value: 'l', label: 'L (Liter)' },
  { value: 'pcs', label: 'pcs (Pieces)' },
]

export function InlineUomCell({
  lineId,
  orderId,
  lineUpdatedAt,
  currentUom,
  productId,
  onSaved,
  interactive = true,
}: {
  lineId: string
  orderId: string
  lineUpdatedAt: string | null | undefined
  currentUom: string
  productId: string | null
  onSaved: () => void
  interactive?: boolean
}) {
  const t = useT()
  const [editing, setEditing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [value, setValue] = React.useState(currentUom)

  const commit = React.useCallback(
    async (nextUom: string) => {
      const normalized = nextUom.trim().toLowerCase()
      if (!normalized || normalized === currentUom) {
        setEditing(false)
        return
      }
      setSaving(true)
      try {
        // 1. Update the order line's own UOM (spec §4.3 Pack Size/UOM).
        const updateLine = () => updateCrud('sales/order-lines', {
          id: lineId,
          orderId,
          quantityUnit: normalized,
          customFields: { uom: normalized },
        })
        if (lineUpdatedAt) {
          await withScopedApiRequestHeaders(buildOptimisticLockHeader(lineUpdatedAt), updateLine)
        } else {
          await updateLine()
        }
        // 2. Cascade to the product's default sales unit so the change persists beyond this
        // one order line (client request: unit change must also update the product record,
        // not just be a one-off override on this order line — spec §4.3 Pack Size/UOM is
        // product-linked). Best-effort: an order line without a linked product just updates
        // the line itself.
        if (productId) {
          try {
            await updateCrud('catalog/products', { id: productId, defaultSalesUnit: normalized })
          } catch {
            flash(
              t('dermat_sales_flow.orderBook.unitCascadeFailed', 'Line unit updated, but syncing the product default unit failed'),
              'error',
            )
          }
        }
        flash(t('dermat_sales_flow.orderBook.unitUpdated', 'Unit updated'), 'success')
        onSaved()
      } catch (err) {
        if (surfaceRecordConflict(err, t, { onRefresh: onSaved })) {
          setEditing(false)
          setSaving(false)
          return
        }
        flash(t('dermat_sales_flow.orderBook.unitUpdateFailed', 'Failed to update unit'), 'error')
      } finally {
        setSaving(false)
        setEditing(false)
      }
    },
    [lineId, orderId, lineUpdatedAt, currentUom, productId, onSaved, t],
  )

  return (
    <InlineCellShell
      displayValue={currentUom || '—'}
      editing={editing}
      saving={saving}
      interactive={interactive}
      onStartEdit={() => {
        setValue(currentUom)
        setEditing(true)
      }}
    >
      <ComboboxInput
        value={value}
        onChange={(next) => {
          setValue(next)
          void commit(next)
        }}
        suggestions={UOM_CHOICES}
        allowCustomValues={false}
        clearable={false}
        autoFocus
        placeholder={t('dermat_sales_flow.orderBook.selectUnit', 'Select unit...')}
      />
    </InlineCellShell>
  )
}
