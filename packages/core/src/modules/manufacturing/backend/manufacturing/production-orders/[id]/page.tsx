"use client"

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Play, CheckCircle, Package, ArrowDownToLine, Undo2 } from 'lucide-react'
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
import { StatusBadge } from '@wantace/ui/primitives/status-badge'

type ProductionOrderDetail = {
  id: string; order_number: string;
  sales_order_id?: string | null; sales_order_number?: string | null;
  bom_id: string; bom_name: string;
  product_variant_id: string; product_name: string;
  planned_quantity: string; produced_quantity: string; rejected_quantity: string;
  unit_of_measure?: string | null; status: string; priority: string;
  planned_start_date?: string | null; planned_end_date?: string | null;
  actual_start_date?: string | null; actual_end_date?: string | null;
  warehouse_id?: string | null;
  material_cost_cents: number; labor_cost_cents: number; overhead_cost_cents: number; total_cost_cents: number;
  notes?: string | null; updated_at?: string | null
}

type BomLineItem = {
  id: string; product_variant_id: string; product_name: string;
  quantity: string; unit_of_measure?: string | null
}

type ProductionStageRow = {
  id: string; name: string; sequence_number: number; status: string;
  planned_quantity: string; produced_quantity: string; rejected_quantity: string;
  started_at?: string | null; completed_at?: string | null;
}

type MaterialConsumptionRow = {
  id: string; product_name: string; product_sku?: string | null;
  planned_quantity: string; actual_quantity: string; wastage_quantity: string;
  unit_of_measure?: string | null; status: string; updated_at?: string | null;
}

type MaterialAvailability = { name: string; required: number; available: number; short: number }
type WarehouseItem = { id: string; name: string; code: string }

const stageStatusVariant: Record<string, 'success' | 'warning' | 'neutral'> = {
  pending: 'neutral', in_progress: 'warning', completed: 'success', skipped: 'neutral',
}

