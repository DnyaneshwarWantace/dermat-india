"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Page, PageBody } from '@wantace/ui/backend/Page'
import { CrudForm, type CrudBuiltinField, type CrudFormGroup } from '@wantace/ui/backend/CrudForm'
import type { CrudFieldOption } from '@wantace/ui/backend/CrudForm'
import { createCrud } from '@wantace/ui/backend/utils/crud'
import { apiCall } from '@wantace/ui/backend/utils/apiCall'
import { useT } from '@wantace/shared/lib/i18n/context'
import { flash } from '@wantace/ui/backend/FlashMessages'
import { Button } from '@wantace/ui/primitives/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@wantace/ui/primitives/dialog'
import { Input } from '@wantace/ui/primitives/input'
import { Label } from '@wantace/ui/primitives/label'
import { ComboboxInput } from '@wantace/ui/backend/inputs/ComboboxInput'

type SupplierItem = { id: string; name: string; code: string; status: string }
type WarehouseItem = { id: string; name: string; code: string }
type CatalogProduct = { id: string; title?: string | null; sku?: string | null; default_variant_id?: string | null }

type POLineValues = {
  productVariantId?: string | null
  productName: string
  productSku?: string | null
  quantity: string
  unitPriceCents: number
  unitOfMeasure?: string | null
  taxRate?: string | null
  description?: string | null
  notes?: string | null
}

