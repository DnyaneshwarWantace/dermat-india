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
import { DEPARTMENT_TYPES } from '../../../data/validators'

type DepartmentData = {
  id: string
  name: string
  type: string
  contact_email: string | null
  contact_phone: string | null
  is_active: boolean
  organization_id: string
  tenant_id: string
  updated_at?: string | null
}

export default function EditDepartmentPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()

  const [department, setDepartment] = React.useState<DepartmentData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isNotFound, setIsNotFound] = React.useState(false)

  React.useEffect(() => {
    async function loadDepartment() {
      try {
        const response = await apiCall<{ items: DepartmentData[] }>(`/api/dermat_departments/departments?id=${params?.id}`)
        if (response.ok && response.result && response.result.items.length > 0) {
          setDepartment(response.result.items[0])
        } else if (!response.ok) {
          setError(t('dermat_departments.form.errors.load', 'Failed to load department'))
        } else {
          setIsNotFound(true)
        }
      } catch (err) {
        setError(t('dermat_departments.form.errors.load', 'Failed to load department'))
      } finally {
        setLoading(false)
      }
    }
    loadDepartment()
  }, [params, t])

  const groups = React.useMemo<CrudFormGroup[]>(
    () => [
      {
        id: 'basic',
        column: 1,
        title: t('dermat_departments.form.group.details', 'Department details'),
        fields: [
          {
            id: 'name',
            type: 'text',
            label: t('dermat_departments.form.field.name', 'Name'),
            required: true,
          },
          {
            id: 'type',
            type: 'select',
            label: t('dermat_departments.form.field.type', 'Type'),
            required: true,
            options: DEPARTMENT_TYPES.map((type) => ({ label: type, value: type })),
          },
          {
            id: 'isActive',
            type: 'checkbox',
            label: t('dermat_departments.form.field.isActive', 'Active'),
          },
        ],
      },
      {
        id: 'contact',
        column: 2,
        title: t('dermat_departments.form.group.contact', 'Shared contact (department queue)'),
        fields: [
          {
            id: 'contactEmail',
            type: 'text',
            label: t('dermat_departments.form.field.contactEmail', 'Shared email'),
            helpText: t('dermat_departments.form.field.contactEmailHelp', 'Shared inbox for this department, not a personal address.'),
          },
          {
            id: 'contactPhone',
            type: 'text',
            label: t('dermat_departments.form.field.contactPhone', 'Shared phone (WhatsApp)'),
            helpText: t('dermat_departments.form.field.contactPhoneHelp', 'Shared WhatsApp-enabled number for this department queue.'),
          },
        ],
      },
    ],
    [t]
  )

  if (loading) {
    return (
      <Page>
        <PageBody>
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground">{t('dermat_departments.form.loading', 'Loading...')}</div>
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
            label={t('dermat_departments.form.errors.notFound', 'Department not found.')}
            backHref="/backend/dermat_departments"
            backLabel={t('dermat_departments.form.actions.backToList', 'Back to departments')}
          />
        </PageBody>
      </Page>
    )
  }

  if (error || !department) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={error ?? t('dermat_departments.form.errors.notFound', 'Department not found.')} />
        </PageBody>
      </Page>
    )
  }

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('dermat_departments.edit.title', 'Edit department')}
          backHref="/backend/dermat_departments"
          versionHistory={{ resourceKind: 'dermat_departments.department', resourceId: department.id }}
          fields={[]}
          groups={groups}
          optimisticLockUpdatedAt={department.updated_at ?? null}
          initialValues={{
            name: department.name,
            type: department.type,
            contactEmail: department.contact_email || '',
            contactPhone: department.contact_phone || '',
            isActive: department.is_active,
          }}
          submitLabel={t('dermat_departments.form.action.save', 'Save changes')}
          cancelHref="/backend/dermat_departments"
          onSubmit={async (values) => {
            const name = String(values.name || '').trim()
            if (!name) {
              throw createCrudFormError(t('dermat_departments.form.errors.nameRequired', 'Name is required'), {
                name: t('dermat_departments.form.errors.nameRequired', 'Name is required'),
              })
            }
            const contactEmail = values.contactEmail ? String(values.contactEmail).trim() : ''
            if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
              throw createCrudFormError(t('dermat_departments.form.errors.contactEmailInvalid', 'Enter a valid email address'), {
                contactEmail: t('dermat_departments.form.errors.contactEmailInvalid', 'Enter a valid email address'),
              })
            }

            const payload = {
              id: department.id,
              name,
              type: values.type,
              contactEmail: contactEmail || null,
              contactPhone: values.contactPhone ? String(values.contactPhone).trim() : null,
              isActive: values.isActive !== false,
            }

            await updateCrud('dermat_departments/departments', payload)

            flash(t('dermat_departments.flash.updated', 'Department updated'), 'success')
            router.push('/backend/dermat_departments')
          }}
        />
      </PageBody>
    </Page>
  )
}
