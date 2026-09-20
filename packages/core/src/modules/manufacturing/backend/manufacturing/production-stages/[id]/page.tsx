"use client"

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Page, PageBody } from '@wantace/ui/backend/Page'
import { CrudForm, type CrudFormField, type CrudFormGroup } from '@wantace/ui/backend/CrudForm'
import { updateCrud, deleteCrud } from '@wantace/ui/backend/utils/crud'
import { LoadingMessage, ErrorMessage } from '@wantace/ui/backend/detail'
import { useT } from '@wantace/shared/lib/i18n/context'
import { flash } from '@wantace/ui/backend/FlashMessages'
import { apiCallOrThrow } from '@wantace/ui/backend/utils/apiCall'
import { useQuery } from '@tanstack/react-query'

type ProductionStageDetail = {
  id: string; production_order_id: string; sequence_number: number; name: string;
  description?: string | null; work_center_id?: string | null; machine_id?: string | null;
  status: string; planned_quantity: string; produced_quantity: string; rejected_quantity: string;
  planned_setup_minutes: string; planned_run_minutes: string;
  actual_setup_minutes: string; actual_run_minutes: string;
  started_at?: string | null; completed_at?: string | null;
  operator_id?: string | null; notes?: string | null; updated_at?: string | null
}

export default function ProductionStageDetailPage() {
  const t = useT()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const { data: stage, isLoading, error } = useQuery({
    queryKey: ['mfg-production-stage', id],
    queryFn: async () => { const res = await apiCallOrThrow(`/api/manufacturing/production-stages?id=${id}`); const items = (res as { items: ProductionStageDetail[] }).items; if (!items?.length) throw new Error('Not found'); return items[0] },
  })

  const fields = React.useMemo<CrudFormField[]>(() => [
    { name: 'productionOrderId', label: t('manufacturing.productionStages.fields.productionOrderId', 'Production Order ID'), type: 'text', required: true, group: 'basic' },
    { name: 'sequenceNumber', label: t('manufacturing.productionStages.fields.sequenceNumber', 'Sequence #'), type: 'number', required: true, group: 'basic' },
    { name: 'name', label: t('manufacturing.productionStages.fields.name', 'Name'), type: 'text', required: true, group: 'basic' },
    { name: 'description', label: t('manufacturing.productionStages.fields.description', 'Description'), type: 'textarea', group: 'basic' },
    { name: 'status', label: t('manufacturing.productionStages.fields.status', 'Status'), type: 'select', options: [
      { value: 'pending', label: t('manufacturing.productionStages.status.pending', 'Pending') },
      { value: 'in_progress', label: t('manufacturing.productionStages.status.in_progress', 'In Progress') },
      { value: 'completed', label: t('manufacturing.productionStages.status.completed', 'Completed') },
      { value: 'skipped', label: t('manufacturing.productionStages.status.skipped', 'Skipped') },
    ], group: 'basic' },
    { name: 'workCenterId', label: t('manufacturing.productionStages.fields.workCenterId', 'Work Center ID'), type: 'text', group: 'assignment' },
    { name: 'machineId', label: t('manufacturing.productionStages.fields.machineId', 'Machine ID'), type: 'text', group: 'assignment' },
    { name: 'operatorId', label: t('manufacturing.productionStages.fields.operatorId', 'Operator ID'), type: 'text', group: 'assignment' },
    { name: 'plannedQuantity', label: t('manufacturing.productionStages.fields.plannedQuantity', 'Planned Quantity'), type: 'text', required: true, group: 'time' },
    { name: 'producedQuantity', label: t('manufacturing.productionStages.fields.producedQuantity', 'Produced Quantity'), type: 'text', group: 'time' },
    { name: 'rejectedQuantity', label: t('manufacturing.productionStages.fields.rejectedQuantity', 'Rejected Quantity'), type: 'text', group: 'time' },
    { name: 'plannedSetupMinutes', label: t('manufacturing.productionStages.fields.plannedSetupMinutes', 'Planned Setup (min)'), type: 'text', group: 'time' },
    { name: 'plannedRunMinutes', label: t('manufacturing.productionStages.fields.plannedRunMinutes', 'Planned Run (min)'), type: 'text', group: 'time' },
    { name: 'actualSetupMinutes', label: t('manufacturing.productionStages.fields.actualSetupMinutes', 'Actual Setup (min)'), type: 'text', group: 'time' },
    { name: 'actualRunMinutes', label: t('manufacturing.productionStages.fields.actualRunMinutes', 'Actual Run (min)'), type: 'text', group: 'time' },
    { name: 'notes', label: t('manufacturing.productionStages.fields.notes', 'Notes'), type: 'textarea', group: 'notes' },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'basic', label: t('manufacturing.productionStages.groups.basic', 'Basic Information') },
    { id: 'assignment', label: t('manufacturing.productionStages.groups.assignment', 'Assignment') },
    { id: 'time', label: t('manufacturing.productionStages.groups.time', 'Quantity & Time') },
    { id: 'notes', label: t('manufacturing.productionStages.groups.notes', 'Notes') },
  ], [t])

  if (isLoading) return <LoadingMessage />
  if (error || !stage) return <ErrorMessage message="Production stage not found" />

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={`${t('manufacturing.productionStages.edit', 'Edit Stage')} — ${stage.name}`}
          backHref="/backend/manufacturing/production-stages"
          fields={fields}
          groups={groups}
          initialValues={{
            productionOrderId: stage.production_order_id, sequenceNumber: stage.sequence_number,
            name: stage.name, description: stage.description ?? '', status: stage.status,
            workCenterId: stage.work_center_id ?? '', machineId: stage.machine_id ?? '',
            operatorId: stage.operator_id ?? '',
            plannedQuantity: stage.planned_quantity, producedQuantity: stage.produced_quantity,
            rejectedQuantity: stage.rejected_quantity,
            plannedSetupMinutes: stage.planned_setup_minutes, plannedRunMinutes: stage.planned_run_minutes,
            actualSetupMinutes: stage.actual_setup_minutes, actualRunMinutes: stage.actual_run_minutes,
            notes: stage.notes ?? '', updatedAt: stage.updated_at ?? undefined,
          }}
          submitLabel={t('common.save', 'Save')}
          cancelHref="/backend/manufacturing/production-stages"
          onSubmit={async (values) => { await updateCrud('/api/manufacturing/production-stages', { id, ...values }); flash.success(t('common.saved', 'Saved')); router.push('/backend/manufacturing/production-stages') }}
          onDelete={async () => { await deleteCrud('/api/manufacturing/production-stages', id); flash.success(t('common.deleted', 'Deleted')); router.push('/backend/manufacturing/production-stages') }}
        />
      </PageBody>
    </Page>
  )
}
