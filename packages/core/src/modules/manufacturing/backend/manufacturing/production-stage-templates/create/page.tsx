"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@wantace/ui/backend/Page'
import { CrudForm, type CrudBuiltinField, type CrudFormGroup } from '@wantace/ui/backend/CrudForm'
import type { CrudFieldOption } from '@wantace/ui/backend/CrudForm'
import { createCrud } from '@wantace/ui/backend/utils/crud'
import { apiCall } from '@wantace/ui/backend/utils/apiCall'
import { useT } from '@wantace/shared/lib/i18n/context'
import { flash } from '@wantace/ui/backend/FlashMessages'

export default function CreateStageTemplatePage() {
  const t = useT()
  const router = useRouter()

  const loadWorkCenterOptions = React.useCallback(async (query?: string): Promise<CrudFieldOption[]> => {
    const params = new URLSearchParams({ page: '1', pageSize: '20', status: 'active' })
    if (query?.trim()) params.set('search', query.trim())
    const res = await apiCall(`/api/manufacturing/work-centers?${params}`)
    const items = (res as { items?: { id: string; name: string; code: string }[] })?.items ?? []
    return items.map((wc) => ({ value: wc.id, label: `${wc.code} — ${wc.name}` }))
  }, [])

  const loadMachineOptions = React.useCallback(async (query?: string): Promise<CrudFieldOption[]> => {
    const params = new URLSearchParams({ page: '1', pageSize: '20', status: 'available' })
    if (query?.trim()) params.set('search', query.trim())
    const res = await apiCall(`/api/manufacturing/machines?${params}`)
    const items = (res as { items?: { id: string; name: string; code: string }[] })?.items ?? []
    return items.map((m) => ({ value: m.id, label: `${m.code} — ${m.name}` }))
  }, [])

  const fields = React.useMemo<CrudBuiltinField[]>(() => [
    {
      id: 'name', label: t('manufacturing.stageTemplates.fields.name', 'Stage Name'),
      type: 'text', required: true, group: 'basic', layout: 'half',
    },
    {
      id: 'code', label: t('manufacturing.stageTemplates.fields.code', 'Code'),
      type: 'text', required: true, group: 'basic', layout: 'half',
    },
    {
      id: 'sequenceNumber', label: t('manufacturing.stageTemplates.fields.sequenceNumber', 'Sequence #'),
      type: 'text', required: true, group: 'basic', layout: 'third',
    },
    {
      id: 'isActive', label: t('manufacturing.stageTemplates.fields.active', 'Active'),
      type: 'select', group: 'basic', layout: 'third',
      options: [
        { value: 'true', label: t('common.yes', 'Yes') },
        { value: 'false', label: t('common.no', 'No') },
      ],
    },
    {
      id: 'requiresQualityCheck', label: t('manufacturing.stageTemplates.fields.requiresQC', 'Requires Quality Check'),
      type: 'select', group: 'basic', layout: 'third',
      options: [
        { value: 'false', label: t('common.no', 'No') },
        { value: 'true', label: t('common.yes', 'Yes') },
      ],
    },
    {
      id: 'description', label: t('manufacturing.stageTemplates.fields.description', 'Description'),
      type: 'textarea', group: 'basic',
    },
    {
      id: 'defaultWorkCenterId', label: t('manufacturing.stageTemplates.fields.workCenter', 'Default Work Center'),
      type: 'combobox', group: 'defaults', layout: 'half',
      loadOptions: loadWorkCenterOptions, allowCustomValues: false,
      placeholder: t('manufacturing.stageTemplates.fields.workCenterPlaceholder', 'Select work center...'),
    },
    {
      id: 'defaultMachineId', label: t('manufacturing.stageTemplates.fields.machine', 'Default Machine'),
      type: 'combobox', group: 'defaults', layout: 'half',
      loadOptions: loadMachineOptions, allowCustomValues: false,
      placeholder: t('manufacturing.stageTemplates.fields.machinePlaceholder', 'Select machine...'),
    },
    {
      id: 'estimatedSetupMinutes', label: t('manufacturing.stageTemplates.fields.setupMinutes', 'Est. Setup Time (min)'),
      type: 'text', group: 'time', layout: 'half',
    },
    {
      id: 'estimatedRunMinutes', label: t('manufacturing.stageTemplates.fields.runMinutes', 'Est. Run Time (min)'),
      type: 'text', group: 'time', layout: 'half',
    },
    {
      id: 'notes', label: t('manufacturing.stageTemplates.fields.notes', 'Notes'),
      type: 'textarea', group: 'notes',
    },
  ], [t, loadWorkCenterOptions, loadMachineOptions])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'basic', label: t('manufacturing.stageTemplates.groups.basic', 'Basic Information') },
    { id: 'defaults', label: t('manufacturing.stageTemplates.groups.defaults', 'Default Assignments') },
    { id: 'time', label: t('manufacturing.stageTemplates.groups.time', 'Time Estimates') },
    { id: 'notes', label: t('manufacturing.stageTemplates.groups.notes', 'Notes') },
  ], [t])

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('manufacturing.stageTemplates.create', 'New Stage Template')}
          backHref="/backend/manufacturing/production-stage-templates"
          fields={fields}
          groups={groups}
          initialValues={{
            sequenceNumber: '1', isActive: 'true', requiresQualityCheck: 'false',
            estimatedSetupMinutes: '0', estimatedRunMinutes: '0',
          }}
          submitLabel={t('common.create', 'Create')}
          cancelHref="/backend/manufacturing/production-stage-templates"
          onSubmit={async (values) => {
            const payload = {
              ...values,
              sequenceNumber: Number(values.sequenceNumber),
              isActive: values.isActive === 'true',
              requiresQualityCheck: values.requiresQualityCheck === 'true',
            }
            const res = await createCrud('/api/manufacturing/production-stage-templates', payload)
            if (res?.id) {
              flash.success(t('common.created', 'Created'))
              router.push(`/backend/manufacturing/production-stage-templates/${res.id}`)
            }
          }}
        />
      </PageBody>
    </Page>
  )
}
