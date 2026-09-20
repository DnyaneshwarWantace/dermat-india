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

type WorkCenterDetail = { id: string; name: string; code: string; description?: string | null; status: string; cost_per_hour_cents: number; capacity_per_day?: string | null; unit_of_measure?: string | null; location?: string | null; notes?: string | null; updated_at?: string | null }

export default function WorkCenterDetailPage() {
  const t = useT()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const { data: wc, isLoading, error } = useQuery({
    queryKey: ['mfg-work-center', id],
    queryFn: async () => { const res = await apiCallOrThrow(`/api/manufacturing/work-centers?id=${id}`); const items = (res as { items: WorkCenterDetail[] }).items; if (!items?.length) throw new Error('Not found'); return items[0] },
  })

  const fields = React.useMemo<CrudFormField[]>(() => [
    { name: 'name', label: t('manufacturing.workCenters.fields.name', 'Name'), type: 'text', required: true, group: 'basic' },
    { name: 'code', label: t('manufacturing.workCenters.fields.code', 'Code'), type: 'text', required: true, group: 'basic' },
    { name: 'description', label: t('manufacturing.workCenters.fields.description', 'Description'), type: 'textarea', group: 'basic' },
    { name: 'status', label: t('manufacturing.workCenters.fields.status', 'Status'), type: 'select', options: [
      { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'maintenance', label: 'Maintenance' },
    ], group: 'basic' },
    { name: 'costPerHourCents', label: t('manufacturing.workCenters.fields.costPerHour', 'Cost per Hour (cents)'), type: 'number', group: 'capacity' },
    { name: 'capacityPerDay', label: t('manufacturing.workCenters.fields.capacityPerDay', 'Capacity per Day'), type: 'text', group: 'capacity' },
    { name: 'unitOfMeasure', label: t('manufacturing.workCenters.fields.unitOfMeasure', 'Unit of Measure'), type: 'text', group: 'capacity' },
    { name: 'location', label: t('manufacturing.workCenters.fields.location', 'Location'), type: 'text', group: 'capacity' },
    { name: 'notes', label: t('manufacturing.workCenters.fields.notes', 'Notes'), type: 'textarea', group: 'notes' },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'basic', label: 'Basic Information' }, { id: 'capacity', label: 'Capacity & Cost' }, { id: 'notes', label: 'Notes' },
  ], [])

  if (isLoading) return <LoadingMessage />
  if (error || !wc) return <ErrorMessage message="Work center not found" />

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={`${t('manufacturing.workCenters.edit', 'Edit Work Center')} — ${wc.name}`}
          backHref="/backend/manufacturing/work-centers"
          fields={fields}
          groups={groups}
          initialValues={{ name: wc.name, code: wc.code, description: wc.description ?? '', status: wc.status, costPerHourCents: wc.cost_per_hour_cents, capacityPerDay: wc.capacity_per_day ?? '', unitOfMeasure: wc.unit_of_measure ?? '', location: wc.location ?? '', notes: wc.notes ?? '', updatedAt: wc.updated_at ?? undefined }}
          submitLabel={t('common.save', 'Save')}
          cancelHref="/backend/manufacturing/work-centers"
          onSubmit={async (values) => { await updateCrud('/api/manufacturing/work-centers', { id, ...values }); flash.success(t('common.saved', 'Saved')); router.push('/backend/manufacturing/work-centers') }}
          onDelete={async () => { await deleteCrud('/api/manufacturing/work-centers', id); flash.success(t('common.deleted', 'Deleted')); router.push('/backend/manufacturing/work-centers') }}
        />
      </PageBody>
    </Page>
  )
}
