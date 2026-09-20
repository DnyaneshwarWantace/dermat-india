"use client"

import * as React from 'react'
import { Input } from '@open-mercato/ui/primitives/input'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
import { DictionarySelectField } from '../../formConfig'
import { createDictionarySelectLabels } from '../utils'
import { DealFormField } from './DealFormField'
import { PipelineSelect } from './PipelineSelect'
import { PipelineStageSelect } from './PipelineStageSelect'
import { SuffixInput } from './SuffixInput'
import { sanitizeAmount } from './dealNumericInput'
import type { BaseValues } from './dealFormTypes'
import type { PipelineOption, PipelineStageOption } from './useDealPipelines'

type Translate = (key: string, fallback: string, params?: Record<string, string | number>) => string

export type DealDetailsFieldsProps = {
  values: BaseValues
  errors: Record<string, string>
  isSubmitting: boolean
  patch: (partial: Partial<BaseValues>) => void
  onPipelineChange: (id: string) => void
  pipelines: PipelineOption[]
  stages: PipelineStageOption[]
  statusLabels: ReturnType<typeof createDictionarySelectLabels>
  tr: Translate
}

export function DealDetailsFields({
  values,
  errors,
  isSubmitting,
  patch,
  onPipelineChange,
  pipelines,
  stages,
  statusLabels,
  tr,
}: DealDetailsFieldsProps) {
  return (
    <>
      <DealFormField
        fieldId="title"
        label={tr('customers.deals.create.fields.title', 'Deal title')}
        required
        hint={tr('customers.deals.create.hints.title', 'Short, descriptive name shown on pipeline cards')}
        error={errors.title}
      >
        <Input
          value={values.title}
          onChange={(event) => patch({ title: event.target.value })}
          aria-invalid={errors.title ? true : undefined}
          disabled={isSubmitting}
        />
      </DealFormField>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DealFormField fieldId="status" label={tr('customers.people.detail.deals.fields.status', 'Status')}>
          <DictionarySelectField
            kind="deal-statuses"
            value={values.status || undefined}
            onChange={(next) => patch({ status: next ?? '' })}
            labels={statusLabels}
            selectClassName="w-full"
            showActiveAppearance={false}
          />
        </DealFormField>
        <DealFormField fieldId="pipelineId" label={tr('customers.people.detail.deals.fields.pipeline', 'Pipeline')}>
          <PipelineSelect
            pipelines={pipelines}
            value={values.pipelineId}
            onChange={onPipelineChange}
            disabled={isSubmitting}
            placeholder={tr('customers.deals.form.pipeline.placeholder', 'Select pipeline…')}
          />
        </DealFormField>
      </div>

      <DealFormField
        fieldId="pipelineStageId"
        label={tr('customers.people.detail.deals.fields.pipelineStage', 'Pipeline stage')}
        hint={tr('customers.deals.create.hints.pipelineStage', 'Stages depend on the selected pipeline')}
      >
        <PipelineStageSelect
          stages={stages}
          value={values.pipelineStageId}
          onChange={(id) => patch({ pipelineStageId: id })}
          disabled={isSubmitting || !values.pipelineId}
          placeholder={tr('customers.deals.form.pipelineStage.placeholder', 'Select stage…')}
          formatCount={(position, total) =>
            tr('customers.deals.create.fields.stageOf', '· stage {position} of {total}', { position, total })
          }
        />
      </DealFormField>

      <DealFormField
        fieldId="valueAmount"
        label={tr('customers.deals.create.fields.valueAmount', 'Deal value')}
        hint={tr('customers.deals.create.hints.valueAmount', 'Potential revenue from this opportunity')}
        error={errors.valueAmount}
      >
        <SuffixInput
          suffix="₹"
          inputMode="decimal"
          value={values.valueAmount}
          onChange={(event) => patch({ valueAmount: sanitizeAmount(event.target.value) })}
          placeholder="0"
          aria-invalid={errors.valueAmount ? true : undefined}
          disabled={isSubmitting}
        />
      </DealFormField>

      <DealFormField fieldId="description" label={tr('customers.people.detail.deals.fields.description', 'Description')}>
        <Textarea
          value={values.description}
          onChange={(event) => patch({ description: event.target.value })}
          disabled={isSubmitting}
        />
      </DealFormField>
    </>
  )
}

export default DealDetailsFields
