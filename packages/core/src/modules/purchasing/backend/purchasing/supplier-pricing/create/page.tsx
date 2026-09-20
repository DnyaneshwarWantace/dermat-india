"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@wantace/ui/backend/Page'
import { CrudForm, type CrudFormField, type CrudFormGroup } from '@wantace/ui/backend/CrudForm'
import { createCrud } from '@wantace/ui/backend/utils/crud'
import { useT } from '@wantace/shared/lib/i18n/context'
import { flash } from '@wantace/ui/backend/FlashMessages'

type SupplierPricingFormValues = {
  supplierId: string
  productVariantId: string
  productName: string
  productSku?: string
  unitPriceCents: number
  currencyCode?: string
  minQuantity?: string
  leadTimeDays?: number | null
  validFrom?: string
  validTo?: string
  isActive?: boolean
  notes?: string
}

export default function CreateSupplierPricingPage() {
  const t = useT()
  const router = useRouter()

  const fields = React.useMemo<CrudFormField[]>(() => [
    { name: 'supplierId', label: t('purchasing.supplierPricing.fields.supplier', 'Supplier ID'), type: 'text', required: true, group: 'basic' },
    { name: 'productVariantId', label: t('purchasing.supplierPricing.fields.productVariantId', 'Product Variant ID'), type: 'text', required: true, group: 'basic' },
    { name: 'productName', label: t('purchasing.supplierPricing.fields.productName', 'Product Name'), type: 'text', required: true, group: 'basic' },
    { name: 'productSku', label: t('purchasing.supplierPricing.fields.productSku', 'SKU'), type: 'text', group: 'basic' },
    { name: 'unitPriceCents', label: t('purchasing.supplierPricing.fields.unitPrice', 'Unit Price (cents)'), type: 'number', required: true, group: 'pricing' },
    { name: 'currencyCode', label: t('purchasing.supplierPricing.fields.currency', 'Currency'), type: 'text', group: 'pricing' },
    { name: 'minQuantity', label: t('purchasing.supplierPricing.fields.minQuantity', 'Min Quantity'), type: 'text', group: 'pricing' },
    { name: 'leadTimeDays', label: t('purchasing.supplierPricing.fields.leadTimeDays', 'Lead Time (Days)'), type: 'number', group: 'pricing' },
    { name: 'validFrom', label: t('purchasing.supplierPricing.fields.validFrom', 'Valid From'), type: 'date', group: 'validity' },
    { name: 'validTo', label: t('purchasing.supplierPricing.fields.validTo', 'Valid To'), type: 'date', group: 'validity' },
    { name: 'isActive', label: t('purchasing.supplierPricing.fields.isActive', 'Active'), type: 'checkbox', group: 'validity' },
    { name: 'notes', label: t('purchasing.supplierPricing.fields.notes', 'Notes'), type: 'textarea', group: 'notes' },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'basic', label: 'Product Information' },
    { id: 'pricing', label: 'Pricing Details' },
    { id: 'validity', label: 'Validity Period' },
    { id: 'notes', label: 'Notes' },
  ], [])

  return (
    <Page>
      <PageBody>
        <CrudForm<SupplierPricingFormValues>
          title={t('purchasing.supplierPricing.create', 'New Pricing Rule')}
          backHref="/backend/purchasing/supplier-pricing"
          fields={fields}
          groups={groups}
          initialValues={{ isActive: true, minQuantity: '1' }}
          submitLabel={t('common.create', 'Create')}
          cancelHref="/backend/purchasing/supplier-pricing"
          onSubmit={async (values) => {
            const res = await createCrud('/api/purchasing/supplier-pricing', values)
            if (res?.id) {
              flash.success(t('common.created', 'Created'))
              router.push('/backend/purchasing/supplier-pricing')
            }
          }}
        />
      </PageBody>
    </Page>
  )
}
