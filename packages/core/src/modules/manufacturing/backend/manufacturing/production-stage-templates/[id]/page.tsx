"use client"

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Page, PageBody } from '@wantace/ui/backend/Page'
import { CrudForm, type CrudBuiltinField, type CrudFormGroup } from '@wantace/ui/backend/CrudForm'
import type { CrudFieldOption } from '@wantace/ui/backend/CrudForm'
import { updateCrud, deleteCrud } from '@wantace/ui/backend/utils/crud'
import { LoadingMessage, ErrorMessage } from '@wantace/ui/backend/detail'
import { useT } from '@wantace/shared/lib/i18n/context'
import { flash } from '@wantace/ui/backend/FlashMessages'
import { apiCallOrThrow, apiCall } from '@wantace/ui/backend/utils/apiCall'
import { useQuery } from '@tanstack/react-query'

type StageTemplateDetail = {
  id: string; name: string; code: string; description?: string | null;
  sequence_number: number; is_active: boolean;
  default_work_center_id?: string | null; default_machine_id?: string | null;
  estimated_setup_minutes: string; estimated_run_minutes: string;
  requires_quality_check: boolean; notes?: string | null; updated_at?: string | null
}

export default function StageTemplateDetailPage() {
  const t = useT()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const { data: template, isLoading, error } = useQuery({
    queryKey: ['mfg-stage-template', id],
    queryFn: async () => {
      const res = await apiCallOrThrow(`/api/manufacturing/production-stage-templates?id=${id}`)
      const items = (res as { items: StageTemplateDetail[] }).items
      if (!items?.length) throw new Error('Not found')
      return items[0]
    },
  })

  const loadWorkCenterOptions = React.useCallback(async (query?: string): Promise<CrudFieldOption[]> => {
    const params = new URLSearchParams({ page: '1', pageSize: '20', status: 'active' })
    if (query?.trim()) params.set('search', query.trim())
    const res = await apiCall(`/api/manufacturing/work-centers?${params}`)
    const items = (res as { items?: { id: string; name: string; code: string }[] })?.items ?? []
    return items.map((wc) => ({ value: wc.id, label: `${wc.code} — ${wc.name}` }))
  }, [])

  const resolveWorkCenterLabel = React.useCallback(async (value: string): Promise<string> => {
    const res = await apiCall(`/api/manufacturing/work-centers?id=${encodeURIComponent(value)}`)
    const items = (res as { items?: { id: string; name: string; code: string }[] })?.items ?? []
    return items.length ? `${items[0].code} — ${items[0].name}` : value
  }, [])

  const loadMachineOptions = React.useCallback(async (query?: string): Promise<CrudFieldOption[]> => {
    const params = new URLSearchParams({ page: '1', pageSize: '20' })
    if (query?.trim()) params.set('search', query.trim())
    const res = await apiCall(`/api/manufacturing/machines?${params}`)
    const items = (res as { items?: { id: string; name: string; code: string }[] })?.items ?? []
    return items.map((m) => ({ value: m.id, label: `${m.code} — ${m.name}` }))
  }, [])

  const resolveMachineLabel = React.useCallback(async (value: string): Promise<string> => {
    const res = await apiCall(`/api/manufacturing/machines?id=${encodeURIComponent(value)}`)
    const items = (res as { items?: { id: string; name: string; code: string }[] })?.items ?? []
    return items.length ? `${items[0].code} — ${items[0].name}` : value
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
      resolveLabel: resolveWorkCenterLabel,
      placeholder: t('manufacturing.stageTemplates.fields.workCenterPlaceholder', 'Select work center...'),
    },
    {
      id: 'defaultMachineId', label: t('manufacturing.stageTemplates.fields.machine', 'Default Machine'),
      type: 'combobox', group: 'defaults', layout: 'half',
      loadOptions: loadMachineOptions, allowCustomValues: false,
      resolveLabel: resolveMachineLabel,
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
  ], [t, loadWorkCenterOptions, resolveWorkCenterLabel, loadMachineOptions, resolveMachineLabel])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'basic', label: t('manufacturing.stageTemplates.groups.basic', 'Basic Information') },
    { id: 'defaults', label: t('manufacturing.stageTemplates.groups.defaults', 'Default Assignments') },
    { id: 'time', label: t('manufacturing.stageTemplates.groups.time', 'Time Estimates') },
    { id: 'notes', label: t('manufacturing.stageTemplates.groups.notes', 'Notes') },
  ], [t])

  if (isLoading) return <LoadingMessage />
  if (error || !template) return <ErrorMessage message="Stage template not found" />

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={`${t('manufacturing.stageTemplates.edit', 'Edit Stage Template')} — ${template.name}`}
          backHref="/backend/manufacturing/production-stage-templates"
          fields={fields}
          groups={groups}
          initialValues={{
            name: template.name,
            code: template.code,
            description: template.description ?? '',
            sequenceNumber: String(template.sequence_number),
            isActive: String(template.is_active),
            requiresQualityCheck: String(template.requires_quality_check),
            defaultWorkCenterId: template.default_work_center_id ?? '',
            defaultMachineId: template.default_machine_id ?? '',
            estimatedSetupMinutes: template.estimated_setup_minutes,
            estimatedRunMinutes: template.estimated_run_minutes,
            notes: template.notes ?? '',
            updatedAt: template.updated_at ?? undefined,
          }}
          submitLabel={t('common.save', 'Save')}
          cancelHref="/backend/manufacturing/production-stage-templates"
          onSubmit={async (values) => {
            const payload = {
              id,
              ...values,
              sequenceNumber: Number(values.sequenceNumber),
              isActive: values.isActive === 'true',
              requiresQualityCheck: values.requiresQualityCheck === 'true',
            }
            await updateCrud('/api/manufacturing/production-stage-templates', payload)
            flash.success(t('common.saved', 'Saved'))
            router.push('/backend/manufacturing/production-stage-templates')
          }}
          onDelete={async () => {
            await deleteCrud('/api/manufacturing/production-stage-templates', id)
            flash.success(t('common.deleted', 'Deleted'))
            router.push('/backend/manufacturing/production-stage-templates')
          }}
        />
      </PageBody>
    </Page>
  )
}
