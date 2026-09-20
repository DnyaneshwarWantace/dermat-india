"use client"

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Page, PageBody } from '@wantace/ui/backend/Page'
import { createCrud } from '@wantace/ui/backend/utils/crud'
import { LoadingMessage } from '@wantace/ui/backend/detail'
import { useT } from '@wantace/shared/lib/i18n/context'
import { flash } from '@wantace/ui/backend/FlashMessages'
import { apiCall, apiCallOrThrow } from '@wantace/ui/backend/utils/apiCall'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@wantace/ui/primitives/button'
import { Input } from '@wantace/ui/primitives/input'
import { Label } from '@wantace/ui/primitives/label'
import { Textarea } from '@wantace/ui/primitives/textarea'
import { ComboboxInput } from '@wantace/ui/backend/inputs/ComboboxInput'
import type { CrudFieldOption } from '@wantace/ui/backend/CrudForm'

type POOption = { id: string; order_number: string; supplier_name?: string | null; status: string }
type POLineItem = {
  id: string
  line_number: number
  product_variant_id?: string | null
  product_name: string
  product_sku?: string | null
  quantity: string
  unit_of_measure?: string | null
  received_quantity?: string | null
}

type ReceiveLine = {
  purchaseOrderLineId: string
  productVariantId?: string | null
  productName: string
  orderedQty: string
  alreadyReceived: string
  remainingQty: string
  receivedQuantity: string
  acceptedQuantity: string
  rejectedQuantity: string
  batchNumber: string
  lotNumber: string
  notes: string
}

