"use client"

import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { createCrudFormError } from '@open-mercato/ui/backend/utils/serverErrors'
import { collectCustomFieldValues } from '@open-mercato/ui/backend/utils/customFieldValues'
import { slugify } from '@open-mercato/shared/lib/slugify'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { E } from '#generated/entities.ids.generated'

type CategoryFormValues = {
  name: string
  description?: string
  isActive?: boolean
}

async function submitCategoryCreate(values: CategoryFormValues, t: (key: string, fallback?: string) => string) {
  const name = typeof values.name === 'string' ? values.name.trim() : ''
  if (!name) {
    const message = t('catalog.categories.form.errors.name', 'Provide the category name.')
    throw createCrudFormError(message, { name: message })
  }
  const slug = slugify(name) || undefined
  const description =
    typeof values.description === 'string' && values.description.trim().length
      ? values.description.trim()
      : undefined
  const customFields = collectCustomFieldValues(values as Record<string, unknown>)
  const payload: Record<string, unknown> = {
    name,
    slug,
    description,
    parentId: null,
    isActive: values.isActive !== false,
  }
  if (Object.keys(customFields).length > 0) payload.customFields = customFields
  await createCrud('catalog/categories', payload)
}

export default function CreateCatalogCategoryPage() {
  const t = useT()
  const fields = React.useMemo<CrudField[]>(() => [
    {
      id: 'name',
      label: t('catalog.categories.form.field.name', 'Name'),
      type: 'text',
      required: true,
      placeholder: t('catalog.categories.form.field.namePlaceholder', 'e.g., Sunscreen'),
    },
    {
      id: 'description',
      label: t('catalog.categories.form.field.description', 'Description'),
      type: 'textarea',
    },
    {
      id: 'isActive',
      label: t('catalog.categories.form.field.isActive', 'Active'),
      type: 'checkbox',
    },
  ], [t])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    {
      id: 'details',
      title: t('catalog.categories.form.group.details', 'Details'),
      column: 1,
      fields: ['name', 'description', 'isActive'],
    },
    {
      id: 'custom',
      title: t('catalog.categories.form.group.custom', 'Custom data'),
      column: 2,
      kind: 'customFields',
    },
  ], [t])

  const successMessage = encodeURIComponent(t('catalog.categories.flash.created', 'Category created'))

  return (
    <Page>
      <PageBody>
        <CrudForm<CategoryFormValues>
          title={t('catalog.categories.form.createTitle', 'Create category')}
          backHref="/backend/catalog/categories"
          fields={fields}
          groups={groups}
          entityId={E.catalog.catalog_product_category}
          initialValues={{ name: '', description: '', isActive: true }}
          submitLabel={t('catalog.categories.form.action.create', 'Create')}
          cancelHref="/backend/catalog/categories"
          successRedirect={`/backend/catalog/categories?flash=${successMessage}&type=success`}
          onSubmit={async (values) => {
            await submitCategoryCreate(values, t)
          }}
        />
      </PageBody>
    </Page>
  )
}
