'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Card, CardContent, CardHeader, CardTitle } from '@open-mercato/ui/primitives/card'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { SegmentedControl, SegmentedControlItem } from '@open-mercato/ui/primitives/segmented-control'
import { Checkbox } from '@open-mercato/ui/primitives/checkbox'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@open-mercato/ui/primitives/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@open-mercato/ui/primitives/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@open-mercato/ui/primitives/dialog'
import {
  Plus,
  LayoutGrid,
  List,
  Search,
  Building2,
  Boxes,
  CreditCard,
  Wallet,
  Truck,
  Clock,
  ArrowRight,
  Sparkles,
  Calendar,
  AlertCircle,
  Eye,
  CheckCircle2,
  Layers,
  Filter,
  FlaskConical,
  ShieldCheck,
  Package,
  Edit3,
  FileSpreadsheet,
  Pencil,
  Save,
  X,
  Loader2,
  Columns3,
} from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall, withScopedApiRequestHeaders } from '@open-mercato/ui/backend/utils/apiCall'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { buildOptimisticLockHeader } from '@open-mercato/ui/backend/utils/optimisticLock'
import { surfaceRecordConflict } from '@open-mercato/ui/backend/conflicts'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { cn } from '@open-mercato/shared/lib/utils'
import { InlineCustomerCell, InlineUomCell } from './components/InlineEditCells'
import { StageActionDialog, type StageGateMode, type StageGateSubmitPayload } from './components/StageActionDialog'

type OrderLineSummary = {
  id: string
  name: string | null
  quantity: string | number | null
  quantity_unit: string | null
  unit_price_net?: string | number | null
  tax_rate?: string | number | null
  product_id?: string | null
  updated_at?: string | null
  cf_line_kind?: 'fg' | 'rm' | null
  cf_pack_size?: string | null
  cf_uom?: string | null
  cf_variant_sku?: string | null
  cf_brand_name?: string | null
  cf_mrp?: string | number | null
  customFields?: Record<string, unknown>
}

type OrderRow = {
  id: string
  orderNumber: string
  status: string | null
  statusEntryId: string | null
  paymentStatus: string | null
  customerName?: string | null
  customerEntityId?: string | null
  placedAt?: string | null
  expectedDeliveryAt: string | null
  grandTotalGrossAmount: string | number | null
  grandTotalNetAmount?: string | number | null
  taxStrategyKey: string | null
  updatedAt: string
  createdAt: string
  comments?: string | null
  customerSnapshot?: {
    customer?: {
      id?: string
      displayName?: string
      primaryPhone?: string
      primaryEmail?: string
      customFields?: Record<string, unknown>
    } | null
  } | null
  cf_advance_received_amount?: string | number | null
  cf_advance_received_at?: string | null
  cf_proforma_invoice_number?: string | null
  cf_transport_arranged?: boolean | null
  cf_customer_po_reference?: string | null
  cf_order_type?: string | null
  cf_priority?: string | null
  cf_sales_poc?: string | null
  cf_packaging_type?: string | null
  cf_pm_source?: string | null
  cf_artwork_requirement?: string | null
  cf_sample_required?: boolean | null
  cf_order_stage?: string | null
  // Master Sheet Specific Operational Fields
  cf_pack_code?: string | null
  cf_packaging_status_tag?: string | null
  cf_brand_name?: string | null
  cf_batch_no?: string | null
  cf_mfg_month?: string | null
  cf_mrp?: string | number | null
  cf_mrp_per_unit?: string | number | null
  cf_expiry?: string | null
  cf_order_verified?: boolean | null
  cf_rd_no?: string | null
  cf_artwork_finalized?: boolean | string | null
  cf_qa_approval_date?: string | null
  cf_sent_to_printing?: string | boolean | null
  cf_carton_stock?: string | null
  cf_printing_details?: string | null
  cf_primary_packaging?: string | null
  cf_tube_label_stock?: string | null
  cf_action_taken_status?: string | null
  cf_billing_rate?: string | number | null
  cf_billing_remarks?: string | null
  cf_designer_status?: string | null

  customFields?: Record<string, unknown>
  metadata?: Record<string, unknown>
  lines?: OrderLineSummary[]
  productSummary?: string | null
}

type StatusOption = {
  id: string
  value: string
  label: string
  color: string | null
}

// Spec §5.2 Kanban column list. `key` is the `customFields.order_stage` enum value written by
// the stage-gate command (dermat_sales_flow.orders.transition_stage) — never written directly
// by the UI. `gate` selects which StageActionDialog mode must be completed before a card can
// move INTO that column; `null` means the move is a lightweight confirmation (spec §5.2: "When
// all data is already complete, a lightweight confirmation can be shown").
export const KANBAN_COLUMNS = [
  {
    key: 'new',
    label: '1. New',
    shortLabel: 'New',
    headerBadge: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-300',
    icon: Clock,
    matchValues: ['new', 'draft', 'inquiry', 'quote'],
    gate: null as StageGateMode | null,
  },
  {
    key: 'advance_payment',
    label: '2. Advance Payment',
    shortLabel: 'Advance',
    headerBadge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300',
    icon: Wallet,
    matchValues: ['advance_payment', 'advance_pending'],
    gate: 'advance' as StageGateMode | null,
  },
  {
    key: 'verified',
    label: '3. Verified / Official',
    shortLabel: 'Verified',
    headerBadge: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300',
    icon: CheckCircle2,
    matchValues: ['verified', 'confirmed', 'advance_received', 'approved', 'advance_paid'],
    gate: 'verify' as StageGateMode | null,
  },
  {
    key: 'rnd_sample',
    label: '4. R&D / Sample',
    shortLabel: 'R&D Sample',
    headerBadge: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-300',
    icon: FlaskConical,
    matchValues: ['rnd_sample', 'sample_trial', 'sample_sent', 'r_and_d', 'lab_trial', 'sampling', 'samples', 'sample'],
    gate: null as StageGateMode | null,
  },
  {
    key: 'artwork_packaging',
    label: '5. Artwork / Packaging',
    shortLabel: 'Artwork/Pkg',
    headerBadge: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-300',
    icon: Layers,
    matchValues: ['artwork_packaging', 'pm_sourcing', 'artwork_approved', 'formulation_approved', 'pm_received', 'pm_source'],
    gate: 'sample_sent' as StageGateMode | null,
  },
  {
    key: 'procurement_material',
    label: '6. Procurement / Material',
    shortLabel: 'Procurement',
    headerBadge: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-300',
    icon: Package,
    matchValues: ['procurement_material', 'procurement', 'material'],
    gate: 'generic' as StageGateMode | null,
  },
  {
    key: 'production',
    label: '7. Production',
    shortLabel: 'Production',
    headerBadge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300',
    icon: Boxes,
    matchValues: ['production', 'in_production', 'processing', 'manufacturing', 'bulk_compounding'],
    gate: 'generic' as StageGateMode | null,
  },
  {
    key: 'qc_qa',
    label: '8. QC / QA',
    shortLabel: 'QC/QA',
    headerBadge: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-300',
    icon: ShieldCheck,
    matchValues: ['qc_qa', 'qc_packing', 'quality_check', 'packaging', 'packing', 'qc_approved', 'cartoning'],
    gate: 'generic' as StageGateMode | null,
  },
  {
    key: 'billing_payment',
    label: '9. Billing / Payment',
    shortLabel: 'Billing',
    headerBadge: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-300',
    icon: CreditCard,
    matchValues: ['billing_payment', 'billing', 'payment'],
    gate: 'generic' as StageGateMode | null,
  },
  {
    key: 'ready_to_dispatch',
    label: '10. Ready to Dispatch',
    shortLabel: 'Ready',
    headerBadge: 'bg-lime-500/10 text-lime-700 dark:text-lime-300 border-lime-300',
    icon: Package,
    matchValues: ['ready_to_dispatch', 'ready'],
    gate: 'generic' as StageGateMode | null,
  },
  {
    key: 'dispatched_completed',
    label: '11. Dispatched / Completed',
    shortLabel: 'Dispatched',
    headerBadge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300',
    icon: Truck,
    matchValues: ['dispatched_completed', 'fulfilled', 'delivered', 'completed', 'dispatched', 'shipped'],
    gate: 'generic' as StageGateMode | null,
  },
] as const

export const PIPELINE_ORDER = [
  'new',
  'advance_payment',
  'verified',
  'rnd_sample',
  'artwork_packaging',
  'procurement_material',
  'production',
  'qc_qa',
  'billing_payment',
  'ready_to_dispatch',
  'dispatched_completed',
] as const

