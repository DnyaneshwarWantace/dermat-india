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

type MachineDetail = { id: string; name: string; code: string; description?: string | null; status: string; work_center_id?: string | null; make_model?: string | null; serial_number?: string | null; purchase_date?: string | null; last_maintenance_date?: string | null; next_maintenance_date?: string | null; notes?: string | null; updated_at?: string | null }

export default function MachineDetailPage() {
  const t = useT()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const { data: machine, isLoading, error } = useQuery({
    queryKey: ['mfg-machine', id],
    queryFn: async () => { const res = await apiCallOrThrow(`/api/manufacturing/machines?id=${id}`); const items = (res as { items: MachineDetail[] }).items; if (!items?.length) throw new Error('Not found'); return items[0] },
  })

  const fields = React.useMemo<CrudFormField[]>(() => [
    { name: 'name', label: t('manufacturing.machines.fields.name', 'Name'), type: 'text', required: true, group: 'basic' },
    { name: 'code', label: t('manufacturing.machines.fields.code', 'Code'), type: 'text', required: true, group: 'basic' },
    { name: 'description', label: t('manufacturing.machines.fields.description', 'Description'), type: 'textarea', group: 'basic' },
    { name: 'status', label: t('manufacturing.machines.fields.status', 'Status'), type: 'select', options: [
      { value: 'available', label: 'Available' }, { value: 'in_use', label: 'In Use' }, { value: 'maintenance', label: 'Maintenance' }, { value: 'retired', label: 'Retired' },
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
    { id: 'basic', label: 'Basic Information' }, { id: 'assignment', label: 'Assignment' }, { id: 'details', label: 'Machine Details' }, { id: 'maintenance', label: 'Maintenance' }, { id: 'notes', label: 'Notes' },
  ], [])

  if (isLoading) return <LoadingMessage />
  if (error || !machine) return <ErrorMessage message="Machine not found" />

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={`${t('manufacturing.machines.edit', 'Edit Machine')} — ${machine.name}`}
          backHref="/backend/manufacturing/machines"
          fields={fields}
          groups={groups}
          initialValues={{ name: machine.name, code: machine.code, description: machine.description ?? '', status: machine.status, workCenterId: machine.work_center_id ?? '', makeModel: machine.make_model ?? '', serialNumber: machine.serial_number ?? '', purchaseDate: machine.purchase_date ?? '', lastMaintenanceDate: machine.last_maintenance_date ?? '', nextMaintenanceDate: machine.next_maintenance_date ?? '', notes: machine.notes ?? '', updatedAt: machine.updated_at ?? undefined }}
          submitLabel={t('common.save', 'Save')}
          cancelHref="/backend/manufacturing/machines"
          onSubmit={async (values) => { await updateCrud('/api/manufacturing/machines', { id, ...values }); flash.success(t('common.saved', 'Saved')); router.push('/backend/manufacturing/machines') }}
          onDelete={async () => { await deleteCrud('/api/manufacturing/machines', id); flash.success(t('common.deleted', 'Deleted')); router.push('/backend/manufacturing/machines') }}
        />
      </PageBody>
    </Page>
  )
}
