'use client'

import * as React from 'react'
import { useGranted } from '../../dermat_departments/components/useGranted'
import { ViewOnlyNote } from '../../dermat_departments/components/ViewOnlyNote'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Copy,
  CopyPlus,
  FlaskConical,
  Layers,
  Network,
  Package,
  Printer,
  Trash2,
} from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Button } from '@open-mercato/ui/primitives/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@open-mercato/ui/primitives/card'
import { Input } from '@open-mercato/ui/primitives/input'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@open-mercato/ui/primitives/select'
import { StatusBadge, type StatusBadgeVariant } from '@open-mercato/ui/primitives/status-badge'
import { apiCall, withScopedApiRequestHeaders } from '@open-mercato/ui/backend/utils/apiCall'
import { buildOptimisticLockHeader } from '@open-mercato/ui/backend/utils/optimisticLock'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { KIND_CONFIG } from '../../dermat_products/lib/kindConfig'
import type { ProductKind } from '../../dermat_products/lib/kinds'
import {
  BOM_KINDS,
  FILL_UNITS,
  PERCENT_TOLERANCE,
  PERCENT_TOTAL,
  batchQuantity,
  bomKindForProduct,
  fillToBulkQuantity,
  parsePackSize,
  type BomKind,
  type FillUnit,
} from '../lib/bomKinds'
import { MaterialPicker, formatQty } from './MaterialPicker'
import { BomTree } from './BomTree'
import { BomLinks } from './BomLinks'
import { FillPlan } from './FillPlan'
import { openPrintSheet } from './printSheet'
import { AvailabilityBadge } from './bom/AvailabilityBadge'
import { BomDetailsCard } from './bom/BomDetailsCard'
import type { BomView, ComponentOption, PackagingCodeView } from './types'
import { PackagingCodePicker } from './packaging/PackagingCodePicker'
import { ExportButton } from '../../dermat_products/components/ExportButton'
import { downloadCsv } from '../../dermat_products/lib/csvExport'
import { BackLink } from '../../dermat_departments/components/BackLink'

type Row = {
  key: string
  componentProductId: string
  componentKind: string
  code: string | null
  name: string
  unit: string
  value: string
  onHand: number
  remark: string
  usesFill: boolean
  fillQty: string
  fillUnit: FillUnit
  specificGravity: number | null
}

type ProductInfo = { id: string; title: string; kind: string | null; unit: string | null; code: string | null; packSize: string | null }

type EditorState = {
  bom: BomView | null
  product: ProductInfo
  kind: BomKind
  name: string
  batchSize: string
  yieldPercent: string
  notes: string
  rows: Row[]
}

type SaveResult = { ok: boolean; id?: string; status?: number; error?: string; rows?: Record<string, string> }

export const STATUS_VARIANT: Record<string, StatusBadgeVariant> = {
  draft: 'warning',
  approved: 'success',
  superseded: 'neutral',
}

const KIND_ICON: Record<BomKind, typeof FlaskConical> = { formula: FlaskConical, pack: Package }

const NO_PRODUCT: ProductInfo = { id: '', title: '', kind: null, unit: null, code: null, packSize: null }

function rowFromOption(option: ComponentOption, kind: BomKind, packSize: string | null): Row {
  const usesFill = kind === 'pack' && option.kind === 'bulk'
  const fill = usesFill ? parsePackSize(packSize) : null
  return {
    key: `${option.id}-${Date.now()}`,
    componentProductId: option.id,
    componentKind: option.kind,
    code: option.code,
    name: option.title,
    unit: option.unit ?? '',
    value: '',
    onHand: option.onHand,
    remark: '',
    usesFill,
    fillQty: fill ? String(fill.qty) : '',
    fillUnit: fill?.unit ?? 'ml',
    specificGravity: option.specificGravity ?? null,
  }
}

function toFillUnit(value: string | null | undefined): FillUnit {
  return (FILL_UNITS as readonly string[]).includes(value ?? '') ? (value as FillUnit) : 'kg'
}

function stateFromBom(bom: BomView): EditorState {
  return {
    bom,
    product: {
      id: bom.productId,
      title: bom.product?.title ?? '',
      kind: bom.product?.kind ?? null,
      unit: bom.product?.unit ?? null,
      code: bom.product?.code ?? null,
      packSize: bom.product?.packSize ?? null,
    },
    kind: bom.kind,
    name: bom.name ?? '',
    batchSize: String(bom.batchSize),
    yieldPercent: String(bom.yieldPercent ?? 100),
    notes: bom.notes ?? '',
    rows: bom.items.map((item) => ({
      key: item.id,
      componentProductId: item.componentProductId,
      componentKind: item.componentKind,
      code: item.code,
      name: item.name,
      unit: item.unit,
      value: String(item.value),
      onHand: item.onHand,
      remark: item.remark ?? '',
      usesFill: bom.kind === 'pack' && item.componentKind === 'bulk',
      fillQty: item.fillQty != null ? String(item.fillQty) : String(item.value),
      fillUnit: item.fillQty != null ? toFillUnit(item.fillUnit) : toFillUnit(item.unit),
      specificGravity: item.specificGravity,
    })),
  }
}

