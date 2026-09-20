"use client"

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { GripVertical, Plus, Pencil, Trash2, Calculator, ChevronDown, ChevronUp } from 'lucide-react'
import { Page, PageBody } from '@wantace/ui/backend/Page'
import { CrudForm, type CrudBuiltinField, type CrudFormGroup } from '@wantace/ui/backend/CrudForm'
import type { CrudFieldOption } from '@wantace/ui/backend/CrudForm'
import { updateCrud, deleteCrud } from '@wantace/ui/backend/utils/crud'
import { LoadingMessage, ErrorMessage } from '@wantace/ui/backend/detail'
import { useT } from '@wantace/shared/lib/i18n/context'
import { flash } from '@wantace/ui/backend/FlashMessages'
import { apiCallOrThrow, apiCall } from '@wantace/ui/backend/utils/apiCall'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@wantace/ui/primitives/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@wantace/ui/primitives/dialog'
import { Input } from '@wantace/ui/primitives/input'
import { Label } from '@wantace/ui/primitives/label'
import { Checkbox } from '@wantace/ui/primitives/checkbox'
import { ComboboxInput } from '@wantace/ui/backend/inputs/ComboboxInput'
import { cn } from '@wantace/shared/lib/utils'

type BOMDetail = {
  id: string; name: string; code: string; description?: string | null; status: string;
  product_variant_id?: string | null; product_name?: string | null;
  output_quantity?: string | null; unit_of_measure?: string | null;
  version: number; is_default: boolean;
  material_cost_cents: number; operation_cost_cents: number; total_cost_cents: number;
  notes?: string | null; updated_at?: string | null
}

type BomLineRow = {
  id: string; line_number: number; product_variant_id: string; product_name: string;
  product_sku?: string | null; quantity: string; unit_of_measure?: string | null;
  rm_percent?: string | null;
  unit_cost_cents: number; wastage_percent?: string | null; line_total: number; is_critical: boolean;
  notes?: string | null
}

type CatalogProduct = { id: string; title?: string | null; sku?: string | null; default_variant_id?: string | null }

type BOMLineValues = {
  productVariantId: string
  productName: string
  productSku?: string | null
  quantity: string
  unitOfMeasure?: string | null
  rmPercent: string
  rmPercentLocked: boolean
  wastagePercent: string
  unitCostCents: number
  isCritical: boolean
  notes?: string | null
}

const emptyLine = (): BOMLineValues => ({
  productVariantId: '', productName: '', productSku: null, quantity: '1',
  unitOfMeasure: null, rmPercent: '0', rmPercentLocked: false,
  wastagePercent: '0', unitCostCents: 0, isCritical: false, notes: null,
})

// Rescale every unlocked line's RM% so the whole set sums to 100, preserving
// each unlocked line's share of the unlocked remainder.
function normalizeRmPercent(lines: BOMLineValues[], changedIndex: number, changedValue: string): BOMLineValues[] {
  const next = lines.map((l, i) => (i === changedIndex ? { ...l, rmPercent: changedValue } : { ...l }))
  const lockedTotal = next.reduce((sum, l, i) => sum + (l.rmPercentLocked || i === changedIndex ? Number(l.rmPercent) || 0 : 0), 0)
  const unlockedIndexes = next.map((l, i) => i).filter((i) => !next[i].rmPercentLocked && i !== changedIndex)
  const remaining = Math.max(0, 100 - lockedTotal)
  const unlockedCurrentTotal = unlockedIndexes.reduce((sum, i) => sum + (Number(next[i].rmPercent) || 0), 0)
  if (unlockedIndexes.length === 0) return next
  for (const i of unlockedIndexes) {
    const current = Number(next[i].rmPercent) || 0
    const share = unlockedCurrentTotal > 0 ? current / unlockedCurrentTotal : 1 / unlockedIndexes.length
    next[i] = { ...next[i], rmPercent: (remaining * share).toFixed(3).replace(/\.?0+$/, '') || '0' }
  }
  return next
}

