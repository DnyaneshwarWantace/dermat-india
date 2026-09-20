'use client'

import * as React from 'react'
import Link from 'next/link'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Card, CardContent, CardHeader, CardTitle } from '@open-mercato/ui/primitives/card'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Checkbox } from '@open-mercato/ui/primitives/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@open-mercato/ui/primitives/select'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall, withScopedApiRequestHeaders } from '@open-mercato/ui/backend/utils/apiCall'
import { buildOptimisticLockHeader } from '@open-mercato/ui/backend/utils/optimisticLock'
import { surfaceRecordConflict } from '@open-mercato/ui/backend/conflicts'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { LoadingMessage, ErrorMessage, RecordNotFoundState } from '@open-mercato/ui/backend/detail'
import { PO_STATUSES } from '../../../data/validators'

type PurchaseOrderData = {
  id: string
  po_number: string
  department: 'rm_store' | 'pm_store'
  vendor_id: string
  bom_id: string | null
  gst_number: string | null
  payment_terms: string | null
  po_date: string
  delivery_date: string | null
  status: string
  updated_at: string
}

type PurchaseOrderLineRow = {
  id: string
  purchase_order_id: string
  line_kind: 'raw_material' | 'packaging_material'
  raw_material_id: string | null
  packaging_material_id: string | null
  component_code: string | null
  quantity: string | number
  pack: string | number | null
  free_quantity: string | number
  mrp: string | number | null
  unit: string
  received_quantity: string | number
  qc_approved: boolean
  qc_approved_at: string | null
  updated_at: string
}

type VendorInfo = { id: string; name: string }

