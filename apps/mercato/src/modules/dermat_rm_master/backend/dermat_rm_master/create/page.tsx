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
import { RM_BENEFIT_TAGS, RM_PHYSICAL_STATES, RM_UNITS } from '../../../data/validators'

export default function CreateRawMaterialPage() {
  const t = useT()
  const router = useRouter()
  const { organizationId, tenantId } = useOrganizationScopeDetail()

  const groups = React.useMemo<CrudFormGroup[]>(
    () => [
      {
        id: 'basic',
        column: 1,
        title: t('dermat_rm_master.form.group.details', 'Raw material details'),
        fields: [
          {
            id: 'name',
            type: 'text',
            label: t('dermat_rm_master.form.field.name', 'Name'),
            placeholder: t('dermat_rm_master.form.field.namePlaceholder', 'e.g. Brightenyl'),
            required: true,
          },
          {
            id: 'inciName',
            type: 'text',
            label: t('dermat_rm_master.form.field.inciName', 'INCI name'),
            placeholder: t('dermat_rm_master.form.field.inciNamePlaceholder', 'e.g. Glycerin aqua & diglucosyl gallic acid'),
          },
          {
            id: 'code',
            type: 'text',
            label: t('dermat_rm_master.form.field.code', 'Code'),
            placeholder: t('dermat_rm_master.form.field.codePlaceholder', 'Leave blank to auto-generate (e.g. AP-004)'),
            helpText: t('dermat_rm_master.form.field.codeHelp', 'Auto-generated sequentially if left blank; you can also set it manually.'),
          },
          {
            id: 'stock',
            type: 'number',
            label: t('dermat_rm_master.form.field.stock', 'Stock'),
            placeholder: '0',
            defaultValue: '0',
          },
          {
            id: 'unit',
            type: 'select',
            label: t('dermat_rm_master.form.field.unit', 'Unit'),
            required: true,
            options: RM_UNITS.map((unit) => ({ label: unit, value: unit })),
          },
        ],
      },
      {
        id: 'sourcing',
        column: 2,
        title: t('dermat_rm_master.form.group.sourcing', 'Sourcing & properties'),
        fields: [
          {
            id: 'makeBrandName',
            type: 'text',
            label: t('dermat_rm_master.form.field.makeBrandName', 'Make/brand'),
            placeholder: t('dermat_rm_master.form.field.makeBrandNamePlaceholder', 'e.g. NV Organics'),
          },
          {
            id: 'supplier',
            type: 'text',
            label: t('dermat_rm_master.form.field.supplier', 'Supplier'),
            placeholder: t('dermat_rm_master.form.field.supplierPlaceholder', 'e.g. Barentez India'),
          },
          {
            id: 'benefit',
            type: 'select',
            label: t('dermat_rm_master.form.field.benefit', 'Benefit'),
            options: [
              { label: t('dermat_rm_master.form.field.none', 'None'), value: '' },
              ...RM_BENEFIT_TAGS.map((benefit) => ({ label: benefit, value: benefit })),
            ],
          },
          {
            id: 'alternateRm',
            type: 'text',
            label: t('dermat_rm_master.form.field.alternateRm', 'Alternate RM'),
            placeholder: t('dermat_rm_master.form.field.alternateRmPlaceholder', 'e.g. NIL'),
          },
          {
            id: 'physicalState',
            type: 'select',
            label: t('dermat_rm_master.form.field.physicalState', 'Physical state'),
            options: [
              { label: t('dermat_rm_master.form.field.none', 'None'), value: '' },
              ...RM_PHYSICAL_STATES.map((state) => ({ label: state, value: state })),
            ],
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
          title={t('dermat_rm_master.create.title', 'Create raw material')}
          backHref="/backend/dermat_rm_master"
          fields={[]}
          groups={groups}
          submitLabel={t('dermat_rm_master.form.action.create', 'Create raw material')}
          cancelHref="/backend/dermat_rm_master"
          onSubmit={async (values) => {
            const name = String(values.name || '').trim()
            if (!name) {
              throw createCrudFormError(t('dermat_rm_master.form.errors.nameRequired', 'Name is required'), {
                name: t('dermat_rm_master.form.errors.nameRequired', 'Name is required'),
              })
            }
            const unit = String(values.unit || '').trim()
            if (!unit) {
              throw createCrudFormError(t('dermat_rm_master.form.errors.unitRequired', 'Unit is required'), {
                unit: t('dermat_rm_master.form.errors.unitRequired', 'Unit is required'),
              })
            }
            const stockValue = values.stock !== undefined && values.stock !== '' ? Number(values.stock) : 0
            if (Number.isNaN(stockValue) || stockValue < 0) {
              throw createCrudFormError(t('dermat_rm_master.form.errors.stockInvalid', 'Stock must be a number of at least 0'), {
                stock: t('dermat_rm_master.form.errors.stockInvalid', 'Stock must be a number of at least 0'),
              })
            }

            const payload = {
              organizationId,
              tenantId,
              name,
              inciName: values.inciName ? String(values.inciName).trim() : null,
              code: values.code ? String(values.code).trim() : '',
              stock: stockValue,
              unit,
              makeBrandName: values.makeBrandName ? String(values.makeBrandName).trim() : null,
              supplier: values.supplier ? String(values.supplier).trim() : null,
              benefit: values.benefit ? String(values.benefit).trim() : null,
              alternateRm: values.alternateRm ? String(values.alternateRm).trim() : null,
              physicalState: values.physicalState ? String(values.physicalState).trim() : null,
            }

            await createCrud('dermat_rm_master/rm_master', payload)

            flash(t('dermat_rm_master.flash.created', 'Raw material created'), 'success')
            router.push('/backend/dermat_rm_master')
          }}
        />
      </PageBody>
    </Page>
  )
}
