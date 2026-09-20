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

type QualityInspectionDetail = {
  id: string; inspection_number: string; inspection_type: string; status: string;
  production_order_id?: string | null; production_stage_id?: string | null;
  product_variant_id: string; product_name: string;
  inspected_quantity: string; passed_quantity: string; failed_quantity: string;
  overall_result?: string | null; inspector_id?: string | null; inspected_at?: string | null;
  notes?: string | null; updated_at?: string | null
}

export default function QualityInspectionDetailPage() {
  const t = useT()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const { data: qi, isLoading, error } = useQuery({
    queryKey: ['mfg-quality-inspection', id],
    queryFn: async () => { const res = await apiCallOrThrow(`/api/manufacturing/quality-inspections?id=${id}`); const items = (res as { items: QualityInspectionDetail[] }).items; if (!items?.length) throw new Error('Not found'); return items[0] },
  })

  const fields = React.useMemo<CrudFormField[]>(() => [
    { name: 'inspectionType', label: t('manufacturing.qualityInspections.fields.inspectionType', 'Inspection Type'), type: 'select', required: true, options: [
      { value: 'incoming', label: t('manufacturing.qualityInspections.type.incoming', 'Incoming') },
      { value: 'in_process', label: t('manufacturing.qualityInspections.type.in_process', 'In-Process') },
      { value: 'final', label: t('manufacturing.qualityInspections.type.final', 'Final') },
      { value: 'periodic', label: t('manufacturing.qualityInspections.type.periodic', 'Periodic') },
    ], group: 'basic' },
    { name: 'status', label: t('manufacturing.qualityInspections.fields.status', 'Status'), type: 'select', options: [
      { value: 'pending', label: t('manufacturing.qualityInspections.status.pending', 'Pending') },
      { value: 'in_progress', label: t('manufacturing.qualityInspections.status.in_progress', 'In Progress') },
      { value: 'passed', label: t('manufacturing.qualityInspections.status.passed', 'Passed') },
      { value: 'failed', label: t('manufacturing.qualityInspections.status.failed', 'Failed') },
      { value: 'on_hold', label: t('manufacturing.qualityInspections.status.on_hold', 'On Hold') },
    ], group: 'basic' },
    { name: 'overallResult', label: t('manufacturing.qualityInspections.fields.overallResult', 'Overall Result'), type: 'select', options: [
      { value: '', label: '—' },
      { value: 'pass', label: t('manufacturing.qualityInspections.result.pass', 'Pass') },
      { value: 'fail', label: t('manufacturing.qualityInspections.result.fail', 'Fail') },
      { value: 'conditional', label: t('manufacturing.qualityInspections.result.conditional', 'Conditional') },
    ], group: 'basic' },
    { name: 'productVariantId', label: t('manufacturing.qualityInspections.fields.productVariantId', 'Product Variant ID'), type: 'text', required: true, group: 'basic' },
    { name: 'productName', label: t('manufacturing.qualityInspections.fields.productName', 'Product Name'), type: 'text', required: true, group: 'basic' },
    { name: 'productionOrderId', label: t('manufacturing.qualityInspections.fields.productionOrderId', 'Production Order ID'), type: 'text', group: 'reference' },
    { name: 'productionStageId', label: t('manufacturing.qualityInspections.fields.productionStageId', 'Production Stage ID'), type: 'text', group: 'reference' },
    { name: 'inspectorId', label: t('manufacturing.qualityInspections.fields.inspectorId', 'Inspector ID'), type: 'text', group: 'reference' },
    { name: 'inspectedQuantity', label: t('manufacturing.qualityInspections.fields.inspectedQuantity', 'Inspected Quantity'), type: 'text', group: 'quantities' },
    { name: 'passedQuantity', label: t('manufacturing.qualityInspections.fields.passedQuantity', 'Passed Quantity'), type: 'text', group: 'quantities' },
    { name: 'failedQuantity', label: t('manufacturing.qualityInspections.fields.failedQuantity', 'Failed Quantity'), type: 'text', group: 'quantities' },
    { name: 'notes', label: t('manufacturing.qualityInspections.fields.notes', 'Notes'), type: 'textarea', group: 'notes' },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'basic', label: t('manufacturing.qualityInspections.groups.basic', 'Basic Information') },
    { id: 'reference', label: t('manufacturing.qualityInspections.groups.reference', 'Reference') },
    { id: 'quantities', label: t('manufacturing.qualityInspections.groups.quantities', 'Quantities') },
    { id: 'notes', label: t('manufacturing.qualityInspections.groups.notes', 'Notes') },
  ], [t])

  if (isLoading) return <LoadingMessage />
  if (error || !qi) return <ErrorMessage message="Quality inspection not found" />

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={`${t('manufacturing.qualityInspections.edit', 'Edit Inspection')} — ${qi.inspection_number}`}
          backHref="/backend/manufacturing/quality-inspections"
          fields={fields}
          groups={groups}
          initialValues={{
            inspectionType: qi.inspection_type, status: qi.status,
            overallResult: qi.overall_result ?? '',
            productVariantId: qi.product_variant_id, productName: qi.product_name,
            productionOrderId: qi.production_order_id ?? '', productionStageId: qi.production_stage_id ?? '',
            inspectorId: qi.inspector_id ?? '',
            inspectedQuantity: qi.inspected_quantity, passedQuantity: qi.passed_quantity,
            failedQuantity: qi.failed_quantity,
            notes: qi.notes ?? '', updatedAt: qi.updated_at ?? undefined,
          }}
          submitLabel={t('common.save', 'Save')}
          cancelHref="/backend/manufacturing/quality-inspections"
          onSubmit={async (values) => { await updateCrud('/api/manufacturing/quality-inspections', { id, ...values }); flash.success(t('common.saved', 'Saved')); router.push('/backend/manufacturing/quality-inspections') }}
          onDelete={async () => { await deleteCrud('/api/manufacturing/quality-inspections', id); flash.success(t('common.deleted', 'Deleted')); router.push('/backend/manufacturing/quality-inspections') }}
        />
      </PageBody>
    </Page>
  )
}
