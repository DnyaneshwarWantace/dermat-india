"use client"

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Page, PageBody } from '@wantace/ui/backend/Page'
import { CrudForm, type CrudFormField, type CrudFormGroup } from '@wantace/ui/backend/CrudForm'
import { updateCrud, deleteCrud } from '@wantace/ui/backend/utils/crud'
import { LoadingMessage, ErrorMessage } from '@wantace/ui/backend/detail'
import { useT } from '@wantace/shared/lib/i18n/context'
import { flash } from '@wantace/ui/backend/FlashMessages'
import { apiCall, apiCallOrThrow } from '@wantace/ui/backend/utils/apiCall'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@wantace/ui/primitives/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@wantace/ui/primitives/dialog'
import { Input } from '@wantace/ui/primitives/input'
import { Label } from '@wantace/ui/primitives/label'
import { ComboboxInput } from '@wantace/ui/backend/inputs/ComboboxInput'
import type { CrudFieldOption } from '@wantace/ui/backend/CrudForm'

type PODetail = {
  id: string
  order_number: string
  supplier_id: string
  supplier_name?: string | null
  status: string
  order_date: string
  expected_delivery_date?: string | null
  warehouse_id?: string | null
  currency_code?: string | null
  payment_terms?: string | null
  shipping_method?: string | null
  notes?: string | null
  updated_at?: string | null
}

type POLine = {
  id: string
  line_number: number
  product_variant_id?: string | null
  product_name: string
  product_sku?: string | null
  quantity: string
  unit_of_measure?: string | null
  unit_price_cents: number
  tax_rate?: string | null
  line_total: number
  received_quantity?: string | null
  status?: string | null
  description?: string | null
  notes?: string | null
}

type GoodsReceiptItem = {
  id: string
  receipt_number: string
  status: string
  receipt_date?: string | null
  created_at?: string | null
}

type CatalogProduct = { id: string; title?: string | null; sku?: string | null; default_variant_id?: string | null }