export default function CreateGoodsReceiptPage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefilledPOId = searchParams?.get('purchaseOrderId') ?? ''

  const [purchaseOrderId, setPurchaseOrderId] = React.useState(prefilledPOId)
  const [receiptDate, setReceiptDate] = React.useState(new Date().toISOString().slice(0, 10))
  const [warehouseId, setWarehouseId] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [receiveLines, setReceiveLines] = React.useState<ReceiveLine[]>([])
  const [submitting, setSubmitting] = React.useState(false)

  const { data: poLines, isLoading: linesLoading } = useQuery({
    queryKey: ['gr-po-lines', purchaseOrderId],
    queryFn: async () => {
      const res = await apiCallOrThrow(`/api/purchasing/purchase-order-lines?purchaseOrderId=${purchaseOrderId}&pageSize=100`)
      return (res as { items: POLineItem[] }).items ?? []
    },
    enabled: !!purchaseOrderId,
  })

  React.useEffect(() => {
    if (poLines) {
      setReceiveLines(poLines.map((l) => {
        const ordered = Number(l.quantity) || 0
        const received = Number(l.received_quantity) || 0
        const remaining = Math.max(0, ordered - received)
        return {
          purchaseOrderLineId: l.id,
          productVariantId: l.product_variant_id,
          productName: l.product_name,
          orderedQty: l.quantity,
          alreadyReceived: String(received),
          remainingQty: String(remaining),
          receivedQuantity: String(remaining),
          acceptedQuantity: String(remaining),
          rejectedQuantity: '0',
          batchNumber: '',
          lotNumber: '',
          notes: '',
        }
      }))
    }
  }, [poLines])

  const loadPOOptions = React.useCallback(async (query?: string): Promise<CrudFieldOption[]> => {
    const params = new URLSearchParams({ page: '1', pageSize: '20' })
    if (query?.trim()) params.set('search', query.trim())
    const res = await apiCall(`/api/purchasing/purchase-orders?${params}`)
    const items = (res as { items?: POOption[] })?.items ?? []
    return items
      .filter((po) => ['confirmed', 'sent', 'partially_received'].includes(po.status))
      .map((po) => ({ value: po.id, label: `${po.order_number}${po.supplier_name ? ` — ${po.supplier_name}` : ''}` }))
  }, [])

  const loadWarehouseOptions = React.useCallback(async (query?: string): Promise<CrudFieldOption[]> => {
    const params = new URLSearchParams({ page: '1', pageSize: '20' })
    if (query?.trim()) params.set('search', query.trim())
    const res = await apiCall(`/api/wms/warehouses?${params}`)
    const items = (res as { items?: { id: string; name: string; code: string }[] })?.items ?? []
    return items.map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` }))
  }, [])

  const updateLine = (index: number, field: keyof ReceiveLine, value: string) => {
    setReceiveLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)))
  }

  const handleSubmit = async () => {
    const linesToSubmit = receiveLines.filter((l) => Number(l.receivedQuantity) > 0)
    if (!purchaseOrderId) {
      flash.error(t('purchasing.goodsReceipts.errors.noPO', 'Select a purchase order'))
      return
    }
    if (linesToSubmit.length === 0) {
      flash.error(t('purchasing.goodsReceipts.errors.noLines', 'Enter received quantities for at least one line'))
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        purchaseOrderId,
        receiptDate,
        warehouseId: warehouseId || undefined,
        notes: notes || undefined,
        lines: linesToSubmit.map((l) => ({
          purchaseOrderLineId: l.purchaseOrderLineId,
          productVariantId: l.productVariantId || undefined,
          productName: l.productName,
          receivedQuantity: l.receivedQuantity,
          acceptedQuantity: l.acceptedQuantity || l.receivedQuantity,
          rejectedQuantity: l.rejectedQuantity || undefined,
          batchNumber: l.batchNumber || undefined,
          lotNumber: l.lotNumber || undefined,
          notes: l.notes || undefined,
        })),
      }
      const res = await createCrud('/api/purchasing/goods-receipts', payload)
      if (res?.id) {
        flash.success(t('common.created', 'Created'))
        router.push(`/backend/purchasing/goods-receipts/${res.id}`)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Page>
      <PageBody>
        <div className="max-w-4xl">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-lg font-semibold">{t('purchasing.goodsReceipts.create', 'New Goods Receipt')}</h1>
            <Button type="button" variant="outline" size="sm" onClick={() => router.push('/backend/purchasing/goods-receipts')}>
              {t('common.cancel', 'Cancel')}
            </Button>
          </div>

          {/* Header Fields */}
          <div className="rounded-lg border border-border p-4 mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{t('purchasing.goodsReceipts.fields.purchaseOrder', 'Purchase Order')} *</Label>
                <ComboboxInput
                  value={purchaseOrderId}
                  onChange={setPurchaseOrderId}
                  loadSuggestions={loadPOOptions}
                  allowCustomValues={false}
                  placeholder={t('purchasing.goodsReceipts.fields.poPlaceholder', 'Search purchase orders...')}
                />
              </div>
              <div>
                <Label>{t('purchasing.goodsReceipts.fields.receiptDate', 'Receipt Date')} *</Label>
                <Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{t('purchasing.goodsReceipts.fields.warehouse', 'Warehouse')}</Label>
                <ComboboxInput
                  value={warehouseId}
                  onChange={setWarehouseId}
                  loadSuggestions={loadWarehouseOptions}
                  allowCustomValues={false}
                  placeholder={t('purchasing.goodsReceipts.fields.warehousePlaceholder', 'Select warehouse...')}
                />
              </div>
              <div>
                <Label>{t('purchasing.goodsReceipts.fields.notes', 'Notes')}</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
            </div>
          </div>

          {/* Receive Lines */}
          {purchaseOrderId && (
            <div className="rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold mb-3">
                {t('purchasing.goodsReceipts.receiveLines.title', 'Receive Against PO Lines')}
              </h3>

              {linesLoading ? (
                <LoadingMessage />
              ) : receiveLines.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {t('purchasing.goodsReceipts.receiveLines.empty', 'No lines found for this purchase order.')}
                </p>
              ) : (
                <div className="space-y-3">
                  {receiveLines.map((line, i) => (
                    <div key={line.purchaseOrderLineId} className="rounded border border-border/50 p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="font-medium text-sm">{line.productName}</span>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {t('purchasing.goodsReceipts.receiveLines.ordered', 'Ordered')}: {line.orderedQty}
                            {' · '}
                            {t('purchasing.goodsReceipts.receiveLines.received', 'Already Received')}: {line.alreadyReceived}
                            {' · '}
                            {t('purchasing.goodsReceipts.receiveLines.remaining', 'Remaining')}: {line.remainingQty}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div>
                          <Label className="text-xs">{t('purchasing.goodsReceipts.receiveLines.receiveQty', 'Receive Qty')}</Label>
                          <Input
                            value={line.receivedQuantity}
                            onChange={(e) => {
                              updateLine(i, 'receivedQuantity', e.target.value)
                              updateLine(i, 'acceptedQuantity', e.target.value)
                            }}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">{t('purchasing.goodsReceipts.receiveLines.rejected', 'Rejected')}</Label>
                          <Input value={line.rejectedQuantity} onChange={(e) => updateLine(i, 'rejectedQuantity', e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-xs">{t('purchasing.goodsReceipts.receiveLines.batch', 'Batch #')}</Label>
                          <Input value={line.batchNumber} onChange={(e) => updateLine(i, 'batchNumber', e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-xs">{t('purchasing.goodsReceipts.receiveLines.lot', 'Lot #')}</Label>
                          <Input value={line.lotNumber} onChange={(e) => updateLine(i, 'lotNumber', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <Button type="button" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? t('common.creating', 'Creating...') : t('common.create', 'Create Goods Receipt')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </PageBody>
    </Page>
  )
}
