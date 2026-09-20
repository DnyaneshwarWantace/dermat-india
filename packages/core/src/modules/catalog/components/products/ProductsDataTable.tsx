"use client"

import * as React from 'react'
import { extensionPoints } from '@open-mercato/core/modules/catalog/extension-points'
import Link from 'next/link'
import type { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy'
import type { SortingState } from '@tanstack/react-table'
import { DataTable, type DataTableExportFormat } from '@open-mercato/ui/backend/DataTable'
import { ListEmptyState } from '@open-mercato/ui/backend/filters/ListEmptyState'
import { Button } from '@open-mercato/ui/primitives/button'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { apiCall, readApiResultOrThrow, withScopedApiRequestHeaders } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { deleteCrud, buildCrudExportUrl } from '@open-mercato/ui/backend/utils/crud'
import { buildOptimisticLockHeader } from '@open-mercato/ui/backend/utils/optimisticLock'
import { useCustomFieldDefs } from '@open-mercato/ui/backend/utils/customFieldDefs'
import { applyCustomFieldVisibility } from '@open-mercato/ui/backend/utils/customFieldColumns'
import type { FilterDef, FilterValues } from '@open-mercato/ui/backend/FilterBar'
import type { FilterOption } from '@open-mercato/ui/backend/FilterOverlay'
import { BooleanIcon } from '@open-mercato/ui/backend/ValueIcons'
import { markdownToPlainText } from '@open-mercato/ui/backend/markdown/markdownToPlainText'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useAppEvent } from '@open-mercato/ui/backend/injection/useAppEvent'
import { ChevronRight, ChevronDown, Layers, Sparkles, FolderTree } from 'lucide-react'
import { E } from '#generated/entities.ids.generated'
import { ProductImageCell } from './ProductImageCell'

export type ProductRow = {
  id: string
  title: string
  description?: string | null
  sku?: string | null
  default_media_id?: string | null
  default_media_url?: string | null
  is_active?: boolean
  metadata?: Record<string, unknown> | null
  custom_fieldset_code?: string | null
  created_at?: string
  updated_at?: string
  variants?: Array<Record<string, any>>
  variant_count?: number
} & Record<string, unknown>

type ProductsResponse = {
  items?: ProductRow[]
  total?: number
  totalPages?: number
}

const PAGE_SIZE = 25
const ENTITY_ID = E.catalog.catalog_product

function formatDate(value?: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString()
}

export type ProductsDataTableSnapshot = {
  search: string
  filterValues: FilterValues
  total: number
}

export type ProductsDataTableProps = {
  extraActions?: React.ReactNode
  onSnapshotChange?: (snapshot: ProductsDataTableSnapshot) => void
}

