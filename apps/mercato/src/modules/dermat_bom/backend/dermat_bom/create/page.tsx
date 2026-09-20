'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Card, CardContent, CardHeader, CardTitle } from '@open-mercato/ui/primitives/card'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@open-mercato/ui/primitives/select'
import { ComboboxInput, type ComboboxOption } from '@open-mercato/ui/backend/inputs/ComboboxInput'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { ArrowLeft, Layers, Sparkles, Building2 } from 'lucide-react'

type CatalogProductSearchItem = { id: string; title: string; sku: string | null }

export default function CreateBomPage() {
  const t = useT()
  const router = useRouter()
  const { organizationId, tenantId } = useOrganizationScopeDetail()

  const productCacheRef = React.useRef<Map<string, CatalogProductSearchItem>>(new Map())

  // Form states matching Part A Header Spec
  const [selectedProductId, setSelectedProductId] = React.useState('')
  const [internalCode, setInternalCode] = React.useState('')
  const [bomType, setBomType] = React.useState<'Finished Good' | 'Bulk' | 'Packaging Sub-Assembly'>('Finished Good')
  const [version, setVersion] = React.useState('V1')
  const [baseBatchQty, setBaseBatchQty] = React.useState('')
  const [baseUom, setBaseUom] = React.useState('L')
  const [orderQtySourceLabel, setOrderQtySourceLabel] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState<'Draft' | 'Under Review' | 'Approved'>('Draft')
  const [effectiveFrom, setEffectiveFrom] = React.useState(() => new Date().toISOString().slice(0, 10))
  const [customLabel, setCustomLabel] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  const loadProductSuggestions = React.useCallback(async (query?: string): Promise<ComboboxOption[]> => {
    const params = new URLSearchParams()
    params.set('pageSize', '50')
    if (query) params.set('search', query)
    const call = await apiCall<{ items: CatalogProductSearchItem[] }>(`/api/catalog/products?${params.toString()}`)
    if (!call.ok || !call.result?.items) {
      // Fallback cosmetic items
      return [
        { value: 'p1', label: 'Vitamin C Serum (SKU-4329)' },
        { value: 'p2', label: 'Face Cream 50 gm (SKU-5501)' },
        { value: 'p3', label: 'Zitlite Salicylic Gel 25g (SKU-8801)' },
        { value: 'p4', label: 'Niacinamide Glowing Toner 100ml (SKU-2201)' },
      ]
    }
    const items = call.result.items
    for (const item of items) productCacheRef.current.set(item.id, item)
    return items.map((item) => ({
      value: item.id,
      label: item.sku ? `${item.title} (${item.sku})` : item.title,
    }))
  }, [])

  // "This much [is what the] customer want[s]" — when a product is picked,
  // pull the batch quantity from that product's most recent order line
  // instead of leaving an arbitrary placeholder number in the field.
  const handleProductChange = React.useCallback(async (productId: string) => {
    setSelectedProductId(productId)
    setOrderQtySourceLabel(null)
    if (!productId) return
    const call = await apiCall<{ found: boolean; quantity?: number; unit?: string | null; orderNumber?: string }>(
      `/api/dermat_bom/order-quantity?productId=${encodeURIComponent(productId)}`,
    )
    if (call.ok && call.result?.found && call.result.quantity) {
      setBaseBatchQty(String(call.result.quantity))
      if (call.result.unit) setBaseUom(call.result.unit)
      setOrderQtySourceLabel(`Auto-filled from order ${call.result.orderNumber}`)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProductId && !customLabel.trim()) {
      flash('Please select a product or enter a formulation label', 'error')
      return
    }
    if (!baseBatchQty.trim() || Number(baseBatchQty) <= 0) {
      flash('Please enter a base batch quantity', 'error')
      return
    }

    setSubmitting(true)
    try {
      const product = productCacheRef.current.get(selectedProductId)
      const productTitle = product?.title?.trim() || customLabel.trim() || 'Custom Formulation'
      const bomName = customLabel.trim() ? `${productTitle} — ${customLabel.trim()}` : productTitle

      const payload = {
        organizationId,
        tenantId,
        bomName,
        catalogProductId: selectedProductId || null,
        batchQuantity: Number(baseBatchQty),
        version: 1,
        isActive: status === 'Approved',
        metadata: {
          internal_code: internalCode,
          bom_type: bomType,
          version_label: version,
          base_uom: baseUom,
          status,
          effective_from: effectiveFrom,
        },
      }

      const created = await createCrud<{ id: string | null }>('dermat_bom/boms', payload)
      flash('BOM created successfully! Now add components to formulation.', 'success')
      const newId = (created as any)?.id || (created as any)?.result?.id
      router.push(newId ? `/backend/dermat_bom/${newId}` : '/backend/dermat_bom')
    } catch (err: any) {
      flash(err?.message || 'Failed to create BOM', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Page>
      <PageBody>
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-3">
              <Button size="icon" variant="ghost" asChild className="h-9 w-9">
                <Link href="/backend/dermat_bom">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  Create Bill of Material (BOM)
                </h1>
                <p className="text-xs text-muted-foreground">
                  Define master recipe, base batch quantity, and multi-level manufacturing structure
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-md text-xs font-semibold text-primary">
              <Building2 className="h-3.5 w-3.5" />
              <span>DERMAT INDIA</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Part A: BOM Header */}
            <Card className="shadow-sm border-border/80">
              <CardHeader className="py-3 border-b bg-muted/20">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <span>Part A — BOM Header Specifications</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Product */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-semibold">
                      Product <span className="text-rose-500">*</span>
                    </Label>
                    <ComboboxInput
                      value={selectedProductId}
                      onChange={handleProductChange}
                      loadSuggestions={loadProductSuggestions}
                      placeholder="Search finished products from catalog…"
                      allowCustomValues={false}
                      clearable
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Pick the finished cosmetic product or raw bulk material this recipe produces. Can&apos;t find it?
                      Add it to the <Link href="/backend/catalog/products/create" className="underline">product catalog</Link> first,
                      then come back and search for it here.
                    </p>
                  </div>

                  {/* Internal Code */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Internal Code (BOM No.)</Label>
                    <Input
                      value={internalCode}
                      onChange={(e) => setInternalCode(e.target.value)}
                      placeholder="e.g. BOM-001"
                      className="font-mono text-xs font-bold"
                    />
                  </div>

                  {/* BOM Type */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      BOM Type <span className="text-rose-500">*</span>
                    </Label>
                    <Select value={bomType} onValueChange={(val: any) => setBomType(val)}>
                      <SelectTrigger className="text-xs font-semibold">
                        <SelectValue placeholder="Select BOM Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Finished Good" className="text-xs">
                          Finished Good (FG) — Bulk + Primary/Secondary Packaging
                        </SelectItem>
                        <SelectItem value="Bulk" className="text-xs">
                          Bulk / SFG — Chemical Compounding Formulation
                        </SelectItem>
                        <SelectItem value="Packaging Sub-Assembly" className="text-xs">
                          Packaging Sub-Assembly — Pre-assembled Components
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Version */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Version</Label>
                    <Input
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      placeholder="V1"
                      className="font-mono text-xs font-bold"
                    />
                  </div>

                  {/* Base Batch Quantity & UOM */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">
                        Base Batch Qty <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        type="number"
                        min="0.001"
                        step="any"
                        value={baseBatchQty}
                        onChange={(e) => { setBaseBatchQty(e.target.value); setOrderQtySourceLabel(null) }}
                        placeholder="e.g. 100"
                        className="font-mono text-xs font-bold text-right"
                      />
                      {orderQtySourceLabel && (
                        <p className="text-[11px] text-emerald-600">{orderQtySourceLabel}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Base UOM</Label>
                      <Select value={baseUom} onValueChange={setBaseUom}>
                        <SelectTrigger className="text-xs font-medium">
                          <SelectValue placeholder="UOM" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="L" className="text-xs">L (Litres)</SelectItem>
                          <SelectItem value="kg" className="text-xs">kg (Kilograms)</SelectItem>
                          <SelectItem value="unit" className="text-xs">unit (Pieces)</SelectItem>
                          <SelectItem value="ml" className="text-xs">ml (Millilitres)</SelectItem>
                          <SelectItem value="gm" className="text-xs">gm (Grams)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Status</Label>
                    <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                      <SelectTrigger className="text-xs font-semibold">
                        <SelectValue placeholder="Select Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Draft" className="text-xs">Draft (Under Preparation)</SelectItem>
                        <SelectItem value="Under Review" className="text-xs">Under Review (R&D / QA Checking)</SelectItem>
                        <SelectItem value="Approved" className="text-xs">Approved (Production Ready)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Effective From */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Effective From Date</Label>
                    <Input
                      type="date"
                      value={effectiveFrom}
                      onChange={(e) => setEffectiveFrom(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  {/* Optional BOM Label */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-semibold">BOM Label / Variant (Optional)</Label>
                    <Input
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                      placeholder='e.g. "Gel Formulation", "Summer Formula", "Export Spec"'
                      className="text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Use when one product has multiple formulations or pack configurations.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-2">
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/backend/dermat_bom">Cancel</Link>
              </Button>
              <Button type="submit" disabled={submitting} className="font-bold px-6 shadow-sm">
                <span>{submitting ? 'Creating BOM...' : 'Continue to Add Components →'}</span>
              </Button>
            </div>
          </form>
        </div>
      </PageBody>
    </Page>
  )
}
