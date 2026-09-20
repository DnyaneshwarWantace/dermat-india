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

type PurchaseInvoiceDetail = {
  id: string
  invoice_number: string
  supplier_invoice_number?: string | null
  supplier_id: string
  purchase_order_id?: string | null
  goods_receipt_id?: string | null
  status: string
  invoice_date: string
  due_date?: string | null
  currency_code?: string | null
  subtotal_cents: number
  tax_cents: number
  total_cents: number
  paid_cents: number
  balance_cents: number
  payment_terms?: string | null
  notes?: string | null
  updated_at?: string | null
}

export default function PurchaseInvoiceDetailPage() {
  const t = useT()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ['purchasing-purchase-invoice', id],
    queryFn: async () => {
      const res = await apiCallOrThrow(`/api/purchasing/purchase-invoices?id=${id}`)
      const items = (res as { items: PurchaseInvoiceDetail[] }).items
      if (!items?.length) throw new Error('Invoice not found')
      return items[0]
    },
  })

  const fields = React.useMemo<CrudFormField[]>(() => [
    { name: 'supplierId', label: t('purchasing.purchaseInvoices.fields.supplier', 'Supplier ID'), type: 'text', required: true, group: 'basic' },
    { name: 'purchaseOrderId', label: t('purchasing.purchaseInvoices.fields.purchaseOrder', 'Purchase Order ID'), type: 'text', group: 'basic' },
    { name: 'goodsReceiptId', label: t('purchasing.purchaseInvoices.fields.goodsReceipt', 'Goods Receipt ID'), type: 'text', group: 'basic' },
    { name: 'supplierInvoiceNumber', label: t('purchasing.purchaseInvoices.fields.supplierInvoiceNumber', 'Supplier Invoice #'), type: 'text', group: 'basic' },
    { name: 'status', label: t('purchasing.purchaseInvoices.fields.status', 'Status'), type: 'select', options: [
      { value: 'draft', label: t('purchasing.purchaseInvoices.status.draft', 'Draft') },
      { value: 'pending_approval', label: t('purchasing.purchaseInvoices.status.pending_approval', 'Pending Approval') },
      { value: 'approved', label: t('purchasing.purchaseInvoices.status.approved', 'Approved') },
      { value: 'paid', label: t('purchasing.purchaseInvoices.status.paid', 'Paid') },
      { value: 'partially_paid', label: t('purchasing.purchaseInvoices.status.partially_paid', 'Partially Paid') },
      { value: 'cancelled', label: t('purchasing.purchaseInvoices.status.cancelled', 'Cancelled') },
    ], group: 'basic' },
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

  if (isLoading) return <LoadingMessage />
  if (error || !invoice) return <ErrorMessage message="Invoice not found" />

  const initialValues = {
    supplierId: invoice.supplier_id,
    purchaseOrderId: invoice.purchase_order_id ?? '',
    goodsReceiptId: invoice.goods_receipt_id ?? '',
    supplierInvoiceNumber: invoice.supplier_invoice_number ?? '',
    status: invoice.status,
    invoiceDate: invoice.invoice_date ? invoice.invoice_date.split('T')[0] : '',
    dueDate: invoice.due_date ? invoice.due_date.split('T')[0] : '',
    currencyCode: invoice.currency_code ?? '',
    paymentTerms: invoice.payment_terms ?? '',
    notes: invoice.notes ?? '',
    updatedAt: invoice.updated_at ?? undefined,
  }

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={`${t('purchasing.purchaseInvoices.edit', 'Edit Invoice')} — ${invoice.invoice_number}`}
          backHref="/backend/purchasing/purchase-invoices"
          fields={fields}
          groups={groups}
          initialValues={initialValues}
          submitLabel={t('common.save', 'Save')}
          cancelHref="/backend/purchasing/purchase-invoices"
          onSubmit={async (values) => {
            await updateCrud('/api/purchasing/purchase-invoices', { id, ...values })
            flash.success(t('common.saved', 'Saved'))
            router.push('/backend/purchasing/purchase-invoices')
          }}
          onDelete={async () => {
            await deleteCrud('/api/purchasing/purchase-invoices', id)
            flash.success(t('common.deleted', 'Deleted'))
            router.push('/backend/purchasing/purchase-invoices')
          }}
        />
      </PageBody>
    </Page>
  )
}
