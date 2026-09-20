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

type BomListItem = { id: string; name: string; code: string; product_variant_id: string; product_name: string; output_quantity: string; unit_of_measure?: string | null }
type SalesOrderItem = { id: string; order_number: string; status?: string | null }
type WarehouseItem = { id: string; name: string; code: string }

export default function CreateProductionOrderPage() {
  const t = useT()
  const router = useRouter()

  const bomCacheRef = React.useRef<Map<string, BomListItem>>(new Map())

  const loadBomOptions = React.useCallback(async (query?: string): Promise<CrudFieldOption[]> => {
    const params = new URLSearchParams({ page: '1', pageSize: '20', status: 'active' })
    if (query?.trim()) params.set('search', query.trim())
    const res = await apiCall(`/api/manufacturing/bill-of-materials?${params}`)
    const items = (res as { items?: BomListItem[] })?.items ?? []
    for (const item of items) bomCacheRef.current.set(item.id, item)
    return items.map((b) => ({ value: b.id, label: `${b.code} — ${b.name} (${b.product_name})` }))
  }, [])

  const loadSalesOrderOptions = React.useCallback(async (query?: string): Promise<CrudFieldOption[]> => {
    const params = new URLSearchParams({ page: '1', pageSize: '20' })
    if (query?.trim()) params.set('search', query.trim())
    const res = await apiCall(`/api/sales/documents?type=order&${params}`)
    const items = (res as { items?: SalesOrderItem[] })?.items ?? []
    return items.map((o) => ({ value: o.id, label: `${o.order_number}${o.status ? ` (${o.status})` : ''}` }))
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
      id: 'bomId', label: t('manufacturing.productionOrders.fields.bom', 'Bill of Materials'),
      type: 'combobox', required: true, group: 'basic', layout: 'full',
      loadOptions: loadBomOptions, allowCustomValues: false,
      placeholder: t('manufacturing.productionOrders.fields.bomPlaceholder', 'Search BOMs...'),
    },
    {
      id: 'salesOrderId', label: t('manufacturing.productionOrders.fields.salesOrder', 'Sales Order (optional)'),
      type: 'combobox', group: 'basic', layout: 'half',
      loadOptions: loadSalesOrderOptions, allowCustomValues: false,
      placeholder: t('manufacturing.productionOrders.fields.salesOrderPlaceholder', 'Link to sales order...'),
    },
    {
      id: 'priority', label: t('manufacturing.productionOrders.fields.priority', 'Priority'),
      type: 'select', group: 'basic', layout: 'half',
      options: [
        { value: 'low', label: t('manufacturing.productionOrders.priority.low', 'Low') },
        { value: 'normal', label: t('manufacturing.productionOrders.priority.normal', 'Normal') },
        { value: 'high', label: t('manufacturing.productionOrders.priority.high', 'High') },
        { value: 'urgent', label: t('manufacturing.productionOrders.priority.urgent', 'Urgent') },
      ],
    },
    {
      id: 'plannedQuantity', label: t('manufacturing.productionOrders.fields.plannedQuantity', 'Planned Quantity'),
      type: 'text', required: true, group: 'quantity', layout: 'half',
    },
    {
      id: 'unitOfMeasure', label: t('manufacturing.productionOrders.fields.unitOfMeasure', 'Unit of Measure'),
      type: 'text', group: 'quantity', layout: 'half',
    },
    {
      id: 'warehouseId', label: t('manufacturing.productionOrders.fields.warehouse', 'Warehouse'),
      type: 'combobox', group: 'quantity', layout: 'half',
      loadOptions: loadWarehouseOptions, allowCustomValues: false,
      placeholder: t('manufacturing.productionOrders.fields.warehousePlaceholder', 'Select warehouse...'),
    },
    {
      id: 'plannedStartDate', label: t('manufacturing.productionOrders.fields.plannedStartDate', 'Planned Start Date'),
      type: 'date', group: 'schedule', layout: 'half',
    },
    {
      id: 'plannedEndDate', label: t('manufacturing.productionOrders.fields.plannedEndDate', 'Planned End Date'),
      type: 'date', group: 'schedule', layout: 'half',
    },
    {
      id: 'notes', label: t('manufacturing.productionOrders.fields.notes', 'Notes'),
      type: 'textarea', group: 'notes',
    },
  ], [t, loadBomOptions, loadSalesOrderOptions, loadWarehouseOptions])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'basic', label: t('manufacturing.productionOrders.groups.basic', 'Basic Information') },
    { id: 'quantity', label: t('manufacturing.productionOrders.groups.quantity', 'Quantity & Warehouse') },
    { id: 'schedule', label: t('manufacturing.productionOrders.groups.schedule', 'Schedule') },
    { id: 'notes', label: t('manufacturing.productionOrders.groups.notes', 'Notes') },
  ], [t])

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('manufacturing.productionOrders.create', 'New Production Order')}
          backHref="/backend/manufacturing/production-orders"
          fields={fields}
          groups={groups}
          initialValues={{ priority: 'normal' }}
          submitLabel={t('common.create', 'Create')}
          cancelHref="/backend/manufacturing/production-orders"
          onSubmit={async (values) => {
            const bomId = values.bomId as string
            const bom = bomCacheRef.current.get(bomId)
            const submitValues = {
              ...values,
              bomName: bom?.name ?? '',
              productVariantId: bom?.product_variant_id ?? '',
              productName: bom?.product_name ?? '',
              unitOfMeasure: (values.unitOfMeasure as string) || bom?.unit_of_measure || null,
            }
            if (values.salesOrderId) {
              const soRes = await apiCall(`/api/sales/documents?type=order&id=${encodeURIComponent(values.salesOrderId as string)}`)
              const soItems = (soRes as { items?: SalesOrderItem[] })?.items ?? []
              if (soItems.length) (submitValues as Record<string, unknown>).salesOrderNumber = soItems[0].order_number
            }
            const res = await createCrud('/api/manufacturing/production-orders', submitValues)
            if (res?.id) {
              flash.success(t('common.created', 'Created'))
              router.push(`/backend/manufacturing/production-orders/${res.id}`)
            }
          }}
        />
      </PageBody>
    </Page>
  )
}
