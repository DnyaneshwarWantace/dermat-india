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

type SupplierDetail = {
  id: string
  name: string
  code: string
  description?: string | null
  status: string
  is_active: boolean
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  website?: string | null
  tax_id?: string | null
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
  currency_code?: string | null
  payment_terms?: string | null
  lead_time_days?: number | null
  notes?: string | null
  updated_at?: string | null
}

export default function SupplierDetailPage() {
  const t = useT()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const { data: supplier, isLoading, error } = useQuery({
    queryKey: ['purchasing-supplier', id],
    queryFn: async () => {
      const res = await apiCallOrThrow(`/api/purchasing/suppliers?id=${id}`)
      const items = (res as { items: SupplierDetail[] }).items
      if (!items?.length) throw new Error('Supplier not found')
      return items[0]
    },
  })

  const fields = React.useMemo<CrudFormField[]>(() => [
    { name: 'name', label: t('purchasing.suppliers.fields.name', 'Name'), type: 'text', required: true, group: 'basic' },
    { name: 'code', label: t('purchasing.suppliers.fields.code', 'Code'), type: 'text', required: true, group: 'basic' },
    { name: 'description', label: 'Description', type: 'textarea', group: 'basic' },
    { name: 'status', label: t('purchasing.suppliers.fields.status', 'Status'), type: 'select', options: [
      { value: 'active', label: t('purchasing.suppliers.status.active', 'Active') },
      { value: 'inactive', label: t('purchasing.suppliers.status.inactive', 'Inactive') },
      { value: 'blocked', label: t('purchasing.suppliers.status.blocked', 'Blocked') },
    ], group: 'basic' },
    { name: 'contactName', label: t('purchasing.suppliers.fields.contactName', 'Contact Name'), type: 'text', group: 'contact' },
    { name: 'contactEmail', label: t('purchasing.suppliers.fields.contactEmail', 'Contact Email'), type: 'email', group: 'contact' },
    { name: 'contactPhone', label: t('purchasing.suppliers.fields.contactPhone', 'Contact Phone'), type: 'text', group: 'contact' },
    { name: 'website', label: t('purchasing.suppliers.fields.website', 'Website'), type: 'text', group: 'contact' },
    { name: 'taxId', label: t('purchasing.suppliers.fields.taxId', 'Tax ID'), type: 'text', group: 'financial' },
    { name: 'currencyCode', label: t('purchasing.suppliers.fields.currencyCode', 'Currency'), type: 'text', group: 'financial' },
    { name: 'paymentTerms', label: t('purchasing.suppliers.fields.paymentTerms', 'Payment Terms'), type: 'text', group: 'financial' },
    { name: 'leadTimeDays', label: t('purchasing.suppliers.fields.leadTimeDays', 'Lead Time (Days)'), type: 'number', group: 'financial' },
    { name: 'addressLine1', label: t('purchasing.suppliers.fields.addressLine1', 'Address Line 1'), type: 'text', group: 'address' },
    { name: 'addressLine2', label: t('purchasing.suppliers.fields.addressLine2', 'Address Line 2'), type: 'text', group: 'address' },
    { name: 'city', label: t('purchasing.suppliers.fields.city', 'City'), type: 'text', group: 'address' },
    { name: 'state', label: t('purchasing.suppliers.fields.state', 'State'), type: 'text', group: 'address' },
    { name: 'postalCode', label: t('purchasing.suppliers.fields.postalCode', 'Postal Code'), type: 'text', group: 'address' },
    { name: 'country', label: t('purchasing.suppliers.fields.country', 'Country'), type: 'text', group: 'address' },
    { name: 'notes', label: t('purchasing.suppliers.fields.notes', 'Notes'), type: 'textarea', group: 'notes' },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'basic', label: 'Basic Information' },
    { id: 'contact', label: 'Contact Information' },
    { id: 'financial', label: 'Financial Details' },
    { id: 'address', label: 'Address' },
    { id: 'notes', label: 'Notes' },
  ], [])

  if (isLoading) return <LoadingMessage />
  if (error || !supplier) return <ErrorMessage message="Supplier not found" />

  const initialValues = {
    name: supplier.name,
    code: supplier.code,
    description: supplier.description ?? '',
    status: supplier.status,
    contactName: supplier.contact_name ?? '',
    contactEmail: supplier.contact_email ?? '',
    contactPhone: supplier.contact_phone ?? '',
    website: supplier.website ?? '',
    taxId: supplier.tax_id ?? '',
    currencyCode: supplier.currency_code ?? '',
    paymentTerms: supplier.payment_terms ?? '',
    leadTimeDays: supplier.lead_time_days ?? null,
    addressLine1: supplier.address_line1 ?? '',
    addressLine2: supplier.address_line2 ?? '',
    city: supplier.city ?? '',
    state: supplier.state ?? '',
    postalCode: supplier.postal_code ?? '',
    country: supplier.country ?? '',
    notes: supplier.notes ?? '',
    updatedAt: supplier.updated_at ?? undefined,
  }

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('purchasing.suppliers.edit', 'Edit Supplier')}
          backHref="/backend/purchasing/suppliers"
          fields={fields}
          groups={groups}
          initialValues={initialValues}
          submitLabel={t('common.save', 'Save')}
          cancelHref="/backend/purchasing/suppliers"
          onSubmit={async (values) => {
            await updateCrud('/api/purchasing/suppliers', { id, ...values })
            flash.success(t('common.saved', 'Saved'))
            router.push('/backend/purchasing/suppliers')
          }}
          onDelete={async () => {
            await deleteCrud('/api/purchasing/suppliers', id)
            flash.success(t('common.deleted', 'Deleted'))
            router.push('/backend/purchasing/suppliers')
          }}
        />
      </PageBody>
    </Page>
  )
}
