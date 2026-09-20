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
import { PM_CATEGORIES, PM_UNITS } from '../../../data/validators'

export default function CreatePackagingMaterialPage() {
  const t = useT()
  const router = useRouter()
  const { organizationId, tenantId } = useOrganizationScopeDetail()

  const groups = React.useMemo<CrudFormGroup[]>(
    () => [
      {
        id: 'basic',
        column: 1,
        title: t('dermat_pm_master.form.group.details', 'Packaging material details'),
        fields: [
          {
            id: 'name',
            type: 'text',
            label: t('dermat_pm_master.form.field.name', 'Name'),
            placeholder: t('dermat_pm_master.form.field.namePlaceholder', 'e.g. Carton - 25gm Tube Box'),
            required: true,
          },
          {
            id: 'code',
            type: 'text',
            label: t('dermat_pm_master.form.field.code', 'Code'),
            placeholder: t('dermat_pm_master.form.field.codePlaceholder', 'Leave blank to auto-generate (e.g. PM-004)'),
            helpText: t('dermat_pm_master.form.field.codeHelp', 'Auto-generated sequentially if left blank; you can also set it manually.'),
          },
          {
            id: 'stock',
            type: 'number',
            label: t('dermat_pm_master.form.field.stock', 'Stock'),
            placeholder: '0',
            defaultValue: '0',
          },
          {
            id: 'unit',
            type: 'select',
            label: t('dermat_pm_master.form.field.unit', 'Unit'),
            required: true,
            options: PM_UNITS.map((unit) => ({ label: unit, value: unit })),
          },
        ],
      },
      {
        id: 'sourcing',
        column: 2,
        title: t('dermat_pm_master.form.group.sourcing', 'Sourcing & properties'),
        fields: [
          {
            id: 'makeBrandName',
            type: 'text',
            label: t('dermat_pm_master.form.field.makeBrandName', 'Make/brand'),
            placeholder: t('dermat_pm_master.form.field.makeBrandNamePlaceholder', 'e.g. NV Packaging'),
          },
          {
            id: 'supplier',
            type: 'text',
            label: t('dermat_pm_master.form.field.supplier', 'Supplier'),
            placeholder: t('dermat_pm_master.form.field.supplierPlaceholder', 'e.g. Barentez Packaging'),
          },
          {
            id: 'category',
            type: 'select',
            label: t('dermat_pm_master.form.field.category', 'Category'),
            options: [
              { label: t('dermat_pm_master.form.field.none', 'None'), value: '' },
              ...PM_CATEGORIES.map((category) => ({ label: category, value: category })),
            ],
          },
          {
            id: 'dimensions',
            type: 'text',
            label: t('dermat_pm_master.form.field.dimensions', 'Dimensions'),
            placeholder: t('dermat_pm_master.form.field.dimensionsPlaceholder', 'e.g. 25gm, 100ml, A6'),
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
          title={t('dermat_pm_master.create.title', 'Create packaging material')}
          backHref="/backend/dermat_pm_master"
          fields={[]}
          groups={groups}
          submitLabel={t('dermat_pm_master.form.action.create', 'Create packaging material')}
          cancelHref="/backend/dermat_pm_master"
          onSubmit={async (values) => {
            const name = String(values.name || '').trim()
            if (!name) {
              throw createCrudFormError(t('dermat_pm_master.form.errors.nameRequired', 'Name is required'), {
                name: t('dermat_pm_master.form.errors.nameRequired', 'Name is required'),
              })
            }
            const unit = String(values.unit || '').trim()
            if (!unit) {
              throw createCrudFormError(t('dermat_pm_master.form.errors.unitRequired', 'Unit is required'), {
                unit: t('dermat_pm_master.form.errors.unitRequired', 'Unit is required'),
              })
            }
            const stockValue = values.stock !== undefined && values.stock !== '' ? Number(values.stock) : 0
            if (Number.isNaN(stockValue) || stockValue < 0) {
              throw createCrudFormError(t('dermat_pm_master.form.errors.stockInvalid', 'Stock must be a number of at least 0'), {
                stock: t('dermat_pm_master.form.errors.stockInvalid', 'Stock must be a number of at least 0'),
              })
            }

            const payload = {
              organizationId,
              tenantId,
              name,
              code: values.code ? String(values.code).trim() : '',
              stock: stockValue,
              unit,
              makeBrandName: values.makeBrandName ? String(values.makeBrandName).trim() : null,
              supplier: values.supplier ? String(values.supplier).trim() : null,
              category: values.category ? String(values.category).trim() : null,
              dimensions: values.dimensions ? String(values.dimensions).trim() : null,
            }

            await createCrud('dermat_pm_master/pm_master', payload)

            flash(t('dermat_pm_master.flash.created', 'Packaging material created'), 'success')
            router.push('/backend/dermat_pm_master')
          }}
        />
      </PageBody>
    </Page>
  )
}