export default function PurchaseOrderDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const id = params?.id

  const [po, setPo] = React.useState<PurchaseOrderData | null>(null)
  const [vendor, setVendor] = React.useState<VendorInfo | null>(null)
  const [lines, setLines] = React.useState<PurchaseOrderLineRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isNotFound, setIsNotFound] = React.useState(false)
  const [reloadToken, setReloadToken] = React.useState(0)

  React.useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const poCall = await apiCall<{ items: PurchaseOrderData[] }>(`/api/dermat_purchase_orders/purchase-orders?id=${id}`)
        if (!poCall.ok) {
          if (!cancelled) setError(t('dermat_purchase_orders.detail.errors.load', 'Failed to load purchase order'))
          return
        }
        const found = poCall.result?.items?.[0]
        if (!found) {
          if (!cancelled) setIsNotFound(true)
          return
        }

        const linesCall = await apiCall<{ items: PurchaseOrderLineRow[] }>(
          `/api/dermat_purchase_orders/purchase-order-lines?purchaseOrderId=${id}&pageSize=100`,
        )
        const vendorCall = await apiCall<{ items: VendorInfo[] }>(`/api/dermat_vendors/vendors?id=${found.vendor_id}`)

        if (!cancelled) {
          setPo(found)
          setLines(linesCall.ok ? linesCall.result?.items ?? [] : [])
          setVendor(vendorCall.ok ? vendorCall.result?.items?.[0] ?? null : null)
        }
      } catch (err) {
        if (!cancelled) setError(t('dermat_purchase_orders.detail.errors.load', 'Failed to load purchase order'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id, reloadToken, t])

  const handleStatusChange = React.useCallback(
    async (next: string) => {
      if (!po) return
      try {
        await withScopedApiRequestHeaders(
          buildOptimisticLockHeader(po.updated_at),
          () => updateCrud('dermat_purchase_orders/purchase-orders', { id: po.id, status: next }),
        )
        setReloadToken((tokenValue) => tokenValue + 1)
      } catch (error) {
        if (surfaceRecordConflict(error, t, { onRefresh: () => setReloadToken((tokenValue) => tokenValue + 1) })) return
        flash(t('dermat_purchase_orders.flash.updateError', 'Failed to update purchase order'), 'error')
        setReloadToken((tokenValue) => tokenValue + 1)
      }
    },
    [po, t],
  )

  const handleReceivedQuantityChange = React.useCallback(
    async (row: PurchaseOrderLineRow, value: string) => {
      const numeric = value.trim().length ? Number(value) : 0
      if (Number.isNaN(numeric) || numeric < 0) {
        flash(t('dermat_purchase_orders.flash.invalidQuantity', 'Enter a valid received quantity'), 'error')
        setReloadToken((tokenValue) => tokenValue + 1)
        return
      }
      try {
        await withScopedApiRequestHeaders(
          buildOptimisticLockHeader(row.updated_at),
          () => updateCrud('dermat_purchase_orders/purchase-order-lines', { id: row.id, receivedQuantity: numeric }),
        )
        setReloadToken((tokenValue) => tokenValue + 1)
      } catch (error) {
        if (surfaceRecordConflict(error, t, { onRefresh: () => setReloadToken((tokenValue) => tokenValue + 1) })) return
        flash(t('dermat_purchase_orders.flash.lineUpdateError', 'Failed to update line'), 'error')
        setReloadToken((tokenValue) => tokenValue + 1)
      }
    },
    [t],
  )

  const handleQcApprove = React.useCallback(
    async (row: PurchaseOrderLineRow, checked: boolean) => {
      try {
        await withScopedApiRequestHeaders(
          buildOptimisticLockHeader(row.updated_at),
          () => updateCrud('dermat_purchase_orders/purchase-order-lines', { id: row.id, qcApproved: checked }),
        )
        flash(
          checked
            ? t('dermat_purchase_orders.flash.qcApproved', 'QC approved — stock updated')
            : t('dermat_purchase_orders.flash.qcUnapproved', 'QC approval removed'),
          'success',
        )
        setReloadToken((tokenValue) => tokenValue + 1)
      } catch (error) {
        if (surfaceRecordConflict(error, t, { onRefresh: () => setReloadToken((tokenValue) => tokenValue + 1) })) return
        flash(t('dermat_purchase_orders.flash.lineUpdateError', 'Failed to update line'), 'error')
        setReloadToken((tokenValue) => tokenValue + 1)
      }
    },
    [t],
  )

  if (loading) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('dermat_purchase_orders.detail.loading', 'Loading...')} />
        </PageBody>
      </Page>
    )
  }

  if (isNotFound) {
    return (
      <Page>
        <PageBody>
          <RecordNotFoundState
            label={t('dermat_purchase_orders.detail.errors.notFound', 'Purchase order not found.')}
            backHref={po?.bom_id ? `/backend/dermat_bom/${po.bom_id}` : '/backend/dermat_bom'}
            backLabel={t('dermat_purchase_orders.detail.backToBom', 'Back to BOM')}
          />
        </PageBody>
      </Page>
    )
  }

  if (error || !po) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={error ?? t('dermat_purchase_orders.detail.errors.notFound', 'Purchase order not found.')} />
        </PageBody>
      </Page>
    )
  }

  return (
    <Page>
      <PageBody>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">{po.po_number}</h1>
              <p className="text-sm text-muted-foreground">
                {vendor?.name ?? t('dermat_purchase_orders.detail.noVendor', 'No vendor')}
                {' · '}
                {po.department === 'rm_store' ? t('dermat_purchase_orders.detail.rmStore', 'RM Store') : t('dermat_purchase_orders.detail.pmStore', 'PM Store')}
                {' · '}
                {po.po_date}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={po.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PO_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {po.bom_id ? (
                <Button asChild variant="outline">
                  <Link href={`/backend/dermat_bom/${po.bom_id}`}>{t('dermat_purchase_orders.detail.backToBom', 'Back to BOM')}</Link>
                </Button>
              ) : null}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('dermat_purchase_orders.detail.lines', 'Line items')}</CardTitle>
            </CardHeader>
            <CardContent>
              {lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('dermat_purchase_orders.detail.empty', 'No line items yet.')}</p>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground font-semibold">
                        <th className="py-2.5 pr-3">Material / Component</th>
                        <th className="py-2.5 pr-3 text-right">Ordered Qty</th>
                        <th className="py-2.5 pr-3 text-center">UOM / Pack</th>
                        <th className="py-2.5 pr-3 text-right">Received Qty (GRN)</th>
                        <th className="py-2.5 pr-3 text-center">QC Approval</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => (
                        <tr key={line.id} className="border-b border-border/60 align-middle hover:bg-muted/10">
                          <td className="py-2.5 pr-3 font-semibold text-foreground">{line.component_code || 'Material Item'}</td>
                          <td className="py-2.5 pr-3 text-right font-bold text-foreground">{line.quantity}</td>
                          <td className="py-2.5 pr-3 text-center font-mono text-xs">{line.unit || line.pack || 'Kg'}</td>
                          <td className="py-2.5 pr-3 text-right">
                            <Input
                              type="number"
                              min={0}
                              step="0.0001"
                              defaultValue={String(line.received_quantity)}
                              disabled={line.qc_approved}
                              onBlur={(event) => {
                                if (event.target.value !== String(line.received_quantity)) handleReceivedQuantityChange(line, event.target.value)
                              }}
                              className="h-8 w-28 text-right font-mono font-semibold ml-auto"
                            />
                          </td>
                          <td className="py-2.5 pr-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Checkbox
                                checked={line.qc_approved}
                                onCheckedChange={(checked) => handleQcApprove(line, checked === true)}
                              />
                              {line.qc_approved ? (
                                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                  QC PASS
                                </span>
                              ) : (
                                <span className="text-[11px] text-amber-600 font-medium">Under Test</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </Page>
  )
}
