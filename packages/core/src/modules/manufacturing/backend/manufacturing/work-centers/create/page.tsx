"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@wantace/ui/backend/Page'
import { CrudForm, type CrudFormField, type CrudFormGroup } from '@wantace/ui/backend/CrudForm'
import { createCrud } from '@wantace/ui/backend/utils/crud'
import { useT } from '@wantace/shared/lib/i18n/context'
import { flash } from '@wantace/ui/backend/FlashMessages'

export default function CreateWorkCenterPage() {
  const t = useT()
  const router = useRouter()

  const fields = React.useMemo<CrudFormField[]>(() => [
    { name: 'name', label: t('manufacturing.workCenters.fields.name', 'Name'), type: 'text', required: true, group: 'basic' },
    { name: 'code', label: t('manufacturing.workCenters.fields.code', 'Code'), type: 'text', required: true, group: 'basic' },
    { name: 'description', label: t('manufacturing.workCenters.fields.description', 'Description'), type: 'textarea', group: 'basic' },
    { name: 'status', label: t('manufacturing.workCenters.fields.status', 'Status'), type: 'select', options: [
      { value: 'active', label: t('manufacturing.workCenters.status.active', 'Active') },
      { value: 'inactive', label: t('manufacturing.workCenters.status.inactive', 'Inactive') },
      { value: 'maintenance', label: t('manufacturing.workCenters.status.maintenance', 'Maintenance') },
    ], group: 'basic' },
    { name: 'costPerHourCents', label: t('manufacturing.workCenters.fields.costPerHour', 'Cost per Hour (cents)'), type: 'number', group: 'capacity' },
    { name: 'capacityPerDay', label: t('manufacturing.workCenters.fields.capacityPerDay', 'Capacity per Day'), type: 'text', group: 'capacity' },
    { name: 'unitOfMeasure', label: t('manufacturing.workCenters.fields.unitOfMeasure', 'Unit of Measure'), type: 'text', group: 'capacity' },
    { name: 'location', label: t('manufacturing.workCenters.fields.location', 'Location'), type: 'text', group: 'capacity' },
    { name: 'notes', label: t('manufacturing.workCenters.fields.notes', 'Notes'), type: 'textarea', group: 'notes' },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'basic', label: 'Basic Information' },
    { id: 'capacity', label: 'Capacity & Cost' },
    { id: 'notes', label: 'Notes' },
  ], [])

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('manufacturing.workCenters.create', 'New Work Center')}
          backHref="/backend/manufacturing/work-centers"
          fields={fields}
          groups={groups}
          initialValues={{ status: 'active', costPerHourCents: 0 }}
          submitLabel={t('common.create', 'Create')}
          cancelHref="/backend/manufacturing/work-centers"
          onSubmit={async (values) => {
            const res = await createCrud('/api/manufacturing/work-centers', values)
            if (res?.id) { flash.success(t('common.created', 'Created')); router.push(`/backend/manufacturing/work-centers/${res.id}`) }
          }}
        />
      </PageBody>
    </Page>
  )
}
