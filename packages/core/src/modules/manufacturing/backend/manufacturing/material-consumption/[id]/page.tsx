"use client"

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowDownToLine, Undo2, Trash2 } from 'lucide-react'
import { Page, PageBody } from '@wantace/ui/backend/Page'
import { CrudForm, type CrudFormField, type CrudFormGroup } from '@wantace/ui/backend/CrudForm'
import { updateCrud, deleteCrud } from '@wantace/ui/backend/utils/crud'
import { LoadingMessage, ErrorMessage } from '@wantace/ui/backend/detail'
import { useT } from '@wantace/shared/lib/i18n/context'
import { flash } from '@wantace/ui/backend/FlashMessages'
import { apiCallOrThrow, apiCall } from '@wantace/ui/backend/utils/apiCall'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@wantace/ui/primitives/button'
import { StatusBadge } from '@wantace/ui/primitives/status-badge'

type MaterialConsumptionDetail = {
  id: string; production_order_id: string; bom_line_id?: string | null;
  product_variant_id: string; product_name: string; product_sku?: string | null;
  planned_quantity: string; actual_quantity: string; wastage_quantity: string;
  unit_of_measure?: string | null; unit_cost_cents: number; status: string;
  warehouse_id?: string | null; lot_id?: string | null;
  issued_at?: string | null; issued_by?: string | null;
  notes?: string | null; updated_at?: string | null
}

type POSummary = { id: string; order_number: string; product_name: string }

const statusVariantMap: Record<string, 'success' | 'warning' | 'neutral' | 'error'> = {
  planned: 'neutral', issued: 'success', returned: 'warning', scrapped: 'error',
}

