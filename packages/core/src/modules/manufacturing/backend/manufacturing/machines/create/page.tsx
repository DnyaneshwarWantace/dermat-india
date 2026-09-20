"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@wantace/ui/backend/Page'
import { CrudForm, type CrudFormField, type CrudFormGroup } from '@wantace/ui/backend/CrudForm'
import { createCrud } from '@wantace/ui/backend/utils/crud'
import { useT } from '@wantace/shared/lib/i18n/context'
import { flash } from '@wantace/ui/backend/FlashMessages'

export default function CreateMachinePage() {
  const t = useT()
  const router = useRouter()

  const fields = React.useMemo<CrudFormField[]>(() => [
    { name: 'name', label: t('manufacturing.machines.fields.name', 'Name'), type: 'text', required: true, group: 'basic' },
    { name: 'code', label: t('manufacturing.machines.fields.code', 'Code'), type: 'text', required: true, group: 'basic' },
    { name: 'description', label: t('manufacturing.machines.fields.description', 'Description'), type: 'textarea', group: 'basic' },
    { name: 'status', label: t('manufacturing.machines.fields.status', 'Status'), type: 'select', options: [
      { value: 'available', label: t('manufacturing.machines.status.available', 'Available') },
      { value: 'in_use', label: t('manufacturing.machines.status.in_use', 'In Use') },
      { value: 'maintenance', label: t('manufacturing.machines.status.maintenance', 'Maintenance') },
      { value: 'retired', label: t('manufacturing.machines.status.retired', 'Retired') },
    ], group: 'basic' },
    { name: 'workCenterId', label: t('manufacturing.machines.fields.workCenter', 'Work Center'), type: 'text', group: 'assignment', placeholder: 'Work Center UUID' },
    { name: 'makeModel', label: t('manufacturing.machines.fields.makeModel', 'Make / Model'), type: 'text', group: 'details' },
    { name: 'serialNumber', label: t('manufacturing.machines.fields.serialNumber', 'Serial Number'), type: 'text', group: 'details' },
    { name: 'purchaseDate', label: t('manufacturing.machines.fields.purchaseDate', 'Purchase Date'), type: 'date', group: 'details' },
    { name: 'lastMaintenanceDate', label: t('manufacturing.machines.fields.lastMaintenance', 'Last Maintenance'), type: 'date', group: 'maintenance' },
    { name: 'nextMaintenanceDate', label: t('manufacturing.machines.fields.nextMaintenance', 'Next Maintenance'), type: 'date', group: 'maintenance' },
    { name: 'notes', label: t('manufacturing.machines.fields.notes', 'Notes'), type: 'textarea', group: 'notes' },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'basic', label: 'Basic Information' },
    { id: 'assignment', label: 'Assignment' },
    { id: 'details', label: 'Machine Details' },
    { id: 'maintenance', label: 'Maintenance' },
    { id: 'notes', label: 'Notes' },
  ], [])

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('manufacturing.machines.create', 'New Machine')}
          backHref="/backend/manufacturing/machines"
          fields={fields}
          groups={groups}
          initialValues={{ status: 'available' }}
          submitLabel={t('common.create', 'Create')}
          cancelHref="/backend/manufacturing/machines"
          onSubmit={async (values) => {
            const res = await createCrud('/api/manufacturing/machines', values)
            if (res?.id) { flash.success(t('common.created', 'Created')); router.push(`/backend/manufacturing/machines/${res.id}`) }
          }}
        />
      </PageBody>
    </Page>
  )
}