export default function ProductsDataTable({
  extraActions,
  onSnapshotChange,
}: ProductsDataTableProps = {}) {
  const t = useT()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const scopeVersion = useOrganizationScopeVersion()
  const [rows, setRows] = React.useState<ProductRow[]>([])
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [cacheStatus, setCacheStatus] = React.useState<'hit' | 'miss' | null>(null)
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'title', desc: false }])
  const [search, setSearch] = React.useState('')
  const [filterValues, setFilterValues] = React.useState<FilterValues>({})
  const [isLoading, setIsLoading] = React.useState(false)
  const [reloadToken, setReloadToken] = React.useState(0)
  const [expandedProducts, setExpandedProducts] = React.useState<Record<string, boolean>>({})

  const toggleExpand = React.useCallback((id: string) => {
    setExpandedProducts((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const toggleExpandAll = React.useCallback(() => {
    setExpandedProducts((prev) => {
      const anyExpanded = rows.some((r) => prev[r.id])
      if (anyExpanded) return {}
      const next: Record<string, boolean> = {}
      rows.forEach((r) => {
        if (r.variants && r.variants.length > 0) next[r.id] = true
      })
      return next
    })
  }, [rows])
  // Step 5.18 (spec §10 line 836, D18 demo): refresh the list when a
  // catalog.product.* event arrives via the DOM event bridge. Confirmed
  // AI bulk mutations (one `ai.action.confirmed` + one
  // `catalog.product.updated` per record) and direct API writes both
  // surface here so the table reflects the new state without a manual
  // reload.
  useAppEvent('catalog.product.*', () => {
    setReloadToken((token) => token + 1)
  })
  const [customFieldsetFilter, setCustomFieldsetFilter] = React.useState<string | null>(null)
  const { data: customFieldDefs = [] } = useCustomFieldDefs(ENTITY_ID, {
    keyExtras: [scopeVersion, reloadToken],
  })
  const [categoryOptionsCache, setCategoryOptionsCache] = React.useState<Record<string, FilterOption>>({})

  const registerOptions = React.useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<Record<string, FilterOption>>>,
      options: FilterOption[]
    ) => {
      setter((prev) => {
        const next = { ...prev }
        options.forEach((opt) => {
          if (opt.value) next[opt.value] = opt
        })
        return next
      })
    },
    []
  )

  const registerCategoryOptions = React.useCallback(
    (options: FilterOption[]) => registerOptions(setCategoryOptionsCache, options),
    [registerOptions]
  )

  const categoryOptions = React.useMemo(() => Object.values(categoryOptionsCache), [categoryOptionsCache])

  const loadCategoryOptions = React.useCallback(
    async (term?: string): Promise<FilterOption[]> => {
      try {
        const params = new URLSearchParams({ pageSize: '200', view: 'manage' })
        if (term && term.trim().length) params.set('search', term.trim())
        const payload = await readApiResultOrThrow<{ items?: Array<{ id?: string; name?: string; parentName?: string | null }> }>(
          `/api/catalog/categories?${params.toString()}`,
          undefined,
          { errorMessage: t('catalog.products.filters.categoriesLoadError', 'Failed to load categories') },
        )
        const items = Array.isArray(payload?.items) ? payload.items : []
        const options = items
          .map((entry) => {
            const value = typeof entry.id === 'string' ? entry.id : null
            if (!value) return null
            const label = typeof entry.name === 'string' && entry.name.trim().length ? entry.name : value
            const description =
              typeof entry.parentName === 'string' && entry.parentName.trim().length ? entry.parentName : null
            return { value, label, description }
          })
          .filter((option) => !!option) as FilterOption[]
        registerCategoryOptions(options)
        return options
      } catch {
        return []
      }
    },
    [registerCategoryOptions, t],
  )

  const filters = React.useMemo<FilterDef[]>(() => [
    { id: 'isActive', label: t('catalog.products.filters.active'), type: 'checkbox' },
    {
      id: 'categoryIds',
      label: t('catalog.products.filters.categories', 'Categories'),
      type: 'tags',
      loadOptions: loadCategoryOptions,
      options: categoryOptions,
      formatValue: (val) => categoryOptionsCache[val]?.label ?? val,
      formatDescription: (val) => categoryOptionsCache[val]?.description ?? null,
    },
  ], [
    categoryOptions,
    categoryOptionsCache,
    loadCategoryOptions,
    t,
  ])

  const columns = React.useMemo<ColumnDef<ProductRow>[]>(() => {
    const base: ColumnDef<ProductRow>[] = [
      {
        id: 'media',
        header: '',
        size: 80,
        cell: ({ row }) => (
          <ProductImageCell
            mediaId={row.original.default_media_id}
            mediaUrl={row.original.default_media_url}
            title={row.original.title}
            cropType="contain"
          />
        ),
        meta: { sticky: true },
      },
      {
        accessorKey: 'title',
        header: t('catalog.products.table.title', 'Product name'),
        cell: ({ row }) => {
          const variants = (row.original.variants || []) as Array<Record<string, any>>
          const isExpanded = Boolean(expandedProducts[row.original.id])
          const hasVariants = variants.length > 0

          return (
            <div className="flex flex-col gap-1 py-1 min-w-[280px] max-w-[320px]">
              <div className="flex items-center gap-1.5">
                {hasVariants ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleExpand(row.original.id)
                    }}
                    className="inline-flex items-center justify-center h-5 w-5 rounded hover:bg-slate-200 text-slate-600 transition-colors"
                    title={isExpanded ? 'Collapse Variants Tree' : 'Expand Variants Tree'}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-slate-800" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                    )}
                  </button>
                ) : (
                  <span className="w-5" />
                )}
                <span className="font-semibold text-slate-900">{row.original.title || '—'}</span>
                {hasVariants ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleExpand(row.original.id)
                    }}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer border ${
                      variants.length > 1
                        ? 'bg-violet-50 hover:bg-violet-100 text-violet-700 border-violet-200'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    }`}
                  >
                    <FolderTree className="h-3 w-3 text-violet-600" />
                    {variants.length} {variants.length === 1 ? 'variant' : 'variants'}
                  </button>
                ) : null}
              </div>

              {row.original.description ? (
                <span className="text-xs text-muted-foreground pl-6">
                  {markdownToPlainText(row.original.description)}
                </span>
              ) : null}

              {/* Collapsed quick variant chips preview */}
              {!isExpanded && hasVariants && variants.length > 1 ? (
                <div className="pl-6 flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500">
                  <span className="text-[10px] font-medium text-slate-400">Packs:</span>
                  {variants.map((v, i) => {
                    const pack = v.metadata?.pack_size || `${v.weight_value || ''}${v.weight_unit || ''}`.trim() || v.name
                    const mrp = v.metadata?.mrp ? `(₹${v.metadata.mrp})` : ''
                    return (
                      <span key={v.id || i} className="inline-flex items-center px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 text-[10px] font-mono">
                        {pack} {mrp}
                      </span>
                    )
                  })}
                </div>
              ) : null}

              {/* Nested Variant Tree View */}
              {isExpanded && hasVariants ? (
                <div className="mt-2 ml-5 w-[260px] max-w-[260px] border-l-2 border-violet-300 flex flex-col gap-1.5 bg-slate-50/95 p-2.5 rounded-r-md border border-slate-200 shadow-xs">
                  <div className="text-[10px] font-semibold text-slate-700 uppercase tracking-wider pb-1 border-b border-slate-200/80 flex items-center gap-1.5 text-violet-700">
                    <FolderTree className="h-3.5 w-3.5 shrink-0 text-violet-600" />
                    <span className="truncate">Variations ({variants.length})</span>
                  </div>
                  {variants.map((v, idx) => {
                    const isLast = idx === variants.length - 1
                    const vPack = v.metadata?.pack_size || `${v.weight_value || ''} ${v.weight_unit || ''}`.trim()
                    const vMrp = v.metadata?.mrp ? `₹${v.metadata.mrp}` : '—'
                    const vRate = v.metadata?.rate ? `₹${v.metadata.rate}` : null
                    const vShelf = v.metadata?.shelf_life || '24M'
                    const vMeta = (v.metadata || {}) as Record<string, any>
                    const vGst = vMeta.gst_percent || vMeta.gstPercent || (row.original.metadata as Record<string, any>)?.gst_rate_percent

                    return (
                      <div
                        key={v.id || idx}
                        className="flex flex-col gap-1 text-xs py-1.5 px-2.5 rounded bg-white border border-slate-200 shadow-2xs hover:border-violet-200 transition-colors"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-violet-400 font-mono text-[11px] font-bold shrink-0">{isLast ? '└──' : '├──'}</span>
                          <span className="font-medium text-slate-800 truncate">{v.name || 'Standard Pack'}</span>
                          {v.is_default ? (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold shrink-0">
                              Default
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap pl-[18px] text-slate-600">
                          {v.sku ? (
                            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              {v.sku}
                            </span>
                          ) : null}
                          {vPack ? (
                            <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] border border-slate-200">
                              {vPack}
                            </span>
                          ) : null}
                          <span className="font-semibold text-emerald-700 text-[10px]">{vMrp}</span>
                          {vRate ? (
                            <span className="text-[10px] text-slate-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              Rate: {vRate}
                            </span>
                          ) : null}
                          {vGst ? (
                            <span className="text-[10px] text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              GST {vGst}%
                            </span>
                          ) : null}
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                            Number(vMeta.stock_qty || 0) > 0
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            Stock: {vMeta.stock_qty || 0}
                          </span>
                          <span className="text-[10px] text-slate-400">{vShelf}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )
        },
        meta: { sticky: true },
      },
      {
        accessorKey: 'cf_product_code',
        header: t('catalog.products.form.productCode', 'Product Code'),
        cell: ({ getValue, row }) => {
          const meta = (row.original.metadata || {}) as Record<string, any>
          const value = getValue() || (row.original as any).cf_product_code || (row.original as any).customValues?.product_code || meta.product_code || row.original.sku
          return value ? <span className="font-mono text-xs font-semibold text-slate-800">{String(value)}</span> : <span className="text-xs text-muted-foreground">—</span>
        },
      },
      {
        accessorKey: 'cf_category',
        header: t('catalog.products.form.category', 'Category'),
        cell: ({ getValue, row }) => {
          const meta = (row.original.metadata || {}) as Record<string, any>
          const value = getValue() || (row.original as any).cf_category || (row.original as any).customValues?.category || meta.category
          return value ? <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">{String(value)}</span> : <span className="text-xs text-muted-foreground">—</span>
        },
      },
      {
        accessorKey: 'cf_customer',
        header: t('catalog.products.form.customer', 'Customer'),
        cell: ({ getValue, row }) => {
          const meta = (row.original.metadata || {}) as Record<string, any>
          const value = getValue() || (row.original as any).cf_customer || (row.original as any).cf_company || (row.original as any).cf_customer_name || (row.original as any).cf_client_brand || (row.original as any).customValues?.customer || (row.original as any).customValues?.company || meta.customer || meta.customer_name || meta.client_brand
          return value ? <span className="text-xs font-semibold text-slate-800">{String(value)}</span> : <span className="text-xs text-muted-foreground">—</span>
        },
      },
      {
        accessorKey: 'cf_pack_size',
        header: t('catalog.products.form.packSize', 'Pack Size'),
        cell: ({ getValue, row }) => {
          const meta = (row.original.metadata || {}) as Record<string, any>
          const variants = (row.original.variants || []) as Array<Record<string, any>>

          if (variants.length > 1) {
            const packList = variants
              .map((v) => (v.metadata?.pack_size ? `${v.metadata.pack_size}${v.metadata?.uom || ''}` : (v.weight_value ? `${v.weight_value}${v.weight_unit || ''}` : v.name)))
              .filter(Boolean)
            return (
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-xs text-slate-800">{packList.join(', ')}</span>
                <span className="text-[10px] text-muted-foreground">{variants.length} options</span>
              </div>
            )
          }

          const singleVar = variants[0]
          const varPack = singleVar?.metadata?.pack_size ? `${singleVar.metadata.pack_size} ${singleVar.metadata.uom || ''}`.trim() : (singleVar?.weight_value ? `${singleVar.weight_value} ${singleVar.weight_unit || ''}`.trim() : null)
          const value = getValue() || (row.original as any).cf_pack_size || (row.original as any).customValues?.pack_size || varPack || meta.pack_size || (meta.pack ? `${meta.pack} ${meta.uom || ''}` : null)
          return value ? <span className="font-medium text-xs text-slate-800">{String(value)}</span> : <span className="text-xs text-muted-foreground">—</span>
        },
      },
      {
        accessorKey: 'cf_mrp',
        header: t('catalog.products.form.mrp', 'M.R.P. (₹)'),
        cell: ({ getValue, row }) => {
          const meta = (row.original.metadata || {}) as Record<string, any>
          const variants = (row.original.variants || []) as Array<Record<string, any>>

          if (variants.length > 1) {
            const mrpList = variants.map((v) => (v.metadata?.mrp ? `₹${v.metadata.mrp}` : null)).filter(Boolean)
            if (mrpList.length > 0) {
              return <span className="font-semibold text-xs text-emerald-700">{mrpList.join(' / ')}</span>
            }
          }

          const singleVar = variants[0]
          const varMrp = singleVar?.metadata?.mrp ? `₹${singleVar.metadata.mrp}` : null
          const raw = getValue() || (row.original as any).cf_mrp || (row.original as any).customValues?.mrp || varMrp || meta.mrp || (meta.mrp_num ? `₹${meta.mrp_num}` : null)
          const value = raw ? (String(raw).startsWith('₹') ? String(raw) : `₹${raw}`) : null
          return value ? <span className="font-semibold text-xs text-emerald-700">{String(value)}</span> : <span className="text-xs text-muted-foreground">—</span>
        },
      },
      {
        accessorKey: 'cf_min_floor_qty',
        header: t('catalog.products.form.minFloorQty', 'Min Floor Qty'),
        cell: ({ getValue, row }) => {
          const meta = (row.original.metadata || {}) as Record<string, any>
          const value = getValue() || (row.original as any).cf_min_floor_qty || (row.original as any).customValues?.min_floor_qty || meta.min_floor_qty || '500'
          return value ? <span className="text-xs font-mono text-slate-700">{Number(value).toLocaleString()}</span> : <span className="text-xs text-muted-foreground">—</span>
        },
      },
      {
        accessorKey: 'cf_base_uom',
        header: t('catalog.products.form.baseUom', 'Base UOM'),
        cell: ({ getValue, row }) => {
          const meta = (row.original.metadata || {}) as Record<string, any>
          const value = getValue() || (row.original as any).cf_base_uom || (row.original as any).customValues?.base_uom || meta.base_uom || meta.uom || row.original.default_unit
          return value ? <span className="text-xs font-mono uppercase text-slate-600">{String(value)}</span> : <span className="text-xs text-muted-foreground">—</span>
        },
      },
      {
        accessorKey: 'cf_stock_status',
        header: t('catalog.products.form.stockStatus', 'Stock & Production Demand'),
        cell: ({ row }) => {
          const meta = (row.original.metadata || {}) as Record<string, any>
          const cf = (row.original as any).customFields || {}
          const stock = Number(cf.stock_qty ?? meta.stock_qty ?? 0)
          const ordered = Number(cf.ordered_qty ?? meta.ordered_qty ?? 0)
          const isMto = meta.is_make_to_order !== false

          return (
            <div className="flex flex-col gap-1 text-xs">
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                  stock > 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  Stock: {stock} Units
                </span>
                {isMto ? (
                  <span className="text-[10px] text-muted-foreground bg-slate-100 px-1 py-0.2 rounded border border-slate-200 font-medium">
                    MTO
                  </span>
                ) : null}
              </div>
              {ordered > 0 ? (
                <span className="text-[10px] text-blue-700 font-medium">
                  To Build: {ordered.toLocaleString()} Units
                </span>
              ) : (
                <span className="text-[10px] text-slate-400">Make to Order</span>
              )}
            </div>
          )
        },
      },
    ]
    const withCustomFields = applyCustomFieldVisibility(base, customFieldDefs)
    const trailing: ColumnDef<ProductRow>[] = [
      {
        accessorKey: 'is_active',
        header: t('catalog.products.table.active'),
        cell: ({ row }) => <BooleanIcon value={!!row.original.is_active} />,
      },
      {
        accessorKey: 'updated_at',
        header: t('catalog.products.table.updatedAt'),
        cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.original.updated_at)}</span>,
      },
    ]
    return [...withCustomFields, ...trailing]
  }, [customFieldDefs, t])

  const handleSearchChange = React.useCallback((value: string) => {
    setSearch(value)
    setPage(1)
  }, [])

  const handleFiltersApply = React.useCallback((values: FilterValues) => {
    setFilterValues(values)
    setPage(1)
  }, [])

  const handleFiltersClear = React.useCallback(() => {
    setFilterValues({})
    setPage(1)
  }, [])

  const handleCustomFieldsetFilterChange = React.useCallback(
    (value: string | null) => {
      if (value === customFieldsetFilter) return
      setCustomFieldsetFilter(value)
      setFilterValues((prev) => {
        const entries = Object.entries(prev)
        if (!entries.some(([key]) => key.startsWith('cf_'))) return prev
        const next: FilterValues = {}
        entries.forEach(([key, val]) => {
          if (!key.startsWith('cf_')) next[key] = val
        })
        return next
      })
      setPage(1)
    },
    [customFieldsetFilter],
  )

  const handleRefresh = React.useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('pageSize', String(PAGE_SIZE))
    if (search.trim()) params.set('search', search.trim())
    const sort = sorting[0]
    if (sort?.id) {
      params.set('sortField', sort.id)
      params.set('sortDir', sort.desc ? 'desc' : 'asc')
    }
    if (filterValues.isActive === true) params.set('isActive', 'true')
    if (filterValues.isActive === false) params.set('isActive', 'false')
    if (Array.isArray(filterValues.categoryIds) && filterValues.categoryIds.length) {
      const values = filterValues.categoryIds
        .map((value) => (typeof value === 'string' ? value : null))
        .filter((value): value is string => !!value)
      if (values.length) params.set('categoryIds', values.join(','))
    }
    Object.entries(filterValues).forEach(([key, value]) => {
      if (!key.startsWith('cf_') || value == null) return
      if (Array.isArray(value)) {
        const entries = value
          .map((entry) => (typeof entry === 'string' ? entry.trim() : String(entry || '').trim()))
          .filter((entry) => entry.length > 0)
        if (entries.length) params.set(key, entries.join(','))
      } else if (typeof value === 'object' && value !== null && ('from' in (value as Record<string, unknown>) || 'to' in (value as Record<string, unknown>))) {
        const range = value as { from?: string; to?: string }
        if (typeof range.from === 'string' && range.from.trim().length) {
          params.set(`${key}:from`, range.from.trim())
        }
        if (typeof range.to === 'string' && range.to.trim().length) {
          params.set(`${key}:to`, range.to.trim())
        }
      } else if (typeof value === 'string' && value.trim()) {
        params.set(key, value.trim())
      }
    })
    if (typeof customFieldsetFilter === 'string' && customFieldsetFilter.trim().length > 0) {
      params.set('customFieldset', customFieldsetFilter.trim())
    }
    return params.toString()
  }, [customFieldsetFilter, filterValues, page, search, sorting])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setCacheStatus(null)
      try {
        const fallback: ProductsResponse = { items: [], total: 0, totalPages: 1 }
        const call = await apiCall<ProductsResponse>(
          `/api/catalog/products?${queryParams}`,
          undefined,
          { fallback },
        )
        if (!call.ok) {
          const message = t('catalog.products.list.error.load', 'Failed to load products')
          flash(message, 'error')
          if (!cancelled) setCacheStatus(null)
          return
        }
        const payload = call.result ?? fallback
        if (cancelled) return
        setCacheStatus(call.cacheStatus ?? null)
        const items = Array.isArray(payload.items) ? payload.items : []
        const normalized = items.filter((item): item is ProductRow => typeof item?.id === 'string')
        setRows(normalized)
        setTotal(typeof payload.total === 'number' ? payload.total : normalized.length)
        setTotalPages(typeof payload.totalPages === 'number' ? payload.totalPages : 1)
      } catch (error) {
        if (!cancelled) {
          setCacheStatus(null)
          const message =
            error instanceof Error
              ? error.message
              : t('catalog.products.list.error.load', 'Failed to load products')
          flash(message, 'error')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [queryParams, reloadToken, scopeVersion, t])

  const handleDelete = React.useCallback(async (row: ProductRow) => {
    const confirmed = await confirm({
      title: t('catalog.products.list.deleteConfirm', 'Delete this product?'),
      variant: 'destructive',
    })
    if (!confirmed) return
    try {
      const headers = buildOptimisticLockHeader(typeof row.updated_at === 'string' ? row.updated_at : null)
      await withScopedApiRequestHeaders(headers, () => (
        deleteCrud('catalog/products', row.id, {
          errorMessage: t('catalog.products.list.error.delete', 'Failed to delete product'),
        })
      ))
      flash(t('catalog.products.flash.deleted', 'Product deleted'), 'success')
      setReloadToken((token) => token + 1)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t('catalog.products.list.error.delete', 'Failed to delete product')
      flash(message, 'error')
    }
  }, [confirm, t])

  React.useEffect(() => {
    if (!onSnapshotChange) return
    onSnapshotChange({ search, filterValues, total })
  }, [onSnapshotChange, search, filterValues, total])

  const currentParams = React.useMemo(() => Object.fromEntries(new URLSearchParams(queryParams)), [queryParams])

  const exportConfig = React.useMemo(() => ({
    view: {
      getUrl: (format: DataTableExportFormat) =>
        buildCrudExportUrl('catalog/products', { ...currentParams, exportScope: 'view' }, format),
    },
    full: {
      getUrl: (format: DataTableExportFormat) =>
        buildCrudExportUrl('catalog/products', { ...currentParams, exportScope: 'full', all: 'true' }, format),
    },
  }), [currentParams])

  return (
    <>
      <DataTable<ProductRow>
        title={t('catalog.products.page.title', 'Products')}
        entityId={ENTITY_ID}
        customFieldFilterKeyExtras={[scopeVersion, reloadToken]}
        refreshButton={{
          label: t('catalog.products.actions.refresh', 'Refresh'),
          onRefresh: handleRefresh,
          isRefreshing: isLoading,
        }}
        actions={(
          <div className="flex items-center gap-2">
            {extraActions}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleExpandAll}
              className="gap-1.5 text-xs font-semibold border-violet-200 bg-violet-50/60 hover:bg-violet-100 text-violet-700 transition-colors"
            >
              <FolderTree className="h-4 w-4 text-violet-600" />
              {rows.some((r) => expandedProducts[r.id]) ? 'Collapse All Tree' : 'Expand All Variations Tree'}
            </Button>
            <Button asChild>
              <Link href="/backend/catalog/products/create">
                {t('catalog.products.actions.create', 'Create')}
              </Link>
            </Button>
          </div>
        )}
        columns={columns}
        data={rows}
        emptyState={(
          <ListEmptyState
            entityName={t('catalog.products.page.title', 'Products')}
            createHref="/backend/catalog/products/create"
            createLabel={t('catalog.products.actions.create', 'Create')}
          />
        )}
        searchValue={search}
        onSearchChange={handleSearchChange}
        filters={filters}
        filterValues={filterValues}
        onFiltersApply={handleFiltersApply}
        onFiltersClear={handleFiltersClear}
        onCustomFieldFilterFieldsetChange={handleCustomFieldsetFilterChange}
        sorting={sorting}
        onSortingChange={setSorting}
        injectionSpotId={extensionPoints.hosts.productsTable.baseSpotId}
        injectionContext={{
          search,
          filters: filterValues,
          customFieldset: customFieldsetFilter,
          page,
          sorting,
          scopeVersion,
          // Step 5.15: surface `total` so the merchandising AI widget
          // (rendered in `data-table:catalog.products:header`) can build
          // a selection-aware pageContext per spec §10.1 without taking a
          // dependency on the host page.
          total,
          totalMatching: total,
        }}
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total,
          totalPages,
          onPageChange: setPage,
          cacheStatus,
        }}
        exporter={exportConfig}
        isLoading={isLoading}
        perspective={{ tableId: extensionPoints.hosts.productsTable.tableId }}
        stickyActionsColumn
        rowActions={(row) => (
          <RowActions
            items={[
              {
                id: 'edit',
                label: t('catalog.products.table.actions.edit', 'Edit'),
                href: `/backend/catalog/products/${row.id}`,
              },
              {
                id: 'delete',
                label: t('catalog.products.table.actions.delete', 'Delete'),
                destructive: true,
                onSelect: () => {
                  void handleDelete(row)
                },
              },
            ]}
          />
        )}
      />
      {ConfirmDialogElement}
    </>
  )
}
