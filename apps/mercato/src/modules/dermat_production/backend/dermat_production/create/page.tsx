'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { createCrudFormError } from '@open-mercato/ui/backend/utils/serverErrors'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'

export default function CreateProductionBatchPage() {
  const t = useT()
  const router = useRouter()
  const { organizationId, tenantId } = useOrganizationScopeDetail()

  const groups = React.useMemo<CrudFormGroup[]>(
    () => [
      {
        id: 'basic',
        column: 1,
        title: t('dermat_production.form.group.details', 'Batch details'),
        fields: [
          {
            id: 'productName',
            type: 'text',
            label: t('dermat_production.form.field.productName', 'Product name'),
            placeholder: t('dermat_production.form.field.productNamePlaceholder', 'e.g. Zitlite Gel'),
            required: true,
          },
          {
            id: 'orderId',
            type: 'text',
            label: t('dermat_production.form.field.orderId', 'Order reference'),
            placeholder: t('dermat_production.form.field.orderIdPlaceholder', 'Sales order ID (optional)'),
          },
          {
            id: 'plannedQuantity',
            type: 'number',
            label: t('dermat_production.form.field.plannedQuantity', 'Planned quantity'),
            required: true,
          },
          {
            id: 'plannedUnit',
            type: 'text',
            label: t('dermat_production.form.field.plannedUnit', 'Unit'),
            placeholder: t('dermat_production.form.field.plannedUnitPlaceholder', 'e.g. kg'),
            required: true,
          },
        ],
      },
      {
        id: 'stages',
        column: 2,
        title: t('dermat_production.form.group.stages', 'Stage setup'),
        fields: [
          {
            id: 'skipSemiFinished',
            type: 'checkbox',
            label: t('dermat_production.form.field.skipSemiFinished', 'Skip Semi-Finished stage'),
            helpText: t(
              'dermat_production.form.field.skipSemiFinishedHelp',
              'Bulk and Finished Goods stages are always created. Enable this if the team wants to go straight from Bulk to Finished for this batch.'
            ),
          },
        ],
      },
    ],
    [t]
  )

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('dermat_production.create.title', 'New production batch')}
          backHref="/backend/dermat_production"
          fields={[]}
          groups={groups}
          submitLabel={t('dermat_production.form.action.create', 'Create batch')}
          cancelHref="/backend/dermat_production"
          onSubmit={async (values) => {
            const productName = String(values.productName || '').trim()
            if (!productName) {
              throw createCrudFormError(t('dermat_production.form.errors.productNameRequired', 'Product name is required'), {
                productName: t('dermat_production.form.errors.productNameRequired', 'Product name is required'),
              })
            }
            const plannedQuantity = Number(values.plannedQuantity)
            if (!Number.isFinite(plannedQuantity) || plannedQuantity <= 0) {
              throw createCrudFormError(t('dermat_production.form.errors.plannedQuantityInvalid', 'Enter a valid planned quantity'), {
                plannedQuantity: t('dermat_production.form.errors.plannedQuantityInvalid', 'Enter a valid planned quantity'),
              })
            }
            const plannedUnit = String(values.plannedUnit || '').trim()
            if (!plannedUnit) {
              throw createCrudFormError(t('dermat_production.form.errors.plannedUnitRequired', 'Unit is required'), {
                plannedUnit: t('dermat_production.form.errors.plannedUnitRequired', 'Unit is required'),
              })
            }

            const payload = {
              organizationId,
              tenantId,
              productName,
              orderId: values.orderId ? String(values.orderId).trim() : null,
              plannedQuantity,
              plannedUnit,
              skipSemiFinished: values.skipSemiFinished === true,
            }

            const { result } = await createCrud<{ id: string }>('dermat_production/batches', payload)

            flash(t('dermat_production.flash.created', 'Production batch created'), 'success')
            router.push(result?.id ? `/backend/dermat_production/${result.id}` : '/backend/dermat_production')
          }}
        />
      </PageBody>
    </Page>
  )
}