export default function CreatePurchaseOrderPage() {
  const t = useT()
  const router = useRouter()

  const supplierCacheRef = React.useRef<Map<string, SupplierItem>>(new Map())
  const productCacheRef = React.useRef<Map<string, CatalogProduct>>(new Map())

  const [lines, setLines] = React.useState<POLineValues[]>([])
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null)
  const [dialogLine, setDialogLine] = React.useState<POLineValues>({
    productVariantId: null, productName: '', productSku: null, quantity: '1',
    unitPriceCents: 0, unitOfMeasure: null, taxRate: null, description: null, notes: null,
  })
  const [dialogProductId, setDialogProductId] = React.useState('')

  const loadSupplierOptions = React.useCallback(async (query?: string): Promise<CrudFieldOption[]> => {
    const params = new URLSearchParams({ page: '1', pageSize: '20', status: 'active' })
    if (query?.trim()) params.set('search', query.trim())
    const res = await apiCall<{ items?: SupplierItem[] }>(`/api/purchasing/suppliers?${params}`, undefined, { fallback: { items: [] } })
    const items = res.result?.items ?? []
    for (const item of items) supplierCacheRef.current.set(item.id, item)
    return items.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))
  }, [])

  const loadWarehouseOptions = React.useCallback(async (query?: string): Promise<CrudFieldOption[]> => {
    const params = new URLSearchParams({ page: '1', pageSize: '20' })
    if (query?.trim()) params.set('search', query.trim())
    const res = await apiCall<{ items?: WarehouseItem[] }>(`/api/wms/warehouses?${params}`, undefined, { fallback: { items: [] } })
    const items = res.result?.items ?? []
    return items.map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` }))
  }, [])

  const loadProductOptions = React.useCallback(async (query?: string): Promise<CrudFieldOption[]> => {
    const params = new URLSearchParams({ page: '1', pageSize: '20' })
    if (query?.trim()) params.set('search', query.trim())
    const res = await apiCall<{ items?: CatalogProduct[] }>(`/api/catalog/products?${params}`, undefined, { fallback: { items: [] } })
    const items = res.result?.items ?? []
    for (const item of items) productCacheRef.current.set(item.id, item)
    return items.map((p) => ({ value: p.id, label: `${p.sku ? `${p.sku} — ` : ''}${p.title ?? 'Untitled'}` }))
  }, [])

  const fields = React.useMemo<CrudBuiltinField[]>(() => [
    {
      id: 'supplierId', label: t('purchasing.purchaseOrders.fields.supplier', 'Supplier'),
      type: 'combobox', required: true, group: 'header', layout: 'half',
      loadOptions: loadSupplierOptions, allowCustomValues: false,
      placeholder: t('purchasing.purchaseOrders.fields.supplierPlaceholder', 'Search suppliers...'),
    },
    {
      id: 'orderDate', label: t('purchasing.purchaseOrders.fields.orderDate', 'Order Date'),
      type: 'date', required: true, group: 'header', layout: 'half',
    },
    {
      id: 'expectedDeliveryDate', label: t('purchasing.purchaseOrders.fields.expectedDeliveryDate', 'Expected Delivery'),
      type: 'date', group: 'header', layout: 'half',
    },
    {
      id: 'warehouseId', label: t('purchasing.purchaseOrders.fields.warehouse', 'Warehouse'),
      type: 'combobox', group: 'header', layout: 'half',
      loadOptions: loadWarehouseOptions, allowCustomValues: false,
      placeholder: t('purchasing.purchaseOrders.fields.warehousePlaceholder', 'Select warehouse...'),
    },
    {
      id: 'currencyCode', label: t('purchasing.purchaseOrders.fields.currency', 'Currency'),
      type: 'text', group: 'terms', layout: 'third',
    },
    {
      id: 'paymentTerms', label: t('purchasing.purchaseOrders.fields.paymentTerms', 'Payment Terms'),
      type: 'text', group: 'terms', layout: 'third',
    },
    {
      id: 'shippingMethod', label: t('purchasing.purchaseOrders.fields.shippingMethod', 'Shipping Method'),
      type: 'text', group: 'terms', layout: 'third',
    },
    {
      id: 'notes', label: t('purchasing.purchaseOrders.fields.notes', 'Notes'),
      type: 'textarea', group: 'notes',
    },
  ], [t, loadSupplierOptions, loadWarehouseOptions])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'header', label: t('purchasing.purchaseOrders.groups.header', 'Order Details') },
    { id: 'terms', label: t('purchasing.purchaseOrders.groups.terms', 'Terms & Shipping') },
    { id: 'notes', label: t('purchasing.purchaseOrders.groups.notes', 'Notes') },
  ], [t])

  const openAddDialog = () => {
    setEditingIndex(null)
    setDialogProductId('')
    setDialogLine({
      productVariantId: null, productName: '', productSku: null, quantity: '1',
      unitPriceCents: 0, unitOfMeasure: null, taxRate: null, description: null, notes: null,
    })
    setDialogOpen(true)
  }

  const openEditDialog = (index: number) => {
    const line = lines[index]
    setEditingIndex(index)
    setDialogProductId(line.productVariantId ?? '')
    setDialogLine({ ...line })
    setDialogOpen(true)
  }

  const handleDialogSave = () => {
    if (!dialogLine.productName.trim()) return
    if (editingIndex !== null) {
      setLines((prev) => prev.map((l, i) => (i === editingIndex ? { ...dialogLine } : l)))
    } else {
      setLines((prev) => [...prev, { ...dialogLine }])
    }
    setDialogOpen(false)
  }

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  const formatCents = (cents: number) => (cents / 100).toFixed(2)

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('purchasing.purchaseOrders.create', 'New Purchase Order')}
          backHref="/backend/purchasing/purchase-orders"
          fields={fields}
          groups={groups}
          initialValues={{
            orderDate: new Date().toISOString().slice(0, 10),
            currencyCode: 'USD',
          }}
          submitLabel={t('common.create', 'Create')}
          cancelHref="/backend/purchasing/purchase-orders"
          onSubmit={async (values) => {
            if (lines.length === 0) {
              flash.error(t('purchasing.purchaseOrders.errors.noLines', 'Add at least one line item'))
              return
            }
            const payload = {
              ...values,
              lines: lines.map((line, i) => ({
                lineNumber: i + 1,
                productVariantId: line.productVariantId || undefined,
                productName: line.productName,
                productSku: line.productSku || undefined,
                quantity: line.quantity,
                unitPriceCents: line.unitPriceCents,
                unitOfMeasure: line.unitOfMeasure || undefined,
                taxRate: line.taxRate || undefined,
                description: line.description || undefined,
                notes: line.notes || undefined,
              })),
            }
            const res = await createCrud('/api/purchasing/purchase-orders', payload)
            if (res?.id) {
              flash.success(t('common.created', 'Created'))
              router.push(`/backend/purchasing/purchase-orders/${res.id}`)
            }
          }}
        />

        {/* Line Items Section */}
        <div className="mt-6 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">
              {t('purchasing.purchaseOrders.lines.title', 'Line Items')}
              <span className="ml-2 text-xs text-muted-foreground font-normal tabular-nums">
                ({lines.length})
              </span>
            </h3>
            <Button type="button" variant="outline" size="sm" onClick={openAddDialog}>
              <Plus className="mr-1 size-3.5" />
              {t('purchasing.purchaseOrders.lines.add', 'Add Line')}
            </Button>
          </div>

          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t('purchasing.purchaseOrders.lines.empty', 'No line items yet. Click "Add Line" to add materials.')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 font-medium w-8">#</th>
                    <th className="pb-2 font-medium">{t('purchasing.purchaseOrders.lines.product', 'Product')}</th>
                    <th className="pb-2 font-medium">{t('purchasing.purchaseOrders.lines.sku', 'SKU')}</th>
                    <th className="pb-2 font-medium text-right tabular-nums">{t('purchasing.purchaseOrders.lines.qty', 'Qty')}</th>
                    <th className="pb-2 font-medium text-right tabular-nums">{t('purchasing.purchaseOrders.lines.unitPrice', 'Unit Price')}</th>
                    <th className="pb-2 font-medium text-right tabular-nums">{t('purchasing.purchaseOrders.lines.tax', 'Tax %')}</th>
                    <th className="pb-2 font-medium text-right tabular-nums">{t('purchasing.purchaseOrders.lines.total', 'Total')}</th>
                    <th className="pb-2 font-medium w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => {
                    const lineTotal = Number(line.quantity) * line.unitPriceCents
                    return (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 text-muted-foreground">{i + 1}</td>
                        <td className="py-2">{line.productName}</td>
                        <td className="py-2 text-muted-foreground">{line.productSku ?? '—'}</td>
                        <td className="py-2 text-right tabular-nums">{line.quantity} {line.unitOfMeasure ?? ''}</td>
                        <td className="py-2 text-right tabular-nums">{formatCents(line.unitPriceCents)}</td>
                        <td className="py-2 text-right tabular-nums">{line.taxRate ?? '—'}</td>
                        <td className="py-2 text-right tabular-nums font-medium">{formatCents(lineTotal)}</td>
                        <td className="py-2 text-right">
                          <div className="flex gap-1 justify-end">
                            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditDialog(i)}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-status-error-fg" onClick={() => removeLine(i)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add/Edit Line Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent
            className="sm:max-w-lg"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault()
                handleDialogSave()
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {editingIndex !== null
                  ? t('purchasing.purchaseOrders.lines.editLine', 'Edit Line Item')
                  : t('purchasing.purchaseOrders.lines.addLine', 'Add Line Item')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>{t('purchasing.purchaseOrders.lines.product', 'Product')}</Label>
                <ComboboxInput
                  value={dialogProductId}
                  onChange={(value) => {
                    setDialogProductId(value)
                    const product = productCacheRef.current.get(value)
                    if (product) {
                      setDialogLine((prev) => ({
                        ...prev,
                        productVariantId: product.default_variant_id ?? product.id,
                        productName: product.title ?? '',
                        productSku: product.sku ?? null,
                      }))
                    }
                  }}
                  loadSuggestions={loadProductOptions}
                  allowCustomValues={false}
                  placeholder={t('purchasing.purchaseOrders.lines.productPlaceholder', 'Search products...')}
                />
              </div>
              <div>
                <Label>{t('purchasing.purchaseOrders.lines.productName', 'Product Name')} *</Label>
                <Input
                  value={dialogLine.productName}
                  onChange={(e) => setDialogLine((prev) => ({ ...prev, productName: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t('purchasing.purchaseOrders.lines.qty', 'Quantity')} *</Label>
                  <Input
                    value={dialogLine.quantity}
                    onChange={(e) => setDialogLine((prev) => ({ ...prev, quantity: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>{t('purchasing.purchaseOrders.lines.unitPrice', 'Unit Price (cents)')}</Label>
                  <Input
                    type="number"
                    value={dialogLine.unitPriceCents}
                    onChange={(e) => setDialogLine((prev) => ({ ...prev, unitPriceCents: Number(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t('purchasing.purchaseOrders.lines.uom', 'Unit of Measure')}</Label>
                  <Input
                    value={dialogLine.unitOfMeasure ?? ''}
                    onChange={(e) => setDialogLine((prev) => ({ ...prev, unitOfMeasure: e.target.value || null }))}
                  />
                </div>
                <div>
                  <Label>{t('purchasing.purchaseOrders.lines.tax', 'Tax Rate (%)')}</Label>
                  <Input
                    value={dialogLine.taxRate ?? ''}
                    onChange={(e) => setDialogLine((prev) => ({ ...prev, taxRate: e.target.value || null }))}
                  />
                </div>
              </div>
              <div>
                <Label>{t('purchasing.purchaseOrders.lines.description', 'Description')}</Label>
                <Input
                  value={dialogLine.description ?? ''}
                  onChange={(e) => setDialogLine((prev) => ({ ...prev, description: e.target.value || null }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="button" onClick={handleDialogSave} disabled={!dialogLine.productName.trim()}>
                {editingIndex !== null ? t('common.save', 'Save') : t('common.add', 'Add')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageBody>
    </Page>
  )
}
