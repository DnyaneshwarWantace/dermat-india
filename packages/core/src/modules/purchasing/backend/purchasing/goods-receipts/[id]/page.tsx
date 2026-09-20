"use client"

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle } from 'lucide-react'
import { Page, PageBody } from '@wantace/ui/backend/Page'
import { LoadingMessage, ErrorMessage } from '@wantace/ui/backend/detail'
import { useT } from '@wantace/shared/lib/i18n/context'
import { flash } from '@wantace/ui/backend/FlashMessages'
import { apiCallOrThrow } from '@wantace/ui/backend/utils/apiCall'
import { updateCrud } from '@wantace/ui/backend/utils/crud'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@wantace/ui/primitives/button'
import { StatusBadge } from '@wantace/ui/primitives/status-badge'

type GRDetail = {
  id: string
  receipt_number: string
  purchase_order_id: string
  status: string
  receipt_date?: string | null
  warehouse_id?: string | null
  received_by_user_id?: string | null
  notes?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type GRLineItem = {
  id: string
  product_name: string
  received_quantity?: string | null
  accepted_quantity?: string | null
  rejected_quantity?: string | null
  batch_number?: string | null
  lot_number?: string | null
  expiry_date?: string | null
  notes?: string | null
}

export default function GoodsReceiptDetailPage() {
  const t = useT()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const queryClient = useQueryClient()
  const [completing, setCompleting] = React.useState(false)

  const { data: gr, isLoading, error } = useQuery({
    queryKey: ['purchasing-gr', id],
    queryFn: async () => {
      const res = await apiCallOrThrow(`/api/purchasing/goods-receipts?id=${id}`)
      const items = (res as { items: GRDetail[] }).items
      if (!items?.length) throw new Error('Not found')
      return items[0]
    },
  })

  const { data: grLines } = useQuery({
    queryKey: ['purchasing-gr-lines', id],
    queryFn: async () => {
      const res = await apiCallOrThrow(`/api/purchasing/goods-receipt-lines?goodsReceiptId=${id}&pageSize=100`)
      return (res as { items: GRLineItem[] }).items ?? []
    },
    enabled: !!id,
  })

  const handleComplete = async () => {
    setCompleting(true)
    try {
      await updateCrud('/api/purchasing/goods-receipts', { id })
      flash.success(t('purchasing.goodsReceipts.completed', 'Goods receipt completed'))
      queryClient.invalidateQueries({ queryKey: ['purchasing-gr', id] })
    } catch {
      flash.error(t('purchasing.goodsReceipts.completeError', 'Failed to complete goods receipt'))
    } finally {
      setCompleting(false)
    }
  }

  if (isLoading) return <LoadingMessage />
  if (error || !gr) return <ErrorMessage message="Goods receipt not found" />

  const isDraft = gr.status === 'draft'
  const statusVariant = gr.status === 'completed' ? 'success' : gr.status === 'cancelled' ? 'error' : 'neutral'

  return (
    <Page>
      <PageBody>
        <div className="max-w-4xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold">{gr.receipt_number}</h1>
                <StatusBadge variant={statusVariant}>
                  {t(`purchasing.goodsReceipts.status.${gr.status}`, gr.status)}
                </StatusBadge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {gr.receipt_date && `${t('purchasing.goodsReceipts.fields.receiptDate', 'Receipt Date')}: ${gr.receipt_date.slice(0, 10)}`}
              </p>
            </div>
            <div className="flex gap-2">
              {isDraft && (
                <Button type="button" onClick={handleComplete} disabled={completing}>
                  <CheckCircle className="mr-1 size-4" />
                  {completing
                    ? t('purchasing.goodsReceipts.completing', 'Completing...')
                    : t('purchasing.goodsReceipts.complete', 'Complete Receipt')}
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => router.push('/backend/purchasing/goods-receipts')}>
                {t('common.back', 'Back')}
              </Button>
            </div>
          </div>

          {/* Info Card */}
          <div className="rounded-lg border border-border p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">{t('purchasing.goodsReceipts.fields.purchaseOrder', 'Purchase Order')}</span>
                <div className="mt-1">
                  <Link href={`/backend/purchasing/purchase-orders/${gr.purchase_order_id}`} className="text-accent-foreground hover:underline">
                    {t('purchasing.goodsReceipts.viewPO', 'View Purchase Order')}
                  </Link>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">{t('purchasing.goodsReceipts.fields.receiptDate', 'Receipt Date')}</span>
                <div className="mt-1 font-medium">{gr.receipt_date?.slice(0, 10) ?? '—'}</div>
              </div>
              <div>
                <span className="text-muted-foreground">{t('purchasing.goodsReceipts.fields.status', 'Status')}</span>
                <div className="mt-1">
                  <StatusBadge variant={statusVariant}>
                    {t(`purchasing.goodsReceipts.status.${gr.status}`, gr.status)}
                  </StatusBadge>
                </div>
              </div>
            </div>
            {gr.notes && (
              <div className="mt-4 pt-4 border-t text-sm">
                <span className="text-muted-foreground">{t('purchasing.goodsReceipts.fields.notes', 'Notes')}</span>
                <p className="mt-1">{gr.notes}</p>
              </div>
            )}
          </div>

          {/* Lines */}
          <div className="rounded-lg border border-border p-4">
            <h3 className="text-sm font-semibold mb-3">
              {t('purchasing.goodsReceipts.lines.title', 'Received Items')}
              <span className="ml-2 text-xs text-muted-foreground font-normal tabular-nums">
                ({grLines?.length ?? 0})
              </span>
            </h3>

            {!grLines?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {t('purchasing.goodsReceipts.lines.empty', 'No line items.')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 font-medium">{t('purchasing.goodsReceipts.lines.product', 'Product')}</th>
                      <th className="pb-2 font-medium text-right tabular-nums">{t('purchasing.goodsReceipts.lines.received', 'Received')}</th>
                      <th className="pb-2 font-medium text-right tabular-nums">{t('purchasing.goodsReceipts.lines.accepted', 'Accepted')}</th>
                      <th className="pb-2 font-medium text-right tabular-nums">{t('purchasing.goodsReceipts.lines.rejected', 'Rejected')}</th>
                      <th className="pb-2 font-medium">{t('purchasing.goodsReceipts.lines.batch', 'Batch')}</th>
                      <th className="pb-2 font-medium">{t('purchasing.goodsReceipts.lines.lot', 'Lot')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grLines.map((line) => (
                      <tr key={line.id} className="border-b border-border/50">
                        <td className="py-2">{line.product_name}</td>
                        <td className="py-2 text-right tabular-nums">{line.received_quantity ?? '—'}</td>
                        <td className="py-2 text-right tabular-nums">{line.accepted_quantity ?? '—'}</td>
                        <td className="py-2 text-right tabular-nums">{line.rejected_quantity ?? '0'}</td>
                        <td className="py-2 text-muted-foreground">{line.batch_number ?? '—'}</td>
                        <td className="py-2 text-muted-foreground">{line.lot_number ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </PageBody>
    </Page>
  )
}