// Master sheet table "Columns" toggle — Pack Code (sticky left, the row's link/identifier)
// and Pipeline Stage & Actions (sticky right, the primary action column) are structural
// and always shown; every other column can be hidden. Grouped to match the table's
// existing section comments so the picker reads the same way the table is organized.
export const TABLE_COLUMN_DEFS: { key: string; label: string; section: string }[] = [
  { key: 'date', label: 'O.Date', section: 'Core Identifiers' },
  { key: 'packaging', label: 'Packaging', section: 'Core Identifiers' },
  { key: 'brand', label: 'Brand / Product Name', section: 'Core Identifiers' },
  { key: 'packSize', label: 'Pack (gm/ml)', section: 'Core Identifiers' },
  { key: 'qty', label: 'Order Qty', section: 'Core Identifiers' },
  { key: 'batchNo', label: 'Batch No', section: 'Core Identifiers' },
  { key: 'month', label: 'Month', section: 'Core Identifiers' },
  { key: 'mrp', label: 'M.R.P. (₹)', section: 'Pricing & Customer' },
  { key: 'mrpPerUnit', label: 'MRP/g or ml', section: 'Pricing & Customer' },
  { key: 'expiry', label: 'Expiry', section: 'Pricing & Customer' },
  { key: 'company', label: 'Customer / Company', section: 'Pricing & Customer' },
  { key: 'verified', label: 'Verified', section: 'Pricing & Customer' },
  { key: 'salesPoc', label: 'Sales POC', section: 'Pricing & Customer' },
  { key: 'rdNo', label: 'R&D No.', section: 'R&D, QA & Artwork' },
  { key: 'artwork', label: 'Artwork Finalized', section: 'R&D, QA & Artwork' },
  { key: 'qa', label: 'QA Approval', section: 'R&D, QA & Artwork' },
  { key: 'printing', label: 'Sent to Printing', section: 'R&D, QA & Artwork' },
  { key: 'cartonStock', label: 'Carton Stock', section: 'Packaging & Material Stock' },
  { key: 'printDetails', label: 'Printing Details', section: 'Packaging & Material Stock' },
  { key: 'primaryPkg', label: 'Primary Packaging', section: 'Packaging & Material Stock' },
  { key: 'tubeStock', label: 'Tube/Label Stock', section: 'Packaging & Material Stock' },
  { key: 'actionStatus', label: 'Action Status', section: 'Commercials & Remarks' },
  { key: 'billingRate', label: 'Billing Rate (₹)', section: 'Commercials & Remarks' },
  { key: 'billingRemarks', label: 'Billing Remarks', section: 'Commercials & Remarks' },
  { key: 'designerStatus', label: 'Designer Status', section: 'Commercials & Remarks' },
]

