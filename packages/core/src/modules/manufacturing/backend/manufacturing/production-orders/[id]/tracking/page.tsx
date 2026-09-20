"use client"

import * as React from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Play, CheckCircle, ArrowDownToLine, Undo2 } from 'lucide-react'
import { Page, PageBody, PageHeader } from '@wantace/ui/backend/Page'
import { LoadingMessage, ErrorMessage } from '@wantace/ui/backend/detail'
import { useT } from '@wantace/shared/lib/i18n/context'
import { flash } from '@wantace/ui/backend/FlashMessages'
import { apiCall } from '@wantace/ui/backend/utils/apiCall'
import { updateCrud } from '@wantace/ui/backend/utils/crud'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@wantace/ui/primitives/button'

type ProductionOrder = {
  id: string; order_number: string; bom_id: string; bom_name: string;
  product_name: string; planned_quantity: string; produced_quantity: string;
  status: string; priority: string;
  planned_start_date?: string | null; planned_end_date?: string | null;
  actual_start_date?: string | null; actual_end_date?: string | null;
}

type ProductionStage = {
  id: string; name: string; sequence_number: number; status: string;
  planned_quantity: string; produced_quantity: string;
  started_at?: string | null; completed_at?: string | null;
}

type MaterialConsumption = {
  id: string; product_name: string; planned_quantity: string;
  actual_quantity: string; status: string;
}

type QualityInspection = {
  id: string; inspection_number: string; inspection_type: string;
  status: string; overall_result?: string | null;
  inspected_quantity: string; passed_quantity: string; failed_quantity: string;
}

const statusSteps = ['draft', 'planned', 'in_progress', 'completed'] as const

function StatusTimeline({ currentStatus }: { currentStatus: string }) {
  const t = useT()
  const labels: Record<string, string> = {
    draft: t('manufacturing.productionOrders.status.draft', 'Draft'),
    planned: t('manufacturing.productionOrders.status.planned', 'Planned'),
    in_progress: t('manufacturing.productionOrders.status.in_progress', 'In Progress'),
    completed: t('manufacturing.productionOrders.status.completed', 'Completed'),
  }

  const currentIdx = statusSteps.indexOf(currentStatus as typeof statusSteps[number])
  const isCancelled = currentStatus === 'cancelled'

  return (
    <div className="flex items-center gap-1">
      {statusSteps.map((step, idx) => {
        const isActive = idx <= currentIdx && !isCancelled
        const isCurrent = step === currentStatus
        return (
          <React.Fragment key={step}>
            <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              isCurrent ? 'bg-primary text-primary-foreground' :
              isActive ? 'bg-primary/20 text-primary' :
              'bg-muted text-muted-foreground'
            }`}>
              {labels[step]}
            </div>
            {idx < statusSteps.length - 1 && (
              <div className={`h-0.5 w-6 ${idx < currentIdx && !isCancelled ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </React.Fragment>
        )
      })}
      {isCancelled && (
        <>
          <div className="h-0.5 w-6 bg-status-error-border" />
          <div className="rounded-full bg-status-error-bg px-3 py-1.5 text-xs font-medium text-status-error-text">
            {t('manufacturing.productionOrders.status.cancelled', 'Cancelled')}
          </div>
        </>
      )}
    </div>
  )
}

