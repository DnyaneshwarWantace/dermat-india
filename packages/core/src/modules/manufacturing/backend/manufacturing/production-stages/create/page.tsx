"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@wantace/ui/backend/Page'
import { CrudForm, type CrudFormField, type CrudFormGroup } from '@wantace/ui/backend/CrudForm'
import { createCrud } from '@wantace/ui/backend/utils/crud'
import { useT } from '@wantace/shared/lib/i18n/context'
import { flash } from '@wantace/ui/backend/FlashMessages'

export default function CreateProductionStagePage() {
  const t = useT()
  const router = useRouter()

  const fields = React.useMemo<CrudFormField[]>(() => [
    { name: 'productionOrderId', label: t('manufacturing.productionStages.fields.productionOrderId', 'Production Order ID'), type: 'text', required: true, group: 'basic' },
    { name: 'sequenceNumber', label: t('manufacturing.productionStages.fields.sequenceNumber', 'Sequence #'), type: 'number', required: true, group: 'basic' },
    { name: 'name', label: t('manufacturing.productionStages.fields.name', 'Name'), type: 'text', required: true, group: 'basic' },
    { name: 'description', label: t('manufacturing.productionStages.fields.description', 'Description'), type: 'textarea', group: 'basic' },
    { name: 'status', label: t('manufacturing.productionStages.fields.status', 'Status'), type: 'select', options: [
      { value: 'pending', label: t('manufacturing.productionStages.status.pending', 'Pending') },
      { value: 'in_progress', label: t('manufacturing.productionStages.status.in_progress', 'In Progress') },
    ], group: 'basic' },
    { name: 'workCenterId', label: t('manufacturing.productionStages.fields.workCenterId', 'Work Center ID'), type: 'text', group: 'assignment' },
    { name: 'machineId', label: t('manufacturing.productionStages.fields.machineId', 'Machine ID'), type: 'text', group: 'assignment' },
    { name: 'operatorId', label: t('manufacturing.productionStages.fields.operatorId', 'Operator ID'), type: 'text', group: 'assignment' },
    { name: 'plannedQuantity', label: t('manufacturing.productionStages.fields.plannedQuantity', 'Planned Quantity'), type: 'text', required: true, group: 'time' },
    { name: 'plannedSetupMinutes', label: t('manufacturing.productionStages.fields.plannedSetupMinutes', 'Planned Setup (min)'), type: 'text', group: 'time' },
    { name: 'plannedRunMinutes', label: t('manufacturing.productionStages.fields.plannedRunMinutes', 'Planned Run (min)'), type: 'text', group: 'time' },
    { name: 'notes', label: t('manufacturing.productionStages.fields.notes', 'Notes'), type: 'textarea', group: 'notes' },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'basic', label: t('manufacturing.productionStages.groups.basic', 'Basic Information') },
    { id: 'assignment', label: t('manufacturing.productionStages.groups.assignment', 'Assignment') },
    { id: 'time', label: t('manufacturing.productionStages.groups.time', 'Quantity & Time') },
    { id: 'notes', label: t('manufacturing.productionStages.groups.notes', 'Notes') },
  ], [t])

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('manufacturing.productionStages.create', 'New Stage')}
          backHref="/backend/manufacturing/production-stages"
          fields={fields}
          groups={groups}
          initialValues={{ status: 'pending', sequenceNumber: 1, plannedSetupMinutes: '0', plannedRunMinutes: '0' }}
          submitLabel={t('common.create', 'Create')}
          cancelHref="/backend/manufacturing/production-stages"
          onSubmit={async (values) => {
            const res = await createCrud('/api/manufacturing/production-stages', values)
            if (res?.id) { flash.success(t('common.created', 'Created')); router.push(`/backend/manufacturing/production-stages/${res.id}`) }
          }}
        />
      </PageBody>
    </Page>
  )
}