function numberOf(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function rowValue(row: Row): number {
  if (!row.usesFill) return numberOf(row.value)
  const fill = numberOf(row.fillQty)
  return fill > 0 ? fillToBulkQuantity(fill, row.fillUnit, row.unit, row.specificGravity) : 0
}

function kindShort(kind: string): string {
  if (kind === 'raw_material') return 'RM'
  if (kind === 'packing_material') return 'PM'
  if (kind === 'bulk') return 'Bulk'
  return KIND_CONFIG[kind as ProductKind]?.singular ?? kind
}

async function readProduct(productId: string): Promise<ProductInfo | null> {
  const call = await apiCall<{ items?: Array<Record<string, unknown>> }>(
    `/api/catalog/products?id=${encodeURIComponent(productId)}&pageSize=1`,
    undefined,
    { fallback: { items: [] } },
  )
  const item = call.result?.items?.[0]
  if (!item) return null
  const custom = (item.customFields ?? {}) as Record<string, unknown>
  const code = (item.cf_item_code ?? custom.item_code ?? null) as string | null
  return {
    id: String(item.id),
    title: String(item.title ?? ''),
    kind: (item.custom_fieldset_code as string | null) ?? null,
    unit: (item.default_unit as string | null) ?? null,
    code: code || null,
    packSize: ((item.cf_pack_size ?? custom.pack_size ?? null) as string | null) || null,
  }
}

export function BomEditor({ bomId, productId }: { bomId?: string; productId?: string }) {
  const t = useT()
  const granted = useGranted()
  const canManage = !granted.ready || granted.has('dermat_boms.manage')
  const canApprove = !granted.ready || granted.has('dermat_boms.approve')
  const router = useRouter()
  const { runMutation } = useGuardedMutation({ contextId: `dermat-bom-${bomId ?? 'new'}` })

  const copyForOrder = async (productId: string) => {
    const orderId = state?.bom?.orderId
    if (!orderId) return
    const body = { orderId, productId }
    const call = await runMutation({
      context: { orderCopy: productId },
      mutationPayload: body,
      operation: () => apiCall<{ id?: string; error?: string }>('/api/dermat_boms/boms/order-copy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    })
    if (call.result?.id) router.push(`/backend/boms/${call.result.id}`)
    else flash(call.result?.error ?? t('dermat_boms.orderCopyError', 'Could not make the order BOM.'), 'error')
  }
  const [state, setState] = React.useState<EditorState | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [rowErrors, setRowErrors] = React.useState<Record<string, string>>({})
  const [dirty, setDirty] = React.useState(false)
  const [view, setView] = React.useState<'lines' | 'tree'>('lines')
  const valueRefs = React.useRef<Record<string, HTMLInputElement | null>>({})
  const focusKey = React.useRef<string | null>(null)

  const load = React.useCallback(async () => {
    setLoadError(null)
    if (bomId) {
      const call = await apiCall<BomView>(`/api/dermat_boms/boms?id=${encodeURIComponent(bomId)}`)
      if (!call.ok || !call.result) {
        setLoadError(t('dermat_boms.errors.load', 'Could not load this BOM.'))
        return
      }
      setState(stateFromBom(call.result))
      setDirty(false)
      return
    }
    const blank = { bom: null, name: '', yieldPercent: '100', notes: '', rows: [] }
    if (!productId) {
      setState({ ...blank, product: NO_PRODUCT, kind: 'formula', batchSize: String(BOM_KINDS.formula.defaultBatchSize) })
      return
    }
    const product = await readProduct(productId)
    const kind = bomKindForProduct(product?.kind)
    if (!product || !kind) {
      setLoadError(t('dermat_boms.errors.productType', 'A BOM can only be made for a Bulk, R&D or Finished Good product.'))
      return
    }
    setState({ ...blank, product, kind, name: product.title, batchSize: String(BOM_KINDS[kind].defaultBatchSize) })
  }, [bomId, productId, t])

  React.useEffect(() => {
    load()
  }, [load])

  React.useEffect(() => {
    if (focusKey.current && valueRefs.current[focusKey.current]) {
      valueRefs.current[focusKey.current]?.focus()
      focusKey.current = null
    }
  })

  const editable = (!state?.bom || state.bom.status === 'draft') && canManage

  const patch = (next: Partial<EditorState>) => {
    setState((prev) => (prev ? { ...prev, ...next } : prev))
    setDirty(true)
  }

  const updateRow = (key: string, next: Partial<Row>) =>
    setState((prev) => {
      if (!prev) return prev
      setDirty(true)
      return { ...prev, rows: prev.rows.map((row) => (row.key === key ? { ...row, ...next } : row)) }
    })

  const moveRow = (index: number, direction: -1 | 1) =>
    setState((prev) => {
      if (!prev) return prev
      const target = index + direction
      if (target < 0 || target >= prev.rows.length) return prev
      const rows = [...prev.rows]
      const [moved] = rows.splice(index, 1)
      rows.splice(target, 0, moved)
      setDirty(true)
      return { ...prev, rows }
    })

  const removeRow = (key: string) =>
    setState((prev) => {
      if (!prev) return prev
      setDirty(true)
      return { ...prev, rows: prev.rows.filter((row) => row.key !== key) }
    })

  const addRow = (option: ComponentOption) => {
    if (!state) return
    const row = rowFromOption(option, state.kind, state.product.packSize)
    focusKey.current = row.key
    setState((prev) => (prev ? { ...prev, rows: [...prev.rows, row] } : prev))
    setDirty(true)
  }

  const addOwnPacking = async () => {
    if (!state) return
    const linked = await apiCall<{ items?: Array<{ id: string; title: string; sku: string | null; unit: string | null }> }>(
      `/api/dermat_products/packing?productId=${encodeURIComponent(state.product.id)}`,
      undefined,
      { fallback: { items: [] } },
    )
    const present = new Set(state.rows.map((row) => row.componentProductId))
    const missing = (linked.result?.items ?? []).filter((item) => !present.has(item.id))
    if (!missing.length) {
      flash(
        linked.result?.items?.length
          ? t('dermat_boms.packing.allAdded', 'All packing items of this product are already in the BOM.')
          : t('dermat_boms.packing.none', 'This product has no packing items yet. Tick them on the product page under "Packing for this product".'),
        'info',
      )
      return
    }
    const stock = await apiCall<{ items?: Record<string, { onHand: number }> }>(
      `/api/dermat_products/stock?productIds=${missing.map((item) => item.id).join(',')}`,
      undefined,
      { fallback: { items: {} } },
    )
    const rows = missing.map((item) => ({
      ...rowFromOption(
        { id: item.id, title: item.title, code: null, sku: item.sku, kind: 'packing_material', unit: item.unit, onHand: stock.result?.items?.[item.id]?.onHand ?? 0 },
        state.kind,
        null,
      ),
      value: '1',
    }))
    setState((prev) => (prev ? { ...prev, rows: [...prev.rows, ...rows] } : prev))
    setDirty(true)
  }

  const addPackagingSet = async (code: PackagingCodeView) => {
    if (!state || !state.product.id) return
    const present = new Set(state.rows.map((row) => row.componentProductId))
    const partRows = code.components
      .filter((part) => !present.has(part.productId))
      .map((part) => ({
        ...rowFromOption({ id: part.productId, title: part.name, code: part.code, sku: null, kind: part.kind ?? 'packing_material', unit: part.unit, onHand: part.onHand }, state.kind, null),
        value: String(part.qty),
      }))
    let printedRows: Row[] = []
    if (code.printedItems.length) {
      const body = { productId: state.product.id, types: code.printedItems }
      const call = await runMutation({
        context: { packagingSet: code.code, productId: state.product.id },
        mutationPayload: body,
        operation: () =>
          apiCall<{ items?: Array<{ id: string; title: string; type: string; sku: string | null; unit: string | null }>; error?: string }>('/api/dermat_products/packing', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          }),
      })
      if (!call.ok) {
        flash(call.result?.error ?? t('dermat_boms.packaging.printedError', 'Could not create the printed items for this product.'), 'error')
      } else {
        const wanted = new Set(code.printedItems.map((item) => item.toLowerCase()))
        const items = (call.result?.items ?? []).filter((item) => wanted.has(item.type.toLowerCase()) && !present.has(item.id))
        const stock = items.length
          ? await apiCall<{ items?: Record<string, { onHand: number }> }>(`/api/dermat_products/stock?productIds=${items.map((item) => item.id).join(',')}`, undefined, { fallback: { items: {} } })
          : null
        printedRows = items.map((item) => ({
          ...rowFromOption({ id: item.id, title: item.title, code: null, sku: item.sku, kind: 'packing_material', unit: item.unit, onHand: stock?.result?.items?.[item.id]?.onHand ?? 0 }, state.kind, null),
          value: '1',
        }))
      }
    }
    const added = [...partRows, ...printedRows]
    if (!added.length) {
      flash(t('dermat_boms.packaging.allThere', 'Everything in {code} is already in this BOM.', { code: code.code }), 'info')
      return
    }
    setState((prev) => (prev ? { ...prev, rows: [...prev.rows, ...added] } : prev))
    setDirty(true)
    flash(t('dermat_boms.packaging.added', '{count} lines added from {code}', { count: added.length, code: code.code }), 'success')
  }

  const selectProduct = async (option: ComponentOption) => {
    const product = (await readProduct(option.id)) ?? { ...NO_PRODUCT, id: option.id, title: option.title, kind: option.kind, unit: option.unit, code: option.code }
    const kind = bomKindForProduct(product.kind)
    if (!kind) {
      flash(t('dermat_boms.errors.productType', 'A BOM can only be made for a Bulk, R&D or Finished Good product.'), 'error')
      return
    }
    setState((prev) => {
      if (!prev) return prev
      const sameKind = prev.kind === kind && Boolean(prev.product.id)
      return {
        ...prev,
        product,
        kind,
        name: !prev.name.trim() || prev.name === prev.product.title ? product.title : prev.name,
        batchSize: sameKind ? prev.batchSize : String(BOM_KINDS[kind].defaultBatchSize),
        rows: sameKind ? prev.rows.filter((row) => row.componentProductId !== product.id) : [],
      }
    })
    setDirty(true)
  }

  const save = async (): Promise<SaveResult> => {
    if (!state) return { ok: false }
    if (!state.product.id) {
      flash(t('dermat_boms.errors.product', 'Pick the product this BOM is for.'), 'error')
      return { ok: false }
    }
    const yieldValue = numberOf(state.yieldPercent)
    if (!(yieldValue > 0) || yieldValue > 100) {
      flash(t('dermat_boms.errors.yield', 'Yield % must be between 0 and 100.'), 'error')
      return { ok: false }
    }
    const errors: Record<string, string> = {}
    state.rows.forEach((row, index) => {
      const value = rowValue(row)
      if (!(value > 0)) errors[String(index + 1)] = t('dermat_boms.errors.value', 'Enter a quantity above 0')
      else if (state.kind === 'formula' && value > PERCENT_TOTAL)
        errors[String(index + 1)] = t('dermat_boms.errors.percent', 'RM % cannot be more than 100')
    })
    if (!(numberOf(state.batchSize) > 0)) {
      flash(t('dermat_boms.errors.batch', 'Enter the batch size.'), 'error')
      return { ok: false }
    }
    setRowErrors(errors)
    if (Object.keys(errors).length) {
      flash(t('dermat_boms.errors.rows', 'Some lines need fixing.'), 'error')
      return { ok: false }
    }
    const body = {
      name: state.name.trim() || null,
      yieldPercent: yieldValue,
      batchSize: numberOf(state.batchSize),
      notes: state.notes.trim() || null,
      items: state.rows.map((row) =>
        row.usesFill
          ? {
              componentProductId: row.componentProductId,
              fillQty: numberOf(row.fillQty),
              fillUnit: row.fillUnit,
              remark: row.remark.trim() || null,
            }
          : { componentProductId: row.componentProductId, value: numberOf(row.value), remark: row.remark.trim() || null },
      ),
    }
    const payload = state.bom ? { ...body, id: state.bom.id } : { ...body, productId: state.product.id }
    const call = await runMutation({
      context: { bomId: state.bom?.id ?? null, productId: state.product.id },
      mutationPayload: payload,
      operation: () => {
        const request = () =>
          apiCall<{ id?: string; error?: string; rows?: Record<string, string> }>('/api/dermat_boms/boms', {
            method: state.bom ? 'PUT' : 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
        return state.bom ? withScopedApiRequestHeaders(buildOptimisticLockHeader(state.bom.updatedAt), request) : request()
      },
    })
    if (!call.ok) {
      if (call.result?.rows) setRowErrors(call.result.rows)
      return { ok: false, status: call.status, error: call.result?.error, id: call.result?.id }
    }
    setDirty(false)
    return { ok: true, id: call.result?.id ?? state.bom?.id }
  }

  const reportFailure = (result: SaveResult) => {
    if (result.status === 409 && !result.id) {
      flash(t('dermat_boms.errors.conflict', 'Someone else changed this BOM. Reload the page to see the latest version.'), 'error')
    } else {
      flash(result.error ?? t('dermat_boms.errors.save', 'Could not save the BOM.'), 'error')
    }
  }

  const handleSave = async () => {
    setBusy(true)
    try {
      const result = await save()
      if (!result.ok) {
        if (result.status) reportFailure(result)
        return
      }
      flash(t('dermat_boms.flash.saved', 'BOM saved'), 'success')
      if (!state?.bom && result.id) router.replace(`/backend/boms/${result.id}`)
      else await load()
    } catch {
      flash(t('dermat_boms.errors.save', 'Could not save the BOM.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const postAction = async (path: 'approve' | 'new-version', id: string, extra: Record<string, unknown> = {}) =>
    runMutation({
      context: { bomId: id, action: path },
      mutationPayload: { id, ...extra },
      operation: () =>
        apiCall<{ id?: string; error?: string }>(`/api/dermat_boms/boms/${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id, ...extra }),
        }),
    })

  const handleApprove = async () => {
    if (!state?.bom) return
    setBusy(true)
    try {
      if (dirty) {
        const saved = await save()
        if (!saved.ok) {
          if (saved.status) reportFailure(saved)
          return
        }
      }
      const call = await postAction('approve', state.bom.id)
      if (!call.ok) {
        flash(call.result?.error ?? t('dermat_boms.errors.approve', 'Could not approve the BOM.'), 'error')
        await load()
        return
      }
      flash(t('dermat_boms.flash.approved', 'BOM approved'), 'success')
      await load()
    } catch {
      flash(t('dermat_boms.errors.save', 'Could not save the BOM.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleNewVersion = async (copy = false) => {
    if (!state?.bom) return
    setBusy(true)
    try {
      const extra = copy ? { name: t('dermat_boms.copyName', 'Copy of {name}', { name: state.name || state.product.title }) } : {}
      const call = await postAction('new-version', state.bom.id, extra)
      const targetId = call.result?.id
      if (!targetId) {
        flash(call.result?.error ?? t('dermat_boms.errors.version', 'Could not start a new version.'), 'error')
        return
      }
      flash(copy ? t('dermat_boms.flash.copied', 'BOM copied. Change it and save.') : t('dermat_boms.flash.newVersion', 'New draft made from this BOM'), 'success')
      router.push(`/backend/boms/${targetId}`)
    } catch {
      flash(t('dermat_boms.errors.save', 'Could not save the BOM.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!state?.bom) return
    setBusy(true)
    try {
      const bom = state.bom
      const call = await runMutation({
        context: { bomId: bom.id, action: 'delete' },
        mutationPayload: { id: bom.id },
        operation: () =>
          withScopedApiRequestHeaders(buildOptimisticLockHeader(bom.updatedAt), () =>
            apiCall<{ error?: string }>(`/api/dermat_boms/boms?id=${encodeURIComponent(bom.id)}`, { method: 'DELETE' }),
          ),
      })
      if (!call.ok) {
        flash(call.result?.error ?? t('dermat_boms.errors.delete', 'Could not delete the BOM.'), 'error')
        return
      }
      flash(t('dermat_boms.flash.deleted', 'BOM deleted'), 'success')
      router.push('/backend/boms')
    } catch {
      flash(t('dermat_boms.errors.save', 'Could not save the BOM.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleExport = () => {
    if (!state) return
    const size = numberOf(state.batchSize)
    const unit = state.bom?.batchUnit ?? BOM_KINDS[state.kind].defaultBatchUnit ?? state.product.unit ?? 'kg'
    downloadCsv(`bom-${state.product.code ?? state.product.title}-v${state.bom?.version ?? 1}`, [
      { header: 'Material ID', value: (row) => row.code ?? '' },
      { header: 'Material', value: (row) => row.name },
      { header: 'Type', value: (row) => row.componentKind ?? '' },
      { header: state.kind === 'formula' ? 'RM %' : 'Per piece', value: (row) => rowValue(row) },
      { header: `Qty for ${formatQty(size, 3)} ${unit}`, value: (row) => batchQuantity(state.kind, size, rowValue(row), unit, row.unit, row.specificGravity) },
      { header: 'Unit', value: (row) => row.unit ?? '' },
      { header: 'Fill', value: (row) => (row.usesFill ? `${numberOf(row.fillQty)} ${row.fillUnit}` : '') },
      { header: 'On hand', value: (row) => row.onHand ?? '' },
      { header: 'Remark', value: (row) => row.remark ?? '' },
    ], state.rows)
  }

  const handlePrint = () => {
    if (!state) return
    const size = numberOf(state.batchSize)
    const printUnit = state.bom?.batchUnit ?? BOM_KINDS[state.kind].defaultBatchUnit ?? state.product.unit ?? 'kg'
    const opened = openPrintSheet({
      kind: state.kind,
      productName: state.product.title,
      productCode: state.product.code,
      version: state.bom?.version ?? 1,
      status: state.bom?.status ?? 'draft',
      batchSize: size,
      batchUnit: printUnit,
      lines: state.rows.map((row) => ({
        code: row.code,
        name: row.name,
        kind: row.componentKind,
        value: rowValue(row),
        quantity: batchQuantity(state.kind, size, rowValue(row), printUnit, row.unit, row.specificGravity),
        onHand: row.onHand,
        fillLabel: row.usesFill
          ? `${formatQty(numberOf(row.fillQty), 3)} ${row.fillUnit}${
              row.fillUnit === 'ml' || row.fillUnit === 'l' ? ` · SG ${formatQty(row.specificGravity && row.specificGravity > 0 ? row.specificGravity : 1, 3)}` : ''
            }`
          : null,
        unit: row.unit,
        remark: row.remark,
      })),
      notes: state.notes,
      createdByName: state.bom?.createdByName ?? null,
      approvedByName: state.bom?.approvedByName ?? null,
      createdAt: state.bom?.createdAt ?? null,
      approvedAt: state.bom?.approvedAt ?? null,
      labels: {
        formulaTitle: t('dermat_boms.print.formulaTitle', 'Bill of Material · Formula'),
        packTitle: t('dermat_boms.print.packTitle', 'Bill of Material · Pack'),
        watermark: t('dermat_boms.print.watermark', 'DRAFT'),
        watermarkOld: t('dermat_boms.print.watermarkOld', 'OLD VERSION'),
        status_draft: t('dermat_boms.status.draft', 'Draft'),
        status_approved: t('dermat_boms.status.approved', 'Approved'),
        status_superseded: t('dermat_boms.status.superseded', 'Superseded'),
        productName: t('dermat_boms.print.productName', 'Product Name'),
        productCode: t('dermat_boms.print.productCode', 'Product Code'),
        version: t('dermat_boms.print.version', 'Version'),
        quantity: t('dermat_boms.print.quantity', 'Quantity'),
        createdOn: t('dermat_boms.print.createdOn', 'Created on'),
        approvedOn: t('dermat_boms.print.approvedOn', 'Approved on'),
        sectionRm: t('dermat_boms.print.sectionRm', 'Raw Material'),
        sectionBulk: t('dermat_boms.print.sectionBulk', 'Bulk'),
        sectionPm: t('dermat_boms.print.sectionPm', 'Packing Material'),
        sectionOther: t('dermat_boms.print.sectionOther', 'Other'),
        code: t('dermat_boms.table.code', 'Code'),
        component: t('dermat_boms.print.component', 'Component'),
        percent: t('dermat_boms.table.percent', 'RM %'),
        perPiece: t('dermat_boms.print.perPiece', 'Qty / pc'),
        batchQty: t('dermat_boms.print.batchQty', 'Quantity'),
        uom: t('dermat_boms.print.uom', 'UOM'),
        onHand: t('dermat_boms.table.onHand', 'On hand'),
        total: t('dermat_boms.table.total', 'Total'),
        notes: t('dermat_boms.notes', 'Notes'),
        madeBy: t('dermat_boms.print.madeBy', 'Made by'),
        approvedBy: t('dermat_boms.print.approvedBy', 'Approved by'),
        issuedTo: t('dermat_boms.print.issuedTo', 'Issued to production'),
        printed: t('dermat_boms.print.printed', 'Printed'),
      },
    })
    if (!opened) flash(t('dermat_boms.print.blocked', 'Allow pop-ups for this site to print the sheet.'), 'error')
  }

  if (loadError) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={loadError} />
        </PageBody>
      </Page>
    )
  }

  if (!state) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('dermat_boms.loading', 'Loading BOM…')} />
        </PageBody>
      </Page>
    )
  }

  const config = BOM_KINDS[state.kind]
  const KindIcon = KIND_ICON[state.kind]
  const batchSize = numberOf(state.batchSize)
  const batchUnit = state.bom?.batchUnit ?? config.defaultBatchUnit ?? state.product.unit ?? 'kg'
  const totalPercent = Math.round(state.rows.reduce((sum, row) => sum + rowValue(row), 0) * 10000) / 10000
  const percentOk = Math.abs(totalPercent - PERCENT_TOTAL) <= PERCENT_TOLERANCE
  const lines = state.rows.map((row) => {
    const need = batchQuantity(state.kind, batchSize, rowValue(row), batchUnit, row.unit, row.specificGravity)
    return { row, need, short: need > row.onHand }
  })
  const valueLabel = state.kind === 'formula' ? t('dermat_boms.table.percent', 'RM %') : t('dermat_boms.table.perPiece', 'Qty per piece')
  const status = state.bom?.status ?? 'draft'
  const isNew = !state.bom
  const hasProduct = Boolean(state.product.id)
  const otherVersions = state.bom?.versions.filter((entry) => entry.id !== state.bom?.id) ?? []
  const needed = lines.filter((line) => rowValue(line.row) > 0 && line.need > 0)
  const readyToProduce = needed.length && batchSize > 0
    ? Math.max(0, Math.min(...needed.map((line) => (line.row.onHand / line.need) * batchSize)))
    : null
  const statusLabel = status === 'approved' ? t('dermat_boms.status.issued', 'Issued') : t(`dermat_boms.status.${status}`, status)

  return (
    <Page>
      <PageBody>
        <div className="mx-auto max-w-7xl space-y-5 pb-16">
          <div className="flex flex-col gap-4 border-b pb-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-1">
              <BackLink href="/backend/boms" label={t('dermat_boms.back', 'Bill of Material')} feature="dermat_boms.view" />
              <div className="flex flex-wrap items-center gap-2">
                <KindIcon className="h-5 w-5 text-primary" />
                <h1 className="truncate text-xl font-bold">
                  {isNew ? t('dermat_boms.new.title', 'New Bill of Material') : state.name || state.product.title}
                </h1>
                {isNew ? null : (
                  <>
                    <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground">
                      v{state.bom?.version ?? 1}
                    </span>
                    <StatusBadge variant={STATUS_VARIANT[status] ?? 'neutral'} dot>
                      {statusLabel}
                    </StatusBadge>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {isNew
                  ? t('dermat_boms.new.hint', 'Fill in the BOM details, then add the raw materials (RM %) or the bulk and packing (per piece).')
                  : state.kind === 'formula'
                    ? t('dermat_boms.kind.formulaHint', 'Formula in RM % · quantities are for the batch below')
                    : t('dermat_boms.kind.packHint', 'Pack BOM · quantity per piece')}
              </p>
              {otherVersions.length ? (
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                  <span className="text-muted-foreground">{t('dermat_boms.versions', 'Other BOMs of this product:')}</span>
                  {otherVersions.map((entry) => (
                    <Link
                      key={entry.id}
                      href={`/backend/boms/${entry.id}`}
                      className="rounded border bg-muted/30 px-2 py-0.5 hover:bg-muted"
                    >
                      v{entry.version} · {entry.status === 'approved' ? t('dermat_boms.status.issued', 'Issued') : t(`dermat_boms.status.${entry.status}`, entry.status)}
                      {entry.orderNo ? ` · ${entry.orderNo}` : ''}
                    </Link>
                  ))}
                </div>
              ) : null}
              {state.bom?.orderId ? (
                <div className="mt-2 rounded-md border border-status-info-border bg-status-info-bg px-3 py-2 text-xs text-status-info-text">
                  <p>
                    {t('dermat_boms.orderOnly', 'This BOM is only for order')}{' '}
                    <Link href={`/backend/orders/${state.bom.orderId}`} className="font-mono font-semibold underline">
                      {state.bom.orderNo}
                    </Link>
                    . {t('dermat_boms.orderOnlyHint', 'The standard BOM of this product is not changed.')}
                  </p>
                  {state.rows.some((row) => row.componentKind === 'bulk') ? (
                    <p className="mt-1 flex flex-wrap items-center gap-2">
                      {state.rows
                        .filter((row) => row.componentKind === 'bulk')
                        .map((row) => (
                          <Button key={row.key} type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => copyForOrder(row.componentProductId)}>
                            {t('dermat_boms.orderFormula', 'Change the formula of {name} for this order', { name: row.name })}
                          </Button>
                        ))}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isNew ? (
                <Button asChild variant="outline" size="sm">
                  <Link href="/backend/boms">{t('dermat_boms.cancel', 'Cancel')}</Link>
                </Button>
              ) : (
                <>
                  <ExportButton size="sm" onExport={handleExport} disabled={!state.rows.length} />
                  <Button type="button" variant="outline" size="sm" onClick={handlePrint} disabled={!state.rows.length}>
                    <Printer className="mr-1.5 h-4 w-4" />
                    {t('dermat_boms.print.button', 'Print / PDF')}
                  </Button>
                </>
              )}
              {canManage && state.bom ? (
                <Button type="button" variant="outline" size="sm" onClick={() => handleNewVersion(true)} disabled={busy}>
                  <Copy className="mr-1.5 h-4 w-4" />
                  {t('dermat_boms.copy', 'Copy BOM')}
                </Button>
              ) : null}
              {canManage && state.bom && status !== 'draft' ? (
                <Button type="button" variant="outline" size="sm" onClick={() => handleNewVersion(false)} disabled={busy}>
                  <CopyPlus className="mr-1.5 h-4 w-4" />
                  {t('dermat_boms.newVersion', 'Edit as new version')}
                </Button>
              ) : null}
              {canManage && state.bom && status === 'draft' ? (
                <Button type="button" variant="destructive-ghost" size="sm" onClick={handleDelete} disabled={busy}>
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  {t('dermat_boms.delete', 'Delete')}
                </Button>
              ) : null}
              {editable ? (
                <Button type="button" variant={state.bom ? 'outline' : 'default'} size="sm" onClick={handleSave} disabled={busy}>
                  {busy ? t('dermat_boms.saving', 'Saving…') : isNew ? t('dermat_boms.create', 'Save BOM') : t('dermat_boms.save', 'Save')}
                </Button>
              ) : null}
              {canApprove && state.bom && status === 'draft' ? (
                <Button type="button" size="sm" onClick={handleApprove} disabled={busy}>
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  {t('dermat_boms.approve', 'Approve & issue')}
                </Button>
              ) : null}
            </div>
          </div>

          {!canManage ? <ViewOnlyNote>{t('dermat_boms.viewOnly', 'View only: BOMs are made, changed and approved by R&D.')}</ViewOnlyNote> : null}

          <BomDetailsCard
            editable={editable}
            productLocked={!isNew}
            name={state.name}
            product={hasProduct ? state.product : null}
            batchSize={state.batchSize}
            batchUnit={batchUnit}
            yieldPercent={state.yieldPercent}
            readyToProduce={readyToProduce}
            madeBy={state.bom?.createdByName ?? null}
            approvedBy={
              state.bom?.approvedByName && state.bom.approvedAt
                ? `${state.bom.approvedByName} · ${new Date(state.bom.approvedAt).toLocaleDateString('en-IN')}`
                : null
            }
            onName={(value) => patch({ name: value })}
            onBatchSize={(value) => patch({ batchSize: value })}
            onYield={(value) => patch({ yieldPercent: value })}
            onPickProduct={(option) => void selectProduct(option)}
          />

          {state.bom ? (
            <div className="inline-flex rounded-lg border bg-muted p-1 text-xs">
              {(
                [
                  { value: 'lines', label: t('dermat_boms.view.lines', 'Lines'), icon: Layers },
                  { value: 'tree', label: t('dermat_boms.view.tree', 'Tree & needs'), icon: Network },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setView(option.value)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition-colors',
                    view === option.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <option.icon className="h-3.5 w-3.5" />
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}

          {view === 'tree' && state.bom ? (
            <div className="space-y-5">
              {state.kind === 'formula' && state.product.kind === 'bulk' ? (
                <FillPlan
                  productId={state.product.id}
                  batchSize={state.bom.batchSize}
                  bulkUnit={state.bom.batchUnit}
                  specificGravity={state.bom.product?.specificGravity ?? null}
                />
              ) : null}
              <BomTree bomId={state.bom.id} defaultQuantity={state.bom.batchSize} unit={state.bom.batchUnit} dirty={dirty} />
            </div>
          ) : (
            <>
              <Card className="overflow-hidden">
                <CardHeader className="flex flex-col gap-3 border-b bg-muted/20 pb-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-sm font-bold">
                      <Layers className="h-4 w-4 text-primary" />
                      {state.kind === 'formula'
                        ? t('dermat_boms.table.formulaTitle', 'Raw Materials')
                        : t('dermat_boms.table.packTitle', 'Bulk & Packing')}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {state.kind === 'formula'
                        ? t(
                            'dermat_boms.table.formulaHint',
                            'Enter RM % for each material. The quantity for the batch is calculated. The total must be 100 % to approve.',
                          )
                        : t(
                            'dermat_boms.table.packHint',
                            "For each bulk enter the fill size of one piece (30 ml, 25 g) — it is turned into kg using the bulk's specific gravity. Packing is pcs per piece. Add several bulks for a kit.",
                          )}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="w-10 p-3 text-center">#</th>
                          <th className="min-w-64 p-3 text-left">{t('dermat_boms.table.component', 'Component')}</th>
                          <th className="w-32 p-3 text-right">{t('dermat_boms.table.onHand', 'On Hand')}</th>
                          <th className="w-32 p-3 text-left">{t('dermat_boms.table.availability', 'Availability')}</th>
                          <th className="w-36 p-3 text-right">{valueLabel}</th>
                          <th className="w-36 p-3 text-right">{t('dermat_boms.table.usage', 'Usage')}</th>
                          <th className="min-w-40 p-3 text-left">{t('dermat_boms.table.remark', 'Remark')}</th>
                          {editable ? <th className="w-28 p-3" /> : null}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {lines.map(({ row, need, short }, index) => {
                          const error = rowErrors[String(index + 1)]
                          return (
                            <tr key={row.key} className={cn('align-top', error && 'bg-status-error-bg')}>
                              <td className="p-3 text-center font-mono text-xs text-muted-foreground">{index + 1}</td>
                              <td className="p-3">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {row.code ? <span className="font-mono text-xs text-primary">{row.code}</span> : null}
                                  <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">{kindShort(row.componentKind)}</span>
                                </div>
                                <span className="mt-0.5 block font-medium">{row.name}</span>
                                {error ? <span className="block text-xs text-status-error-text">{error}</span> : null}
                              </td>
                              <td className={cn('p-3 text-right font-mono', short && rowValue(row) > 0 && 'text-status-error-text')}>
                                {formatQty(row.onHand)} <span className="text-xs font-normal text-muted-foreground">{row.unit}</span>
                              </td>
                              <td className="p-3">
                                <AvailabilityBadge need={rowValue(row) > 0 ? need : 0} onHand={row.onHand} />
                              </td>
                              <td className="p-2 text-right">
                                {row.usesFill ? (
                                  <div className="space-y-1">
                                    {editable ? (
                                      <div className="flex justify-end gap-1">
                                        <Input
                                          ref={(element) => {
                                            valueRefs.current[row.key] = element
                                          }}
                                          type="number"
                                          min={0}
                                          step="any"
                                          value={row.fillQty}
                                          placeholder="30"
                                          aria-label={t('dermat_boms.table.fillSize', 'Fill size per piece')}
                                          className="h-8 w-20 text-right font-mono"
                                          onChange={(event) => updateRow(row.key, { fillQty: event.target.value })}
                                        />
                                        <Select
                                          value={row.fillUnit}
                                          onValueChange={(value) => updateRow(row.key, { fillUnit: value as FillUnit })}
                                        >
                                          <SelectTrigger className="h-8 w-16">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {FILL_UNITS.map((unit) => (
                                              <SelectItem key={unit} value={unit}>
                                                {unit}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    ) : (
                                      <span className="font-mono">
                                        {formatQty(numberOf(row.fillQty), 3)} {row.fillUnit}
                                      </span>
                                    )}
                                    <span className="block text-xs text-muted-foreground">
                                      = {formatQty(rowValue(row), 5)} {row.unit}
                                      {row.fillUnit === 'ml' || row.fillUnit === 'l'
                                        ? ` · SG ${formatQty(row.specificGravity && row.specificGravity > 0 ? row.specificGravity : 1, 3)}`
                                        : ''}
                                    </span>
                                  </div>
                                ) : editable ? (
                                  <Input
                                    ref={(element) => {
                                      valueRefs.current[row.key] = element
                                    }}
                                    type="number"
                                    min={0}
                                    step="any"
                                    value={row.value}
                                    placeholder={state.kind === 'formula' ? '0.000' : '1'}
                                    className="h-8 text-right font-mono"
                                    onChange={(event) => updateRow(row.key, { value: event.target.value })}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter') {
                                        event.preventDefault()
                                        const next = state.rows[index + 1]
                                        if (next) valueRefs.current[next.key]?.focus()
                                      }
                                    }}
                                  />
                                ) : (
                                  <span className="font-mono">{formatQty(numberOf(row.value), 5)}</span>
                                )}
                              </td>
                              <td className="p-3 text-right font-mono font-semibold">
                                {formatQty(need)} <span className="text-xs font-normal text-muted-foreground">{row.unit}</span>
                              </td>
                              <td className="p-2">
                                {editable ? (
                                  <Input
                                    className="h-8"
                                    value={row.remark}
                                    onChange={(event) => updateRow(row.key, { remark: event.target.value })}
                                  />
                                ) : (
                                  <span className="text-xs text-muted-foreground">{row.remark || '—'}</span>
                                )}
                              </td>
                              {editable ? (
                                <td className="p-2">
                                  <div className="flex justify-end gap-0.5">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      aria-label={t('dermat_boms.table.up', 'Move up')}
                                      disabled={index === 0}
                                      onClick={() => moveRow(index, -1)}
                                    >
                                      <ArrowUp className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      aria-label={t('dermat_boms.table.down', 'Move down')}
                                      disabled={index === state.rows.length - 1}
                                      onClick={() => moveRow(index, 1)}
                                    >
                                      <ArrowDown className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground"
                                      aria-label={t('dermat_boms.table.remove', 'Remove line')}
                                      onClick={() => removeRow(row.key)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                              ) : null}
                            </tr>
                          )
                        })}
                        {!state.rows.length ? (
                          <tr>
                            <td colSpan={editable ? 8 : 7} className="p-8 text-center text-sm text-muted-foreground">
                              {hasProduct
                                ? t('dermat_boms.table.empty', 'No lines yet. Use "Add material" below.')
                                : t('dermat_boms.table.pickFirst', 'Pick the product in BOM details first, then add materials here.')}
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                      {state.rows.length ? (
                        <tfoot className="border-t bg-muted/30 text-sm font-semibold">
                          <tr>
                            <td colSpan={4} className="p-3 text-right text-xs uppercase text-muted-foreground">
                              {t('dermat_boms.table.total', 'Total')}
                            </td>
                            <td
                              className={cn('p-3 text-right font-mono', state.kind === 'formula' && !percentOk && 'text-status-error-text')}
                            >
                              {state.kind === 'formula' ? `${formatQty(totalPercent, 4)} %` : ''}
                            </td>
                            <td className="p-3 text-right font-mono">
                              {state.kind === 'formula' ? `${formatQty((totalPercent * batchSize) / PERCENT_TOTAL)} ${batchUnit}` : ''}
                            </td>
                            <td colSpan={editable ? 2 : 1} />
                          </tr>
                        </tfoot>
                      ) : null}
                    </table>
                  </div>
                  {editable ? (
                    <div className="flex flex-wrap items-center gap-3 border-t p-3">
                      <MaterialPicker
                        kinds={config.componentKinds}
                        excludeIds={[state.product.id, ...state.rows.map((row) => row.componentProductId)]}
                        disabled={!hasProduct}
                        onSelect={addRow}
                        label={t('dermat_boms.table.add', 'Add material')}
                      />
                      {state.kind === 'pack' && hasProduct ? (
                        <PackagingCodePicker variant="button" label={t('dermat_boms.packaging.addSet', 'Add packaging set (code)')} onSelect={(code) => void addPackagingSet(code)} />
                      ) : null}
                      {state.kind === 'pack' && hasProduct ? (
                        <Button type="button" variant="outline" size="sm" onClick={addOwnPacking}>
                          <Package className="mr-1.5 h-4 w-4" />
                          {t('dermat_boms.packing.add', 'Add packing of this product')}
                        </Button>
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        {state.kind === 'formula'
                          ? t('dermat_boms.table.addFormulaHint', 'Raw materials, or another Bulk as a sub-formula')
                          : t('dermat_boms.table.addPackHint', 'Bulk and packing materials')}
                      </span>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold">{t('dermat_boms.notes', 'Notes')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {editable ? (
                    <Textarea
                      rows={3}
                      value={state.notes}
                      placeholder={t('dermat_boms.notesPlaceholder', 'Process notes, order of adding, temperature…')}
                      onChange={(event) => patch({ notes: event.target.value })}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{state.notes || '—'}</p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
          {state.bom ? <BomLinks productId={state.product.id} productKind={state.product.kind} /> : null}
        </div>
      </PageBody>
    </Page>
  )
}

export default BomEditor
