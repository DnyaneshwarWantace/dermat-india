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

type ProductionOrderItem = { id: string; order_number: string; product_name: string; product_variant_id: string; status: string }
type CatalogProduct = { id: string; title?: string | null; sku?: string | null; default_variant_id?: string | null }

export default function CreateQualityInspectionPage() {
  const t = useT()
  const router = useRouter()

  const poCacheRef = React.useRef<Map<string, ProductionOrderItem>>(new Map())
  const productCacheRef = React.useRef<Map<string, CatalogProduct>>(new Map())

  const loadProductionOrderOptions = React.useCallback(async (query?: string): Promise<CrudFieldOption[]> => {
    const params = new URLSearchParams({ page: '1', pageSize: '20' })
    if (query?.trim()) params.set('search', query.trim())
    const res = await apiCall(`/api/manufacturing/production-orders?${params}`)
    const items = (res as { items?: ProductionOrderItem[] })?.items ?? []
    for (const item of items) poCacheRef.current.set(item.id, item)
    return items.map((po) => ({
      value: po.id,
      label: `${po.order_number} — ${po.product_name} (${po.status})`,
    }))
  }, [])

  const loadProductOptions = React.useCallback(async (query?: string): Promise<CrudFieldOption[]> => {
    const params = new URLSearchParams({ page: '1', pageSize: '20' })
    if (query?.trim()) params.set('search', query.trim())
    const res = await apiCall(`/api/catalog/products?${params}`)
    const items = (res as { items?: CatalogProduct[] })?.items ?? []
    for (const item of items) productCacheRef.current.set(item.id, item)
    return items.map((p) => ({
      value: p.id,
      label: `${p.sku ? `${p.sku} — ` : ''}${p.title ?? 'Untitled'}`,
    }))
  }, [])

  const fields = React.useMemo<CrudBuiltinField[]>(() => [
    {
      id: 'inspectionType', label: t('manufacturing.qualityInspections.fields.inspectionType', 'Inspection Type'),
      type: 'select', required: true, group: 'basic', layout: 'half',
      options: [
        { value: 'incoming', label: t('manufacturing.qualityInspections.type.incoming', 'Incoming') },
        { value: 'in_process', label: t('manufacturing.qualityInspections.type.in_process', 'In-Process') },
        { value: 'final', label: t('manufacturing.qualityInspections.type.final', 'Final') },
        { value: 'periodic', label: t('manufacturing.qualityInspections.type.periodic', 'Periodic') },
      ],
    },
    {
      id: 'productionOrderId', label: t('manufacturing.qualityInspections.fields.productionOrder', 'Production Order'),
      type: 'combobox', group: 'basic', layout: 'half',
      loadOptions: loadProductionOrderOptions, allowCustomValues: false,
      placeholder: t('manufacturing.qualityInspections.fields.productionOrderPlaceholder', 'Search production orders...'),
    },
    {
      id: 'productId', label: t('manufacturing.qualityInspections.fields.product', 'Product'),
      type: 'combobox', required: true, group: 'basic', layout: 'full',
      loadOptions: loadProductOptions, allowCustomValues: false,
      placeholder: t('manufacturing.qualityInspections.fields.productPlaceholder', 'Search products...'),
    },
    {
      id: 'inspectedQuantity', label: t('manufacturing.qualityInspections.fields.inspectedQuantity', 'Inspected Qty'),
      type: 'text', group: 'quantities', layout: 'third',
    },
    {
      id: 'notes', label: t('manufacturing.qualityInspections.fields.notes', 'Notes'),
      type: 'textarea', group: 'notes',
    },
  ], [t, loadProductionOrderOptions, loadProductOptions])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'basic', label: t('manufacturing.qualityInspections.groups.basic', 'Basic Information') },
    { id: 'quantities', label: t('manufacturing.qualityInspections.groups.quantities', 'Quantities') },
    { id: 'notes', label: t('manufacturing.qualityInspections.groups.notes', 'Notes') },
  ], [t])

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('manufacturing.qualityInspections.create', 'New Inspection')}
          backHref="/backend/manufacturing/quality-inspections"
          fields={fields}
          groups={groups}
          initialValues={{ inspectionType: 'incoming', inspectedQuantity: '0' }}
          submitLabel={t('common.create', 'Create')}
          cancelHref="/backend/manufacturing/quality-inspections"
          onSubmit={async (values) => {
            const productId = values.productId as string
            const product = productCacheRef.current.get(productId)
            const po = values.productionOrderId ? poCacheRef.current.get(values.productionOrderId as string) : null
            const submitValues = {
              ...values,
              productVariantId: product?.default_variant_id ?? productId,
              productName: product?.title ?? '',
            }
            if (po && !values.productId) {
              (submitValues as Record<string, unknown>).productVariantId = po.product_variant_id
              ;(submitValues as Record<string, unknown>).productName = po.product_name
            }
            delete (submitValues as Record<string, unknown>).productId
            const res = await createCrud('/api/manufacturing/quality-inspections', submitValues)
            if (res?.id) {
              flash.success(t('common.created', 'Created'))
              router.push(`/backend/manufacturing/quality-inspections/${res.id}`)
            }
          }}
        />
      </PageBody>
    </Page>
  )
}