function MaterialAvailabilityPanel({ bomId, plannedQuantity }: { bomId: string; plannedQuantity: number }) {
  const t = useT()

  const { data: materials, isLoading } = useQuery({
    queryKey: ['mfg-material-availability', bomId, plannedQuantity],
    queryFn: async () => {
      const bomLinesRes = await apiCall(`/api/manufacturing/bom-lines?bomId=${encodeURIComponent(bomId)}&pageSize=100`)
      const bomLines = (bomLinesRes as { items?: BomLineItem[] })?.items ?? []
      if (!bomLines.length) return []

      const results: MaterialAvailability[] = []
      for (const line of bomLines) {
        const requiredQty = Number(line.quantity) * plannedQuantity
        let availableQty = 0
        try {
          const invRes = await apiCall(`/api/wms/inventory-balances?productVariantId=${encodeURIComponent(line.product_variant_id)}&pageSize=1`)
          const invItems = (invRes as { items?: Array<{ available_quantity?: string | number }> })?.items ?? []
          availableQty = Number(invItems[0]?.available_quantity ?? 0)
        } catch { /* WMS may not be available */ }
        results.push({
          name: line.product_name || line.product_variant_id,
          required: requiredQty, available: availableQty,
          short: Math.max(0, requiredQty - availableQty),
        })
      }
      return results
    },
    enabled: !!bomId,
  })

  if (isLoading) return <div className="mt-6 rounded-lg border border-border p-4 text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</div>
  if (!materials?.length) return null

  const hasShortage = materials.some((m) => m.short > 0)

  return (
    <div className={`mt-6 rounded-lg border p-4 ${hasShortage ? 'border-status-error-border bg-status-error-bg/30' : 'border-status-success-border bg-status-success-bg/30'}`}>
      <h3 className="text-sm font-semibold mb-3">
        {t('manufacturing.productionOrders.materialAvailability', 'Material Availability')}
        {hasShortage && <span className="ml-2 text-status-error-text text-xs font-normal">({t('manufacturing.productionOrders.materialsShort', 'Shortages detected')})</span>}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-2 font-medium">{t('manufacturing.productionOrders.materialName', 'Material')}</th>
              <th className="pb-2 font-medium text-right tabular-nums">{t('manufacturing.productionOrders.materialRequired', 'Required')}</th>
              <th className="pb-2 font-medium text-right tabular-nums">{t('manufacturing.productionOrders.materialInStock', 'In Stock')}</th>
              <th className="pb-2 font-medium text-right tabular-nums">{t('manufacturing.productionOrders.materialShort', 'Short')}</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((m) => (
              <tr key={m.name} className="border-b border-border/50">
                <td className="py-2">{m.name}</td>
                <td className="py-2 text-right tabular-nums">{m.required.toFixed(2)}</td>
                <td className="py-2 text-right tabular-nums">{m.available.toFixed(2)}</td>
                <td className={`py-2 text-right font-medium tabular-nums ${m.short > 0 ? 'text-status-error-text' : 'text-status-success-text'}`}>
                  {m.short > 0 ? m.short.toFixed(2) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function ProductionOrderDetailPage() {
  const t = useT()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const queryClient = useQueryClient()

  const { data: po, isLoading, error } = useQuery({
    queryKey: ['mfg-production-order', id],
    queryFn: async () => {
      const res = await apiCallOrThrow(`/api/manufacturing/production-orders?id=${id}`)
      const items = (res as { items: ProductionOrderDetail[] }).items
      if (!items?.length) throw new Error('Not found')
      return items[0]
    },
  })

  const { data: stages } = useQuery({
    queryKey: ['mfg-po-stages', id],
    queryFn: async () => {
      const res = await apiCall(`/api/manufacturing/production-stages?productionOrderId=${encodeURIComponent(id)}&pageSize=50`)
      return ((res as { items?: ProductionStageRow[] })?.items ?? []).sort((a, b) => a.sequence_number - b.sequence_number)
    },
    enabled: !!id,
  })

  const updateStageStatus = async (stageId: string, status: 'in_progress' | 'completed') => {
    try {
      await updateCrud('/api/manufacturing/production-stages', { id: stageId, status })
      flash.success(status === 'completed' ? t('manufacturing.stages.completed', 'Stage completed') : t('manufacturing.stages.started', 'Stage started'))
      queryClient.invalidateQueries({ queryKey: ['mfg-po-stages', id] })
    } catch {
      flash.error(t('manufacturing.stages.updateError', 'Failed to update stage'))
    }
  }

  const { data: materials } = useQuery({
    queryKey: ['mfg-po-materials', id],
    queryFn: async () => {
      const res = await apiCall(`/api/manufacturing/material-consumption?productionOrderId=${encodeURIComponent(id)}&pageSize=100&sortField=productName&sortDir=asc`)
      return (res as { items?: MaterialConsumptionRow[] })?.items ?? []
    },
    enabled: !!id,
  })

  const issueMaterial = async (mcId: string, plannedQty: string) => {
    try {
      await updateCrud('/api/manufacturing/material-consumption', { id: mcId, status: 'issued', actualQuantity: plannedQty })
      flash.success(t('manufacturing.materialConsumption.issued', 'Material issued'))
      queryClient.invalidateQueries({ queryKey: ['mfg-po-materials', id] })
    } catch {
      flash.error(t('manufacturing.materialConsumption.issueError', 'Failed to issue material'))
    }
  }

  const issueAllMaterials = async () => {
    const planned = materials?.filter((m) => m.status === 'planned') ?? []
    if (!planned.length) return
    try {
      for (const m of planned) {
        await updateCrud('/api/manufacturing/material-consumption', { id: m.id, status: 'issued', actualQuantity: m.planned_quantity })
      }
      flash.success(t('manufacturing.materialConsumption.allIssued', 'All materials issued'))
      queryClient.invalidateQueries({ queryKey: ['mfg-po-materials', id] })
    } catch {
      flash.error(t('manufacturing.materialConsumption.issueError', 'Failed to issue material'))
    }
  }

  const returnMaterial = async (mcId: string) => {
    try {
      await updateCrud('/api/manufacturing/material-consumption', { id: mcId, status: 'returned' })
      flash.success(t('manufacturing.materialConsumption.returned', 'Material returned'))
      queryClient.invalidateQueries({ queryKey: ['mfg-po-materials', id] })
    } catch {
      flash.error(t('manufacturing.materialConsumption.returnError', 'Failed to return material'))
    }
  }

  const loadWarehouseOptions = React.useCallback(async (query?: string): Promise<CrudFieldOption[]> => {
    const params = new URLSearchParams({ page: '1', pageSize: '20' })
    if (query?.trim()) params.set('search', query.trim())
    const res = await apiCall(`/api/wms/warehouses?${params}`)
    const items = (res as { items?: WarehouseItem[] })?.items ?? []
    return items.map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` }))
  }, [])

  const resolveWarehouseLabel = React.useCallback(async (value: string): Promise<string> => {
    const res = await apiCall(`/api/wms/warehouses?id=${encodeURIComponent(value)}`)
    const items = (res as { items?: WarehouseItem[] })?.items ?? []
    return items.length ? `${items[0].code} — ${items[0].name}` : value
  }, [])

  const fields = React.useMemo<CrudBuiltinField[]>(() => [
    {
      id: 'bomDisplay', label: t('manufacturing.productionOrders.fields.bom', 'Bill of Materials'),
      type: 'text', group: 'basic', layout: 'half', readOnly: true,
    },
    {
      id: 'productDisplay', label: t('manufacturing.productionOrders.fields.productName', 'Product'),
      type: 'text', group: 'basic', layout: 'half', readOnly: true,
    },
    {
      id: 'salesOrderDisplay', label: t('manufacturing.productionOrders.fields.salesOrder', 'Sales Order'),
      type: 'text', group: 'basic', layout: 'half', readOnly: true,
    },
    {
      id: 'status', label: t('manufacturing.productionOrders.fields.status', 'Status'),
      type: 'select', group: 'basic', layout: 'half',
      options: [
        { value: 'draft', label: t('manufacturing.productionOrders.status.draft', 'Draft') },
        { value: 'planned', label: t('manufacturing.productionOrders.status.planned', 'Planned') },
        { value: 'in_progress', label: t('manufacturing.productionOrders.status.in_progress', 'In Progress') },
        { value: 'completed', label: t('manufacturing.productionOrders.status.completed', 'Completed') },
        { value: 'cancelled', label: t('manufacturing.productionOrders.status.cancelled', 'Cancelled') },
        { value: 'on_hold', label: t('manufacturing.productionOrders.status.on_hold', 'On Hold') },
      ],
    },
    {
      id: 'priority', label: t('manufacturing.productionOrders.fields.priority', 'Priority'),
      type: 'select', group: 'basic', layout: 'half',
      options: [
        { value: 'low', label: t('manufacturing.productionOrders.priority.low', 'Low') },
        { value: 'normal', label: t('manufacturing.productionOrders.priority.normal', 'Normal') },
        { value: 'high', label: t('manufacturing.productionOrders.priority.high', 'High') },
        { value: 'urgent', label: t('manufacturing.productionOrders.priority.urgent', 'Urgent') },
      ],
    },
    {
      id: 'plannedQuantity', label: t('manufacturing.productionOrders.fields.plannedQuantity', 'Planned Quantity'),
      type: 'text', required: true, group: 'quantity', layout: 'third',
    },
    {
      id: 'producedQuantity', label: t('manufacturing.productionOrders.fields.producedQuantity', 'Produced'),
      type: 'text', group: 'quantity', layout: 'third',
    },
    {
      id: 'rejectedQuantity', label: t('manufacturing.productionOrders.fields.rejectedQuantity', 'Rejected'),
      type: 'text', group: 'quantity', layout: 'third',
    },
    {
      id: 'unitOfMeasure', label: t('manufacturing.productionOrders.fields.unitOfMeasure', 'Unit of Measure'),
      type: 'text', group: 'quantity', layout: 'half',
    },
    {
      id: 'warehouseId', label: t('manufacturing.productionOrders.fields.warehouse', 'Warehouse'),
      type: 'combobox', group: 'quantity', layout: 'half',
      loadOptions: loadWarehouseOptions, allowCustomValues: false, resolveLabel: resolveWarehouseLabel,
      placeholder: t('manufacturing.productionOrders.fields.warehousePlaceholder', 'Select warehouse...'),
    },
    {
      id: 'plannedStartDate', label: t('manufacturing.productionOrders.fields.plannedStartDate', 'Planned Start'),
      type: 'date', group: 'schedule', layout: 'half',
    },
    {
      id: 'plannedEndDate', label: t('manufacturing.productionOrders.fields.plannedEndDate', 'Planned End'),
      type: 'date', group: 'schedule', layout: 'half',
    },
    {
      id: 'actualStartDate', label: t('manufacturing.productionOrders.fields.actualStartDate', 'Actual Start'),
      type: 'date', group: 'schedule', layout: 'half', readOnly: true,
    },
    {
      id: 'actualEndDate', label: t('manufacturing.productionOrders.fields.actualEndDate', 'Actual End'),
      type: 'date', group: 'schedule', layout: 'half', readOnly: true,
    },
    {
      id: 'notes', label: t('manufacturing.productionOrders.fields.notes', 'Notes'),
      type: 'textarea', group: 'notes',
    },
  ], [t, loadWarehouseOptions, resolveWarehouseLabel])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'basic', label: t('manufacturing.productionOrders.groups.basic', 'Basic Information') },
    { id: 'quantity', label: t('manufacturing.productionOrders.groups.quantity', 'Quantity & Warehouse') },
    { id: 'schedule', label: t('manufacturing.productionOrders.groups.schedule', 'Schedule') },
    { id: 'notes', label: t('manufacturing.productionOrders.groups.notes', 'Notes') },
  ], [t])

  if (isLoading) return <LoadingMessage />
  if (error || !po) return <ErrorMessage message="Production order not found" />

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={`${t('manufacturing.productionOrders.edit', 'Edit Production Order')} — ${po.order_number}`}
          backHref="/backend/manufacturing/production-orders"
          fields={fields}
          groups={groups}
          initialValues={{
            bomDisplay: `${po.bom_name}`,
            productDisplay: po.product_name,
            salesOrderDisplay: po.sales_order_number || t('common.none', '—'),
            status: po.status, priority: po.priority,
            plannedQuantity: po.planned_quantity, producedQuantity: po.produced_quantity,
            rejectedQuantity: po.rejected_quantity,
            unitOfMeasure: po.unit_of_measure ?? '',
            warehouseId: po.warehouse_id ?? '',
            plannedStartDate: po.planned_start_date ?? '',
            plannedEndDate: po.planned_end_date ?? '',
            actualStartDate: po.actual_start_date ?? '',
            actualEndDate: po.actual_end_date ?? '',
            notes: po.notes ?? '',
            updatedAt: po.updated_at ?? undefined,
          }}
          submitLabel={t('common.save', 'Save')}
          cancelHref="/backend/manufacturing/production-orders"
          onSubmit={async (values) => {
            const { bomDisplay, productDisplay, salesOrderDisplay, ...submitValues } = values as Record<string, unknown>
            await updateCrud('/api/manufacturing/production-orders', { id, ...submitValues })
            flash.success(t('common.saved', 'Saved'))
            router.push('/backend/manufacturing/production-orders')
          }}
          onDelete={async () => {
            await deleteCrud('/api/manufacturing/production-orders', id)
            flash.success(t('common.deleted', 'Deleted'))
            router.push('/backend/manufacturing/production-orders')
          }}
        />

        <div className="mt-6 rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold mb-2">{t('manufacturing.productionOrders.costSummary', 'Cost Summary')}</h3>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div><span className="text-muted-foreground">{t('manufacturing.productionOrders.fields.materialCost', 'Material')}:</span> {(po.material_cost_cents / 100).toFixed(2)}</div>
            <div><span className="text-muted-foreground">{t('manufacturing.productionOrders.fields.laborCost', 'Labor')}:</span> {(po.labor_cost_cents / 100).toFixed(2)}</div>
            <div><span className="text-muted-foreground">{t('manufacturing.productionOrders.fields.overheadCost', 'Overhead')}:</span> {(po.overhead_cost_cents / 100).toFixed(2)}</div>
            <div><span className="font-semibold">{t('manufacturing.productionOrders.fields.totalCost', 'Total')}:</span> {(po.total_cost_cents / 100).toFixed(2)}</div>
          </div>
        </div>

        {/* Production Stages */}
        <div className="mt-6 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">
              {t('manufacturing.productionOrders.stages', 'Production Stages')}
              <span className="ml-2 text-xs text-muted-foreground font-normal tabular-nums">
                ({stages?.filter((s) => s.status === 'completed').length ?? 0}/{stages?.length ?? 0} {t('manufacturing.productionOrders.stagesCompleted', 'completed')})
              </span>
            </h3>
            <Link href={`/backend/manufacturing/production-orders/${id}/tracking`}>
              <Button type="button" variant="outline" size="sm">
                {t('manufacturing.productionOrders.viewTracking', 'View Tracking')}
              </Button>
            </Link>
          </div>

          {!stages?.length ? (
            <p className="text-sm text-muted-foreground py-2 text-center">
              {t('manufacturing.productionOrders.noStages', 'No stages yet. Configure Stage Templates to auto-generate stages on new orders.')}
            </p>
          ) : (
            <div className="space-y-2">
              {stages.map((stage) => (
                <div key={stage.id} className="flex items-center justify-between rounded border border-border/50 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground tabular-nums w-5">#{stage.sequence_number}</span>
                    <span className="text-sm font-medium">{stage.name}</span>
                    <StatusBadge variant={stageStatusVariant[stage.status] ?? 'neutral'}>
                      {t(`manufacturing.productionStages.status.${stage.status}`, stage.status.replace('_', ' '))}
                    </StatusBadge>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {Number(stage.produced_quantity)}/{Number(stage.planned_quantity)}
                    </span>
                    {stage.status === 'pending' && (
                      <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => updateStageStatus(stage.id, 'in_progress')}>
                        <Play className="mr-1 size-3" />{t('manufacturing.stages.start', 'Start')}
                      </Button>
                    )}
                    {stage.status === 'in_progress' && (
                      <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => updateStageStatus(stage.id, 'completed')}>
                        <CheckCircle className="mr-1 size-3" />{t('manufacturing.stages.complete', 'Complete')}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Material Consumption */}
        <div className="mt-6 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">
              <Package className="mr-1 inline size-4" />
              {t('manufacturing.productionOrders.materials', 'Materials')}
              <span className="ml-2 text-xs text-muted-foreground font-normal tabular-nums">
                ({materials?.filter((m) => m.status === 'issued').length ?? 0}/{materials?.length ?? 0} {t('manufacturing.productionOrders.materialsIssued', 'issued')})
              </span>
            </h3>
            {(materials?.some((m) => m.status === 'planned') ?? false) && (
              <Button type="button" variant="outline" size="sm" onClick={issueAllMaterials}>
                <ArrowDownToLine className="mr-1 size-3" />{t('manufacturing.materialConsumption.issueAll', 'Issue All')}
              </Button>
            )}
          </div>

          {!materials?.length ? (
            <p className="text-sm text-muted-foreground py-2 text-center">
              {t('manufacturing.productionOrders.noMaterials', 'No material consumption records. They are auto-generated from BOM lines when creating a production order.')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 font-medium">{t('manufacturing.materialConsumption.fields.productName', 'Material')}</th>
                    <th className="pb-2 font-medium text-right tabular-nums">{t('manufacturing.materialConsumption.fields.plannedQuantity', 'Planned')}</th>
                    <th className="pb-2 font-medium text-right tabular-nums">{t('manufacturing.materialConsumption.fields.actualQuantity', 'Actual')}</th>
                    <th className="pb-2 font-medium text-right tabular-nums">{t('manufacturing.materialConsumption.fields.wastageQuantity', 'Wastage')}</th>
                    <th className="pb-2 font-medium">{t('manufacturing.materialConsumption.fields.status', 'Status')}</th>
                    <th className="pb-2 font-medium text-right">{t('common.actions', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => (
                    <tr key={m.id} className="border-b border-border/50">
                      <td className="py-2">
                        <Link href={`/backend/manufacturing/material-consumption/${m.id}`} className="text-primary hover:underline">
                          {m.product_name}
                        </Link>
                        {m.product_sku && <span className="ml-1 text-xs text-muted-foreground">({m.product_sku})</span>}
                      </td>
                      <td className="py-2 text-right tabular-nums">{Number(m.planned_quantity).toFixed(2)}</td>
                      <td className="py-2 text-right tabular-nums">{Number(m.actual_quantity).toFixed(2)}</td>
                      <td className="py-2 text-right tabular-nums">{Number(m.wastage_quantity).toFixed(2)}</td>
                      <td className="py-2">
                        <StatusBadge variant={m.status === 'issued' ? 'success' : m.status === 'returned' ? 'warning' : m.status === 'scrapped' ? 'error' : 'neutral'}>
                          {t(`manufacturing.materialConsumption.status.${m.status}`, m.status)}
                        </StatusBadge>
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-1">
                          {m.status === 'planned' && (
                            <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => issueMaterial(m.id, m.planned_quantity)}>
                              <ArrowDownToLine className="mr-1 size-3" />{t('manufacturing.materialConsumption.issue', 'Issue')}
                            </Button>
                          )}
                          {m.status === 'issued' && (
                            <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => returnMaterial(m.id)}>
                              <Undo2 className="mr-1 size-3" />{t('manufacturing.materialConsumption.return', 'Return')}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {po.sales_order_id && (
          <div className="mt-4 rounded-lg border border-border p-4">
            <h3 className="text-sm font-semibold mb-2">{t('manufacturing.productionOrders.linkedSalesOrder', 'Linked Sales Order')}</h3>
            <a href={`/backend/sales/documents/${po.sales_order_id}`} className="text-sm text-primary hover:underline">
              {po.sales_order_number || po.sales_order_id}
            </a>
          </div>
        )}

        <MaterialAvailabilityPanel bomId={po.bom_id} plannedQuantity={Number(po.planned_quantity) || 1} />
      </PageBody>
    </Page>
  )
}
