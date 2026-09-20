"use client"

import * as React from 'react'
import { Package, Plus, X } from 'lucide-react'
import { ComboboxInput, type ComboboxOption } from '@open-mercato/ui/backend/inputs/ComboboxInput'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Spinner } from '@open-mercato/ui/primitives/spinner'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { DealSectionCard } from './DealSectionCard'
import { DealFormField } from './DealFormField'
import type { Translate } from './dealFormTypes'

type CatalogProductSearchItem = { id: string; title: string; sku: string | null }

export type DealProductSectionProps = {
  tr: Translate
  productId: string
  onProductChange: (next: string) => void
  companyId?: string
  disabled: boolean
}

export function DealProductSection({ tr, productId, onProductChange, companyId, disabled }: DealProductSectionProps) {
  const productCacheRef = React.useRef<Map<string, CatalogProductSearchItem>>(new Map())
  const [isCreating, setIsCreating] = React.useState(false)
  const [newProductTitle, setNewProductTitle] = React.useState('')
  const [isSavingNewProduct, setIsSavingNewProduct] = React.useState(false)
  const [selectedLabel, setSelectedLabel] = React.useState('')

  const loadProductSuggestions = React.useCallback(async (query?: string): Promise<ComboboxOption[]> => {
    const params = new URLSearchParams()
    params.set('pageSize', '20')
    if (query) params.set('search', query)
    if (companyId) params.set('cf_company', companyId)
    const call = await apiCall<{ items: CatalogProductSearchItem[] }>(`/api/catalog/products?${params.toString()}`)
    if (!call.ok) return []
    const items = call.result?.items ?? []
    for (const item of items) productCacheRef.current.set(item.id, item)
    return items.map((item) => ({
      value: item.id,
      label: item.sku ? `${item.title} (${item.sku})` : item.title,
    }))
  }, [companyId])

  React.useEffect(() => {
    if (!productId) {
      setSelectedLabel('')
      return
    }
    const cached = productCacheRef.current.get(productId)
    if (cached) {
      setSelectedLabel(cached.sku ? `${cached.title} (${cached.sku})` : cached.title)
      return
    }
    let cancelled = false
    apiCall<{ items: CatalogProductSearchItem[] }>(`/api/catalog/products?id=${encodeURIComponent(productId)}&pageSize=1`).then((call) => {
      if (cancelled || !call.ok) return
      const item = call.result?.items?.[0]
      if (item) {
        productCacheRef.current.set(item.id, item)
        setSelectedLabel(item.sku ? `${item.title} (${item.sku})` : item.title)
      }
    })
    return () => {
      cancelled = true
    }
  }, [productId])

  const handleCreateProduct = React.useCallback(async () => {
    const title = newProductTitle.trim()
    if (!title) return
    setIsSavingNewProduct(true)
    try {
      const payload: Record<string, unknown> = { title }
      if (companyId) payload.cf_company = companyId
      const created = await createCrud<{ id?: string }>('catalog/products', payload, {
        errorMessage: tr('customers.deals.create.sections.product.createError', 'Failed to create product.'),
      })
      const newId = created.result?.id
      if (newId) {
        productCacheRef.current.set(newId, { id: newId, title, sku: null })
        onProductChange(newId)
        setSelectedLabel(title)
        setNewProductTitle('')
        setIsCreating(false)
        flash(tr('customers.deals.create.sections.product.created', 'Product created.'), 'success')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : tr('customers.deals.create.sections.product.createError', 'Failed to create product.')
      flash(message, 'error')
    } finally {
      setIsSavingNewProduct(false)
    }
  }, [companyId, newProductTitle, onProductChange, tr])

  return (
    <DealSectionCard
      icon={Package}
      title={tr('customers.deals.create.sections.product.title', 'Product')}
      subtitle={tr(
        'customers.deals.create.sections.product.subtitle',
        'Which product is this deal for? It carries through to the sample and order.',
      )}
    >
      <DealFormField fieldId="productId" label={tr('customers.deals.create.sections.product.field', 'Product')}>
        {!isCreating ? (
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <ComboboxInput
                value={productId}
                onChange={(next) => {
                  onProductChange(next)
                  const cached = productCacheRef.current.get(next)
                  setSelectedLabel(cached ? (cached.sku ? `${cached.title} (${cached.sku})` : cached.title) : selectedLabel)
                }}
                loadSuggestions={loadProductSuggestions}
                placeholder={tr('customers.deals.create.sections.product.placeholder', 'Search products…')}
                allowCustomValues={false}
                clearable
                disabled={disabled}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => setIsCreating(true)}
            >
              <Plus className="mr-1 h-4 w-4" />
              {tr('customers.deals.create.sections.product.new', 'New product')}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={newProductTitle}
              onChange={(event) => setNewProductTitle(event.target.value)}
              placeholder={tr('customers.deals.create.sections.product.newPlaceholder', 'New product name…')}
              disabled={isSavingNewProduct}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleCreateProduct()
                }
              }}
            />
            <Button type="button" size="sm" onClick={handleCreateProduct} disabled={isSavingNewProduct || !newProductTitle.trim()}>
              {isSavingNewProduct ? <Spinner className="size-4" /> : tr('customers.deals.create.sections.product.save', 'Save')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isSavingNewProduct}
              onClick={() => {
                setIsCreating(false)
                setNewProductTitle('')
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </DealFormField>
    </DealSectionCard>
  )
}

export default DealProductSection