export default function MaterialConsumptionDetailPage() {
  const t = useT()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const queryClient = useQueryClient()

  const { data: mc, isLoading, error } = useQuery({
    queryKey: ['mfg-material-consumption', id],
    queryFn: async () => {
      const res = await apiCallOrThrow(`/api/manufacturing/material-consumption?id=${id}`)
      const items = (res as { items: MaterialConsumptionDetail[] }).items
      if (!items?.length) throw new Error('Not found')
      return items[0]
    },
  })

  const { data: po } = useQuery({
    queryKey: ['mfg-mc-po', mc?.production_order_id],
    queryFn: async () => {
      const res = await apiCall(`/api/manufacturing/production-orders?id=${encodeURIComponent(mc!.production_order_id)}`)
      const items = (res as { items?: POSummary[] })?.items ?? []
      return items[0] ?? null
    },
    enabled: !!mc?.production_order_id,
  })

  const handleIssue = async () => {
    if (!mc) return
    try {
      await updateCrud('/api/manufacturing/material-consumption', { id, status: 'issued', actualQuantity: mc.planned_quantity })
      flash.success(t('manufacturing.materialConsumption.issued', 'Material issued'))
      queryClient.invalidateQueries({ queryKey: ['mfg-material-consumption', id] })
    } catch {
      flash.error(t('manufacturing.materialConsumption.issueError', 'Failed to issue'))
    }
  }

  const handleReturn = async () => {
    if (!mc) return
    try {
      await updateCrud('/api/manufacturing/material-consumption', { id, status: 'returned' })
      flash.success(t('manufacturing.materialConsumption.returned', 'Material returned'))
      queryClient.invalidateQueries({ queryKey: ['mfg-material-consumption', id] })
    } catch {
      flash.error(t('manufacturing.materialConsumption.returnError', 'Failed to return'))
    }
  }

  const handleScrap = async () => {
    if (!mc) return
    try {
      await updateCrud('/api/manufacturing/material-consumption', { id, status: 'scrapped' })
      flash.success(t('manufacturing.materialConsumption.scrapped', 'Material scrapped'))
      queryClient.invalidateQueries({ queryKey: ['mfg-material-consumption', id] })
    } catch {
      flash.error(t('manufacturing.materialConsumption.scrapError', 'Failed to scrap'))
    }
  }

  const fields = React.useMemo<CrudFormField[]>(() => [
    { name: 'actualQuantity', label: t('manufacturing.materialConsumption.fields.actualQuantity', 'Actual Quantity'), type: 'text', group: 'quantity', layout: 'third' as const },
    { name: 'wastageQuantity', label: t('manufacturing.materialConsumption.fields.wastageQuantity', 'Wastage Quantity'), type: 'text', group: 'quantity', layout: 'third' as const },
    {
      name: 'status', label: t('manufacturing.materialConsumption.fields.status', 'Status'),
      type: 'select', group: 'quantity', layout: 'third' as const,
      options: [
        { value: 'planned', label: t('manufacturing.materialConsumption.status.planned', 'Planned') },
        { value: 'issued', label: t('manufacturing.materialConsumption.status.issued', 'Issued') },
        { value: 'returned', label: t('manufacturing.materialConsumption.status.returned', 'Returned') },
        { value: 'scrapped', label: t('manufacturing.materialConsumption.status.scrapped', 'Scrapped') },
      ],
    },
    { name: 'notes', label: t('manufacturing.materialConsumption.fields.notes', 'Notes'), type: 'textarea', group: 'notes' },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'quantity', label: t('manufacturing.materialConsumption.groups.quantity', 'Quantity & Status') },
    { id: 'notes', label: t('manufacturing.materialConsumption.groups.notes', 'Notes') },
  ], [t])

  if (isLoading) return <LoadingMessage />
  if (error || !mc) return <ErrorMessage message="Material consumption record not found" />

  const variance = Number(mc.actual_quantity) - Number(mc.planned_quantity)
  const totalCost = Number(mc.actual_quantity) * mc.unit_cost_cents

  return (
    <Page>
      <PageBody>
        {/* Material info header */}
        <div className="mb-6 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">{mc.product_name}</h2>
            <StatusBadge variant={statusVariantMap[mc.status] ?? 'neutral'}>
              {t(`manufacturing.materialConsumption.status.${mc.status}`, mc.status)}
            </StatusBadge>
          </div>
          {mc.product_sku && <p className="text-sm text-muted-foreground mb-3">{t('manufacturing.materialConsumption.fields.productSku', 'SKU')}: {mc.product_sku}</p>}

          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <span className="text-muted-foreground">{t('manufacturing.materialConsumption.fields.plannedQuantity', 'Planned')}:</span>
              <span className="ml-1 font-medium tabular-nums">{Number(mc.planned_quantity).toFixed(4)}</span>
              {mc.unit_of_measure && <span className="ml-1 text-muted-foreground">{mc.unit_of_measure}</span>}
            </div>
            <div>
              <span className="text-muted-foreground">{t('manufacturing.materialConsumption.fields.actualQuantity', 'Actual')}:</span>
              <span className="ml-1 font-medium tabular-nums">{Number(mc.actual_quantity).toFixed(4)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('manufacturing.materialConsumption.fields.wastageQuantity', 'Wastage')}:</span>
              <span className="ml-1 font-medium tabular-nums">{Number(mc.wastage_quantity).toFixed(4)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('manufacturing.materialConsumption.variance', 'Variance')}:</span>
              <span className={`ml-1 font-medium tabular-nums ${variance > 0 ? 'text-status-error-text' : variance < 0 ? 'text-status-success-text' : ''}`}>
                {variance > 0 ? '+' : ''}{variance.toFixed(4)}
              </span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <span className="text-muted-foreground">{t('manufacturing.materialConsumption.fields.unitCost', 'Unit Cost')}:</span>
              <span className="ml-1 tabular-nums">{(mc.unit_cost_cents / 100).toFixed(2)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('manufacturing.materialConsumption.totalCost', 'Total Cost')}:</span>
              <span className="ml-1 font-medium tabular-nums">{(totalCost / 100).toFixed(2)}</span>
            </div>
            {mc.issued_at && (
              <div>
                <span className="text-muted-foreground">{t('manufacturing.materialConsumption.issuedAt', 'Issued')}:</span>
                <span className="ml-1">{new Date(mc.issued_at).toLocaleString()}</span>
              </div>
            )}
          </div>

          {po && (
            <div className="mt-3 text-sm">
              <span className="text-muted-foreground">{t('manufacturing.materialConsumption.productionOrder', 'Production Order')}:</span>{' '}
              <Link href={`/backend/manufacturing/production-orders/${po.id}`} className="text-primary hover:underline">
                {po.order_number} — {po.product_name}
              </Link>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="mb-6 flex gap-2">
          {mc.status === 'planned' && (
            <Button type="button" variant="outline" onClick={handleIssue}>
              <ArrowDownToLine className="mr-1 size-4" />{t('manufacturing.materialConsumption.issue', 'Issue Material')}
            </Button>
          )}
          {mc.status === 'issued' && (
            <>
              <Button type="button" variant="outline" onClick={handleReturn}>
                <Undo2 className="mr-1 size-4" />{t('manufacturing.materialConsumption.return', 'Return Material')}
              </Button>
              <Button type="button" variant="outline" onClick={handleScrap}>
                <Trash2 className="mr-1 size-4" />{t('manufacturing.materialConsumption.scrap', 'Mark as Scrapped')}
              </Button>
            </>
          )}
        </div>

        {/* Edit form */}
        <CrudForm
          title={t('manufacturing.materialConsumption.editQuantities', 'Update Quantities')}
          backHref="/backend/manufacturing/material-consumption"
          fields={fields}
          groups={groups}
          initialValues={{
            actualQuantity: mc.actual_quantity,
            wastageQuantity: mc.wastage_quantity,
            status: mc.status,
            notes: mc.notes ?? '',
            updatedAt: mc.updated_at ?? undefined,
          }}
          submitLabel={t('common.save', 'Save')}
          cancelHref="/backend/manufacturing/material-consumption"
          onSubmit={async (values) => {
            await updateCrud('/api/manufacturing/material-consumption', { id, ...values })
            flash.success(t('common.saved', 'Saved'))
            queryClient.invalidateQueries({ queryKey: ['mfg-material-consumption', id] })
          }}
          onDelete={mc.status !== 'issued' ? async () => {
            await deleteCrud('/api/manufacturing/material-consumption', id)
            flash.success(t('common.deleted', 'Deleted'))
            router.push('/backend/manufacturing/material-consumption')
          } : undefined}
        />
      </PageBody>
    </Page>
  )
}
