"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@wantace/ui/backend/Page'
import { CrudForm, type CrudFormField, type CrudFormGroup } from '@wantace/ui/backend/CrudForm'
import { createCrud } from '@wantace/ui/backend/utils/crud'
import { useT } from '@wantace/shared/lib/i18n/context'
import { flash } from '@wantace/ui/backend/FlashMessages'

type SupplierFormValues = {
  name: string
  code: string
  description?: string
  status: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  website?: string
  taxId?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  currencyCode?: string
  paymentTerms?: string
  leadTimeDays?: number | null
  notes?: string
}

export default function CreateSupplierPage() {
  const t = useT()
  const router = useRouter()

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

  return (
    <Page>
      <PageBody>
        <CrudForm<SupplierFormValues>
          title={t('purchasing.suppliers.create', 'New Supplier')}
          backHref="/backend/purchasing/suppliers"
          fields={fields}
          groups={groups}
          initialValues={{ status: 'active' }}
          submitLabel={t('common.create', 'Create')}
          cancelHref="/backend/purchasing/suppliers"
          onSubmit={async (values) => {
            const res = await createCrud('/api/purchasing/suppliers', values)
            if (res?.id) {
              flash.success(t('common.created', 'Created'))
              router.push(`/backend/purchasing/suppliers/${res.id}`)
            }
          }}
        />
      </PageBody>
    </Page>
  )
}
