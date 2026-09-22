'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { createCrudFormError } from '@open-mercato/ui/backend/utils/serverErrors'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { RecordNotFoundState, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { RM_BENEFIT_TAGS, RM_PHYSICAL_STATES, RM_UNITS } from '../../../data/validators'

type RawMaterialData = {
  id: string
  name: string
  inci_name: string | null
  code: string
  stock: string | number | null
  unit: string
  make_brand_name: string | null
  supplier: string | null
  benefit: string | null
  alternate_rm: string | null
  physical_state: string | null
  organization_id: string
  tenant_id: string
  updated_at?: string | null
}

export default function RawMaterialDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()

  const [material, setMaterial] = React.useState<RawMaterialData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isNotFound, setIsNotFound] = React.useState(false)
  const [supplierOptions, setSupplierOptions] = React.useState<{ label: string; value: string }[]>([])

  React.useEffect(() => {
    async function load() {
      try {
        const response = await apiCall<{ items: RawMaterialData[] }>(`/api/dermat_rm_master/rm_master?id=${params?.id}`)
        if (response.ok && response.result && response.result.items.length > 0) {
          setMaterial(response.result.items[0])
        } else if (!response.ok) {
          setError(t('dermat_rm_master.form.errors.load', 'Failed to load raw material'))
        } else {
          setIsNotFound(true)
        }
      } catch (err) {
        setError(t('dermat_rm_master.form.errors.load', 'Failed to load raw material'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params, t])

  React.useEffect(() => {
    apiCall<{ items?: Array<{ id: string; name: string; is_active?: boolean }> }>('/api/dermat_vendors/vendors?pageSize=100', undefined, { fallback: { items: [] } })
      .then((res) => {
        if (!res.ok) return
        const items = (res.result?.items ?? []).filter((v) => v.is_active !== false)
        setSupplierOptions(items.map((v) => ({ label: v.name, value: v.name })))
      })
  }, [])

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
            required: true,
          },
          {
            id: 'inciName',
            type: 'text',
            label: t('dermat_rm_master.form.field.inciName', 'INCI name'),
          },
          {
            id: 'code',
            type: 'text',
            label: t('dermat_rm_master.form.field.code', 'Code'),
          },
          {
            id: 'stock',
            type: 'number',
            label: t('dermat_rm_master.form.field.stock', 'Stock'),
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
          },
          {
            id: 'supplier',
            type: 'select',
            label: t('dermat_rm_master.form.field.supplier', 'Supplier'),
            options: [
              { label: t('dermat_rm_master.form.field.none', 'None'), value: '' },
              ...supplierOptions,
            ],
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
    [t, supplierOptions]
  )

  if (loading) {
    return (
      <Page>
        <PageBody>
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground">{t('dermat_rm_master.form.loading', 'Loading...')}</div>
          </div>
        </PageBody>
      </Page>
    )
  }

  if (isNotFound) {
    return (
      <Page>
        <PageBody>
          <RecordNotFoundState
            label={t('dermat_rm_master.form.errors.notFound', 'Raw material not found.')}
            backHref="/backend/dermat_rm_master"
            backLabel={t('dermat_rm_master.form.actions.backToList', 'Back to raw materials')}
          />
        </PageBody>
      </Page>
    )
  }

  if (error || !material) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={error ?? t('dermat_rm_master.form.errors.notFound', 'Raw material not found.')} />
        </PageBody>
      </Page>
    )
  }

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('dermat_rm_master.detail.title', 'Raw material')}
          backHref="/backend/dermat_rm_master"
          fields={[]}
          groups={groups}
          optimisticLockUpdatedAt={material.updated_at ?? null}
          initialValues={{
            name: material.name,
            inciName: material.inci_name || '',
            code: material.code || '',
            stock: material.stock ?? 0,
            unit: material.unit,
            makeBrandName: material.make_brand_name || '',
            supplier: material.supplier || '',
            benefit: material.benefit || '',
            alternateRm: material.alternate_rm || '',
            physicalState: material.physical_state || '',
          }}
          submitLabel={t('dermat_rm_master.form.action.save', 'Save changes')}
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
              id: material.id,
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

            await updateCrud('dermat_rm_master/rm_master', payload)

            flash(t('dermat_rm_master.flash.updated', 'Raw material updated'), 'success')
            router.push('/backend/dermat_rm_master')
          }}
        />
      </PageBody>
    </Page>
  )
}
