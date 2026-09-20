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

type SupplierPricingDetail = {
  id: string
  supplier_id: string
  product_variant_id: string
  product_name: string
  product_sku?: string | null
  unit_price_cents: number
  currency_code?: string | null
  min_quantity: string
  lead_time_days?: number | null
  valid_from?: string | null
  valid_to?: string | null
  is_active: boolean
  notes?: string | null
  updated_at?: string | null
}

export default function SupplierPricingDetailPage() {
  const t = useT()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const { data: pricing, isLoading, error } = useQuery({
    queryKey: ['purchasing-supplier-pricing', id],
    queryFn: async () => {
      const res = await apiCallOrThrow(`/api/purchasing/supplier-pricing?id=${id}`)
      const items = (res as { items: SupplierPricingDetail[] }).items
      if (!items?.length) throw new Error('Pricing rule not found')
      return items[0]
    },
  })

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

  if (isLoading) return <LoadingMessage />
  if (error || !pricing) return <ErrorMessage message="Pricing rule not found" />

  const initialValues = {
    supplierId: pricing.supplier_id,
    productVariantId: pricing.product_variant_id,
    productName: pricing.product_name,
    productSku: pricing.product_sku ?? '',
    unitPriceCents: pricing.unit_price_cents,
    currencyCode: pricing.currency_code ?? '',
    minQuantity: pricing.min_quantity,
    leadTimeDays: pricing.lead_time_days ?? null,
    validFrom: pricing.valid_from ?? '',
    validTo: pricing.valid_to ?? '',
    isActive: pricing.is_active,
    notes: pricing.notes ?? '',
    updatedAt: pricing.updated_at ?? undefined,
  }

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('purchasing.supplierPricing.edit', 'Edit Pricing Rule')}
          backHref="/backend/purchasing/supplier-pricing"
          fields={fields}
          groups={groups}
          initialValues={initialValues}
          submitLabel={t('common.save', 'Save')}
          cancelHref="/backend/purchasing/supplier-pricing"
          onSubmit={async (values) => {
            await updateCrud('/api/purchasing/supplier-pricing', { id, ...values })
            flash.success(t('common.saved', 'Saved'))
            router.push('/backend/purchasing/supplier-pricing')
          }}
          onDelete={async () => {
            await deleteCrud('/api/purchasing/supplier-pricing', id)
            flash.success(t('common.deleted', 'Deleted'))
            router.push('/backend/purchasing/supplier-pricing')
          }}
        />
      </PageBody>
    </Page>
  )
}