function StageCard({ stage, onAction }: { stage: ProductionStage; onAction: (stageId: string, status: 'in_progress' | 'completed') => void }) {
  const t = useT()
  const statusColors: Record<string, string> = {
    pending: 'border-muted bg-muted/30',
    in_progress: 'border-status-warning-border bg-status-warning-bg/30',
    completed: 'border-status-success-border bg-status-success-bg/30',
    skipped: 'border-muted bg-muted/20',
  }

  return (
    <div className={`rounded-lg border p-3 ${statusColors[stage.status] ?? 'border-border'}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">#{stage.sequence_number} {stage.name}</span>
        <span className="text-xs capitalize">{stage.status.replace('_', ' ')}</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground tabular-nums">
        {Number(stage.produced_quantity)}/{Number(stage.planned_quantity)} produced
      </div>
      {stage.started_at && <div className="mt-0.5 text-xs text-muted-foreground">Started: {new Date(stage.started_at).toLocaleDateString()}</div>}
      {stage.completed_at && <div className="text-xs text-muted-foreground">Done: {new Date(stage.completed_at).toLocaleDateString()}</div>}
      {(stage.status === 'pending' || stage.status === 'in_progress') && (
        <div className="mt-2 flex gap-1">
          {stage.status === 'pending' && (
            <Button type="button" variant="outline" size="sm" className="h-6 text-xs" onClick={() => onAction(stage.id, 'in_progress')}>
              <Play className="mr-1 size-3" />{t('manufacturing.stages.start', 'Start')}
            </Button>
          )}
          {stage.status === 'in_progress' && (
            <Button type="button" variant="outline" size="sm" className="h-6 text-xs" onClick={() => onAction(stage.id, 'completed')}>
              <CheckCircle className="mr-1 size-3" />{t('manufacturing.stages.complete', 'Complete')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default function ProductionOrderTrackingPage() {
  const t = useT()
  const params = useParams()
  const id = params.id as string
  const queryClient = useQueryClient()

  const handleStageAction = async (stageId: string, status: 'in_progress' | 'completed') => {
    try {
      await updateCrud('/api/manufacturing/production-stages', { id: stageId, status })
      flash.success(status === 'completed' ? t('manufacturing.stages.completed', 'Stage completed') : t('manufacturing.stages.started', 'Stage started'))
      queryClient.invalidateQueries({ queryKey: ['mfg-po-tracking-stages', id] })
    } catch {
      flash.error(t('manufacturing.stages.updateError', 'Failed to update stage'))
    }
  }

  const handleMaterialAction = async (mcId: string, status: 'issued' | 'returned', plannedQty?: string) => {
    try {
      const payload: Record<string, unknown> = { id: mcId, status }
      if (status === 'issued' && plannedQty) payload.actualQuantity = plannedQty
      await updateCrud('/api/manufacturing/material-consumption', payload)
      flash.success(status === 'issued' ? t('manufacturing.materialConsumption.issued', 'Material issued') : t('manufacturing.materialConsumption.returned', 'Material returned'))
      queryClient.invalidateQueries({ queryKey: ['mfg-po-tracking-materials', id] })
    } catch {
      flash.error(t('manufacturing.materialConsumption.updateError', 'Failed to update material'))
    }
  }

  const { data: po, isLoading: poLoading, error: poError } = useQuery({
    queryKey: ['mfg-po-tracking', id],
    queryFn: async () => {
      const res = await apiCall(`/api/manufacturing/production-orders?id=${encodeURIComponent(id)}`)
      const items = (res as { items?: ProductionOrder[] })?.items ?? []
      if (!items.length) throw new Error('Not found')
      return items[0]
    },
  })

  const { data: stages } = useQuery({
    queryKey: ['mfg-po-tracking-stages', id],
    queryFn: async () => {
      const res = await apiCall(`/api/manufacturing/production-stages?productionOrderId=${encodeURIComponent(id)}&pageSize=50`)
      return ((res as { items?: ProductionStage[] })?.items ?? []).sort((a, b) => a.sequence_number - b.sequence_number)
    },
    enabled: !!id,
  })

  const { data: materials } = useQuery({
    queryKey: ['mfg-po-tracking-materials', id],
    queryFn: async () => {
      const res = await apiCall(`/api/manufacturing/material-consumption?productionOrderId=${encodeURIComponent(id)}&pageSize=100`)
      return (res as { items?: MaterialConsumption[] })?.items ?? []
    },
    enabled: !!id,
  })

  const { data: inspections } = useQuery({
    queryKey: ['mfg-po-tracking-inspections', id],
    queryFn: async () => {
      const res = await apiCall(`/api/manufacturing/quality-inspections?productionOrderId=${encodeURIComponent(id)}&pageSize=10`)
      return (res as { items?: QualityInspection[] })?.items ?? []
    },
    enabled: !!id,
  })

  if (poLoading) return <LoadingMessage />
  if (poError || !po) return <ErrorMessage message="Production order not found" />

  const completedStages = stages?.filter((s) => s.status === 'completed').length ?? 0
  const totalStages = stages?.length ?? 0
  const issuedMaterials = materials?.filter((m) => m.status === 'issued').length ?? 0
  const totalMaterials = materials?.length ?? 0

  return (
    <Page>
      <PageHeader
        title={`${t('manufacturing.tracking.title', 'Order Tracking')} — ${po.order_number}`}
        description={po.product_name}
      />
      <PageBody>
        <div className="space-y-6">
          {/* Status Timeline */}
          <div className="rounded-lg border border-border p-4">
            <h3 className="mb-3 text-sm font-semibold">{t('manufacturing.tracking.orderStatus', 'Order Status')}</h3>
            <StatusTimeline currentStatus={po.status} />
            <div className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <span className="text-muted-foreground">{t('manufacturing.tracking.planned', 'Planned')}:</span>{' '}
                <span className="tabular-nums">{po.planned_quantity}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('manufacturing.tracking.produced', 'Produced')}:</span>{' '}
                <span className="tabular-nums">{po.produced_quantity}</span>
              </div>
              {po.planned_start_date && (
                <div>
                  <span className="text-muted-foreground">{t('manufacturing.tracking.startDate', 'Start')}:</span>{' '}
                  {new Date(po.planned_start_date).toLocaleDateString()}
                </div>
              )}
              {po.planned_end_date && (
                <div>
                  <span className="text-muted-foreground">{t('manufacturing.tracking.endDate', 'End')}:</span>{' '}
                  {new Date(po.planned_end_date).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          {/* Production Stages */}
          <div className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{t('manufacturing.tracking.stages', 'Production Stages')}</h3>
              <span className="text-xs text-muted-foreground tabular-nums">{completedStages}/{totalStages} {t('manufacturing.tracking.completed', 'completed')}</span>
            </div>
            {totalStages > 0 && (
              <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${totalStages > 0 ? (completedStages / totalStages) * 100 : 0}%` }} />
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {stages?.map((stage) => <StageCard key={stage.id} stage={stage} onAction={handleStageAction} />)}
            </div>
            {!totalStages && <p className="text-sm text-muted-foreground">{t('manufacturing.tracking.noStages', 'No stages defined yet.')}</p>}
          </div>

          {/* Material Status */}
          <div className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{t('manufacturing.tracking.materials', 'Materials')}</h3>
              <span className="text-xs text-muted-foreground tabular-nums">{issuedMaterials}/{totalMaterials} {t('manufacturing.tracking.issued', 'issued')}</span>
            </div>
            {totalMaterials > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 font-medium">{t('manufacturing.tracking.materialName', 'Material')}</th>
                      <th className="pb-2 font-medium text-right tabular-nums">{t('manufacturing.tracking.materialPlanned', 'Planned')}</th>
                      <th className="pb-2 font-medium text-right tabular-nums">{t('manufacturing.tracking.materialActual', 'Actual')}</th>
                      <th className="pb-2 font-medium text-right">{t('manufacturing.tracking.materialStatus', 'Status')}</th>
                      <th className="pb-2 font-medium text-right">{t('common.actions', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials?.map((m) => (
                      <tr key={m.id} className="border-b border-border/50">
                        <td className="py-2">
                          <Link href={`/backend/manufacturing/material-consumption/${m.id}`} className="text-primary hover:underline">{m.product_name}</Link>
                        </td>
                        <td className="py-2 text-right tabular-nums">{Number(m.planned_quantity).toFixed(2)}</td>
                        <td className="py-2 text-right tabular-nums">{Number(m.actual_quantity).toFixed(2)}</td>
                        <td className="py-2 text-right">
                          <span className={`text-xs capitalize ${m.status === 'issued' ? 'text-status-success-text' : 'text-muted-foreground'}`}>
                            {m.status}
                          </span>
                        </td>
                        <td className="py-2 text-right">
                          {m.status === 'planned' && (
                            <Button type="button" variant="outline" size="sm" className="h-6 text-xs" onClick={() => handleMaterialAction(m.id, 'issued', m.planned_quantity)}>
                              <ArrowDownToLine className="mr-1 size-3" />{t('manufacturing.materialConsumption.issue', 'Issue')}
                            </Button>
                          )}
                          {m.status === 'issued' && (
                            <Button type="button" variant="outline" size="sm" className="h-6 text-xs" onClick={() => handleMaterialAction(m.id, 'returned')}>
                              <Undo2 className="mr-1 size-3" />{t('manufacturing.materialConsumption.return', 'Return')}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('manufacturing.tracking.noMaterials', 'No materials tracked yet.')}</p>
            )}
          </div>

          {/* Quality Inspections */}
          <div className="rounded-lg border border-border p-4">
            <h3 className="mb-3 text-sm font-semibold">{t('manufacturing.tracking.qualityInspections', 'Quality Inspections')}</h3>
            {inspections?.length ? (
              <div className="space-y-2">
                {inspections.map((qi) => (
                  <Link key={qi.id} href={`/backend/manufacturing/quality-inspections/${qi.id}`} className="block rounded-lg border border-border p-3 transition-colors hover:bg-accent">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{qi.inspection_number}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        qi.overall_result === 'pass' ? 'bg-status-success-bg text-status-success-text' :
                        qi.overall_result === 'fail' ? 'bg-status-error-bg text-status-error-text' :
                        qi.overall_result === 'conditional' ? 'bg-status-warning-bg text-status-warning-text' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {qi.overall_result ?? qi.status}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {qi.inspection_type} — {Number(qi.passed_quantity)} passed, {Number(qi.failed_quantity)} failed
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('manufacturing.tracking.noInspections', 'No inspections yet.')}</p>
            )}
          </div>

          {/* Quick Links */}
          <div className="flex gap-3">
            <Link href={`/backend/manufacturing/production-orders/${id}`} className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-accent">
              {t('manufacturing.tracking.editOrder', 'Edit Order')}
            </Link>
            <Link href="/backend/manufacturing/production-orders" className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-accent">
              {t('manufacturing.tracking.allOrders', 'All Orders')}
            </Link>
          </div>
        </div>
      </PageBody>
    </Page>
  )
}
