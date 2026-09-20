"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@wantace/ui/backend/Page'
import { CrudForm, type CrudFormField, type CrudFormGroup } from '@wantace/ui/backend/CrudForm'
import { createCrud } from '@wantace/ui/backend/utils/crud'
import { useT } from '@wantace/shared/lib/i18n/context'
import { flash } from '@wantace/ui/backend/FlashMessages'

type PurchaseInvoiceFormValues = {
  supplierId: string
  purchaseOrderId?: string
  goodsReceiptId?: string
  supplierInvoiceNumber?: string
  invoiceDate: string
  dueDate?: string
  currencyCode?: string
  paymentTerms?: string
  notes?: string
  lines: Array<{
    lineNumber: number
    productName: string
    quantity: string
    unitPriceCents: number
    taxRate?: string
  }>
}

export default function CreatePurchaseInvoicePage() {
  const t = useT()
  const router = useRouter()

  const fields = React.useMemo<CrudFormField[]>(() => [
    { name: 'supplierId', label: t('purchasing.purchaseInvoices.fields.supplier', 'Supplier ID'), type: 'text', required: true, group: 'basic' },
    { name: 'purchaseOrderId', label: t('purchasing.purchaseInvoices.fields.purchaseOrder', 'Purchase Order ID'), type: 'text', group: 'basic' },
    { name: 'goodsReceiptId', label: t('purchasing.purchaseInvoices.fields.goodsReceipt', 'Goods Receipt ID'), type: 'text', group: 'basic' },
    { name: 'supplierInvoiceNumber', label: t('purchasing.purchaseInvoices.fields.supplierInvoiceNumber', 'Supplier Invoice #'), type: 'text', group: 'basic' },
    { name: 'invoiceDate', label: t('purchasing.purchaseInvoices.fields.invoiceDate', 'Invoice Date'), type: 'date', required: true, group: 'dates' },
    { name: 'dueDate', label: t('purchasing.purchaseInvoices.fields.dueDate', 'Due Date'), type: 'date', group: 'dates' },
    { name: 'currencyCode', label: t('purchasing.purchaseInvoices.fields.currency', 'Currency'), type: 'text', group: 'financial' },
    { name: 'paymentTerms', label: t('purchasing.purchaseInvoices.fields.paymentTerms', 'Payment Terms'), type: 'text', group: 'financial' },
    { name: 'notes', label: t('purchasing.purchaseInvoices.fields.notes', 'Notes'), type: 'textarea', group: 'notes' },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'basic', label: 'Invoice Details' },
    { id: 'dates', label: 'Dates' },
    { id: 'financial', label: 'Financial' },
    { id: 'notes', label: 'Notes' },
  ], [])

  return (
    <Page>
      <PageBody>
        <CrudForm<PurchaseInvoiceFormValues>
          title={t('purchasing.purchaseInvoices.create', 'New Purchase Invoice')}
          backHref="/backend/purchasing/purchase-invoices"
          fields={fields}
          groups={groups}
          initialValues={{
            invoiceDate: new Date().toISOString().split('T')[0],
            lines: [{ lineNumber: 1, productName: '', quantity: '1', unitPriceCents: 0 }],
          }}
          submitLabel={t('common.create', 'Create')}
          cancelHref="/backend/purchasing/purchase-invoices"
          onSubmit={async (values) => {
            const res = await createCrud('/api/purchasing/purchase-invoices', values)
            if (res?.id) {
              flash.success(t('common.created', 'Created'))
              router.push(`/backend/purchasing/purchase-invoices/${res.id}`)
            }
          }}
        />
      </PageBody>
    </Page>
  )
}