type OnHandMap = Record<string, number | null>

export default function BOMDetailPage() {
  const t = useT()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const queryClient = useQueryClient()

  const { data: bom, isLoading, error } = useQuery({
    queryKey: ['mfg-bom', id],
    queryFn: async () => {
      const res = await apiCallOrThrow(`/api/manufacturing/bill-of-materials?id=${id}`)
      const items = (res as { items: BOMDetail[] }).items
      if (!items?.length) throw new Error('Not found')
      return items[0]
    },
  })

  const { data: bomLines } = useQuery({
    queryKey: ['mfg-bom-lines', id],
    queryFn: async () => {
      const res = await apiCall<{ items?: BomLineRow[] }>(`/api/manufacturing/bom-lines?bomId=${encodeURIComponent(id)}&pageSize=100`, undefined, { fallback: { items: [] } })
      return (res.result?.items ?? []).sort((a, b) => a.line_number - b.line_number)
    },
    enabled: !!id,
  })

  const productCacheRef = React.useRef<Map<string, CatalogProduct>>(new Map())
  const [lines, setLines] = React.useState<BOMLineValues[]>([])
  const [linesInitialized, setLinesInitialized] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [showAdvanced, setShowAdvanced] = React.useState(false)
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null)
  const [dialogLine, setDialogLine] = React.useState<BOMLineValues>(emptyLine())
  const [dialogProductId, setDialogProductId] = React.useState('')
  const [batchQuantity, setBatchQuantity] = React.useState('1')
  const [onHandByVariant, setOnHandByVariant] = React.useState<OnHandMap>({})
  const onHandByVariantRef = React.useRef<OnHandMap>({})
  const [dragIndex, setDragIndex] = React.useState<number | null>(null)

  const [calcOpen, setCalcOpen] = React.useState(false)
  const [calcQty, setCalcQty] = React.useState('')

  React.useEffect(() => {
    if (bomLines && !linesInitialized) {
      setLines(bomLines.map((l) => ({
        productVariantId: l.product_variant_id,
        productName: l.product_name,
        productSku: l.product_sku ?? null,
        quantity: l.quantity,
        unitOfMeasure: l.unit_of_measure ?? null,
        rmPercent: l.rm_percent ?? '0',
        rmPercentLocked: false,
        wastagePercent: l.wastage_percent ?? '0',
        unitCostCents: l.unit_cost_cents,
        isCritical: l.is_critical,
        notes: l.notes ?? null,
      })))
      setLinesInitialized(true)
    }
  }, [bomLines, linesInitialized])

  React.useEffect(() => {
    if (bom?.output_quantity) setBatchQuantity(bom.output_quantity)
  }, [bom?.output_quantity])

  const loadProductOptions = React.useCallback(async (query?: string): Promise<CrudFieldOption[]> => {
    const params = new URLSearchParams({ page: '1', pageSize: '20' })
    if (query?.trim()) params.set('search', query.trim())
    const res = await apiCall<{ items?: CatalogProduct[] }>(`/api/catalog/products?${params}`, undefined, { fallback: { items: [] } })
    const items = res.result?.items ?? []
    for (const item of items) productCacheRef.current.set(item.id, item)
    return items.map((p) => ({
      value: p.id,
      label: `${p.sku ? `${p.sku} — ` : ''}${p.title ?? 'Untitled'}`,
    }))
  }, [])

  const resolveProductLabel = React.useCallback(async (value: string): Promise<string> => {
    const res = await apiCall<{ items?: CatalogProduct[] }>(`/api/catalog/products?id=${encodeURIComponent(value)}`, undefined, { fallback: { items: [] } })
    const items = res.result?.items ?? []
    if (items.length) {
      const p = items[0]
      productCacheRef.current.set(p.id, p)
      return `${p.sku ? `${p.sku} — ` : ''}${p.title ?? 'Untitled'}`
    }
    return value
  }, [])

  // On-hand stock is an optional WMS lookup — degrade to "—" silently if WMS isn't installed.
  const refreshOnHand = React.useCallback(async (variantIds: string[]) => {
    const uniqueIds = Array.from(new Set(variantIds.filter(Boolean))).filter((varId) => !(varId in onHandByVariantRef.current))
    if (!uniqueIds.length) return
    const results = await Promise.all(uniqueIds.map(async (variantId) => {
      try {
        const res = await apiCall<{ items?: Array<{ quantity_available?: number | null }> }>(
          `/api/wms/inventory/balances?catalogVariantId=${encodeURIComponent(variantId)}&pageSize=1`,
          undefined,
          { fallback: { items: [] } },
        )
        const items = res.result?.items ?? []
        const total = items.reduce((sum, item) => sum + (Number(item.quantity_available) || 0), 0)
        return [variantId, items.length ? total : null] as const
      } catch {
        return [variantId, null] as const
      }
    }))
    setOnHandByVariant((prev) => {
      const next = { ...prev }
      for (const [variantId, qty] of results) next[variantId] = qty
      onHandByVariantRef.current = next
      return next
    })
  }, [])

  React.useEffect(() => {
    void refreshOnHand(lines.map((l) => l.productVariantId))
  }, [lines, refreshOnHand])

  const fields = React.useMemo<CrudBuiltinField[]>(() => [
    {
      id: 'name', label: t('manufacturing.bom.fields.name', 'Name'),
      type: 'text', required: true, group: 'basic', layout: 'half',
    },
    {
      id: 'code', label: t('manufacturing.bom.fields.code', 'Code'),
      type: 'text', required: true, group: 'basic', layout: 'half',
    },
    {
      id: 'status', label: t('manufacturing.bom.fields.status', 'Status'),
      type: 'select', group: 'basic', layout: 'half',
      options: [
        { value: 'draft', label: t('manufacturing.bom.status.draft', 'Draft') },
        { value: 'active', label: t('manufacturing.bom.status.active', 'Active') },
        { value: 'obsolete', label: t('manufacturing.bom.status.obsolete', 'Obsolete') },
      ],
    },
    {
      id: 'productId', label: t('manufacturing.bom.fields.product', 'Product'),
      type: 'combobox', group: 'product', layout: 'full',
      loadOptions: loadProductOptions, allowCustomValues: false,
      resolveLabel: resolveProductLabel,
      placeholder: t('manufacturing.bom.fields.productPlaceholder', 'Search products...'),
    },
    {
      id: 'outputQuantity', label: t('manufacturing.bom.fields.outputQuantity', 'Batch Size (per recipe)'),
      type: 'text', group: 'product', layout: 'half',
    },
    {
      id: 'unitOfMeasure', label: t('manufacturing.bom.fields.unitOfMeasure', 'Unit of Measure'),
      type: 'text', group: 'product', layout: 'half',
    },
    {
      id: 'description', label: t('manufacturing.bom.fields.description', 'Description'),
      type: 'textarea', group: 'notes',
    },
    {
      id: 'notes', label: t('manufacturing.bom.fields.notes', 'Notes'),
      type: 'textarea', group: 'notes',
    },
  ], [t, loadProductOptions, resolveProductLabel])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'basic', label: t('manufacturing.bom.groups.basic', 'Basic Information') },
    { id: 'product', label: t('manufacturing.bom.groups.product', 'Product & Output') },
    { id: 'notes', label: t('manufacturing.bom.groups.notes', 'Notes') },
  ], [t])

  const openAddDialog = () => {
    setEditingIndex(null)
    setDialogProductId('')
    setShowAdvanced(false)
    setDialogLine(emptyLine())
    setDialogOpen(true)
  }

  const openEditDialog = (index: number) => {
    const line = lines[index]
    setEditingIndex(index)
    setDialogProductId(line.productVariantId)
    setShowAdvanced(false)
    setDialogLine({ ...line })
    setDialogOpen(true)
  }

  const handleDialogSave = () => {
    if (!dialogLine.productName.trim() || !dialogLine.productVariantId) return
    if (editingIndex !== null) {
      setLines((prev) => normalizeRmPercent(prev.map((l, i) => (i === editingIndex ? { ...dialogLine } : l)), editingIndex, dialogLine.rmPercent))
    } else {
      setLines((prev) => {
        const withNew = [...prev, { ...dialogLine }]
        return normalizeRmPercent(withNew, withNew.length - 1, dialogLine.rmPercent)
      })
    }
    setDialogOpen(false)
  }

  const removeLine = (index: number) => {
    setLines((prev) => {
      const next = prev.filter((_, i) => i !== index)
      if (!next.length) return next
      return normalizeRmPercent(next, 0, next[0].rmPercent)
    })
  }

  const updateRmPercent = (index: number, value: string) => {
    setLines((prev) => normalizeRmPercent(prev, index, value))
  }

  const toggleLock = (index: number) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, rmPercentLocked: !l.rmPercentLocked } : l)))
  }

  const moveLine = (from: number, to: number) => {
    if (to < 0 || to >= lines.length || from === to) return
    setLines((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  if (isLoading) return <LoadingMessage />
  if (error || !bom) return <ErrorMessage message="BOM not found" />

  const formatCents = (cents: number) => (cents / 100).toFixed(2)
  const batchQtyNumber = Number(batchQuantity) || 0
  const rmPercentTotal = lines.reduce((sum, l) => sum + (Number(l.rmPercent) || 0), 0)

  return (
    <Page>
      <PageBody>
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 rounded-lg border border-border p-4">
          <div>
            <span className="text-sm text-muted-foreground">{t('manufacturing.bom.fields.materialCost', 'Material Cost')}</span>
            <p className="text-lg font-semibold tabular-nums">{formatCents(bom.material_cost_cents)}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">{t('manufacturing.bom.fields.operationCost', 'Operation Cost')}</span>
            <p className="text-lg font-semibold tabular-nums">{formatCents(bom.operation_cost_cents)}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">{t('manufacturing.bom.fields.totalCost', 'Total Cost')}</span>
            <p className="text-lg font-semibold tabular-nums">{formatCents(bom.total_cost_cents)}</p>
          </div>
        </div>

        {/* Recipe Calculator */}
        <div className="mb-6 rounded-lg border border-border">
          <button
            type="button"
            className="flex w-full items-center justify-between p-4 text-left hover:bg-accent transition-colors rounded-lg"
            onClick={() => setCalcOpen((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <Calculator className="size-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{t('manufacturing.bom.calculator.title', 'Recipe Calculator')}</span>
            </div>
            <span className="text-xs text-muted-foreground">{calcOpen ? '▲' : '▼'}</span>
          </button>
          {calcOpen && (
            <div className="border-t border-border p-4">
              <div className="flex items-end gap-3 mb-4">
                <div className="flex-1 max-w-xs">
                  <Label>{t('manufacturing.bom.calculator.desiredOutput', 'Desired Output Quantity')}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    placeholder={bom.output_quantity ?? '1'}
                    value={calcQty}
                    onChange={(e) => setCalcQty(e.target.value)}
                  />
                </div>
                <div className="text-sm text-muted-foreground pb-2">
                  {t('manufacturing.bom.calculator.bomMakes', 'BOM makes')}: <span className="font-medium text-foreground">{bom.output_quantity ?? '1'}</span> {bom.unit_of_measure ?? t('manufacturing.bom.calculator.units', 'units')}
                </div>
              </div>
              {(() => {
                const desiredQty = parseFloat(calcQty) || parseFloat(bom.output_quantity ?? '1')
                const bomOutput = parseFloat(bom.output_quantity ?? '1') || 1
                const scale = desiredQty / bomOutput
                if (!lines.length) {
                  return <p className="text-sm text-muted-foreground">{t('manufacturing.bom.calculator.noLines', 'Add material lines to calculate requirements.')}</p>
                }
                const calculated = lines.map((line) => {
                  const baseQty = parseFloat(line.quantity) * scale
                  const wastage = parseFloat(line.wastagePercent) / 100
                  const withWastage = baseQty * (1 + wastage)
                  const totalCost = Math.round(withWastage * line.unitCostCents)
                  return { ...line, baseQty, withWastage, totalCost }
                })
                const grandTotal = calculated.reduce((sum, c) => sum + c.totalCost, 0)
                return (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left">
                            <th className="pb-2 font-medium">{t('manufacturing.bom.calculator.material', 'Material')}</th>
                            <th className="pb-2 font-medium text-right tabular-nums">{t('manufacturing.bom.calculator.baseQty', 'Base Qty')}</th>
                            <th className="pb-2 font-medium text-right tabular-nums">{t('manufacturing.bom.calculator.withWastage', 'With Wastage')}</th>
                            <th className="pb-2 font-medium text-right tabular-nums">{t('manufacturing.bom.calculator.unitCost', 'Unit Cost')}</th>
                            <th className="pb-2 font-medium text-right tabular-nums">{t('manufacturing.bom.calculator.totalCost', 'Total Cost')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {calculated.map((c, i) => (
                            <tr key={i} className="border-b border-border/50">
                              <td className="py-2">
                                {c.productName}
                                {c.isCritical && <span className="ml-1 text-xs text-status-error-text">●</span>}
                              </td>
                              <td className="py-2 text-right tabular-nums">{c.baseQty.toFixed(4)} {c.unitOfMeasure ?? ''}</td>
                              <td className="py-2 text-right tabular-nums">{c.withWastage.toFixed(4)} {c.unitOfMeasure ?? ''}</td>
                              <td className="py-2 text-right tabular-nums">{formatCents(c.unitCostCents)}</td>
                              <td className="py-2 text-right tabular-nums font-medium">{formatCents(c.totalCost)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-border">
                            <td colSpan={4} className="py-2 text-right font-semibold">{t('manufacturing.bom.calculator.grandTotal', 'Grand Total')}</td>
                            <td className="py-2 text-right tabular-nums font-semibold">{formatCents(grandTotal)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t('manufacturing.bom.calculator.scaleNote', 'Scale factor')}: {scale.toFixed(4)}x ({t('manufacturing.bom.calculator.output', 'output')}: {desiredQty} / {t('manufacturing.bom.calculator.bomOutput', 'BOM output')}: {bomOutput})
                    </p>
                  </>
                )
              })()}
            </div>
          )}
        </div>

        <CrudForm
          title={`${t('manufacturing.bom.edit', 'Edit BOM')} — ${bom.name}`}
          backHref="/backend/manufacturing/bill-of-materials"
          fields={fields}
          groups={groups}
          initialValues={{
            name: bom.name, code: bom.code, description: bom.description ?? '',
            status: bom.status,
            productId: bom.product_variant_id ?? '',
            outputQuantity: bom.output_quantity ?? '1',
            unitOfMeasure: bom.unit_of_measure ?? '',
            notes: bom.notes ?? '',
            updatedAt: bom.updated_at ?? undefined,
          }}
          submitLabel={t('common.save', 'Save')}
          cancelHref="/backend/manufacturing/bill-of-materials"
          onSubmit={async (values) => {
            const productId = values.productId as string
            const product = productCacheRef.current.get(productId)
            const payload = {
              id,
              ...values,
              productVariantId: product?.default_variant_id ?? productId,
              productName: product?.title ?? bom.product_name ?? '',
              isDefault: bom.is_default,
              lines: lines.map((line, i) => ({
                lineNumber: i + 1,
                productVariantId: line.productVariantId,
                productName: line.productName,
                productSku: line.productSku || undefined,
                quantity: line.quantity,
                unitOfMeasure: line.unitOfMeasure || undefined,
                rmPercent: line.rmPercent || undefined,
                wastagePercent: line.wastagePercent,
                unitCostCents: line.unitCostCents,
                isCritical: line.isCritical,
                notes: line.notes || undefined,
              })),
            }
            delete (payload as Record<string, unknown>).productId
            await updateCrud('/api/manufacturing/bill-of-materials', payload)
            flash.success(t('common.saved', 'Saved'))
            queryClient.invalidateQueries({ queryKey: ['mfg-bom', id] })
            queryClient.invalidateQueries({ queryKey: ['mfg-bom-lines', id] })
          }}
          onDelete={async () => {
            await deleteCrud('/api/manufacturing/bill-of-materials', id)
            flash.success(t('common.deleted', 'Deleted'))
            router.push('/backend/manufacturing/bill-of-materials')
          }}
        />

        {/* Material Lines Editor */}
        <div className="mt-6 rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold">
              {t('manufacturing.bom.lines.title', 'Raw Materials')}
              <span className="ml-2 text-xs text-muted-foreground font-normal tabular-nums">
                ({lines.length})
              </span>
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">
                  {t('manufacturing.bom.lines.batchQuantity', 'Order Quantity')}
                </Label>
                <Input
                  className="w-24 h-8"
                  value={batchQuantity}
                  onChange={(e) => setBatchQuantity(e.target.value)}
                />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={openAddDialog}>
                <Plus className="mr-1 size-3.5" />
                {t('manufacturing.bom.lines.add', 'Add Material')}
              </Button>
            </div>
          </div>

          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t('manufacturing.bom.lines.empty', 'No materials added yet. Click "Add Material" to add components.')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 font-medium w-8"></th>
                    <th className="pb-2 font-medium">{t('manufacturing.bom.lines.product', 'Material')}</th>
                    <th className="pb-2 font-medium text-right tabular-nums">{t('manufacturing.bom.lines.qtyPerUnit', 'Qty/Unit')}</th>
                    <th className="pb-2 font-medium text-right tabular-nums">{t('manufacturing.bom.lines.rmPercent', 'RM %')}</th>
                    <th className="pb-2 font-medium text-right tabular-nums">{t('manufacturing.bom.lines.totalQty', 'Total Qty')}</th>
                    <th className="pb-2 font-medium text-right tabular-nums">{t('manufacturing.bom.lines.onHand', 'On Hand')}</th>
                    <th className="pb-2 font-medium">{t('manufacturing.bom.lines.uom', 'UOM')}</th>
                    <th className="pb-2 font-medium w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => {
                    const qtyPerUnit = Number(line.quantity) || 0
                    const totalQty = qtyPerUnit * batchQtyNumber
                    const onHand = onHandByVariant[line.productVariantId]
                    return (
                      <tr
                        key={i}
                        className={cn('border-b border-border/50', dragIndex === i && 'opacity-40')}
                        draggable
                        onDragStart={() => setDragIndex(i)}
                        onDragEnd={() => setDragIndex(null)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault()
                          if (dragIndex !== null) moveLine(dragIndex, i)
                          setDragIndex(null)
                        }}
                      >
                        <td className="py-2 cursor-grab text-muted-foreground">
                          <div className="flex flex-col items-center gap-0.5">
                            <GripVertical className="size-3.5" />
                            <div className="flex flex-col -space-y-1">
                              <button type="button" className="disabled:opacity-30" disabled={i === 0} onClick={() => moveLine(i, i - 1)}>
                                <ChevronUp className="size-3" />
                              </button>
                              <button type="button" className="disabled:opacity-30" disabled={i === lines.length - 1} onClick={() => moveLine(i, i + 1)}>
                                <ChevronDown className="size-3" />
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="py-2">{line.productName}</td>
                        <td className="py-2 text-right tabular-nums">{line.quantity}</td>
                        <td className="py-2 text-right tabular-nums">
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              className="w-20 h-7 text-right"
                              value={line.rmPercent}
                              onChange={(e) => updateRmPercent(i, e.target.value)}
                            />
                            <button
                              type="button"
                              title={line.rmPercentLocked
                                ? t('manufacturing.bom.lines.unlock', 'Unlock — allow auto-adjust')
                                : t('manufacturing.bom.lines.lock', 'Lock — exclude from auto-adjust')}
                              className={cn('text-xs px-1 rounded', line.rmPercentLocked ? 'text-brand-violet' : 'text-muted-foreground')}
                              onClick={() => toggleLock(i)}
                            >
                              {line.rmPercentLocked ? '🔒' : '🔓'}
                            </button>
                          </div>
                        </td>
                        <td className="py-2 text-right tabular-nums">{totalQty ? totalQty.toFixed(4).replace(/\.?0+$/, '') : '0'}</td>
                        <td className="py-2 text-right tabular-nums">
                          {onHand == null ? <span className="text-muted-foreground">—</span> : onHand}
                        </td>
                        <td className="py-2 text-muted-foreground">{line.unitOfMeasure ?? '—'}</td>
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
                <tfoot>
                  <tr>
                    <td colSpan={3} />
                    <td className={cn('pt-2 text-right text-xs font-medium tabular-nums', Math.abs(rmPercentTotal - 100) > 0.01 ? 'text-status-error-fg' : 'text-muted-foreground')}>
                      {rmPercentTotal.toFixed(2).replace(/\.?0+$/, '')}%
                    </td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Add/Edit Material Dialog */}
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
                  ? t('manufacturing.bom.lines.editMaterial', 'Edit Material')
                  : t('manufacturing.bom.lines.addMaterial', 'Add Material')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>{t('manufacturing.bom.lines.product', 'Material')} *</Label>
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
                  placeholder={t('manufacturing.bom.lines.materialPlaceholder', 'Search materials...')}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t('manufacturing.bom.lines.qtyPerUnit', 'Qty/Unit')} *</Label>
                  <Input
                    value={dialogLine.quantity}
                    onChange={(e) => setDialogLine((prev) => ({ ...prev, quantity: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>{t('manufacturing.bom.lines.rmPercent', 'RM %')}</Label>
                  <Input
                    value={dialogLine.rmPercent}
                    onChange={(e) => setDialogLine((prev) => ({ ...prev, rmPercent: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label>{t('manufacturing.bom.lines.uom', 'Unit of Measure')}</Label>
                <Input
                  value={dialogLine.unitOfMeasure ?? ''}
                  onChange={(e) => setDialogLine((prev) => ({ ...prev, unitOfMeasure: e.target.value || null }))}
                />
              </div>

              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                {t('manufacturing.bom.lines.advanced', 'Advanced (cost, wastage, critical)')}
              </button>

              {showAdvanced ? (
                <div className="space-y-3 rounded-md border border-border p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>{t('manufacturing.bom.lines.unitCost', 'Unit Cost (cents)')}</Label>
                      <Input
                        type="number"
                        value={dialogLine.unitCostCents}
                        onChange={(e) => setDialogLine((prev) => ({ ...prev, unitCostCents: Number(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <Label>{t('manufacturing.bom.lines.wastage', 'Wastage %')}</Label>
                      <Input
                        value={dialogLine.wastagePercent}
                        onChange={(e) => setDialogLine((prev) => ({ ...prev, wastagePercent: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={dialogLine.isCritical}
                      onCheckedChange={(checked) => setDialogLine((prev) => ({ ...prev, isCritical: checked === true }))}
                    />
                    <Label className="cursor-pointer">{t('manufacturing.bom.lines.critical', 'Critical material')}</Label>
                  </div>
                </div>
              ) : null}
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