function ColumnVisibilityDropdown({
  hidden,
  onToggle,
  onShowAll,
}: {
  hidden: Set<string>
  onToggle: (key: string) => void
  onShowAll: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const sections = React.useMemo(() => {
    const map = new Map<string, typeof TABLE_COLUMN_DEFS>()
    for (const col of TABLE_COLUMN_DEFS) {
      const list = map.get(col.section) ?? []
      list.push(col)
      map.set(col.section, list)
    }
    return [...map.entries()]
  }, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <Columns3 className="mr-1.5 h-4 w-4" />
          Columns
          {hidden.size > 0 ? (
            <span className="ml-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5">{hidden.size} hidden</span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3 max-h-[70vh] overflow-y-auto space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">Show / hide columns</span>
          <button type="button" className="text-[11px] text-primary hover:underline" onClick={onShowAll}>
            Show all
          </button>
        </div>
        {sections.map(([section, cols]) => (
          <div key={section} className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{section}</p>
            {cols.map((col) => (
              <label key={col.key} className="flex items-center gap-2 py-0.5 text-xs cursor-pointer">
                <Checkbox checked={!hidden.has(col.key)} onCheckedChange={() => onToggle(col.key)} />
                <span className="text-foreground">{col.label}</span>
              </label>
            ))}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}

// Helper to extract field safely from customFields, metadata, or direct properties
function getField(order: OrderRow, key: string, fallback = '—'): string {
  const line = order.lines?.[0]
  const val =
    order.customFields?.[key] ??
    order.metadata?.[key] ??
    (order as Record<string, unknown>)[`cf_${key}`] ??
    (order as Record<string, unknown>)[key] ??
    (line?.customFields as Record<string, unknown>)?.[key] ??
    (line as Record<string, unknown>)?.[`cf_${key}`]

  if (val === undefined || val === null || val === '') return fallback
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  return String(val)
}

// Bulk-edit dropdown option sets — copied verbatim from the existing Quick Edit dialog's
// implicit values (openEditModal/handleSaveEdit) so this mode never invents new enums.
const PACKAGING_STATUS_OPTIONS = ['NEW', 'REPEAT', 'REVISION']
const ARTWORK_FINALIZED_OPTIONS = [
  { value: 'Yes', label: 'Yes' },
  { value: 'No', label: 'No' },
]
const ACTION_TAKEN_STATUS_OPTIONS = [
  'IN PRODUCTION',
  'PENDING',
  'ON HOLD',
  'READY',
  'DISPATCHED',
  'COMPLETED',
]
const DESIGNER_STATUS_OPTIONS = ['PM OK', 'IN PROGRESS', 'PENDING', 'REVISION NEEDED']
const PRIMARY_PACKAGING_OPTIONS = ['Bottle', 'Tube', 'Jar', 'Sachet', 'Box']

function BulkTextCell({
  value,
  dirty,
  onChange,
  placeholder,
}: {
  value: string
  dirty: boolean
  onChange: (next: string) => void
  placeholder?: string
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn('h-7 min-w-[110px] text-xs', dirty && 'border-l-2 border-l-amber-500 bg-amber-500/5')}
      onClick={(e) => e.stopPropagation()}
    />
  )
}

function BulkSelectCell({
  value,
  dirty,
  onChange,
  options,
}: {
  value: string
  dirty: boolean
  onChange: (next: string) => void
  options: string[] | { value: string; label: string }[]
}) {
  const normalized = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={cn('h-7 min-w-[110px] text-xs', dirty && 'border-l-2 border-l-amber-500 bg-amber-500/5')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {normalized.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function getOrderColumnKey(order: OrderRow): string {
  const customStage = (
    (order.customFields?.order_stage as string) ||
    (order.metadata?.order_stage as string) ||
    (order.cf_order_stage as string) ||
    ''
  ).toLowerCase()

  const status = (order.status || '').toLowerCase()

  if (customStage) {
    for (const col of KANBAN_COLUMNS) {
      if (col.matchValues.some((v) => customStage === v || customStage.includes(v) || v.includes(customStage))) {
        return col.key
      }
    }
  }

  for (const col of KANBAN_COLUMNS) {
    if (col.matchValues.some((v) => status === v || status.includes(v) || v.includes(status))) {
      return col.key
    }
  }

  return 'new'
}

function formatINR(amount: string | number | null | undefined): string {
  const numeric = Number(amount ?? 0)
  if (!Number.isFinite(numeric)) return '₹0.00'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(numeric)
}

function formatDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function getDaysRemaining(dateStr?: string | null): { text: string; isUrgent: boolean } {
  if (!dateStr) return { text: 'No date', isUrgent: false }
  const target = new Date(dateStr)
  if (Number.isNaN(target.getTime())) return { text: '—', isUrgent: false }
  const now = new Date()
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, isUrgent: true }
  if (diffDays === 0) return { text: 'Due today', isUrgent: true }
  if (diffDays <= 5) return { text: `${diffDays}d left`, isUrgent: true }
  return { text: `${diffDays}d left`, isUrgent: false }
}

export default function OrderBookPage() {
  const t = useT()
  const router = useRouter()
  const scopeVersion = useOrganizationScopeVersion()

  const [viewMode, setViewMode] = React.useState<'table' | 'kanban'>('table')
  // Table view "Columns" toggle — the master sheet table keeps its existing bulk-edit
  // and cascading-cell logic untouched; hiding a column here just toggles CSS
  // (`data-col` attribute + a scoped `display:none` rule) rather than restructuring
  // the table into a data-driven column model, so nothing about how cells save changes.
  const [hiddenColumns, setHiddenColumns] = React.useState<Set<string>>(new Set())
  const [orders, setOrders] = React.useState<OrderRow[]>([])
  const [statusOptions, setStatusOptions] = React.useState<StatusOption[]>([])
  const [loading, setLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)

  // Quick edit modal state for operational remarks
  const [editOrder, setEditOrder] = React.useState<OrderRow | null>(null)
  const [editFormData, setEditFormData] = React.useState<Record<string, any>>({})
  const [savingEdit, setSavingEdit] = React.useState(false)

  // Bulk "Excel-style" edit mode (client ask: "user can just directly want to go and see that
  // do thing i kind excel view" — every row's operational fields become live inputs at once,
  // changes are staged locally, and one Save commits them all in a batch). Stage is explicitly
  // excluded — it always routes through StageActionDialog regardless of this mode.
  const [bulkEditMode, setBulkEditMode] = React.useState(false)
  const [dirtyRows, setDirtyRows] = React.useState<Record<string, Record<string, any>>>({})
  const [bulkSaving, setBulkSaving] = React.useState(false)

  const dirtyCount = Object.keys(dirtyRows).length

  const setDirtyField = React.useCallback((orderId: string, key: string, value: any) => {
    setDirtyRows((prev) => ({
      ...prev,
      [orderId]: { ...(prev[orderId] || {}), [key]: value },
    }))
  }, [])

  const handleCancelBulkEdit = React.useCallback(() => {
    setDirtyRows({})
    setBulkEditMode(false)
  }, [])

  const handleSaveBulkEdit = React.useCallback(async () => {
    const entries = Object.entries(dirtyRows)
    if (entries.length === 0) return
    setBulkSaving(true)
    let successCount = 0
    let failureCount = 0
    try {
      for (const [orderId, changes] of entries) {
        const order = orders.find((o) => o.id === orderId)
        if (!order) continue
        try {
          const payload: Record<string, any> = {
            id: orderId,
            customFields: { ...(order.customFields || {}), ...changes },
            metadata: { ...(order.metadata || {}), ...changes },
          }
          await withScopedApiRequestHeaders(buildOptimisticLockHeader(order.updatedAt), () =>
            updateCrud('sales/orders', payload)
          )

          // Brand/Product Name cascades to the linked catalog product's real title (client
          // ask: same principle as UOM's cascade-to-product — the order-level custom field is
          // a label, but if a real product is linked, its title must change too).
          if (typeof changes.product_name === 'string' && changes.product_name.trim()) {
            const productId = order.lines?.[0]?.product_id ?? null
            if (productId) {
              try {
                await updateCrud('catalog/products', { id: productId, title: changes.product_name.trim() })
              } catch {
                flash(
                  t('dermat_sales_flow.orderBook.productNameCascadeFailed', 'Order updated, but syncing the product title failed for {{orderNumber}}', { orderNumber: order.orderNumber }),
                  'error',
                )
              }
            }
          }

          successCount += 1
        } catch (err) {
          failureCount += 1
          if (!surfaceRecordConflict(err, t, { onRefresh: () => setReloadToken((v) => v + 1) })) {
            flash(
              t('dermat_sales_flow.orderBook.bulkSaveRowFailed', 'Failed to save changes for order {{orderNumber}}', { orderNumber: order.orderNumber }),
              'error',
            )
          }
        }
      }

      if (failureCount === 0) {
        flash(t('dermat_sales_flow.orderBook.bulkSaveSuccess', 'Saved changes to {{count}} orders', { count: successCount }), 'success')
      } else if (successCount > 0) {
        flash(
          t('dermat_sales_flow.orderBook.bulkSavePartial', 'Saved {{successCount}} of {{total}} orders — some rows failed', { successCount, total: successCount + failureCount }),
          'error',
        )
      }

      setDirtyRows({})
      setBulkEditMode(false)
      setReloadToken((v) => v + 1)
    } finally {
      setBulkSaving(false)
    }
  }, [dirtyRows, orders, t])

  // Filters
  const [search, setSearch] = React.useState('')
  const [selectedStatusTab, setSelectedStatusTab] = React.useState<string>('all')
  const [filterPriority, setFilterPriority] = React.useState<string>('all')
  const [filterOrderType, setFilterOrderType] = React.useState<string>('all')

  // Load Status Options
  React.useEffect(() => {
    async function loadStatuses() {
      const call = await apiCall<{ items?: StatusOption[] }>(
        '/api/sales/order-statuses?page=1&pageSize=100',
        undefined,
        { fallback: { items: [] } }
      )
      if (call.ok && Array.isArray(call.result?.items)) {
        setStatusOptions(call.result.items)
      }
    }
    loadStatuses()
  }, [])

  // Load Orders with Lines
  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const orderCall = await apiCall<{ items?: OrderRow[]; total?: number }>(
          '/api/sales/orders?page=1&pageSize=100&sortField=updatedAt&sortDir=desc',
          undefined,
          { fallback: { items: [], total: 0 } }
        )

        const rawItems = Array.isArray(orderCall.result?.items) ? orderCall.result!.items! : []

        // Fetch lines for each order
        const itemsWithLines: OrderRow[] = await Promise.all(
          rawItems.map(async (order) => {
            try {
              const lineCall = await apiCall<{ items?: OrderLineSummary[] }>(
                `/api/sales/order-lines?orderId=${order.id}&pageSize=50`,
                undefined,
                { fallback: { items: [] } }
              )
              const lines = Array.isArray(lineCall.result?.items) ? lineCall.result!.items! : []
              const fgLines = lines.filter((l) => (l.cf_line_kind ?? 'fg') === 'fg')
              const productSummary = fgLines
                .map((l) => `${l.name || 'Product'}${l.cf_pack_size ? ` (${l.cf_pack_size} ${l.cf_uom || 'ml'})` : ''} × ${l.quantity || 1}`)
                .join(', ')

              return {
                ...order,
                lines,
                productSummary: productSummary || null,
              }
            } catch {
              return order
            }
          })
        )

        if (!cancelled) {
          setOrders(itemsWithLines)
        }
      } catch {
        if (!cancelled) flash('Failed to load order book', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [reloadToken, scopeVersion])

  // Stage-gate mechanism (spec §5.2): a stage move never blindly PATCHes order_stage. It opens
  // StageActionDialog for stages that require it (advance confirm / verify / sample-sent /
  // generic), validates + transacts server-side via the transition-stage command, then moves
  // the card only on success.
  const [pendingStageMove, setPendingStageMove] = React.useState<{ order: OrderRow; stageKey: string } | null>(null)
  const [stageGateSubmitting, setStageGateSubmitting] = React.useState(false)

  const requestStageMove = React.useCallback(
    (order: OrderRow, stageKey: string) => {
      const col = KANBAN_COLUMNS.find((c) => c.key === stageKey)
      const currentKey = getOrderColumnKey(order)
      if (currentKey === stageKey) return

      // Orders move one stage at a time (client ask: "user can't jump from one to the second
      // stage at all"). Forward is exactly the next stage; backward to any earlier stage is
      // allowed, but only with a reason (client ask: "revert back but with the reason").
      // Anything else (skipping ahead) is rejected client-side too — the transition-stage
      // command enforces the same rule server-side so a direct API call can't bypass it.
      const currentIdxRaw = (PIPELINE_ORDER as readonly string[]).indexOf(currentKey)
      const currentIdx = currentIdxRaw >= 0 ? currentIdxRaw : 0
      const targetIdx = (PIPELINE_ORDER as readonly string[]).indexOf(stageKey)
      if (targetIdx < 0) return
      const isForward = targetIdx > currentIdx
      const isBackward = targetIdx < currentIdx
      if (!isForward && !isBackward) return

      if (isBackward) {
        setPendingStageMove({ order, stageKey: `revert:${stageKey}` })
        return
      }

      // "Advance Payment" is now its own explicit pipeline stage (client ask: "even if the
      // advance payment is already given, add the stage and confirm order advance payment
      // received" — a visible step, not a hidden check). Moving New -> Advance Payment routes
      // through its gate normally via col.gate below.
      //
      // Independently re-checked when LEAVING R&D/Sample (client ask: "only give the sample
      // when advance payment is done" — a standing rule, not just a one-time gate). An order
      // could reach R&D/Sample via revert + re-forward, or advance_required could be toggled
      // off at creation, so this can't just rely on the Advance Payment stage having been
      // passed through earlier — it's re-verified here too before letting the sample go out.
      const advanceRequired = Boolean(order.customFields?.advance_required ?? order.metadata?.advance_required)
      const advanceReceived = Number(order.cf_advance_received_amount || order.customFields?.advance_received_amount || 0) > 0
      if (advanceRequired && !advanceReceived && currentKey === 'rnd_sample') {
        setPendingStageMove({ order, stageKey: `advance:${stageKey}` })
        return
      }

      if (!col?.gate) {
        // Lightweight confirmation stage — still routed through the gated dialog (generic
        // mode) rather than a blind write, per spec §5.2's "lightweight confirmation" clause.
        setPendingStageMove({ order, stageKey: `generic:${stageKey}` })
        return
      }
      setPendingStageMove({ order, stageKey: `${col.gate}:${stageKey}` })
    },
    [],
  )

  const handleUpdateStage = requestStageMove

  const activeGate = React.useMemo(() => {
    if (!pendingStageMove) return null
    const [modeRaw, targetStage] = pendingStageMove.stageKey.split(':')
    const mode = (modeRaw === 'advance' ? 'advance' : modeRaw) as StageGateMode
    const col = KANBAN_COLUMNS.find((c) => c.key === targetStage)
    return { mode, targetStage, col }
  }, [pendingStageMove])

  const handleStageGateConfirm = React.useCallback(
    async (payload: StageGateSubmitPayload) => {
      if (!pendingStageMove || !activeGate) return
      setStageGateSubmitting(true)
      try {
        const call = await apiCall<{ orderId: string; stage: string }>(
          `/api/dermat_sales_flow/orders/${pendingStageMove.order.id}/transition-stage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              targetStage: activeGate.targetStage,
              ...payload,
            }),
          },
        )
        if (!call.ok) {
          const message = (call.result as { error?: string } | null)?.error
          flash(message || 'Failed to move order stage', 'error')
          return
        }
        flash(`Order moved to ${activeGate.col?.shortLabel || activeGate.targetStage}`, 'success')
        setPendingStageMove(null)
        setReloadToken((t) => t + 1)
      } catch {
        flash('Failed to move order stage', 'error')
      } finally {
        setStageGateSubmitting(false)
      }
    },
    [pendingStageMove, activeGate],
  )

  // Open Edit Modal for an order's operational fields
  const openEditModal = (order: OrderRow) => {
    setEditOrder(order)
    setEditFormData({
      pack_code: getField(order, 'pack_code', ''),
      packaging_status_tag: getField(order, 'packaging_status_tag', 'NEW'),
      brand_name: getField(order, 'brand_name', order.customerName || ''),
      product_name: getField(order, 'product_name', order.lines?.[0]?.name || order.productSummary || ''),
      batch_no: getField(order, 'batch_no', ''),
      mfg_month: getField(order, 'mfg_month', ''),
      mrp: getField(order, 'mrp', ''),
      mrp_per_unit: getField(order, 'mrp_per_unit', ''),
      expiry: getField(order, 'expiry', '24 Months'),
      rd_no: getField(order, 'rd_no', ''),
      artwork_finalized: getField(order, 'artwork_finalized', 'No') === 'Yes',
      qa_approval_date: getField(order, 'qa_approval_date', ''),
      sent_to_printing: getField(order, 'sent_to_printing', ''),
      carton_stock: getField(order, 'carton_stock', ''),
      printing_details: getField(order, 'printing_details', ''),
      primary_packaging: getField(order, 'primary_packaging', getField(order, 'packaging_type', 'Bottle')),
      tube_label_stock: getField(order, 'tube_label_stock', ''),
      action_taken_status: getField(order, 'action_taken_status', 'IN PRODUCTION'),
      billing_remarks: getField(order, 'billing_remarks', ''),
      designer_status: getField(order, 'designer_status', 'PM OK'),
    })
  }

  // Save Edit Modal
  const handleSaveEdit = async () => {
    if (!editOrder) return
    setSavingEdit(true)
    try {
      const payload = {
        id: editOrder.id,
        customFields: {
          ...(editOrder.customFields || {}),
          ...editFormData,
        },
        metadata: {
          ...(editOrder.metadata || {}),
          ...editFormData,
        },
      }
      await withScopedApiRequestHeaders(buildOptimisticLockHeader(editOrder.updatedAt), () =>
        updateCrud('sales/orders', payload)
      )
      flash('Operational details updated successfully', 'success')
      setEditOrder(null)
      setReloadToken((t) => t + 1)
    } catch (err) {
      flash('Failed to save operational details', 'error')
    } finally {
      setSavingEdit(false)
    }
  }

  // Filtered orders
  const filteredOrders = React.useMemo(() => {
    return orders.filter((o) => {
      const q = search.trim().toLowerCase()
      if (q) {
        const orderNum = o.orderNumber.toLowerCase()
        const cust = (o.customerName || o.customerSnapshot?.customer?.displayName || '').toLowerCase()
        const prod = (o.productSummary || '').toLowerCase()
        const poc = (o.cf_sales_poc || (o.customFields?.sales_poc as string) || '').toLowerCase()
        const poRef = (o.cf_customer_po_reference || (o.customFields?.customer_po_reference as string) || '').toLowerCase()
        const brand = getField(o, 'brand_name', '').toLowerCase()
        const packCode = getField(o, 'pack_code', '').toLowerCase()
        const batchNo = getField(o, 'batch_no', '').toLowerCase()
        const rdNo = getField(o, 'rd_no', '').toLowerCase()
        const actionStatus = getField(o, 'action_taken_status', '').toLowerCase()

        if (
          !orderNum.includes(q) &&
          !cust.includes(q) &&
          !prod.includes(q) &&
          !poc.includes(q) &&
          !poRef.includes(q) &&
          !brand.includes(q) &&
          !packCode.includes(q) &&
          !batchNo.includes(q) &&
          !rdNo.includes(q) &&
          !actionStatus.includes(q)
        ) {
          return false
        }
      }

      if (selectedStatusTab !== 'all') {
        const orderColKey = getOrderColumnKey(o)
        if (orderColKey !== selectedStatusTab) return false
      }

      const priority = (o.cf_priority || (o.customFields?.priority as string) || (o.metadata?.priority as string) || 'Normal')
      if (filterPriority !== 'all' && priority !== filterPriority) return false

      const orderType = (o.cf_order_type || (o.customFields?.order_type as string) || (o.metadata?.order_type as string) || 'New')
      if (filterOrderType !== 'all' && orderType !== filterOrderType) return false

      return true
    })
  }, [orders, search, selectedStatusTab, filterPriority, filterOrderType])

  // KPIs
  const totalOrders = orders.length
  const totalValue = orders.reduce((acc, o) => acc + (Number(o.grandTotalGrossAmount) || 0), 0)
  const totalAdvance = orders.reduce((acc, o) => acc + (Number(o.cf_advance_received_amount || o.customFields?.advance_received_amount) || 0), 0)
  const totalPendingBalance = Math.max(0, totalValue - totalAdvance)
  const urgentCount = orders.filter((o) => (o.cf_priority || o.customFields?.priority) === 'Urgent').length

  return (
    <Page>
      <PageBody>
        <div className="space-y-6 max-w-[1700px] mx-auto pb-16">
          {/* Header Bar */}
          <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold tracking-tight">Order Book & Production Master Sheet</h1>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                  {filteredOrders.length} Orders
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Dermat India Operational Order Tracking Sheet: Formulations, Batches, QA/Artwork, Packaging Stock & Production Status
              </p>
            </div>

            <div className="flex items-center gap-3">
              <SegmentedControl value={viewMode} onValueChange={(val) => setViewMode(val as 'table' | 'kanban')}>
                <SegmentedControlItem value="table" className="flex items-center gap-1.5 px-3">
                  <List className="h-3.5 w-3.5" /> Table
                </SegmentedControlItem>
                <SegmentedControlItem value="kanban" className="flex items-center gap-1.5 px-3">
                  <LayoutGrid className="h-3.5 w-3.5" /> Kanban
                </SegmentedControlItem>
              </SegmentedControl>

              {viewMode === 'table' ? (
                bulkEditMode ? (
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2.5 py-1 text-xs font-semibold">
                      {t('dermat_sales_flow.orderBook.editingRowCount', 'Editing... {{count}} changed', { count: dirtyCount })}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={bulkSaving}
                      onClick={handleCancelBulkEdit}
                    >
                      <X className="mr-1.5 h-3.5 w-3.5" /> {t('dermat_sales_flow.orderBook.cancelEdit', 'Cancel')}
                    </Button>
                    <Button
                      size="sm"
                      className="bg-primary text-primary-foreground font-semibold"
                      disabled={dirtyCount === 0 || bulkSaving}
                      onClick={() => { void handleSaveBulkEdit() }}
                    >
                      {bulkSaving ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      {bulkSaving ? t('dermat_sales_flow.orderBook.saving', 'Saving...') : t('dermat_sales_flow.orderBook.saveAll', 'Save All')}
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => setBulkEditMode(true)}>
                    <Pencil className="mr-1.5 h-4 w-4" /> {t('dermat_sales_flow.orderBook.editTable', 'Edit Table')}
                  </Button>
                )
              ) : null}

              {viewMode === 'table' ? (
                <ColumnVisibilityDropdown
                  hidden={hiddenColumns}
                  onToggle={(key) => setHiddenColumns((prev) => {
                    const next = new Set(prev)
                    if (next.has(key)) next.delete(key)
                    else next.add(key)
                    return next
                  })}
                  onShowAll={() => setHiddenColumns(new Set())}
                />
              ) : null}

              <Button asChild className="bg-primary text-primary-foreground font-semibold">
                <Link href="/backend/sales/order-book/create">
                  <Plus className="mr-1.5 h-4 w-4" /> Book New Order
                </Link>
              </Button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Booked Value</p>
                  <CreditCard className="h-4 w-4 text-primary" />
                </div>
                <div className="mt-2 text-2xl font-bold text-foreground">{formatINR(totalValue)}</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{totalOrders} active production contracts</p>
              </CardContent>
            </Card>

            <Card className="bg-emerald-500/5 border-emerald-500/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Advance Received</p>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatINR(totalAdvance)}</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {totalValue > 0 ? `${Math.round((totalAdvance / totalValue) * 100)}% of total order book collected` : 'Advance accounting'}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-amber-500/5 border-amber-500/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">Balance Outstanding</p>
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">{formatINR(totalPendingBalance)}</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Payable before dispatch / on invoice</p>
              </CardContent>
            </Card>

            <Card className={cn(urgentCount > 0 ? "bg-rose-500/10 border-rose-500/30" : "bg-muted/30")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300">Urgent / Rush Orders</p>
                  <AlertCircle className="h-4 w-4 text-rose-600" />
                </div>
                <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">{urgentCount} Orders</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Flagged for expedited compounding</p>
              </CardContent>
            </Card>
          </div>

          {/* Search, Filter Tabs & Controls */}
          <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              {/* Search Bar */}
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by Pack Code, Brand, Batch No, Company, R&D No, POC, Printing, Status Remarks..."
                  className="pl-9 h-9 text-xs"
                />
              </div>

              {/* Priority & Order Type dropdowns */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="h-9 w-36 text-xs">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Urgent">Urgent / Rush</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterOrderType} onValueChange={setFilterOrderType}>
                  <SelectTrigger className="h-9 w-36 text-xs">
                    <SelectValue placeholder="Order Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="New">New Formulation</SelectItem>
                    <SelectItem value="Repeat">Repeat Order</SelectItem>
                    <SelectItem value="Revision">Revision</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t">
              <Button
                variant={selectedStatusTab === 'all' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setSelectedStatusTab('all')}
              >
                All Pipeline ({orders.length})
              </Button>
              {KANBAN_COLUMNS.map((col) => {
                const count = orders.filter((o) => getOrderColumnKey(o) === col.key).length
                return (
                  <Button
                    key={col.key}
                    variant={selectedStatusTab === col.key ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs px-2.5"
                    onClick={() => setSelectedStatusTab(col.key)}
                  >
                    {col.shortLabel} ({count})
                  </Button>
                )
              })}
            </div>
          </div>

          {/* ========================================================= */}
          {/* MASTER ERP TABLE VIEW (ALL 28 MASTER SHEET FIELDS) */}
          {/* ========================================================= */}
          {viewMode === 'table' ? (
            <Card className="shadow-sm">
              {hiddenColumns.size > 0 ? (
                <style>{[...hiddenColumns].map((key) => `[data-col="${key}"]{display:none}`).join('')}</style>
              ) : null}
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[800px]">
                  <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                    <thead className="sticky top-0 z-20 bg-muted/90 backdrop-blur font-semibold text-muted-foreground border-b text-[11px] uppercase tracking-wider">
                      <tr>
                        {/* Section 1: Core Identifiers */}
                        <th className="p-2.5 pl-3 sticky left-0 bg-muted/95 z-30 shadow-[1px_0_0_0_rgba(0,0,0,0.1)]">
                          Pack Code
                        </th>
                        <th className="p-2.5" data-col="date">O.Date</th>
                        <th className="p-2.5" data-col="packaging">Packaging</th>
                        <th className="p-2.5 font-bold text-foreground min-w-[200px]" data-col="brand">Brand / Product Name</th>
                        <th className="p-2.5" data-col="packSize">Pack (gm/ml)</th>
                        <th className="p-2.5" data-col="qty">Order Qty</th>
                        <th className="p-2.5" data-col="batchNo">Batch No</th>
                        <th className="p-2.5" data-col="month">Month</th>

                        {/* Section 2: Pricing & Customer */}
                        <th className="p-2.5" data-col="mrp">M.R.P. (₹)</th>
                        <th className="p-2.5" data-col="mrpPerUnit">MRP/g or ml</th>
                        <th className="p-2.5" data-col="expiry">Expiry</th>
                        <th className="p-2.5 font-bold text-foreground" data-col="company">Customer / Company</th>
                        <th className="p-2.5 text-center" data-col="verified">Verified</th>
                        <th className="p-2.5" data-col="salesPoc">Sales POC</th>

                        {/* Section 3: R&D, QA & Artwork */}
                        <th className="p-2.5" data-col="rdNo">R&D No.</th>
                        <th className="p-2.5" data-col="artwork">Artwork Finalized</th>
                        <th className="p-2.5" data-col="qa">QA Approval</th>
                        <th className="p-2.5" data-col="printing">Sent to Printing</th>

                        {/* Section 4: Packaging & Material Stock */}
                        <th className="p-2.5" data-col="cartonStock">Carton Stock</th>
                        <th className="p-2.5" data-col="printDetails">Printing Details</th>
                        <th className="p-2.5" data-col="primaryPkg">Primary Packaging</th>
                        <th className="p-2.5" data-col="tubeStock">Tube/Label Stock</th>

                        {/* Section 5: Commercials & Remarks */}
                        <th className="p-2.5" data-col="actionStatus">Action Status</th>
                        <th className="p-2.5" data-col="billingRate">Billing Rate (₹)</th>
                        <th className="p-2.5" data-col="billingRemarks">Billing Remarks</th>
                        <th className="p-2.5" data-col="designerStatus">Designer Status</th>
                        <th className="p-2.5 pr-3 text-right sticky right-0 bg-background/95 backdrop-blur z-10 border-l shadow-[-2px_0_4px_rgba(0,0,0,0.06)] min-w-[240px]">
                          Pipeline Stage & Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={27} className="p-10 text-center text-muted-foreground text-sm">
                            {loading ? 'Loading master production orders...' : 'No orders found matching criteria.'}
                          </td>
                        </tr>
                      ) : (
                        filteredOrders.map((order) => {
                          const line = order.lines?.[0]
                          const custName = order.customerName || order.customerSnapshot?.customer?.displayName || 'Customer'
                          const packCode = getField(order, 'pack_code', line?.cf_variant_sku || 'RARE')
                          const packagingTag = getField(order, 'packaging_status_tag', (order.cf_order_type || 'NEW') as string)
                          const brandName = getField(order, 'brand_name', line?.cf_brand_name || custName)
                          const productName = line?.name || order.productSummary || getField(order, 'product_name', 'Custom Formulation')
                          const packSize = getField(order, 'pack_size', line?.cf_pack_size || '30')
                          const orderQty = line?.quantity ? String(line.quantity) : getField(order, 'quantity', '1000')
                          const batchNo = getField(order, 'batch_no', `BATCH-${order.orderNumber.slice(-4)}`)
                          const mfgMonth = getField(order, 'mfg_month', order.placedAt ? new Date(order.placedAt).toLocaleDateString('en-IN', { month: '2-digit', year: 'numeric' }) : '08/2026')
                          const mrpVal = Number(getField(order, 'mrp', line?.cf_mrp ? String(line.cf_mrp) : '599')) || 0
                          const packNum = Number(packSize) || 1
                          const mrpPerUnit = mrpVal > 0 && packNum > 0 ? (mrpVal / packNum).toFixed(2) : '—'
                          const expiry = getField(order, 'expiry', '24 Months')
                          // Verified reads off the order's real pipeline stage (the same
                          // source the Action-column stage selector uses) instead of a
                          // separate boolean toggle — so the two can never drift apart.
                          const verifiedPipelineIdx = (PIPELINE_ORDER as readonly string[]).indexOf(getOrderColumnKey(order))
                          const isVerified = verifiedPipelineIdx >= (PIPELINE_ORDER as readonly string[]).indexOf('verified')
                          const salesPoc = getField(order, 'sales_poc', (order.cf_sales_poc as string) || '')
                          const rdNo = getField(order, 'rd_no', order.cf_sample_required ? 'RD-2026-089' : '—')
                          const artworkFinal = getField(order, 'artwork_finalized', 'Pending')
                          const qaApproval = getField(order, 'qa_approval_date', '—')
                          const sentToPrinting = getField(order, 'sent_to_printing', 'Pending')
                          const cartonStock = getField(order, 'carton_stock', 'In Stock')
                          const printDetails = getField(order, 'printing_details', '—')
                          const primaryPkg = getField(order, 'primary_packaging', (order.cf_packaging_type as string) || 'Bottle')
                          const tubeLabelStock = getField(order, 'tube_label_stock', 'Ready')
                          const actionStatus = getField(order, 'action_taken_status', 'IN PRODUCTION')
                          const billingRate = line?.unit_price_net ? Number(line.unit_price_net) : (Number(getField(order, 'billing_rate', '180')) || 0)
                          const billingRemarks = getField(order, 'billing_remarks', '50% Adv Received')
                          const designerStatus = getField(order, 'designer_status', 'PM OK')

                          const rowDirty = dirtyRows[order.id]
                          const getBulkValue = (key: string, fallback: string) =>
                            rowDirty && Object.prototype.hasOwnProperty.call(rowDirty, key)
                              ? String(rowDirty[key])
                              : fallback
                          const isFieldDirty = (key: string) =>
                            Boolean(rowDirty && Object.prototype.hasOwnProperty.call(rowDirty, key))
                          const setBulkField = (key: string, value: string) => setDirtyField(order.id, key, value)

                          return (
                            <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                              {/* 1. Pack Code (Sticky Left) */}
                              <td className="p-2.5 pl-3 sticky left-0 bg-background/95 z-10 font-bold text-primary shadow-[1px_0_0_0_rgba(0,0,0,0.1)]">
                                {bulkEditMode ? (
                                  <BulkTextCell
                                    value={getBulkValue('pack_code', packCode)}
                                    dirty={isFieldDirty('pack_code')}
                                    onChange={(v) => setBulkField('pack_code', v)}
                                  />
                                ) : (
                                  <Link href={`/backend/sales/order-book/${order.id}`} className="hover:underline">
                                    {packCode}
                                  </Link>
                                )}
                              </td>

                              {/* 2. O.Date */}
                              <td className="p-2.5 text-muted-foreground font-mono text-[11px]" data-col="date">
                                {formatDate(order.placedAt || order.createdAt)}
                              </td>

                              {/* 3. Packaging Status Tag */}
                              <td className="p-2.5" data-col="packaging">
                                {bulkEditMode ? (
                                  <BulkSelectCell
                                    value={getBulkValue('packaging_status_tag', packagingTag)}
                                    dirty={isFieldDirty('packaging_status_tag')}
                                    onChange={(v) => setBulkField('packaging_status_tag', v)}
                                    options={PACKAGING_STATUS_OPTIONS}
                                  />
                                ) : (
                                  <span className={cn(
                                    "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                                    packagingTag.includes('REPEAT') ? "bg-blue-500/10 text-blue-600" :
                                    packagingTag.includes('NEW') ? "bg-emerald-500/10 text-emerald-600" :
                                    "bg-amber-500/10 text-amber-600"
                                  )}>
                                    {packagingTag}
                                  </span>
                                )}
                              </td>

                              {/* 4. Brand / Product Name — product_name cascades to the linked
                                  catalog product's real title on save (client ask: same
                                  principle as UOM's cascade — the order-level field is a label,
                                  but if a real product is linked, rename it for real). */}
                              <td className="p-2.5 font-semibold text-foreground max-w-[240px]" data-col="brand">
                                {bulkEditMode ? (
                                  <div className="flex flex-col gap-1 min-w-[160px]">
                                    <BulkTextCell
                                      value={getBulkValue('brand_name', brandName)}
                                      dirty={isFieldDirty('brand_name')}
                                      onChange={(v) => setBulkField('brand_name', v)}
                                      placeholder={t('dermat_sales_flow.orderBook.brandName', 'Brand')}
                                    />
                                    <BulkTextCell
                                      value={getBulkValue('product_name', productName)}
                                      dirty={isFieldDirty('product_name')}
                                      onChange={(v) => setBulkField('product_name', v)}
                                      placeholder={t('dermat_sales_flow.orderBook.productName', 'Product name')}
                                    />
                                  </div>
                                ) : (
                                  <span className="truncate block" title={line?.name || getField(order, 'brand_name', custName)}>
                                    {line?.name || getField(order, 'brand_name', custName)}
                                  </span>
                                )}
                              </td>

                              {/* 5. Pack (gm/ml) — inline-editable unit (client ask: click cell, pick a
                                  different unit; cascades to the product's default unit) */}
                              <td className="p-2.5 font-medium" data-col="packSize">
                                {line ? (
                                  <div className="flex items-center gap-1">
                                    <span>{packSize}</span>
                                    <InlineUomCell
                                      lineId={line.id}
                                      orderId={order.id}
                                      lineUpdatedAt={line.updated_at ?? null}
                                      currentUom={line.cf_uom || 'ml'}
                                      productId={line.product_id ?? null}
                                      onSaved={() => setReloadToken((t) => t + 1)}
                                      interactive={bulkEditMode}
                                    />
                                  </div>
                                ) : (
                                  <>{packSize} ml</>
                                )}
                              </td>

                              {/* 6. Order Quantity */}
                              <td className="p-2.5 font-bold text-foreground" data-col="qty">
                                {Number(orderQty).toLocaleString('en-IN')}
                              </td>

                              {/* 7. Batch No */}
                              <td className="p-2.5 font-mono text-[11px] font-medium text-slate-700 dark:text-slate-300" data-col="batchNo">
                                {bulkEditMode ? (
                                  <BulkTextCell
                                    value={getBulkValue('batch_no', batchNo)}
                                    dirty={isFieldDirty('batch_no')}
                                    onChange={(v) => setBulkField('batch_no', v)}
                                  />
                                ) : (
                                  batchNo
                                )}
                              </td>

                              {/* 8. Month */}
                              <td className="p-2.5 text-muted-foreground font-mono text-[11px]" data-col="month">
                                {bulkEditMode ? (
                                  <BulkTextCell
                                    value={getBulkValue('mfg_month', mfgMonth)}
                                    dirty={isFieldDirty('mfg_month')}
                                    onChange={(v) => setBulkField('mfg_month', v)}
                                  />
                                ) : (
                                  mfgMonth
                                )}
                              </td>

                              {/* 9. M.R.P. */}
                              <td className="p-2.5 font-medium" data-col="mrp">
                                {bulkEditMode ? (
                                  <BulkTextCell
                                    value={getBulkValue('mrp', mrpVal > 0 ? String(mrpVal) : '')}
                                    dirty={isFieldDirty('mrp')}
                                    onChange={(v) => setBulkField('mrp', v)}
                                  />
                                ) : (
                                  mrpVal > 0 ? `₹${mrpVal}` : '—'
                                )}
                              </td>

                              {/* 10. MRP/g or ml */}
                              <td className="p-2.5 text-muted-foreground text-[11px]" data-col="mrpPerUnit">
                                {bulkEditMode ? (
                                  <BulkTextCell
                                    value={getBulkValue('mrp_per_unit', mrpPerUnit !== '—' ? mrpPerUnit : '')}
                                    dirty={isFieldDirty('mrp_per_unit')}
                                    onChange={(v) => setBulkField('mrp_per_unit', v)}
                                  />
                                ) : (
                                  mrpPerUnit !== '—' ? `₹${mrpPerUnit}` : '—'
                                )}
                              </td>

                              {/* 11. Expiry */}
                              <td className="p-2.5 text-muted-foreground" data-col="expiry">
                                {bulkEditMode ? (
                                  <BulkTextCell
                                    value={getBulkValue('expiry', expiry)}
                                    dirty={isFieldDirty('expiry')}
                                    onChange={(v) => setBulkField('expiry', v)}
                                  />
                                ) : (
                                  expiry
                                )}
                              </td>

                              {/* 12. Company — inline-editable (client ask: click cell, dropdown
                                  opens, pick a different customer, no navigation/retyping) */}
                              <td className="p-2.5 font-semibold text-foreground max-w-[160px] truncate" data-col="company">
                                <InlineCustomerCell
                                  orderId={order.id}
                                  updatedAt={order.updatedAt}
                                  currentCustomerId={order.customerEntityId ?? null}
                                  currentCustomerName={custName}
                                  onSaved={() => setReloadToken((t) => t + 1)}
                                  interactive={bulkEditMode}
                                />
                              </td>

                              {/* 13. Order Verified — read-only status, derived from the order's
                                  real pipeline stage. Change it via the stage selector in the
                                  Action column; this cell just reflects that, so the two never
                                  disagree. */}
                              <td className="p-2.5 text-center" data-col="verified">
                                <StatusBadge variant={isVerified ? 'success' : 'neutral'} dot>
                                  {isVerified ? 'Verified' : 'Pending'}
                                </StatusBadge>
                              </td>

                              {/* 14. Sales POC */}
                              <td className="p-2.5 text-muted-foreground" data-col="salesPoc">
                                {salesPoc || '—'}
                              </td>

                              {/* 15. R&D No. */}
                              <td className="p-2.5 font-mono text-[11px] text-purple-600 dark:text-purple-400 font-medium" data-col="rdNo">
                                {bulkEditMode ? (
                                  <BulkTextCell
                                    value={getBulkValue('rd_no', rdNo !== '—' ? rdNo : '')}
                                    dirty={isFieldDirty('rd_no')}
                                    onChange={(v) => setBulkField('rd_no', v)}
                                  />
                                ) : (
                                  rdNo
                                )}
                              </td>

                              {/* 16. Artwork Finalized */}
                              <td className="p-2.5" data-col="artwork">
                                {bulkEditMode ? (
                                  <BulkSelectCell
                                    value={getBulkValue('artwork_finalized', artworkFinal === 'Yes' || artworkFinal === 'Finalized' ? 'Yes' : 'No')}
                                    dirty={isFieldDirty('artwork_finalized')}
                                    onChange={(v) => setBulkField('artwork_finalized', v)}
                                    options={ARTWORK_FINALIZED_OPTIONS}
                                  />
                                ) : (
                                  <span className={cn(
                                    "rounded px-1.5 py-0.5 text-[10px] font-medium",
                                    artworkFinal === 'Yes' || artworkFinal === 'Finalized'
                                      ? "bg-emerald-500/10 text-emerald-600"
                                      : "bg-amber-500/10 text-amber-600"
                                  )}>
                                    {artworkFinal}
                                  </span>
                                )}
                              </td>

                              {/* 17. QA Approval */}
                              <td className="p-2.5 text-muted-foreground text-[11px]" data-col="qa">
                                {bulkEditMode ? (
                                  <BulkTextCell
                                    value={getBulkValue('qa_approval_date', qaApproval !== '—' ? qaApproval : '')}
                                    dirty={isFieldDirty('qa_approval_date')}
                                    onChange={(v) => setBulkField('qa_approval_date', v)}
                                  />
                                ) : (
                                  qaApproval
                                )}
                              </td>

                              {/* 18. Sent to Printing */}
                              <td className="p-2.5" data-col="printing">
                                {bulkEditMode ? (
                                  <BulkTextCell
                                    value={getBulkValue('sent_to_printing', sentToPrinting !== 'Pending' ? sentToPrinting : '')}
                                    dirty={isFieldDirty('sent_to_printing')}
                                    onChange={(v) => setBulkField('sent_to_printing', v)}
                                  />
                                ) : (
                                  <span className={cn(
                                    "rounded px-1.5 py-0.5 text-[10px] font-medium",
                                    sentToPrinting === 'Done' || sentToPrinting === 'Yes'
                                      ? "bg-emerald-500/10 text-emerald-600"
                                      : "bg-muted text-muted-foreground"
                                  )}>
                                    {sentToPrinting}
                                  </span>
                                )}
                              </td>

                              {/* 19. Carton Stock */}
                              <td className="p-2.5 text-muted-foreground" data-col="cartonStock">
                                {bulkEditMode ? (
                                  <BulkTextCell
                                    value={getBulkValue('carton_stock', cartonStock)}
                                    dirty={isFieldDirty('carton_stock')}
                                    onChange={(v) => setBulkField('carton_stock', v)}
                                  />
                                ) : (
                                  cartonStock
                                )}
                              </td>

                              {/* 20. Printing Details */}
                              <td className="p-2.5 text-muted-foreground max-w-[140px]" data-col="printDetails">
                                {bulkEditMode ? (
                                  <BulkTextCell
                                    value={getBulkValue('printing_details', printDetails !== '—' ? printDetails : '')}
                                    dirty={isFieldDirty('printing_details')}
                                    onChange={(v) => setBulkField('printing_details', v)}
                                  />
                                ) : (
                                  <span className="truncate block" title={printDetails}>{printDetails}</span>
                                )}
                              </td>

                              {/* 21. Primary Packaging */}
                              <td className="p-2.5 text-foreground font-medium" data-col="primaryPkg">
                                {bulkEditMode ? (
                                  <BulkSelectCell
                                    value={getBulkValue('primary_packaging', primaryPkg)}
                                    dirty={isFieldDirty('primary_packaging')}
                                    onChange={(v) => setBulkField('primary_packaging', v)}
                                    options={PRIMARY_PACKAGING_OPTIONS}
                                  />
                                ) : (
                                  primaryPkg
                                )}
                              </td>

                              {/* 22. Tube/Label Stock */}
                              <td className="p-2.5 text-muted-foreground" data-col="tubeStock">
                                {bulkEditMode ? (
                                  <BulkTextCell
                                    value={getBulkValue('tube_label_stock', tubeLabelStock)}
                                    dirty={isFieldDirty('tube_label_stock')}
                                    onChange={(v) => setBulkField('tube_label_stock', v)}
                                  />
                                ) : (
                                  tubeLabelStock
                                )}
                              </td>

                              {/* 23. Action Taken / Status */}
                              <td className="p-2.5" data-col="actionStatus">
                                {bulkEditMode ? (
                                  <BulkSelectCell
                                    value={getBulkValue('action_taken_status', actionStatus)}
                                    dirty={isFieldDirty('action_taken_status')}
                                    onChange={(v) => setBulkField('action_taken_status', v)}
                                    options={ACTION_TAKEN_STATUS_OPTIONS}
                                  />
                                ) : (
                                  <span className="rounded bg-primary/10 text-primary font-bold px-1.5 py-0.5 text-[10px]">
                                    {actionStatus}
                                  </span>
                                )}
                              </td>

                              {/* 24. Billing Rate */}
                              <td className="p-2.5 font-bold text-foreground" data-col="billingRate">
                                {formatINR(billingRate)}
                              </td>

                              {/* 25. Billing Remarks */}
                              <td className="p-2.5 text-muted-foreground max-w-[140px]" data-col="billingRemarks">
                                {bulkEditMode ? (
                                  <Textarea
                                    value={getBulkValue('billing_remarks', billingRemarks !== '—' ? billingRemarks : '')}
                                    onChange={(e) => setBulkField('billing_remarks', e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    rows={1}
                                    className={cn(
                                      'min-w-[140px] text-xs min-h-7 py-1',
                                      isFieldDirty('billing_remarks') && 'border-l-2 border-l-amber-500 bg-amber-500/5',
                                    )}
                                  />
                                ) : (
                                  <span className="truncate block" title={billingRemarks}>{billingRemarks}</span>
                                )}
                              </td>

                              {/* 26. Designer Status */}
                              <td className="p-2.5" data-col="designerStatus">
                                {bulkEditMode ? (
                                  <BulkSelectCell
                                    value={getBulkValue('designer_status', designerStatus)}
                                    dirty={isFieldDirty('designer_status')}
                                    onChange={(v) => setBulkField('designer_status', v)}
                                    options={DESIGNER_STATUS_OPTIONS}
                                  />
                                ) : (
                                  <span className="rounded bg-secondary text-secondary-foreground font-medium px-1.5 py-0.5 text-[10px]">
                                    {designerStatus}
                                  </span>
                                )}
                              </td>

                              {/* 27. Sticky Stage & Action Column */}
                              <td className="p-2 pr-3 sticky right-0 bg-background/95 backdrop-blur z-10 border-l shadow-[-2px_0_4px_rgba(0,0,0,0.06)]">
                                {(() => {
                                  const currentStageKey = getOrderColumnKey(order)
                                  const currentStageCol = KANBAN_COLUMNS.find((c) => c.key === currentStageKey) || KANBAN_COLUMNS[0]
                                  const currPipelineIdx = (PIPELINE_ORDER as readonly string[]).indexOf(currentStageKey)
                                  const nextStageKey = currPipelineIdx >= 0 && currPipelineIdx < PIPELINE_ORDER.length - 1 ? PIPELINE_ORDER[currPipelineIdx + 1] : null
                                  const nextStageCol = nextStageKey ? KANBAN_COLUMNS.find((c) => c.key === nextStageKey) : null
                                  const CurrentIcon = currentStageCol.icon

                                  return (
                                    <div className="flex items-center justify-end gap-1.5">
                                      {/* Stage pill — single click trigger, not a dropdown +
                                          separate button (client ask: "the stage will also be
                                          clickable... click on the stage, if it's pending, it
                                          opens the dialog"). Clicking advances to the next
                                          stage and opens the same StageActionDialog gate used
                                          everywhere else (advance/verify/sample-sent/generic/
                                          revert) — Table and Kanban both call handleUpdateStage,
                                          so the two views are always driven by the same state. */}
                                      <button
                                        type="button"
                                        disabled={!nextStageCol}
                                        onClick={() => nextStageCol && handleUpdateStage(order, nextStageCol.key)}
                                        className={cn(
                                          "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold shadow-sm transition-all",
                                          currentStageCol.headerBadge,
                                          nextStageCol ? "hover:opacity-90 active:scale-95 cursor-pointer" : "cursor-default opacity-80",
                                        )}
                                        title={nextStageCol ? `${currentStageCol.label} — click to advance to ${nextStageCol.label}` : currentStageCol.label}
                                      >
                                        <CurrentIcon className="h-3 w-3 shrink-0" />
                                        <span className="truncate max-w-[110px]">{currentStageCol.shortLabel}</span>
                                        {nextStageCol ? <ArrowRight className="h-3 w-3 shrink-0" /> : null}
                                      </button>

                                      {/* Revert to an earlier stage — separate from the primary
                                          click (which always advances), since going backward
                                          needs a reason and shouldn't be one accidental click
                                          away. Only shown once there's somewhere to revert to. */}
                                      {currPipelineIdx > 0 && (
                                        <Select value="" onValueChange={(val) => handleUpdateStage(order, val)}>
                                          <SelectTrigger
                                            className="h-7 w-7 justify-center border-dashed px-0 text-muted-foreground shadow-sm [&>svg:last-child]:hidden"
                                            title="Revert to an earlier stage"
                                          >
                                            <Clock className="h-3 w-3" />
                                          </SelectTrigger>
                                          <SelectContent align="end" className="z-50 min-w-[200px]">
                                            {KANBAN_COLUMNS.filter((col) => {
                                              const colIdx = (PIPELINE_ORDER as readonly string[]).indexOf(col.key)
                                              return colIdx >= 0 && colIdx < currPipelineIdx
                                            }).map((col) => {
                                              const Icon = col.icon
                                              return (
                                                <SelectItem key={col.key} value={col.key} className="text-xs">
                                                  <div className="flex items-center gap-2">
                                                    <Icon className="h-3.5 w-3.5" />
                                                    <span>{col.label}</span>
                                                  </div>
                                                </SelectItem>
                                              )
                                            })}
                                          </SelectContent>
                                        </Select>
                                      )}

                                      {/* Quick Edit & View */}
                                      <div className="flex items-center gap-0.5 border-l pl-1 shrink-0">
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                          onClick={() => openEditModal(order)}
                                          title="Quick edit operational details"
                                        >
                                          <Edit3 className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" asChild>
                                          <Link href={`/backend/sales/order-book/${order.id}`} title="View full order details">
                                            <Eye className="h-3.5 w-3.5" />
                                          </Link>
                                        </Button>
                                      </div>
                                    </div>
                                  )
                                })()}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* ========================================================= */}
          {/* KANBAN BOARD VIEW (FULL 8-STAGE CONTRACT MFG PIPELINE) */}
          {/* ========================================================= */}
          {viewMode === 'kanban' ? (
            <div className="flex gap-4 overflow-x-auto pb-4 items-start min-h-[600px]">
              {KANBAN_COLUMNS.map((col) => {
                const colOrders = filteredOrders.filter((o) => getOrderColumnKey(o) === col.key)
                const ColIcon = col.icon

                return (
                  <div
                    key={col.key}
                    className="min-w-[285px] w-[285px] shrink-0 rounded-xl border bg-muted/30 p-3 space-y-3 flex flex-col min-h-[550px]"
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between border-b pb-2">
                      <div className="flex items-center gap-1.5">
                        <ColIcon className="h-3.5 w-3.5 text-primary" />
                        <span className="font-bold text-xs uppercase tracking-wider text-foreground">
                          {col.label}
                        </span>
                      </div>
                      <span className="rounded-full bg-background border px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                        {colOrders.length}
                      </span>
                    </div>

                    {/* Column Cards Container */}
                    <div className="space-y-3 flex-1 overflow-y-auto max-h-[750px] pr-0.5">
                      {colOrders.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground bg-background/50">
                          No orders in this stage
                        </div>
                      ) : (
                        colOrders.map((order) => {
                          const custName = order.customerName || order.customerSnapshot?.customer?.displayName || 'Customer'
                          const orderType = (order.cf_order_type || order.customFields?.order_type || order.metadata?.order_type || 'New') as string
                          const priority = (order.cf_priority || order.customFields?.priority || order.metadata?.priority || 'Normal') as string
                          const salesPoc = (order.cf_sales_poc || order.customFields?.sales_poc || order.metadata?.sales_poc || '') as string
                          const packaging = (order.cf_packaging_type || order.customFields?.packaging_type || order.metadata?.packaging_type || '') as string
                          const pmSource = (order.cf_pm_source || order.customFields?.pm_source || order.metadata?.pm_source || 'dermat') as string
                          const sampleReq = Boolean(order.cf_sample_required ?? order.customFields?.sample_required ?? order.metadata?.sample_required)
                          const totalVal = Number(order.grandTotalGrossAmount) || 0
                          const advVal = Number(order.cf_advance_received_amount || order.customFields?.advance_received_amount) || 0
                          const balVal = Math.max(0, totalVal - advVal)
                          const days = getDaysRemaining(order.expectedDeliveryAt)

                          return (
                            <div
                              key={order.id}
                              className="rounded-xl border bg-card p-3.5 shadow-sm space-y-3 hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary"
                              onClick={() => router.push(`/backend/sales/order-book/${order.id}`)}
                            >
                              {/* Order Card Header */}
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-primary hover:underline">
                                  {order.orderNumber}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                                    {orderType}
                                  </span>
                                  {priority !== 'Normal' ? (
                                    <span
                                      className={cn(
                                        "rounded px-1.5 py-0.5 text-[10px] font-bold",
                                        priority === 'Urgent'
                                          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                                          : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                      )}
                                    >
                                      {priority}
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              {/* Customer & Formulation Summary */}
                              <div className="space-y-1">
                                <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                                  <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <span className="truncate">{custName}</span>
                                </div>
                                <div className="text-[11px] text-muted-foreground line-clamp-2 pl-5">
                                  {order.productSummary || 'Finished Good Formulation'}
                                </div>
                              </div>

                              {/* Manufacturing & Sampling Badges */}
                              <div className="flex flex-wrap gap-1.5 text-[10px]">
                                {sampleReq ? (
                                  <span className="rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 font-medium flex items-center gap-1">
                                    <FlaskConical className="h-3 w-3" /> R&D Trial
                                  </span>
                                ) : null}
                                {packaging ? (
                                  <span className="rounded bg-secondary/80 px-1.5 py-0.5 text-secondary-foreground font-medium">
                                    📦 {packaging} ({pmSource === 'client' ? 'Client PM' : 'Dermat PM'})
                                  </span>
                                ) : null}
                                {salesPoc ? (
                                  <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                                    👤 {salesPoc}
                                  </span>
                                ) : null}
                              </div>

                              {/* Financials Breakdown */}
                              <div className="rounded-lg border bg-muted/20 p-2 text-[11px] space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">Order Value:</span>
                                  <strong className="text-foreground">{formatINR(totalVal)}</strong>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">Balance:</span>
                                  <strong className={balVal > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600"}>
                                    {formatINR(balVal)}
                                  </strong>
                                </div>
                              </div>

                              {/* Delivery & Stage Selector Footer */}
                              <div className="flex items-center justify-between pt-1 border-t text-[10px]">
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  <span className={cn(days.isUrgent && "text-rose-600 font-bold")}>
                                    {days.text}
                                  </span>
                                </div>

                                <div onClick={(e) => e.stopPropagation()}>
                                  {(() => {
                                    // Same one-stage-at-a-time rule as the table's stage selector:
                                    // current, the single next stage, and earlier stages (revert,
                                    // requires a reason) are selectable — skipping ahead is blocked.
                                    const cardStageKey = getOrderColumnKey(order)
                                    const cardStageIdx = (PIPELINE_ORDER as readonly string[]).indexOf(cardStageKey)
                                    const cardNextKey = cardStageIdx >= 0 && cardStageIdx < PIPELINE_ORDER.length - 1
                                      ? PIPELINE_ORDER[cardStageIdx + 1]
                                      : null
                                    return (
                                      <Select
                                        value={cardStageKey}
                                        onValueChange={(newStage) => handleUpdateStage(order, newStage)}
                                      >
                                        <SelectTrigger className="h-6 w-28 text-[10px] px-1.5 py-0">
                                          <SelectValue placeholder="Move Stage" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {KANBAN_COLUMNS.map((stage) => {
                                            const stageIdx = (PIPELINE_ORDER as readonly string[]).indexOf(stage.key)
                                            const isCurrent = stage.key === cardStageKey
                                            const isNext = stage.key === cardNextKey
                                            const isBack = stageIdx >= 0 && stageIdx < cardStageIdx
                                            return (
                                              <SelectItem
                                                key={stage.key}
                                                value={stage.key}
                                                disabled={!isCurrent && !isNext && !isBack}
                                                className="text-xs"
                                              >
                                                {stage.shortLabel}
                                              </SelectItem>
                                            )
                                          })}
                                        </SelectContent>
                                      </Select>
                                    )
                                  })()}
                                </div>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}

          {/* ========================================================= */}
          {/* KANBAN STAGE-GATE DIALOG (spec §5.2) */}
          {/* ========================================================= */}
          <StageActionDialog
            open={Boolean(pendingStageMove)}
            mode={activeGate?.mode ?? 'generic'}
            orderNumber={pendingStageMove?.order.orderNumber}
            targetStageLabel={activeGate?.col?.label}
            advanceAlreadyReceived={Boolean(
              pendingStageMove
                ? Number(pendingStageMove.order.cf_advance_received_amount || pendingStageMove.order.customFields?.advance_received_amount || 0) > 0
                : false,
            )}
            defaultAdvanceAmount={
              pendingStageMove
                ? (Number(pendingStageMove.order.grandTotalGrossAmount || 0) *
                    (Number(pendingStageMove.order.customFields?.advance_percent ?? 40) / 100)) ||
                  Number(pendingStageMove.order.cf_advance_received_amount || 0)
                : null
            }
            totalAmount={pendingStageMove ? Number(pendingStageMove.order.grandTotalGrossAmount || 0) : null}
            advancePercent={pendingStageMove ? Number(pendingStageMove.order.customFields?.advance_percent ?? 40) : 40}
            advanceRequired={pendingStageMove ? Boolean(pendingStageMove.order.customFields?.advance_required ?? true) : true}
            loading={stageGateSubmitting}
            onCancel={() => setPendingStageMove(null)}
            onConfirm={handleStageGateConfirm}
          />

          {/* ========================================================= */}
          {/* QUICK EDIT MODAL FOR MASTER SHEET FIELDS */}
          {/* ========================================================= */}
          <Dialog open={Boolean(editOrder)} onOpenChange={(open) => !open && setEditOrder(null)}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Edit3 className="h-5 w-5 text-primary" />
                  Edit Operational & Master Sheet Tracking Fields ({editOrder?.orderNumber})
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                {/* Section 1: Identification & Batch */}
                <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                  <div className="font-semibold text-sm border-b pb-1">1. Product, Pack & Batch Identification</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Pack Code</Label>
                      <Input
                        value={editFormData.pack_code || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, pack_code: e.target.value })}
                        placeholder="RARE"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Brand / Product Name</Label>
                      <Input
                        value={editFormData.brand_name || editFormData.product_name || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, brand_name: e.target.value, product_name: e.target.value })}
                        placeholder="e.g. Mishkae Sunscreen 50 gm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Batch No</Label>
                      <Input
                        value={editFormData.batch_no || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, batch_no: e.target.value })}
                        placeholder="43401"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Mfg Month</Label>
                      <Input
                        value={editFormData.mfg_month || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, mfg_month: e.target.value })}
                        placeholder="08/2026"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: QA, R&D & Artwork */}
                <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                  <div className="font-semibold text-sm border-b pb-1">2. QA, R&D Trial & Printing Approvals</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">R&D No.</Label>
                      <Input
                        value={editFormData.rd_no || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, rd_no: e.target.value })}
                        placeholder="RD-2026-089"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">QA Approval Date</Label>
                      <Input
                        value={editFormData.qa_approval_date || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, qa_approval_date: e.target.value })}
                        placeholder="18/08/2026"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Artwork Finalized</Label>
                      <Select
                        value={editFormData.artwork_finalized ? 'Yes' : 'No'}
                        onValueChange={(val) => setEditFormData({ ...editFormData, artwork_finalized: val === 'Yes' })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Finalized / Approved</SelectItem>
                          <SelectItem value="No">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Sent to Printing</Label>
                      <Input
                        value={editFormData.sent_to_printing || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, sent_to_printing: e.target.value })}
                        placeholder="In Printing / Done"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Material Stocks & Packaging */}
                <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                  <div className="font-semibold text-sm border-b pb-1">3. Packaging Material Stock & Status</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Carton Stock</Label>
                      <Input
                        value={editFormData.carton_stock || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, carton_stock: e.target.value })}
                        placeholder="5000 in Stock"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tube/Label Stock</Label>
                      <Input
                        value={editFormData.tube_label_stock || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, tube_label_stock: e.target.value })}
                        placeholder="3000 pcs received"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Primary Packaging</Label>
                      <Input
                        value={editFormData.primary_packaging || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, primary_packaging: e.target.value })}
                        placeholder="30ml Amber Glass Dropper"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Action Taken / Status</Label>
                      <Input
                        value={editFormData.action_taken_status || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, action_taken_status: e.target.value })}
                        placeholder="PARTY SIDE / IN PRODUCTION"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 4: Operational Remarks */}
                <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                  <div className="font-semibold text-sm border-b pb-1">4. Departmental & Team Remarks</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Designer Status</Label>
                      <Input
                        value={editFormData.designer_status || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, designer_status: e.target.value })}
                        placeholder="PM OK / ORDER / Hold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditOrder(null)}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleSaveEdit} disabled={savingEdit}>
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </PageBody>
    </Page>
  )
}