type LineValues = {
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

const PO_STATUSES = ['draft', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled', 'closed'] as const

export default function PurchaseOrderDetailPage() {
  const t = useT()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const productCacheRef = React.useRef<Map<string, CatalogProduct>>(new Map())

  const { data: po, isLoading, error } = useQuery({
    queryKey: ['purchasing-po', id],
    queryFn: async () => {
      const res = await apiCallOrThrow(`/api/purchasing/purchase-orders?id=${id}`)
      const items = (res as { items: PODetail[] }).items
      if (!items?.length) throw new Error('Not found')
      return items[0]
    },
  })

  const { data: poLines } = useQuery({
    queryKey: ['purchasing-po-lines', id],
    queryFn: async () => {
      const res = await apiCallOrThrow(`/api/purchasing/purchase-order-lines?purchaseOrderId=${id}&pageSize=100`)
      return (res as { items: POLine[] }).items ?? []
    },
    enabled: !!id,
  })

  const { data: goodsReceipts } = useQuery({
    queryKey: ['purchasing-po-grs', id],
    queryFn: async () => {
      const res = await apiCallOrThrow(`/api/purchasing/goods-receipts?purchaseOrderId=${id}&pageSize=100`)
      return (res as { items: GoodsReceiptItem[] }).items ?? []
    },
    enabled: !!id,
  })

  const isDraft = po?.status === 'draft'
  const canReceive = po?.status === 'confirmed' || po?.status === 'sent' || po?.status === 'partially_received'

  // Line editor state (only used in draft mode)
  const [lines, setLines] = React.useState<LineValues[]>([])
  const [linesInitialized, setLinesInitialized] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null)
  const [dialogLine, setDialogLine] = React.useState<LineValues>({
    productVariantId: null, productName: '', productSku: null, quantity: '1',
    unitPriceCents: 0, unitOfMeasure: null, taxRate: null, description: null, notes: null,
  })
  const [dialogProductId, setDialogProductId] = React.useState('')

  React.useEffect(() => {
    if (poLines && !linesInitialized) {
      setLines(poLines.map((l) => ({
        productVariantId: l.product_variant_id,
        productName: l.product_name,
        productSku: l.product_sku,
        quantity: l.quantity,
        unitPriceCents: l.unit_price_cents,
        unitOfMeasure: l.unit_of_measure,
        taxRate: l.tax_rate,
        description: l.description,
        notes: l.notes,
      })))
      setLinesInitialized(true)
    }
  }, [poLines, linesInitialized])

  const loadSupplierOptions = React.useCallback(async (query?: string): Promise<CrudFieldOption[]> => {
    const params = new URLSearchParams({ page: '1', pageSize: '20', status: 'active' })
    if (query?.trim()) params.set('search', query.trim())
    const res = await apiCall(`/api/purchasing/suppliers?${params}`)
    const items = (res as { items?: { id: string; name: string; code: string }[] })?.items ?? []
    return items.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))
  }, [])

  const loadWarehouseOptions = React.useCallback(async (query?: string): Promise<CrudFieldOption[]> => {
    const params = new URLSearchParams({ page: '1', pageSize: '20' })
    if (query?.trim()) params.set('search', query.trim())
    const res = await apiCall(`/api/wms/warehouses?${params}`)
    const items = (res as { items?: { id: string; name: string; code: string }[] })?.items ?? []
    return items.map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` }))
  }, [])

  const loadProductOptions = React.useCallback(async (query?: string): Promise<CrudFieldOption[]> => {
    const params = new URLSearchParams({ page: '1', pageSize: '20' })
    if (query?.trim()) params.set('search', query.trim())
    const res = await apiCall(`/api/catalog/products?${params}`)
    const items = (res as { items?: CatalogProduct[] })?.items ?? []
    for (const item of items) productCacheRef.current.set(item.id, item)
    return items.map((p) => ({ value: p.id, label: `${p.sku ? `${p.sku} — ` : ''}${p.title ?? 'Untitled'}` }))
  }, [])

  const fields = React.useMemo<CrudFormField[]>(() => [
    {
      name: 'supplierId', label: t('purchasing.purchaseOrders.fields.supplier', 'Supplier'),
      type: 'combobox', required: true, group: 'header',
      loadOptions: loadSupplierOptions, allowCustomValues: false,
      disabled: !isDraft,
    },
    {
      name: 'status', label: t('purchasing.purchaseOrders.fields.status', 'Status'),
      type: 'select', group: 'header',
      options: PO_STATUSES.map((s) => ({ value: s, label: t(`purchasing.purchaseOrders.status.${s}`, s) })),
    },
    {
      name: 'orderDate', label: t('purchasing.purchaseOrders.fields.orderDate', 'Order Date'),
      type: 'date', required: true, group: 'header', disabled: !isDraft,
    },
    {
      name: 'expectedDeliveryDate', label: t('purchasing.purchaseOrders.fields.expectedDeliveryDate', 'Expected Delivery'),
      type: 'date', group: 'header',
    },
    {
      name: 'warehouseId', label: t('purchasing.purchaseOrders.fields.warehouse', 'Warehouse'),
      type: 'combobox', group: 'header',
      loadOptions: loadWarehouseOptions, allowCustomValues: false,
    },
    {
      name: 'currencyCode', label: t('purchasing.purchaseOrders.fields.currency', 'Currency'),
      type: 'text', group: 'terms', disabled: !isDraft,
    },
    {
      name: 'paymentTerms', label: t('purchasing.purchaseOrders.fields.paymentTerms', 'Payment Terms'),
      type: 'text', group: 'terms',
    },
    {
      name: 'shippingMethod', label: t('purchasing.purchaseOrders.fields.shippingMethod', 'Shipping Method'),
      type: 'text', group: 'terms',
    },
    {
      name: 'notes', label: t('purchasing.purchaseOrders.fields.notes', 'Notes'),
      type: 'textarea', group: 'notes',
    },
  ], [t, isDraft, loadSupplierOptions, loadWarehouseOptions])

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

  if (isLoading) return <LoadingMessage />
  if (error || !po) return <ErrorMessage message="Purchase order not found" />

  const initialValues = {
    supplierId: po.supplier_id,
    status: po.status,
    orderDate: po.order_date?.slice(0, 10) ?? '',
    expectedDeliveryDate: po.expected_delivery_date?.slice(0, 10) ?? '',
    warehouseId: po.warehouse_id ?? '',
    currencyCode: po.currency_code ?? '',
    paymentTerms: po.payment_terms ?? '',
    shippingMethod: po.shipping_method ?? '',
    notes: po.notes ?? '',
    updatedAt: po.updated_at ?? undefined,
  }

  const displayLines = isDraft ? lines : (poLines ?? []).map((l) => ({
    productVariantId: l.product_variant_id,
    productName: l.product_name,
    productSku: l.product_sku,
    quantity: l.quantity,
    unitPriceCents: l.unit_price_cents,
    unitOfMeasure: l.unit_of_measure,
    taxRate: l.tax_rate,
    description: l.description,
    notes: l.notes,
    receivedQuantity: l.received_quantity,
    lineStatus: l.status,
  }))

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={`${t('purchasing.purchaseOrders.detail', 'Purchase Order')} — ${po.order_number}`}
          backHref="/backend/purchasing/purchase-orders"
          fields={fields}
          groups={groups}
          initialValues={initialValues}
          submitLabel={t('common.save', 'Save')}
          cancelHref="/backend/purchasing/purchase-orders"
          onSubmit={async (values) => {
            const payload: Record<string, unknown> = { id, ...values }
            if (isDraft && lines.length > 0) {
              payload.lines = lines.map((line, i) => ({
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
              }))
            }
            await updateCrud('/api/purchasing/purchase-orders', payload)
            flash.success(t('common.saved', 'Saved'))
            router.push('/backend/purchasing/purchase-orders')
          }}
          onDelete={isDraft ? async () => {
            await deleteCrud('/api/purchasing/purchase-orders', id)
            flash.success(t('common.deleted', 'Deleted'))
            router.push('/backend/purchasing/purchase-orders')
          } : undefined}
        />

        {/* Line Items Section */}
        <div className="mt-6 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">
              {t('purchasing.purchaseOrders.lines.title', 'Line Items')}
              <span className="ml-2 text-xs text-muted-foreground font-normal tabular-nums">
                ({displayLines.length})
              </span>
            </h3>
            {isDraft && (
              <Button type="button" variant="outline" size="sm" onClick={openAddDialog}>
                <Plus className="mr-1 size-3.5" />
                {t('purchasing.purchaseOrders.lines.add', 'Add Line')}
              </Button>
            )}
          </div>

          {displayLines.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t('purchasing.purchaseOrders.lines.empty', 'No line items.')}
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
                    {!isDraft && (
                      <th className="pb-2 font-medium text-right tabular-nums">{t('purchasing.purchaseOrders.lines.received', 'Received')}</th>
                    )}
                    {isDraft && <th className="pb-2 font-medium w-20"></th>}
                  </tr>
                </thead>
                <tbody>
                  {displayLines.map((line, i) => {
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
                        {!isDraft && (
                          <td className="py-2 text-right tabular-nums">
                            {('receivedQuantity' in line ? (line as { receivedQuantity?: string | null }).receivedQuantity : null) ?? '0'}
                          </td>
                        )}
                        {isDraft && (
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
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Linked Goods Receipts */}
        <div className="mt-6 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">
              {t('purchasing.purchaseOrders.goodsReceipts.title', 'Goods Receipts')}
              <span className="ml-2 text-xs text-muted-foreground font-normal tabular-nums">
                ({goodsReceipts?.length ?? 0})
              </span>
            </h3>
            {canReceive && (
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href={`/backend/purchasing/goods-receipts/create?purchaseOrderId=${id}`}>
                  <Plus className="mr-1 size-3.5" />
                  {t('purchasing.purchaseOrders.goodsReceipts.create', 'Create Goods Receipt')}
                </Link>
              </Button>
            )}
          </div>

          {!goodsReceipts?.length ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t('purchasing.purchaseOrders.goodsReceipts.empty', 'No goods receipts yet.')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 font-medium">{t('purchasing.goodsReceipts.fields.receiptNumber', 'Receipt Number')}</th>
                    <th className="pb-2 font-medium">{t('purchasing.goodsReceipts.fields.status', 'Status')}</th>
                    <th className="pb-2 font-medium">{t('purchasing.goodsReceipts.fields.receiptDate', 'Date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {goodsReceipts.map((gr) => (
                    <tr key={gr.id} className="border-b border-border/50">
                      <td className="py-2">
                        <Link href={`/backend/purchasing/goods-receipts/${gr.id}`} className="text-accent-foreground hover:underline">
                          {gr.receipt_number}
                        </Link>
                      </td>
                      <td className="py-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          gr.status === 'completed' ? 'bg-status-success-bg text-status-success-fg' :
                          gr.status === 'draft' ? 'bg-status-neutral-bg text-status-neutral-fg' :
                          'bg-status-warning-bg text-status-warning-fg'
                        }`}>
                          {t(`purchasing.goodsReceipts.status.${gr.status}`, gr.status)}
                        </span>
                      </td>
                      <td className="py-2 text-muted-foreground">{gr.receipt_date?.slice(0, 10) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add/Edit Line Dialog (draft only) */}
        {isDraft && (
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
        )}
      </PageBody>
    </Page>
  )
}
