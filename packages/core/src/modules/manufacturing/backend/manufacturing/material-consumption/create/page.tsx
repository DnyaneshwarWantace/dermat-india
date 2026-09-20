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

type ProductionOrderItem = { id: string; order_number: string; product_name: string; status: string }
type CatalogProduct = { id: string; title?: string | null; sku?: string | null; default_variant_id?: string | null }
type WarehouseItem = { id: string; name: string; code: string }

export default function CreateMaterialConsumptionPage() {
  const t = useT()
  const router = useRouter()

  const productCacheRef = React.useRef<Map<string, CatalogProduct>>(new Map())

  const loadProductionOrderOptions = React.useCallback(async (query?: string): Promise<CrudFieldOption[]> => {
    const params = new URLSearchParams({ page: '1', pageSize: '20' })
    if (query?.trim()) params.set('search', query.trim())
    const res = await apiCall(`/api/manufacturing/production-orders?${params}`)
    const items = (res as { items?: ProductionOrderItem[] })?.items ?? []
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

  const loadWarehouseOptions = React.useCallback(async (query?: string): Promise<CrudFieldOption[]> => {
    const params = new URLSearchParams({ page: '1', pageSize: '20' })
    if (query?.trim()) params.set('search', query.trim())
    const res = await apiCall(`/api/wms/warehouses?${params}`)
    const items = (res as { items?: WarehouseItem[] })?.items ?? []
    return items.map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` }))
  }, [])

  const fields = React.useMemo<CrudBuiltinField[]>(() => [
    {
      id: 'productionOrderId', label: t('manufacturing.materialConsumption.fields.productionOrder', 'Production Order'),
      type: 'combobox', required: true, group: 'basic', layout: 'full',
      loadOptions: loadProductionOrderOptions, allowCustomValues: false,
      placeholder: t('manufacturing.materialConsumption.fields.productionOrderPlaceholder', 'Search production orders...'),
    },
    {
      id: 'productId', label: t('manufacturing.materialConsumption.fields.material', 'Material / Raw Material'),
      type: 'combobox', required: true, group: 'basic', layout: 'full',
      loadOptions: loadProductOptions, allowCustomValues: false,
      placeholder: t('manufacturing.materialConsumption.fields.materialPlaceholder', 'Search materials...'),
    },
    {
      id: 'plannedQuantity', label: t('manufacturing.materialConsumption.fields.plannedQuantity', 'Planned Quantity'),
      type: 'text', required: true, group: 'quantity', layout: 'half',
    },
    {
      id: 'unitOfMeasure', label: t('manufacturing.materialConsumption.fields.unitOfMeasure', 'Unit of Measure'),
      type: 'text', group: 'quantity', layout: 'half',
    },
    {
      id: 'unitCostCents', label: t('manufacturing.materialConsumption.fields.unitCost', 'Unit Cost (cents)'),
      type: 'number', group: 'quantity', layout: 'half',
    },
    {
      id: 'warehouseId', label: t('manufacturing.materialConsumption.fields.warehouse', 'Warehouse'),
      type: 'combobox', group: 'source', layout: 'half',
      loadOptions: loadWarehouseOptions, allowCustomValues: false,
      placeholder: t('manufacturing.materialConsumption.fields.warehousePlaceholder', 'Select warehouse...'),
    },
    {
      id: 'notes', label: t('manufacturing.materialConsumption.fields.notes', 'Notes'),
      type: 'textarea', group: 'notes',
    },
  ], [t, loadProductionOrderOptions, loadProductOptions, loadWarehouseOptions])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'basic', label: t('manufacturing.materialConsumption.groups.basic', 'Material Details') },
    { id: 'quantity', label: t('manufacturing.materialConsumption.groups.quantity', 'Quantity & Cost') },
    { id: 'source', label: t('manufacturing.materialConsumption.groups.source', 'Source') },
    { id: 'notes', label: t('manufacturing.materialConsumption.groups.notes', 'Notes') },
  ], [t])

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('manufacturing.materialConsumption.create', 'New Material Consumption')}
          backHref="/backend/manufacturing/material-consumption"
          fields={fields}
          groups={groups}
          initialValues={{ unitCostCents: 0 }}
          submitLabel={t('common.create', 'Create')}
          cancelHref="/backend/manufacturing/material-consumption"
          onSubmit={async (values) => {
            const productId = values.productId as string
            const product = productCacheRef.current.get(productId)
            const submitValues = {
              ...values,
              productVariantId: product?.default_variant_id ?? productId,
              productName: product?.title ?? '',
              productSku: product?.sku ?? null,
            }
            delete (submitValues as Record<string, unknown>).productId
            const res = await createCrud('/api/manufacturing/material-consumption', submitValues)
            if (res?.id) {
              flash.success(t('common.created', 'Created'))
              router.push(`/backend/manufacturing/material-consumption/${res.id}`)
            }
          }}
        />
      </PageBody>
    </Page>
  )
}
