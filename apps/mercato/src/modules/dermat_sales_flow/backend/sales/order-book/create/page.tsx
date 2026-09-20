'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Card, CardContent, CardHeader, CardTitle } from '@open-mercato/ui/primitives/card'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
import { SegmentedControl, SegmentedControlItem } from '@open-mercato/ui/primitives/segmented-control'
import { StepIndicator, type StepIndicatorStep } from '@open-mercato/ui/primitives/step-indicator'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { Checkbox } from '@open-mercato/ui/primitives/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@open-mercato/ui/primitives/select'
import {
  Trash2,
  Plus,
  Building2,
  Package,
  PackageCheck,
  Boxes,
  CheckCircle2,
  ShoppingBag,
  Sparkles,
  Calendar,
  Layers,
  FlaskConical,
  ArrowRight,
  ArrowLeft,
  Search,
  Copy,
  HelpCircle,
  FileText,
  CreditCard,
} from 'lucide-react'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'

const UOM_OPTIONS = [
  { value: 'ml', label: 'ml (Milliliter)' },
  { value: 'gm', label: 'gm (Gram)' },
  { value: 'kg', label: 'kg (Kilogram)' },
  { value: 'l', label: 'L (Liter)' },
  { value: 'pcs', label: 'pcs (Pieces)' },
] as const

const CATEGORY_OPTIONS = [
  { value: 'Serum', label: 'Face Serum' },
  { value: 'Cream', label: 'Face Cream / Moisturizer' },
  { value: 'Lotion', label: 'Body Lotion / Milk' },
  { value: 'Gel', label: 'Treatment Gel / Salicylic' },
  { value: 'Face Wash', label: 'Cleanser / Face Wash' },
  { value: 'Sunscreen', label: 'Sunscreen Gel / Lotion SPF' },
  { value: 'Toner', label: 'Facial Toner / Mist' },
  { value: 'Shampoo', label: 'Hair Care / Shampoo / Conditioner' },
  { value: 'Mask', label: 'Face Mask / Peeling Solution' },
  { value: 'Oil', label: 'Face / Hair Oil' },
] as const

const GST_RATES = [
  { value: '0', label: '0% (Exempt)' },
  { value: '5', label: '5% GST' },
  { value: '12', label: '12% GST' },
  { value: '18', label: '18% GST (Cosmetics)' },
  { value: '28', label: '28% GST' },
] as const

const PACKAGING_TYPES = [
  { value: 'Bottle', label: 'Bottle (Dropper / Pump / Flip-top)' },
  { value: 'Jar', label: 'Jar (Glass / Acrylic / PP)' },
  { value: 'Tube', label: 'Tube (Lami / Aluminum / Plastic)' },
  { value: 'Dropper', label: 'Glass Dropper Bottle' },
  { value: 'Pump', label: 'Airless Pump Bottle' },
  { value: 'Sachet', label: 'Sachet / Single Use' },
  { value: 'Custom', label: 'Custom Packaging' },
] as const

type CustomerRow = {
  id: string
  displayName: string
  phone: string | null
  gstin: string | null
  salesPoc: string | null
  email?: string | null
  address?: string | null
}

type CatalogProductItem = {
  id: string
  title: string
  sku?: string | null
  category?: string | null
  baseUom?: string | null
  customerId?: string | null
  customerName?: string | null
  clientBrand?: string | null
  minFloorQty?: number | null
  itemType?: string | null
}

type WizardStepId = 'customer' | 'lines' | 'details' | 'review'

const WIZARD_STEPS: { id: WizardStepId; label: string }[] = [
  { id: 'customer', label: '1. Customer & Header' },
  { id: 'lines', label: '2. Products & Items' },
  { id: 'details', label: '3. Packaging & R&D' },
  { id: 'review', label: '4. Review & Book' },
]

type OrderLineDraft = {
  key: string
  productId: string
  productLabel: string
  productCode?: string
  category: string
  variantSku: string
  brandName: string
  packSize: string
  uom: string
  quantity: string
  rate: string
  gstPercent: string
  mrp: string
}

function makeEmptyLine(): OrderLineDraft {
  return {
    key: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `line-${Math.random().toString(36).slice(2)}`,
    productId: '',
    productLabel: '',
    productCode: '',
    category: 'Serum',
    variantSku: 'Standard',
    brandName: '',
    packSize: '',
    uom: 'ml',
    quantity: '',
    rate: '',
    gstPercent: '18',
    mrp: '',
  }
}

function calcLineSubtotal(line: OrderLineDraft): number {
  const qty = Number(line.quantity) || 0
  const rate = Number(line.rate) || 0
  return qty * rate
}

function calcLineTax(line: OrderLineDraft): number {
  const sub = calcLineSubtotal(line)
  const gst = Number(line.gstPercent) || 0
  return (sub * gst) / 100
}

function calcLineTotal(line: OrderLineDraft): number {
  return calcLineSubtotal(line) + calcLineTax(line)
}

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount)
}

export default function CreateOrderPage() {
  const t = useT()
  const router = useRouter()
  const { organizationId, tenantId } = useOrganizationScopeDetail()

  const [activeStep, setActiveStep] = React.useState<WizardStepId>('customer')

  // Step 1: Customer state
  const [customerMode, setCustomerMode] = React.useState<'existing' | 'new'>('existing')
  const [search, setSearch] = React.useState('')
  const [customerRows, setCustomerRows] = React.useState<CustomerRow[]>([])
  const [loadingCustomers, setLoadingCustomers] = React.useState(false)
  const [selectedCustomer, setSelectedCustomer] = React.useState<CustomerRow | null>(null)

  // Step 1: Inline New Customer state
  const [newCustName, setNewCustName] = React.useState('')
  const [newCustContact, setNewCustContact] = React.useState('')
  const [newCustPhone, setNewCustPhone] = React.useState('')
  const [newCustEmail, setNewCustEmail] = React.useState('')
  const [newCustGstin, setNewCustGstin] = React.useState('')
  const [newCustSalesPoc, setNewCustSalesPoc] = React.useState('')
  const [newCustAddress, setNewCustAddress] = React.useState('')
  const [creatingCustomer, setCreatingCustomer] = React.useState(false)

  // Step 1: Commercial Header state
  const [orderDate, setOrderDate] = React.useState(() => new Date().toISOString().slice(0, 10))
  const [deliveryDate, setDeliveryDate] = React.useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().slice(0, 10)
  })
  const [customerPoRef, setCustomerPoRef] = React.useState('')
  const [orderType, setOrderType] = React.useState<'New' | 'Repeat' | 'Revision'>('New')
  const [priority, setPriority] = React.useState<'Normal' | 'High' | 'Urgent'>('Normal')
  const [salesPoc, setSalesPoc] = React.useState('')

  // Step 2: Order Lines state
  const [lines, setLines] = React.useState<OrderLineDraft[]>([makeEmptyLine()])

  // Catalog products cache for line selection
  const [catalogProducts, setCatalogProducts] = React.useState<CatalogProductItem[]>([])
  const [loadingCatalog, setLoadingCatalog] = React.useState(false)

  // Inline Product / Variation panel state — a line's panel is expanded directly
  // below its row when targetLineKey matches that line's key (no modal).
  const [targetLineKey, setTargetLineKey] = React.useState<string | null>(null)
  const [prodModalMode, setProdModalMode] = React.useState<'existing' | 'new'>('existing')
  const [selectedExistingProdId, setSelectedExistingProdId] = React.useState<string>('')
  // Multi-select: lets the user attach several variations (e.g. 30ml + 50ml) of the
  // same product to the order in one go, one order line per selected variation.
  const [selectedVariantIds, setSelectedVariantIds] = React.useState<string[]>([])
  // True while the inline "add a new variation" table row is open for editing.
  const [addingNewVariantRow, setAddingNewVariantRow] = React.useState(false)
  const [savingNewVariantRow, setSavingNewVariantRow] = React.useState(false)
  const [existingVariants, setExistingVariants] = React.useState<
    Array<{ id: string; name: string; sku?: string | null; packSize?: string; uom?: string; mrp?: string; rate?: string | null; gstPercent?: string; gstTaxCategory?: string; shelfLife?: string; isDefault?: boolean }>
  >([])
  const [loadingVariants, setLoadingVariants] = React.useState(false)

  // Make-to-Order Customer Attachment in modal
  const [newProdCustomerId, setNewProdCustomerId] = React.useState<string>('')
  const [newProdCustomerName, setNewProdCustomerName] = React.useState<string>('')
  const [newProdBrandName, setNewProdBrandName] = React.useState('')

  // Section 1: Basic Product Information
  const [newProdTitle, setNewProdTitle] = React.useState('')
  const [newProdCode, setNewProdCode] = React.useState('')
  const [newProdCategory, setNewProdCategory] = React.useState('Serum')
  const [newProdGstTaxCategory, setNewProdGstTaxCategory] = React.useState('18% GST Cosmetics')
  const [newProdMinFloorQty, setNewProdMinFloorQty] = React.useState('500')
  const [newProdBaseUom, setNewProdBaseUom] = React.useState('ml')
  const [newProdDescription, setNewProdDescription] = React.useState('')

  // Section 2: Variant Details
  const [newProdVariantName, setNewProdVariantName] = React.useState('Standard')
  const [newProdPackSize, setNewProdPackSize] = React.useState('50')
  const [newProdUom, setNewProdUom] = React.useState('ml')
  const [newProdMrp, setNewProdMrp] = React.useState('599')
  const [newProdShelfLife, setNewProdShelfLife] = React.useState('24 Months')

  // Section 3: Commercial Order Terms
  const [newProdQuantity, setNewProdQuantity] = React.useState('500')
  const [newProdRate, setNewProdRate] = React.useState('180')
  const [newProdGstPercent, setNewProdGstPercent] = React.useState('18')

  const [creatingProduct, setCreatingProduct] = React.useState(false)

  // Step 3: Packaging & R&D state
  const [packagingType, setPackagingType] = React.useState('Bottle')
  const [pmSource, setPmSource] = React.useState<'dermat' | 'client'>('dermat')
  const [artworkRequirement, setArtworkRequirement] = React.useState<'client' | 'in_house' | 'approved'>('client')
  const [sampleRequired, setSampleRequired] = React.useState(false)
  const [sampleQty, setSampleQty] = React.useState('2')
  const [sampleDueDate, setSampleDueDate] = React.useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  })
  const [orderNotes, setOrderNotes] = React.useState('')

  // Step 3: Payment (spec §4.1 step 3 / §4.3 Advance Required, Advance %, Advance Amount,
  // Advance Received Date — declared in ce.ts but never surfaced in this wizard until now).
  // The Kanban's advance-payment gate (New -> Verified/Official) reads `advance_required` /
  // `advance_percent` set here to decide whether it must prompt for advance confirmation.
  const [advanceRequired, setAdvanceRequired] = React.useState(true)
  const [advancePercent, setAdvancePercent] = React.useState('40')
  const [advanceAmount, setAdvanceAmount] = React.useState('')
  const [advanceReceivedNow, setAdvanceReceivedNow] = React.useState(false)
  const [advanceReceivedDate, setAdvanceReceivedDate] = React.useState('')
  const [paymentRef, setPaymentRef] = React.useState('')

  // Submission state
  const [submitting, setSubmitting] = React.useState(false)

  // Load existing customers
  const loadCustomers = React.useCallback(async (query: string) => {
    setLoadingCustomers(true)
    try {
      const params = new URLSearchParams()
      params.set('pageSize', '50')
      if (query) params.set('search', query)
      const call = await apiCall<{ items: Array<{ id: string; display_name?: string; primary_phone?: string | null; primary_email?: string | null; cf_gst_number?: string | null; cf_sales_poc?: string | null; cf_address?: string | null }> }>(
        `/api/customers/companies?${params.toString()}`
      )
      const items = call.ok ? call.result?.items ?? [] : []
      setCustomerRows(
        items.map((item) => ({
          id: item.id,
          displayName: item.display_name ?? 'Unnamed Company',
          phone: item.primary_phone ?? null,
          email: item.primary_email ?? null,
          gstin: item.cf_gst_number ?? null,
          salesPoc: item.cf_sales_poc ?? null,
          address: item.cf_address ?? null,
        }))
      )
    } finally {
      setLoadingCustomers(false)
    }
  }, [])

  React.useEffect(() => {
    if (customerMode !== 'existing') return
    const handle = setTimeout(() => loadCustomers(search), 250)
    return () => clearTimeout(handle)
  }, [customerMode, search, loadCustomers])

  // Load catalog products for line picker
  React.useEffect(() => {
    async function loadCatalog() {
      setLoadingCatalog(true)
      try {
        const call = await apiCall<{ items: Array<any> }>(
          '/api/catalog/products?pageSize=100'
        )
        if (call.ok && Array.isArray(call.result?.items)) {
          setCatalogProducts(
            call.result.items.map((p: any) => {
              const meta = (p.metadata || {}) as Record<string, any>
              const cf = (p.customFields || {}) as Record<string, any>
              return {
                id: p.id,
                title: p.title || p.name || 'Unnamed Product',
                sku: p.sku || cf.product_code || meta.product_code || null,
                category: cf.category || meta.category || 'Serum',
                baseUom: cf.base_uom || meta.base_uom || p.default_unit || 'ml',
                customerId: cf.customer || cf.customer_id || cf.company || meta.customer_id || null,
                customerName: cf.customer_name || meta.customer_name || meta.customer || null,
                clientBrand: cf.client_brand || meta.client_brand || meta.customer || meta.brand_name || null,
                minFloorQty: cf.min_floor_qty || meta.min_floor_qty || null,
                itemType: meta.item_type || cf.item_type || null,
              }
            })
          )
        }
      } catch (e) {
        console.error('Failed to load catalog products', e)
      } finally {
        setLoadingCatalog(false)
      }
    }
    loadCatalog()
  }, [])

  // Customer Product Filtering & Matching
  const isProductForCustomer = React.useCallback(
    (p: CatalogProductItem, cust: CustomerRow | null) => {
      if (!cust) return true
      if (p.customerId && p.customerId === cust.id) return true
      const normCust = cust.displayName.trim().toLowerCase()
      if (p.customerName && (p.customerName.toLowerCase().includes(normCust) || normCust.includes(p.customerName.toLowerCase()))) return true
      if (p.clientBrand && (p.clientBrand.toLowerCase().includes(normCust) || normCust.includes(p.clientBrand.toLowerCase()))) return true
      if (p.title && p.title.toLowerCase().includes(normCust)) return true
      return false
    },
    []
  )

  const customerMatchingProducts = React.useMemo(() => {
    if (!selectedCustomer) return catalogProducts
    return catalogProducts.filter((p) => isProductForCustomer(p, selectedCustomer))
  }, [catalogProducts, selectedCustomer, isProductForCustomer])

  const otherCatalogProducts = React.useMemo(() => {
    if (!selectedCustomer) return []
    return catalogProducts.filter((p) => !isProductForCustomer(p, selectedCustomer))
  }, [catalogProducts, selectedCustomer, isProductForCustomer])

  // Automatically keep brand name synced and auto-select product for new empty order line when customer is selected
  React.useEffect(() => {
    if (!selectedCustomer) return
    setLines((prev) => {
      const match = catalogProducts.filter((p) => isProductForCustomer(p, selectedCustomer))
      return prev.map((l, idx) => {
        const brand = selectedCustomer.displayName
        if (idx === 0 && !l.productId && match.length > 0) {
          const p = match[0]
          return {
            ...l,
            productId: p.id,
            productLabel: p.title,
            productCode: p.sku || '',
            category: p.category || 'Serum',
            uom: p.baseUom || 'ml',
            brandName: p.clientBrand || brand,
            variantSku: 'Standard',
          }
        }
        return {
          ...l,
          brandName: l.brandName || brand,
        }
      })
    })
  }, [selectedCustomer, catalogProducts, isProductForCustomer])

  // Create Inline Customer
  const handleCreateCustomer = React.useCallback(async () => {
    if (!newCustName.trim()) {
      flash('Company / Customer name is required', 'error')
      return
    }
    setCreatingCustomer(true)
    try {
      const customFields: Record<string, unknown> = {}
      if (newCustGstin.trim()) customFields.gst_number = newCustGstin.trim()
      if (newCustSalesPoc.trim()) customFields.sales_poc = newCustSalesPoc.trim()
      if (newCustAddress.trim()) customFields.address = newCustAddress.trim()

      const payload = {
        organizationId,
        tenantId,
        displayName: newCustName.trim(),
        primaryPhone: newCustPhone.trim() || undefined,
        primaryEmail: newCustEmail.trim() || undefined,
        contactName: newCustContact.trim() || undefined,
        customFields: Object.keys(customFields).length ? customFields : undefined,
      }

      const res = await createCrud<{ id: string }>('customers/companies', payload)
      const createdId = res.result?.id
      if (createdId) {
        const cust: CustomerRow = {
          id: createdId,
          displayName: newCustName.trim(),
          phone: newCustPhone.trim() || null,
          email: newCustEmail.trim() || null,
          gstin: newCustGstin.trim() || null,
          salesPoc: newCustSalesPoc.trim() || null,
          address: newCustAddress.trim() || null,
        }
        setCustomerRows((prev) => [cust, ...prev.filter((c) => c.id !== createdId)])
        setSelectedCustomer(cust)
        if (newCustSalesPoc.trim() && !salesPoc) setSalesPoc(newCustSalesPoc.trim())
        flash(`Customer "${newCustName.trim()}" created & selected`, 'success')
        setCustomerMode('existing')
      }
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to create customer', 'error')
    } finally {
      setCreatingCustomer(false)
    }
  }, [newCustName, newCustContact, newCustPhone, newCustEmail, newCustGstin, newCustSalesPoc, newCustAddress, organizationId, tenantId, salesPoc])

  // Helper   // Load variants for a selected existing product
  const loadVariantsForProduct = React.useCallback(async (prodId: string) => {
    if (!prodId) {
      setExistingVariants([])
      return
    }
    setLoadingVariants(true)
    try {
      const res = await apiCall<{ items?: Array<any> }>(
        `/api/catalog/variants?productId=${encodeURIComponent(prodId)}&pageSize=50`
      )
      if (res.ok && res.result?.items && res.result.items.length > 0) {
        const mapped = res.result.items.map((v: any) => ({
          id: v.id,
          name: v.name || 'Standard',
          sku: v.sku || null,
          packSize: String(v.metadata?.pack_size || v.customFields?.pack_size || v.weightValue || '50'),
          uom: v.metadata?.uom || v.weightUnit || v.customFields?.uom || 'ml',
          mrp: String(v.metadata?.mrp || v.customFields?.mrp || '599'),
          rate: v.metadata?.rate ? String(v.metadata.rate) : (v.customFields?.rate ? String(v.customFields.rate) : null),
          gstPercent: String(v.metadata?.gst_percent || v.customFields?.gst_percent || '18'),
          gstTaxCategory: v.metadata?.gst_tax_category || v.customFields?.gst_tax_category || '18% GST Cosmetics',
          shelfLife: v.metadata?.shelf_life || v.customFields?.shelf_life || '24 Months',
          isDefault: Boolean(v.isDefault || v.is_default),
        }))
        setExistingVariants(mapped)
        if (mapped[0]) {
          setSelectedVariantIds([mapped[0].id])
          setNewProdVariantName(mapped[0].name)
          setNewProdPackSize(mapped[0].packSize || '50')
          setNewProdUom(mapped[0].uom || 'ml')
          setNewProdMrp(mapped[0].mrp || '599')
          if (mapped[0].rate) setNewProdRate(mapped[0].rate)
          if (mapped[0].gstPercent) setNewProdGstPercent(mapped[0].gstPercent)
          if (mapped[0].shelfLife) setNewProdShelfLife(mapped[0].shelfLife)
        } else {
          setSelectedVariantIds([])
        }
      } else {
        setExistingVariants([{ id: 'Standard', name: 'Standard (50ml)', packSize: '50', uom: 'ml', mrp: '599', gstPercent: '18', shelfLife: '24 Months' }])
        setSelectedVariantIds(['Standard'])
      }
    } catch {
      setExistingVariants([{ id: 'Standard', name: 'Standard (50ml)', packSize: '50', uom: 'ml', mrp: '599', gstPercent: '18', shelfLife: '24 Months' }])
      setSelectedVariantIds(['Standard'])
    } finally {
      setLoadingVariants(false)
    }
  }, [])

  // Expand the inline Product & Variation panel directly under a line's row
  // (supports both existing-catalog and brand-new-product modes). Clicking the
  // same trigger again while that line's panel is already open in the same mode
  // collapses it, so the row link doubles as an open/close toggle.
  const openLineProductPanel = React.useCallback(
    (lineKey: string, mode: 'existing' | 'new' = 'existing', preselectedProdId?: string) => {
      if (targetLineKey === lineKey && prodModalMode === mode) {
        setTargetLineKey(null)
        return
      }
      setTargetLineKey(lineKey)
      const currentLine = lines.find((l) => l.key === lineKey)
      setProdModalMode(mode)
      setSelectedVariantIds([])
      setAddingNewVariantRow(false)

      const effectiveProdId =
        preselectedProdId ||
        currentLine?.productId ||
        customerMatchingProducts[0]?.id ||
        catalogProducts[0]?.id ||
        ''
      setSelectedExistingProdId(effectiveProdId)

      // Customer assignment
      setNewProdCustomerId(selectedCustomer?.id || '')
      setNewProdCustomerName(selectedCustomer?.displayName || '')
      setNewProdBrandName(currentLine?.brandName || selectedCustomer?.displayName || '')

      if (mode === 'existing' && effectiveProdId) {
        const matched = catalogProducts.find((p) => p.id === effectiveProdId)
        setNewProdTitle(matched?.title || '')
        setNewProdCode(matched?.sku || '')
        setNewProdCategory(matched?.category || currentLine?.category || 'Serum')
        setNewProdBaseUom(matched?.baseUom || currentLine?.uom || 'ml')
        loadVariantsForProduct(effectiveProdId)
      } else {
        // Section 1: Basic Product Information
        setNewProdTitle('')
        setNewProdCode('')
        setNewProdCategory(currentLine?.category || 'Serum')
        setNewProdMinFloorQty('500')
        setNewProdBaseUom(currentLine?.uom || 'ml')
        setNewProdDescription('')
      }

      // Section 2: Variant Details
      setNewProdVariantName('Standard')
      setNewProdPackSize(currentLine?.packSize || '50')
      setNewProdUom(currentLine?.uom || 'ml')
      setNewProdMrp(currentLine?.mrp || '599')
      setNewProdShelfLife('24 Months')

      // Section 3: Commercial Order Terms
      setNewProdQuantity(currentLine?.quantity || '500')
      setNewProdRate(currentLine?.rate || '180')
      setNewProdGstPercent(currentLine?.gstPercent || '18')
    },
    [lines, selectedCustomer, catalogProducts, loadVariantsForProduct]
  )

  // Open the inline "add a new variation" table row, starting from blank fields
  // (not a pre-filled clone of whichever variant was last clicked).
  const startAddingNewVariantRow = React.useCallback(() => {
    setNewProdVariantName('')
    setNewProdPackSize('')
    setNewProdUom('ml')
    setNewProdMrp('')
    setNewProdRate('')
    setNewProdGstPercent('18')
    setNewProdShelfLife('')
    setAddingNewVariantRow(true)
  }, [])

  // Save the inline "add a new variation" row immediately: creates the variant via
  // the API right away, adds it to the variation table pre-selected, and closes the
  // row — no separate outer "confirm" step needed for this part.
  const handleSaveNewVariantRow = React.useCallback(async () => {
    if (!selectedExistingProdId) {
      flash('Select a product first', 'error')
      return
    }
    if (!newProdPackSize.trim()) {
      flash('Pack Size is required', 'error')
      return
    }
    setSavingNewVariantRow(true)
    try {
      const mrpNum = Number(newProdMrp)
      const packNum = Number(newProdPackSize)
      const rateNum = Number(newProdRate)
      const variantPayload = {
        organizationId,
        tenantId,
        productId: selectedExistingProdId,
        name: newProdVariantName.trim() || `${newProdPackSize}${newProdUom}`,
        isActive: true,
        weightValue: !Number.isNaN(packNum) ? packNum : undefined,
        weightUnit: newProdUom || undefined,
        metadata: {
          pack_size: newProdPackSize.trim(),
          uom: newProdUom.trim(),
          mrp: newProdMrp.trim(),
          rate: newProdRate.trim(),
          gst_percent: newProdGstPercent.trim() || '18',
          gst_tax_category: newProdGstTaxCategory.trim() || '18% GST Cosmetics',
          shelf_life: newProdShelfLife.trim() || '24 Months',
        },
        customFields: {
          pack_size: newProdPackSize.trim() || undefined,
          uom: newProdUom.trim() || undefined,
          shelf_life: newProdShelfLife.trim() || undefined,
          mrp: !Number.isNaN(mrpNum) ? mrpNum : undefined,
          rate: !Number.isNaN(rateNum) ? rateNum : undefined,
          gst_percent: newProdGstPercent.trim() || '18',
          gst_tax_category: newProdGstTaxCategory.trim() || '18% GST Cosmetics',
        },
      }
      const res = await createCrud<{ id: string }>('catalog/variants', variantPayload)
      const newId = res.result?.id || `local-${Date.now()}`
      const newVariant = {
        id: newId,
        name: newProdVariantName.trim() || `${newProdPackSize}${newProdUom}`,
        packSize: newProdPackSize.trim(),
        uom: newProdUom.trim(),
        mrp: newProdMrp.trim(),
        rate: newProdRate.trim() || null,
        gstPercent: newProdGstPercent.trim() || '18',
        shelfLife: newProdShelfLife.trim() || '24 Months',
        isDefault: false,
      }
      setExistingVariants((prev) => [...prev, newVariant])
      setSelectedVariantIds((prev) => [...prev, newId])
      setAddingNewVariantRow(false)
      flash(`Variation "${newVariant.name}" saved`, 'success')
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to save variation', 'error')
    } finally {
      setSavingNewVariantRow(false)
    }
  }, [
    selectedExistingProdId,
    newProdVariantName,
    newProdPackSize,
    newProdUom,
    newProdMrp,
    newProdRate,
    newProdGstPercent,
    newProdGstTaxCategory,
    newProdShelfLife,
    organizationId,
    tenantId,
  ])

  // Save product & variant (handles creating brand new product OR configuring existing product / new variant)
  const handleCreateProduct = React.useCallback(async () => {
    setCreatingProduct(true)
    try {
      const isMakeToOrder = Boolean(newProdCustomerId || selectedCustomer?.id)
      const customerId = newProdCustomerId || selectedCustomer?.id
      const customerName = newProdCustomerName || selectedCustomer?.displayName || 'Customer'
      const clientBrand = newProdBrandName.trim() || customerName

      let productId = selectedExistingProdId
      let productTitle = newProdTitle.trim()
      let productCode = newProdCode.trim()
      let productCategory = newProdCategory.trim()
      let baseUom = newProdBaseUom.trim()

      // One entry per order line this save should produce — normally 1, but
      // multiple when the user multi-selects several existing variations
      // (e.g. 30ml + 50ml "both") to attach at once.
      type AttachEntry = { variantName: string; packSize: string; packUom: string; mrp: string; rate: string; gstPercent: string }
      let attachEntries: AttachEntry[] = [{
        variantName: newProdVariantName.trim() || 'Standard',
        packSize: newProdPackSize.trim(),
        packUom: newProdUom.trim(),
        mrp: newProdMrp.trim(),
        rate: newProdRate.trim(),
        gstPercent: newProdGstPercent.trim() || '18',
      }]

      if (prodModalMode === 'new') {
        if (!newProdTitle.trim()) {
          flash('Product Name is required', 'error')
          setCreatingProduct(false)
          return
        }

        const minFloorQtyNum = Number(newProdMinFloorQty)
        const prodCustomFields: Record<string, unknown> = {
          is_make_to_order: isMakeToOrder,
        }
        if (customerId) prodCustomFields.customer_id = customerId
        if (customerName) prodCustomFields.customer_name = customerName
        if (clientBrand) prodCustomFields.client_brand = clientBrand
        if (newProdCode.trim()) prodCustomFields.product_code = newProdCode.trim()
        if (newProdCategory.trim()) prodCustomFields.category = newProdCategory.trim()
        if (newProdBaseUom.trim()) prodCustomFields.base_uom = newProdBaseUom.trim()
        if (newProdMinFloorQty.trim() && !Number.isNaN(minFloorQtyNum)) {
          prodCustomFields.min_floor_qty = minFloorQtyNum
        }

        const prodPayload = {
          organizationId,
          tenantId,
          title: newProdTitle.trim(),
          sku: newProdCode.trim() || undefined,
          description: newProdDescription.trim() || undefined,
          isActive: true,
          productType: 'simple',
          metadata: {
            is_make_to_order: isMakeToOrder,
            customer_id: customerId,
            customer_name: customerName,
            client_brand: clientBrand,
            product_code: newProdCode.trim(),
            category: newProdCategory.trim(),
            base_uom: newProdBaseUom.trim(),
            min_floor_qty: minFloorQtyNum,
          },
          customFields: Object.keys(prodCustomFields).length ? prodCustomFields : undefined,
        }

        const prodRes = await createCrud<{ id: string }>('catalog/products', prodPayload)
        productId = prodRes.result?.id || ''

        if (!productId) {
          throw new Error('Product created, but ID was not returned.')
        }

        // Add to catalog cache
        const newItem: CatalogProductItem = {
          id: productId,
          title: newProdTitle.trim(),
          sku: newProdCode.trim() || null,
          category: newProdCategory.trim(),
          baseUom: newProdBaseUom.trim(),
          customerName,
          clientBrand,
        }
        setCatalogProducts((prev) => [newItem, ...prev])
      } else {
        // Existing product selected
        if (!selectedExistingProdId) {
          flash('Please select an available product', 'error')
          setCreatingProduct(false)
          return
        }
        const matched = catalogProducts.find((p) => p.id === selectedExistingProdId)
        if (matched) {
          productId = matched.id
          productTitle = matched.title
          productCode = matched.sku || ''
          productCategory = matched.category || 'Serum'
          baseUom = matched.baseUom || 'ml'
        }
      }

      // A brand-new product always needs its first variant created too (existing
      // products already get their variants via the inline "add variation" row).
      if (prodModalMode === 'new') {
        const mrpNum = Number(newProdMrp)
        const packNum = Number(newProdPackSize)
        const rateNum = Number(newProdRate)
        const variantPayload = {
          organizationId,
          tenantId,
          productId,
          name: newProdVariantName.trim() || `${newProdPackSize}${newProdUom}`,
          isActive: true,
          weightValue: !Number.isNaN(packNum) ? packNum : undefined,
          weightUnit: newProdUom || undefined,
          metadata: {
            pack_size: newProdPackSize.trim(),
            uom: newProdUom.trim(),
            mrp: newProdMrp.trim(),
            rate: newProdRate.trim(),
            gst_percent: newProdGstPercent.trim() || '18',
            gst_tax_category: newProdGstTaxCategory.trim() || '18% GST Cosmetics',
            shelf_life: newProdShelfLife.trim() || '24 Months',
          },
          customFields: {
            pack_size: newProdPackSize.trim() || undefined,
            uom: newProdUom.trim() || undefined,
            shelf_life: newProdShelfLife.trim() || undefined,
            mrp: !Number.isNaN(mrpNum) ? mrpNum : undefined,
            rate: !Number.isNaN(rateNum) ? rateNum : undefined,
            gst_percent: newProdGstPercent.trim() || '18',
            gst_tax_category: newProdGstTaxCategory.trim() || '18% GST Cosmetics',
          },
        }
        await createCrud('catalog/variants', variantPayload)
      } else if (prodModalMode === 'existing') {
        const chosen = existingVariants.filter((v) => selectedVariantIds.includes(v.id))
        if (!chosen.length) {
          flash('Select at least one variation (or add a new one)', 'error')
          setCreatingProduct(false)
          return
        }
        attachEntries = chosen.map((v) => ({
          variantName: v.name,
          packSize: v.packSize || newProdPackSize.trim(),
          packUom: v.uom || newProdUom.trim(),
          mrp: v.mrp || newProdMrp.trim(),
          rate: v.rate || newProdRate.trim(),
          gstPercent: v.gstPercent || newProdGstPercent.trim() || '18',
        }))
      }

      // Attach to the active target line — the first entry mutates that line in
      // place, any further entries (multi-selected variations) append new lines.
      if (targetLineKey) {
        const [first, ...rest] = attachEntries
        if (first) {
          setLines((prev) =>
            prev.map((l) =>
              l.key === targetLineKey
                ? {
                    ...l,
                    productId,
                    productLabel: productTitle,
                    productCode,
                    category: productCategory || 'Serum',
                    variantSku: first.variantName || 'Standard',
                    brandName: clientBrand,
                    packSize: first.packSize || l.packSize || '50',
                    uom: first.packUom || l.uom || 'ml',
                    quantity: newProdQuantity.trim() || l.quantity || '500',
                    rate: first.rate || l.rate || '180',
                    gstPercent: first.gstPercent || l.gstPercent || '18',
                    mrp: first.mrp || l.mrp || '599',
                  }
                : l
            )
          )
        }
        if (rest.length) {
          setLines((prev) => [
            ...prev,
            ...rest.map((entry) => ({
              ...makeEmptyLine(),
              productId,
              productLabel: productTitle,
              productCode,
              category: productCategory || 'Serum',
              variantSku: entry.variantName || 'Standard',
              brandName: clientBrand,
              packSize: entry.packSize || '50',
              uom: entry.packUom || 'ml',
              quantity: newProdQuantity.trim() || '500',
              rate: entry.rate || '180',
              gstPercent: entry.gstPercent || '18',
              mrp: entry.mrp || '599',
            })),
          ])
        }
      }

      flash(
        prodModalMode === 'new'
          ? `New product "${productTitle}" created & attached to order!`
          : attachEntries.length > 1
            ? `${attachEntries.length} variations of "${productTitle}" attached to order!`
            : `Product "${productTitle}" attached to order!`,
        'success'
      )
      setTargetLineKey(null)
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to save product', 'error')
    } finally {
      setCreatingProduct(false)
    }
  }, [
    prodModalMode,
    selectedExistingProdId,
    selectedVariantIds,
    existingVariants,
    newProdTitle,
    newProdCode,
    newProdCategory,
    newProdGstTaxCategory,
    newProdMinFloorQty,
    newProdBaseUom,
    newProdDescription,
    newProdVariantName,
    newProdPackSize,
    newProdUom,
    newProdMrp,
    newProdShelfLife,
    newProdQuantity,
    newProdRate,
    newProdGstPercent,
    newProdBrandName,
    newProdCustomerId,
    newProdCustomerName,
    targetLineKey,
    selectedCustomer,
    catalogProducts,
    organizationId,
    tenantId,
  ])

  const updateLine = React.useCallback((key: string, patch: Partial<OrderLineDraft>) => {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }, [])

  const addLine = React.useCallback(() => {
    setLines((prev) => [
      ...prev,
      {
        ...makeEmptyLine(),
        brandName: selectedCustomer?.displayName || '',
      },
    ])
  }, [selectedCustomer])

  const duplicateLine = React.useCallback((line: OrderLineDraft) => {
    const newLine: OrderLineDraft = {
      ...line,
      key: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `line-${Math.random().toString(36).slice(2)}`,
    }
    setLines((prev) => [...prev, newLine])
    flash('Product line duplicated', 'info')
  }, [])

  const removeLine = React.useCallback((key: string) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((line) => line.key !== key) : prev))
  }, [])

  // Wizard status validation
  const customerComplete = Boolean(selectedCustomer)
  const linesComplete = lines.some((line) => line.productId && Number(line.quantity) > 0 && Number(line.rate) > 0)

  const steps: StepIndicatorStep[] = React.useMemo(
    () =>
      WIZARD_STEPS.map((step) => {
        let status: StepIndicatorStep['status'] = 'pending'
        if (step.id === activeStep) status = 'current'
        else if (step.id === 'customer' && customerComplete) status = 'complete'
        else if (step.id === 'lines' && linesComplete) status = 'complete'
        else if (step.id === 'details' && linesComplete) status = 'complete'
        return {
          id: step.id,
          label: step.label,
          status,
        }
      }),
    [activeStep, customerComplete, linesComplete]
  )

  // Running calculations
  const subtotal = React.useMemo(() => lines.reduce((acc, l) => acc + calcLineSubtotal(l), 0), [lines])
  const totalTax = React.useMemo(() => lines.reduce((acc, l) => acc + calcLineTax(l), 0), [lines])
  const grandTotal = subtotal + totalTax

  // Submit Order
  const handleSubmit = React.useCallback(async () => {
    if (!selectedCustomer) {
      flash('Select or create a customer to continue', 'error')
      setActiveStep('customer')
      return
    }
    const validLines = lines.filter((l) => l.productId && Number(l.quantity) > 0)
    if (!validLines.length) {
      flash('Add at least one product line with quantity', 'error')
      setActiveStep('lines')
      return
    }

    setSubmitting(true)
    try {
      const orderCustomFields: Record<string, unknown> = {
        order_type: orderType,
        priority,
        sales_poc: salesPoc || selectedCustomer.salesPoc || undefined,
        packaging_type: packagingType,
        pm_source: pmSource,
        artwork_requirement: artworkRequirement,
        sample_required: sampleRequired,
        sample_qty: sampleRequired ? sampleQty : undefined,
        sample_due_date: sampleRequired ? sampleDueDate : undefined,
        // Kanban stage-gate mechanism: every new order starts in the 'new' pipeline stage;
        // the advance fields below drive the advance-confirmation gate on New -> Verified.
        order_stage: 'new',
        advance_required: advanceRequired,
        advance_percent: advanceRequired ? Number(advancePercent) || 0 : undefined,
        payment_ref: advanceRequired && paymentRef.trim() ? paymentRef.trim() : undefined,
        advance_received_amount: advanceRequired && advanceReceivedNow
          ? (advanceAmount ? Number(advanceAmount) : Math.round((grandTotal * (Number(advancePercent) || 0)) / 100))
          : (advanceAmount ? Number(advanceAmount) : undefined),
        advance_received_at: advanceRequired && advanceReceivedNow ? advanceReceivedDate : undefined,
      }

      const payload = {
        organizationId,
        tenantId,
        customerEntityId: selectedCustomer.id,
        currencyCode: 'INR',
        taxStrategyKey: 'gst_exclusive',
        customerReference: customerPoRef.trim() || undefined,
        placedAt: orderDate ? new Date(orderDate) : new Date(),
        expectedDeliveryAt: deliveryDate ? new Date(deliveryDate) : undefined,
        comments: orderNotes.trim() || undefined,
        customFields: orderCustomFields,
        metadata: {
          order_type: orderType,
          priority,
          packaging_type: packagingType,
          pm_source: pmSource,
          artwork_requirement: artworkRequirement,
          sample_required: sampleRequired,
          order_stage: 'new',
          subtotal,
          total_tax: totalTax,
          grand_total: grandTotal,
        },
        lines: validLines.map((line, idx) => {
          const qty = Number(line.quantity) || 0
          const rate = Number(line.rate) || 0
          const gst = Number(line.gstPercent) || 0
          const lineSubtotal = qty * rate
          const lineTax = (lineSubtotal * gst) / 100
          const lineTotal = lineSubtotal + lineTax
          return {
            lineNumber: idx + 1,
            currencyCode: 'INR',
            productId: line.productId,
            name: line.productLabel,
            quantity: String(qty),
            unitPriceNet: String(rate),
            unitPriceGross: String(Math.round((rate * (1 + gst / 100)) * 100) / 100),
            priceMode: 'net',
            taxRate: String(gst),
            taxAmount: String(lineTax),
            totalNetAmount: String(lineSubtotal),
            totalGrossAmount: String(lineTotal),
            customFields: {
              line_kind: 'fg',
              variant_sku: line.variantSku || 'Standard',
              brand_name: line.brandName || selectedCustomer.displayName,
              pack_size: line.packSize,
              uom: line.uom,
              mrp: line.mrp ? Number(line.mrp) : undefined,
            },
          }
        }),
      }

      const created = await createCrud<{ id: string | null }>('sales/orders', payload)
      flash('Order booked successfully!', 'success')
      const newId = created.result?.id
      router.push(newId ? `/backend/sales/order-book/${newId}` : '/backend/sales/order-book')
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to book order', 'error')
    } finally {
      setSubmitting(false)
    }
  }, [
    selectedCustomer,
    lines,
    orderType,
    priority,
    salesPoc,
    customerPoRef,
    orderDate,
    deliveryDate,
    packagingType,
    pmSource,
    artworkRequirement,
    sampleRequired,
    sampleQty,
    sampleDueDate,
    orderNotes,
    advanceRequired,
    advancePercent,
    advanceAmount,
    advanceReceivedNow,
    advanceReceivedDate,
    paymentRef,
    subtotal,
    totalTax,
    grandTotal,
    organizationId,
    tenantId,
    router,
  ])

  // Rendered inline under whichever order line has its Product & Variation
  // panel expanded (targetLineKey) — same JSX element reused wherever it matches,
  // so no separate modal/dialog is involved.
  const productPanelContent = (
      <div className="rounded-lg border-2 border-primary/25 bg-background shadow-sm">
        <div className="p-4 space-y-4">
            <div className="flex items-start justify-between gap-2 border-b pb-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {prodModalMode === 'existing' ? (
                    <>
                      <PackageCheck className="h-4 w-4 text-primary" />
                      Select Product & Variation
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      Create New Product
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {prodModalMode === 'existing'
                    ? 'Choose an available product from the catalog, pick an existing variation or add a new variation, and attach it to your order.'
                    : 'Register a brand-new product in the master catalog and attach it to your active order line.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTargetLineKey(null)}
                className="text-muted-foreground hover:text-foreground text-sm shrink-0"
                title="Close"
              >
                {'✕'}
              </button>
            </div>

            <div className="space-y-4">
              {/* TOP MODE TOGGLE: SELECT EXISTING PRODUCT VS CREATE NEW PRODUCT */}
              <SegmentedControl
                value={prodModalMode}
                onValueChange={(val: any) => {
                  setProdModalMode(val)
                  if (val === 'existing') {
                    const effId = selectedExistingProdId || catalogProducts[0]?.id || ''
                    setSelectedExistingProdId(effId)
                    if (effId) {
                      const m = catalogProducts.find((p) => p.id === effId)
                      setNewProdTitle(m?.title || '')
                      setNewProdCode(m?.sku || '')
                      setNewProdCategory(m?.category || 'Serum')
                      setNewProdBaseUom(m?.baseUom || 'ml')
                      loadVariantsForProduct(effId)
                    }
                  } else {
                    setNewProdTitle('')
                    setNewProdCode('')
                    setNewProdDescription('')
                  }
                }}
                className="w-full grid grid-cols-2"
              >
                <SegmentedControlItem value="existing" className="flex items-center justify-center gap-2 py-2">
                  <PackageCheck className="h-4 w-4 text-primary" />
                  <span className="font-medium text-xs">Select Existing Product</span>
                </SegmentedControlItem>
                <SegmentedControlItem value="new" className="flex items-center justify-center gap-2 py-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span className="font-medium text-xs">Create New Product</span>
                </SegmentedControlItem>
              </SegmentedControl>

              {/* CLIENT & PRIVATE LABEL BRAND ASSIGNMENT */}
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-primary/20 pb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-xs text-primary uppercase tracking-wider">
                      Client & Private Label Brand Assignment
                    </h3>
                  </div>
                  {selectedCustomer ? (
                    <span className="text-[11px] text-muted-foreground">
                      Active: <strong className="text-foreground">{selectedCustomer.displayName}</strong>
                    </span>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Customer / Client Company *</Label>
                    <Select
                      value={newProdCustomerId || selectedCustomer?.id || ''}
                      onValueChange={(val) => {
                        setNewProdCustomerId(val)
                        const c = customerRows.find((item) => item.id === val)
                        if (c) {
                          setNewProdCustomerName(c.displayName)
                          if (!newProdBrandName) setNewProdBrandName(c.displayName)
                        }
                      }}
                    >
                      <SelectTrigger className="text-xs h-9 bg-background">
                        <SelectValue placeholder="Select Customer..." />
                      </SelectTrigger>
                      <SelectContent>
                        {customerRows.map((c) => (
                          <SelectItem key={c.id} value={c.id} className="text-xs">
                            {c.displayName} {c.gstin ? `(GST: ${c.gstin})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Private Label Brand Name *</Label>
                    <Input
                      value={newProdBrandName}
                      onChange={(e) => setNewProdBrandName(e.target.value)}
                      placeholder={selectedCustomer?.displayName || 'e.g. SkinGlo, DermaCare'}
                      className="text-xs h-9 bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* ======================================================== */}
              {/* MODE 1: SELECT EXISTING PRODUCT */}
              {/* ======================================================== */}
              {prodModalMode === 'existing' ? (
                <div className="space-y-4">
                  {/* SELECT PRODUCT FROM CATALOG */}
                  <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                          1. Select Product
                        </h3>
                      </div>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {customerMatchingProducts.length > 0
                          ? `${customerMatchingProducts.length} linked to ${selectedCustomer?.displayName || 'Customer'} (${catalogProducts.length} total)`
                          : `${catalogProducts.length} Available in Catalog`}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Choose Product *</Label>
                      <Select
                        value={selectedExistingProdId}
                        onValueChange={(val) => {
                          setSelectedExistingProdId(val)
                          const matched = catalogProducts.find((p) => p.id === val)
                          if (matched) {
                            setNewProdTitle(matched.title)
                            setNewProdCode(matched.sku || '')
                            setNewProdCategory(matched.category || 'Serum')
                            setNewProdBaseUom(matched.baseUom || 'ml')
                            if (matched.clientBrand && !newProdBrandName) {
                              setNewProdBrandName(matched.clientBrand)
                            }
                          }
                          loadVariantsForProduct(val)
                        }}
                      >
                        <SelectTrigger className="text-xs h-10 bg-background">
                          <SelectValue placeholder="Select an available product..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {customerMatchingProducts.length > 0 ? (
                            <div className="px-2 py-1 text-[11px] font-bold text-primary uppercase tracking-wider bg-primary/10 rounded-sm mb-1">
                              ✨ {selectedCustomer?.displayName || 'Customer'} Products ({customerMatchingProducts.length})
                            </div>
                          ) : null}
                          {customerMatchingProducts.map((p) => (
                            <SelectItem key={p.id} value={p.id} className="text-xs py-2 bg-primary/5 hover:bg-primary/10 mb-0.5">
                              <div className="flex flex-col">
                                <span className="font-semibold text-primary">{p.title}</span>
                                <span className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                                  {p.sku ? <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">SKU: {p.sku}</span> : null}
                                  {p.category ? <span>• {p.category}</span> : null}
                                  {p.clientBrand ? <span>• Brand: {p.clientBrand}</span> : null}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                          {otherCatalogProducts.length > 0 ? (
                            <>
                              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/40 rounded-sm my-1 border-t">
                                Other Catalog Products ({otherCatalogProducts.length})
                              </div>
                              {otherCatalogProducts.map((p) => (
                                <SelectItem key={p.id} value={p.id} className="text-xs py-2">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-foreground">{p.title}</span>
                                    <span className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                                      {p.sku ? <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">SKU: {p.sku}</span> : null}
                                      {p.category ? <span>• {p.category}</span> : null}
                                      {p.clientBrand ? <span>• Brand: {p.clientBrand}</span> : null}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </>
                          ) : null}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Selected Product Summary Box */}
                    {selectedExistingProdId ? (
                      <div className="rounded-md border bg-background/80 p-3 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <span className="text-muted-foreground text-[10px] uppercase font-semibold">SKU Code</span>
                          <div className="font-mono font-bold text-foreground">{newProdCode || 'DER-FORM-01'}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-[10px] uppercase font-semibold">Category</span>
                          <div className="font-medium text-foreground">{newProdCategory || 'Serum'}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-[10px] uppercase font-semibold">Base UOM</span>
                          <div className="font-medium text-foreground">{newProdBaseUom || 'ml'}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-[10px] uppercase font-semibold">Status</span>
                          <div className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Ready in Catalog
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* VARIATION TABLE — pick one or more existing rows, or add a new one inline */}
                  <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Boxes className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                          2. Variations — select one or more, or add a new one
                        </h3>
                      </div>
                      <span className="text-[11px] text-muted-foreground">{existingVariants.length} available</span>
                    </div>

                    <div className="overflow-x-auto rounded border bg-background">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="py-2 px-2 w-8"></th>
                            <th className="py-2 px-2 text-left">Variation</th>
                            <th className="py-2 px-2 text-left">Pack</th>
                            <th className="py-2 px-2 text-right">MRP (₹)</th>
                            <th className="py-2 px-2 text-right">Rate (₹)</th>
                            <th className="py-2 px-2 text-right">GST</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {loadingVariants ? (
                            <tr>
                              <td colSpan={6} className="py-3 text-center text-muted-foreground font-mono">
                                Loading product variations...
                              </td>
                            </tr>
                          ) : (
                            existingVariants.map((v) => {
                              const isSelected = selectedVariantIds.includes(v.id)
                              return (
                                <tr
                                  key={v.id}
                                  onClick={() =>
                                    setSelectedVariantIds((prev) =>
                                      prev.includes(v.id) ? prev.filter((id) => id !== v.id) : [...prev, v.id]
                                    )
                                  }
                                  className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/10' : 'hover:bg-muted/40'}`}
                                >
                                  <td className="py-2 px-2 text-center">
                                    <span className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm border text-[9px] ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>
                                      {isSelected ? '✓' : ''}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2 font-medium">
                                    {v.name}
                                    {v.isDefault ? <span className="ml-1.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">Default</span> : null}
                                  </td>
                                  <td className="py-2 px-2 font-mono">{v.packSize} {v.uom}</td>
                                  <td className="py-2 px-2 text-right font-mono">{v.mrp || '—'}</td>
                                  <td className="py-2 px-2 text-right font-mono">{v.rate || '—'}</td>
                                  <td className="py-2 px-2 text-right font-mono">{v.gstPercent || '18'}%</td>
                                </tr>
                              )
                            })
                          )}

                          {addingNewVariantRow ? (
                            <tr className="bg-amber-500/5">
                              <td className="py-1.5 px-2"></td>
                              <td className="py-1.5 px-2">
                                <Input
                                  value={newProdVariantName}
                                  onChange={(e) => setNewProdVariantName(e.target.value)}
                                  placeholder="e.g. 30ml"
                                  className="h-7 text-xs bg-background"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <div className="flex items-center gap-1">
                                  <Input
                                    value={newProdPackSize}
                                    onChange={(e) => setNewProdPackSize(e.target.value)}
                                    placeholder="30"
                                    className="h-7 w-14 text-xs text-center font-mono bg-background"
                                  />
                                  <Select value={newProdUom} onValueChange={setNewProdUom}>
                                    <SelectTrigger className="h-7 w-16 text-xs bg-background">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {UOM_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                          {opt.value}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </td>
                              <td className="py-1.5 px-2">
                                <Input
                                  type="number"
                                  min={0}
                                  value={newProdMrp}
                                  onChange={(e) => setNewProdMrp(e.target.value)}
                                  placeholder="599"
                                  className="h-7 text-xs font-mono text-right bg-background"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <Input
                                  type="number"
                                  min={0}
                                  value={newProdRate}
                                  onChange={(e) => setNewProdRate(e.target.value)}
                                  placeholder="180"
                                  className="h-7 text-xs font-mono text-right bg-background"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <Select value={newProdGstPercent} onValueChange={setNewProdGstPercent}>
                                  <SelectTrigger className="h-7 text-xs bg-background">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {GST_RATES.map((opt) => (
                                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                        {opt.value}%
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>

                    {addingNewVariantRow ? (
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setAddingNewVariantRow(false)}
                          className="text-muted-foreground hover:text-foreground text-[11px] font-medium"
                        >
                          Cancel
                        </button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={handleSaveNewVariantRow}
                          disabled={savingNewVariantRow || !newProdPackSize.trim()}
                        >
                          {savingNewVariantRow ? 'Saving...' : 'Save Variation'}
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={startAddingNewVariantRow}
                        className="text-primary hover:underline text-[11px] font-medium inline-flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        Add a new variation (e.g. a size that isn't listed)
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* ======================================================== */
                /* MODE 2: CREATE BRAND NEW PRODUCT */
                /* ======================================================== */
                <div className="space-y-3">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-center gap-2 pb-2">
                      <Package className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                        New Product & Variation — fill in what's needed, then save
                      </h3>
                    </div>
                    <div className="overflow-x-auto rounded border bg-background">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="py-2 px-2 text-left min-w-[160px]">Product Name *</th>
                            <th className="py-2 px-2 text-left">Code</th>
                            <th className="py-2 px-2 text-left">Category</th>
                            <th className="py-2 px-2 text-left">Pack</th>
                            <th className="py-2 px-2 text-right">MRP (₹)</th>
                            <th className="py-2 px-2 text-right">Rate (₹)</th>
                            <th className="py-2 px-2 text-right">GST</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="py-1.5 px-2">
                              <Input
                                value={newProdTitle}
                                onChange={(e) => setNewProdTitle(e.target.value)}
                                placeholder="e.g. 10% Niacinamide Face Serum"
                                className="h-7 text-xs bg-background"
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <Input
                                value={newProdCode}
                                onChange={(e) => setNewProdCode(e.target.value)}
                                placeholder="DER-FORM-01"
                                className="h-7 w-28 text-xs font-mono bg-background"
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <Select value={newProdCategory} onValueChange={setNewProdCategory}>
                                <SelectTrigger className="h-7 w-32 text-xs bg-background">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {CATEGORY_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="py-1.5 px-2">
                              <div className="flex items-center gap-1">
                                <Input
                                  value={newProdPackSize}
                                  onChange={(e) => setNewProdPackSize(e.target.value)}
                                  placeholder="50"
                                  className="h-7 w-14 text-xs text-center font-mono bg-background"
                                />
                                <Select value={newProdUom} onValueChange={(v) => { setNewProdUom(v); setNewProdBaseUom(v) }}>
                                  <SelectTrigger className="h-7 w-16 text-xs bg-background">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {UOM_OPTIONS.map((opt) => (
                                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                        {opt.value}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </td>
                            <td className="py-1.5 px-2">
                              <Input
                                type="number"
                                min={0}
                                value={newProdMrp}
                                onChange={(e) => setNewProdMrp(e.target.value)}
                                placeholder="599"
                                className="h-7 w-16 text-xs font-mono text-right bg-background"
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <Input
                                type="number"
                                min={0}
                                value={newProdRate}
                                onChange={(e) => setNewProdRate(e.target.value)}
                                placeholder="180"
                                className="h-7 w-16 text-xs font-mono text-right bg-background"
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <Select value={newProdGstPercent} onValueChange={setNewProdGstPercent}>
                                <SelectTrigger className="h-7 w-16 text-xs bg-background">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {GST_RATES.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                      {opt.value}%
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-2 space-y-1">
                      <Label className="text-xs text-muted-foreground">Description & Specifications (optional)</Label>
                      <Textarea
                        value={newProdDescription}
                        onChange={(e) => setNewProdDescription(e.target.value)}
                        rows={2}
                        placeholder="Active ingredients, target texture, packaging details..."
                        className="text-xs bg-background"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 3: COMMERCIAL ORDER TERMS */}
              <div className="rounded-lg border bg-emerald-500/5 border-emerald-500/20 p-4 space-y-3">
                <div className="flex items-center gap-2 border-b border-emerald-500/20 pb-2">
                  <ShoppingBag className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="font-semibold text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    3. Commercial Order Terms for this Line
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Batch Order Qty (Units) *</Label>
                    <Input
                      type="number"
                      min={1}
                      value={newProdQuantity}
                      onChange={(e) => setNewProdQuantity(e.target.value)}
                      placeholder="500"
                      className="text-xs font-mono font-bold bg-background"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Contract Billing Rate (₹) *</Label>
                    <Input
                      type="number"
                      min={0}
                      value={newProdRate}
                      onChange={(e) => setNewProdRate(e.target.value)}
                      placeholder="180"
                      className="text-xs font-mono font-bold bg-background"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">GST Tax Rate</Label>
                    <Select value={newProdGstPercent} onValueChange={setNewProdGstPercent}>
                      <SelectTrigger className="text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GST_RATES.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Calculation Preview */}
                <div className="rounded border bg-background p-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-muted-foreground">Line Subtotal: </span>
                    <strong className="font-mono">{formatINR((Number(newProdQuantity) || 0) * (Number(newProdRate) || 0))}</strong>
                    <span className="text-muted-foreground ml-3">GST ({newProdGstPercent}%): </span>
                    <strong className="font-mono">
                      {formatINR(
                        (((Number(newProdQuantity) || 0) * (Number(newProdRate) || 0)) * (Number(newProdGstPercent) || 0)) / 100
                      )}
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground">Line Total: </span>
                    <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400 font-mono">
                      {formatINR(
                        ((Number(newProdQuantity) || 0) * (Number(newProdRate) || 0)) *
                          (1 + (Number(newProdGstPercent) || 0) / 100)
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setTargetLineKey(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-primary font-semibold"
                onClick={handleCreateProduct}
                disabled={
                  creatingProduct ||
                  (prodModalMode === 'new' && !newProdTitle.trim()) ||
                  (prodModalMode === 'existing' && !selectedExistingProdId)
                }
              >
                {creatingProduct
                  ? 'Saving Product...'
                  : prodModalMode === 'new'
                    ? 'Create Product & Add to Order'
                    : 'Add Selected Variation(s) to Order'}
              </Button>
            </div>
          </div>
        </div>
  )

  return (
    <Page>
      <PageBody>
        <div className="space-y-6 max-w-6xl mx-auto pb-12">
          {/* Header Title & Stepper */}
          <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold tracking-tight">Create New Sales Order</h1>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Dermat India Contract Manufacturing Order Booking Flow
              </p>
            </div>
            {selectedCustomer ? (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-1.5 text-xs">
                <Building2 className="h-4 w-4 text-primary" />
                <span>Client: <strong>{selectedCustomer.displayName}</strong></span>
              </div>
            ) : null}
          </div>

          <StepIndicator steps={steps} onStepClick={(id) => setActiveStep(id as WizardStepId)} />

          {/* ======================================================== */}
          {/* STEP 1: CUSTOMER & COMMERCIAL HEADER */}
          {/* ======================================================== */}
          {activeStep === 'customer' ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    Customer / Company Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <SegmentedControl
                    value={customerMode}
                    onValueChange={(next) => setCustomerMode(next as 'existing' | 'new')}
                  >
                    <SegmentedControlItem value="existing">
                      Select Existing Customer
                    </SegmentedControlItem>
                    <SegmentedControlItem value="new">
                      + Create New Customer (Inline)
                    </SegmentedControlItem>
                  </SegmentedControl>

                  {customerMode === 'existing' ? (
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search customer by name, phone, GSTIN..."
                          className="pl-9"
                        />
                      </div>

                      {selectedCustomer ? (
                        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                              <span className="font-semibold text-sm">{selectedCustomer.displayName}</span>
                              {selectedCustomer.gstin ? (
                                <span className="rounded bg-background px-1.5 py-0.5 text-xs font-mono border">
                                  GST: {selectedCustomer.gstin}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-3">
                              {selectedCustomer.phone ? <span>Phone: {selectedCustomer.phone}</span> : null}
                              {selectedCustomer.email ? <span>Email: {selectedCustomer.email}</span> : null}
                              {selectedCustomer.salesPoc ? <span>POC: {selectedCustomer.salesPoc}</span> : null}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedCustomer(null)}
                          >
                            Change
                          </Button>
                        </div>
                      ) : null}

                      {!selectedCustomer ? (
                        <div className="max-h-60 overflow-y-auto rounded-lg border divide-y">
                          {loadingCustomers ? (
                            <div className="p-4 text-center text-xs text-muted-foreground">Loading customers...</div>
                          ) : customerRows.length === 0 ? (
                            <div className="p-6 text-center text-xs text-muted-foreground">
                              No matching customers found. Switch to "+ Create New Customer" tab to add one.
                            </div>
                          ) : (
                            customerRows.map((cust) => (
                              <div
                                key={cust.id}
                                onClick={() => {
                                  setSelectedCustomer(cust)
                                  if (cust.salesPoc && !salesPoc) setSalesPoc(cust.salesPoc)
                                }}
                                className="w-full text-left p-3 hover:bg-muted/50 transition-colors flex items-center justify-between cursor-pointer"
                              >
                                <div className="space-y-0.5">
                                  <div className="font-semibold text-sm">{cust.displayName}</div>
                                  <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                                    {cust.phone ? <span>📞 {cust.phone}</span> : null}
                                    {cust.email ? <span>✉️ {cust.email}</span> : null}
                                    {cust.gstin ? <span>GSTIN: <strong>{cust.gstin}</strong></span> : null}
                                    {cust.salesPoc ? <span>POC: {cust.salesPoc}</span> : null}
                                  </div>
                                </div>
                                <Button type="button" variant="outline" size="sm">Select</Button>
                              </div>
                            ))
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    /* INLINE CREATE NEW CUSTOMER FORM */
                    <div className="rounded-lg border bg-muted/10 p-4 space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1 sm:col-span-2">
                          <Label>Company / Customer Name *</Label>
                          <Input
                            value={newCustName}
                            onChange={(e) => setNewCustName(e.target.value)}
                            placeholder="e.g. SkinGlo Pharma Pvt Ltd"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Contact Person</Label>
                          <Input
                            value={newCustContact}
                            onChange={(e) => setNewCustContact(e.target.value)}
                            placeholder="e.g. Dr. Rajesh Sharma"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Phone Number</Label>
                          <Input
                            value={newCustPhone}
                            onChange={(e) => setNewCustPhone(e.target.value)}
                            placeholder="e.g. +91 98765 43210"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Email Address</Label>
                          <Input
                            type="email"
                            value={newCustEmail}
                            onChange={(e) => setNewCustEmail(e.target.value)}
                            placeholder="e.g. contact@skinglo.com"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>GSTIN / Tax ID</Label>
                          <Input
                            value={newCustGstin}
                            onChange={(e) => setNewCustGstin(e.target.value)}
                            placeholder="e.g. 27AAAAA0000A1Z5"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Sales POC (Responsible Person)</Label>
                          <Input
                            value={newCustSalesPoc}
                            onChange={(e) => setNewCustSalesPoc(e.target.value)}
                            placeholder="e.g. Amit Kumar"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Billing / Shipping Address</Label>
                          <Input
                            value={newCustAddress}
                            onChange={(e) => setNewCustAddress(e.target.value)}
                            placeholder="e.g. Sector 18, Gurugram, Haryana"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end pt-2">
                        <Button
                          type="button"
                          onClick={handleCreateCustomer}
                          disabled={creatingCustomer || !newCustName.trim()}
                        >
                          {creatingCustomer ? 'Creating Customer...' : 'Save & Select Customer'}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Commercial Header Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Commercial & Order Header Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label>Order Date *</Label>
                      <Input
                        type="date"
                        value={orderDate}
                        onChange={(e) => setOrderDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Committed Delivery Date *</Label>
                      <Input
                        type="date"
                        value={deliveryDate}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Customer PO / Ref No.</Label>
                      <Input
                        value={customerPoRef}
                        onChange={(e) => setCustomerPoRef(e.target.value)}
                        placeholder="e.g. PO-2026-089"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Order Type</Label>
                      <Select value={orderType} onValueChange={(v: any) => setOrderType(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="New">New Order (First Batch)</SelectItem>
                          <SelectItem value="Repeat">Repeat Order</SelectItem>
                          <SelectItem value="Revision">Order Revision</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Operational Priority</Label>
                      <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Normal">Normal</SelectItem>
                          <SelectItem value="High">High Priority</SelectItem>
                          <SelectItem value="Urgent">Urgent / Rush</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Sales POC / Executive</Label>
                      <Input
                        value={salesPoc}
                        onChange={(e) => setSalesPoc(e.target.value)}
                        placeholder="e.g. Amit Kumar"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center justify-between pt-2">
                <Button type="button" variant="outline" asChild>
                  <a href="/backend/sales/order-book">Cancel</a>
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (!selectedCustomer) {
                      flash('Please select or create a customer first', 'error')
                      return
                    }
                    setActiveStep('lines')
                  }}
                  disabled={!selectedCustomer}
                >
                  Continue to Products & Items <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}

          {/* ======================================================== */}
          {/* STEP 2: PRODUCTS & ORDER ITEMS TABLE */}
          {/* ======================================================== */}
          {activeStep === 'lines' ? (
            <div className="space-y-6">
              <Card className="shadow-sm border-border/80">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b gap-3">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Boxes className="h-5 w-5 text-primary" />
                      Ordered Products Table ({lines.length} {lines.length === 1 ? 'Item' : 'Items'})
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Selected products & variations for{' '}
                      <strong>{selectedCustomer?.displayName || 'Client'}</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openLineProductPanel(lines[0]?.key || '', 'existing')}
                      className="text-xs"
                    >
                      <PackageCheck className="mr-1.5 h-3.5 w-3.5 text-primary" />
                      Select Product / Variant
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openLineProductPanel(lines[0]?.key || '', 'new')}
                      className="text-xs border-dashed text-amber-600 dark:text-amber-400 hover:text-amber-700"
                    >
                      <Sparkles className="mr-1.5 h-3.5 w-3.5 text-amber-500" />
                      + New Product
                    </Button>
                    <Button type="button" size="sm" onClick={addLine} className="text-xs">
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Add Row
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {selectedCustomer ? (
                    <div className="bg-primary/5 border-b border-primary/15 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span>
                          Customer / Brand: <strong className="text-foreground">{selectedCustomer.displayName}</strong>
                          {customerMatchingProducts.length > 0 ? (
                            <span className="ml-1 font-medium text-primary">
                              ({customerMatchingProducts.length} linked product{customerMatchingProducts.length > 1 ? 's' : ''} available)
                            </span>
                          ) : (
                            <span className="ml-1 text-muted-foreground">(No existing products linked to this customer)</span>
                          )}
                        </span>
                      </div>
                      {customerMatchingProducts.length > 0 && !lines[0]?.productId ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-7 text-xs font-medium"
                          onClick={() => {
                            const p = customerMatchingProducts[0]
                            updateLine(lines[0].key, {
                              productId: p.id,
                              productLabel: p.title,
                              productCode: p.sku || '',
                              category: p.category || 'Serum',
                              uom: p.baseUom || 'ml',
                              brandName: p.clientBrand || selectedCustomer.displayName,
                              variantSku: 'Standard',
                            })
                          }}
                        >
                          Quick-Select: {customerMatchingProducts[0].title}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/40 border-b text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-3 w-10 text-center">#</th>
                          <th className="py-3 px-3 min-w-[240px]">Product *</th>
                          <th className="py-3 px-3 min-w-[140px]">Client Brand</th>
                          <th className="py-3 px-3 min-w-[130px]">Category</th>
                          <th className="py-3 px-3 min-w-[140px]">Pack Size & UOM</th>
                          <th className="py-3 px-3 min-w-[110px]">Order Qty *</th>
                          <th className="py-3 px-3 min-w-[110px]">Rate (₹) *</th>
                          <th className="py-3 px-3 min-w-[95px] text-right">Taxable</th>
                          <th className="py-3 px-3 min-w-[100px]">GST Rate</th>
                          <th className="py-3 px-3 min-w-[110px] text-right">Total (₹)</th>
                          <th className="py-3 px-3 w-16 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {lines.map((line, idx) => (
                          <React.Fragment key={line.key}>
                          <tr className="hover:bg-muted/20 transition-colors">
                            {/* Column 1: Index */}
                            <td className="py-3 px-3 text-center align-middle font-mono font-bold text-muted-foreground text-xs">
                              {idx + 1}
                            </td>

                            {/* Column 2: Product */}
                            <td className="py-3 px-3 align-middle">
                              <div className="space-y-1.5">
                                <Select
                                  value={line.productId}
                                  onValueChange={(val) => {
                                    // Selecting a product here only opens the variation panel
                                    // below with that product's real variations loaded — the
                                    // line itself is only updated once a variation is actually
                                    // confirmed there, so we never write a fake "Standard"
                                    // variant with no real pack size onto the line.
                                    if (val === '__new_product__') {
                                      openLineProductPanel(line.key, 'new')
                                      return
                                    }
                                    openLineProductPanel(line.key, 'existing', val)
                                  }}
                                >
                                  <SelectTrigger className="text-xs h-8">
                                    <SelectValue placeholder="Select product from Catalog…" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-72">
                                    <SelectItem value="__new_product__" className="text-xs font-medium text-amber-600 dark:text-amber-400">
                                      + Create New Product
                                    </SelectItem>
                                    {customerMatchingProducts.length > 0 ? (
                                      <div className="px-2 py-1 text-[11px] font-bold text-primary uppercase tracking-wider bg-primary/10 rounded-sm mb-1">
                                        ✨ {selectedCustomer?.displayName || 'Customer'} Products ({customerMatchingProducts.length})
                                      </div>
                                    ) : null}
                                    {customerMatchingProducts.map((p) => (
                                      <SelectItem key={p.id} value={p.id} className="text-xs font-medium bg-primary/5 hover:bg-primary/10 mb-0.5">
                                        <div className="flex flex-col">
                                          <span className="font-semibold text-primary">{p.title}</span>
                                          <span className="text-[10px] text-muted-foreground">
                                            {p.sku ? `SKU: ${p.sku}` : ''} {p.category ? `• ${p.category}` : ''} {p.clientBrand ? `• Brand: ${p.clientBrand}` : ''}
                                          </span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                    {otherCatalogProducts.length > 0 ? (
                                      <>
                                        <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/40 rounded-sm my-1 border-t">
                                          Other Catalog Products ({otherCatalogProducts.length})
                                        </div>
                                        {otherCatalogProducts.map((p) => (
                                          <SelectItem key={p.id} value={p.id} className="text-xs">
                                            <div className="flex flex-col">
                                              <span className="font-medium">{p.title}</span>
                                              <span className="text-[10px] text-muted-foreground">
                                                {p.sku ? `SKU: ${p.sku}` : ''} {p.category ? `• ${p.category}` : ''} {p.clientBrand ? `• Brand: ${p.clientBrand}` : ''}
                                              </span>
                                            </div>
                                          </SelectItem>
                                        ))}
                                      </>
                                    ) : null}
                                  </SelectContent>
                                </Select>

                                <button
                                  type="button"
                                  onClick={() => openLineProductPanel(line.key, 'existing', line.productId)}
                                  className="w-full text-left text-[11px]"
                                >
                                  {line.productId ? (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {line.variantSku ? (
                                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                                          {line.variantSku}
                                        </span>
                                      ) : null}
                                      {line.packSize ? (
                                        <span className="text-[10px] text-muted-foreground">{line.packSize} {line.uom}</span>
                                      ) : null}
                                      {line.productCode ? (
                                        <span className="font-mono text-muted-foreground text-[10px] truncate max-w-[100px]">
                                          Code: {line.productCode}
                                        </span>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground text-[10px]">No variation chosen yet</span>
                                  )}
                                </button>
                              </div>
                            </td>

                            {/* Column 3: Client Brand (auto-filled, read-only) */}
                            <td className="py-3 px-3 align-middle text-xs text-foreground">
                              {line.brandName || selectedCustomer?.displayName || <span className="text-muted-foreground">—</span>}
                            </td>

                            {/* Column 4: Category (auto-filled, read-only) */}
                            <td className="py-3 px-3 align-middle">
                              <span className="inline-block rounded bg-muted px-2 py-1 text-[11px] font-medium text-foreground">
                                {line.category || '—'}
                              </span>
                            </td>

                            {/* Column 5: Pack Size & UOM (auto-filled, read-only) */}
                            <td className="py-3 px-3 align-middle font-mono text-xs text-foreground">
                              {line.packSize ? `${line.packSize} ${line.uom}` : '—'}
                            </td>

                            {/* Column 6: Order Qty (Units) */}
                            <td className="py-3 px-3 align-middle">
                              <Input
                                type="number"
                                min={1}
                                value={line.quantity}
                                onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                                placeholder="500"
                                className="text-xs h-8 font-mono font-semibold text-right"
                              />
                            </td>

                            {/* Column 7: Billing Rate (₹) */}
                            <td className="py-3 px-3 align-middle">
                              <Input
                                type="number"
                                min={0}
                                value={line.rate}
                                onChange={(e) => updateLine(line.key, { rate: e.target.value })}
                                placeholder="180"
                                className="text-xs h-8 font-mono text-right"
                              />
                            </td>

                            {/* Column 8: Taxable Subtotal */}
                            <td className="py-3 px-3 align-middle text-right font-mono font-medium text-xs">
                              {formatINR(calcLineSubtotal(line))}
                            </td>

                            {/* Column 9: GST Rate */}
                            <td className="py-3 px-3 align-middle">
                              <Select
                                value={line.gstPercent}
                                onValueChange={(val) => updateLine(line.key, { gstPercent: val })}
                              >
                                <SelectTrigger className="text-xs h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {GST_RATES.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>

                            {/* Column 10: Line Total */}
                            <td className="py-3 px-3 align-middle text-right font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                              {formatINR(calcLineTotal(line))}
                            </td>

                            {/* Column 11: Actions */}
                            <td className="py-3 px-3 align-middle text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  onClick={() => duplicateLine(line)}
                                  title="Duplicate Row"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => removeLine(line.key)}
                                  disabled={lines.length === 1}
                                  title="Remove Row"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                          {targetLineKey === line.key ? (
                            <tr>
                              <td colSpan={11} className="bg-muted/10 border-b p-3">
                                {productPanelContent}
                              </td>
                            </tr>
                          ) : null}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Footer */}
                  <div className="border-t bg-muted/30 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground">Total Formulations: </span>
                        <strong>{lines.length}</strong>
                      </div>
                      <div className="h-4 w-px bg-border" />
                      <div>
                        <span className="text-muted-foreground">Total Batch Units: </span>
                        <strong className="font-mono">{lines.reduce((acc, l) => acc + (Number(l.quantity) || 0), 0)} Units</strong>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-right">
                      <div className="text-xs space-y-0.5">
                        <div className="text-muted-foreground">
                          Taxable Subtotal: <strong className="text-foreground font-mono">{formatINR(subtotal)}</strong>
                        </div>
                        <div className="text-muted-foreground">
                          Total GST Tax: <strong className="text-foreground font-mono">{formatINR(totalTax)}</strong>
                        </div>
                      </div>
                      <div className="border-l pl-6">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                          Grand Total (INR)
                        </div>
                        <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                          {formatINR(grandTotal)}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setActiveStep('customer')}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to Customer
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (!linesComplete) {
                      flash('Please select formulations and enter order quantities for all lines', 'error')
                      return
                    }
                    setActiveStep('details')
                  }}
                  disabled={!linesComplete}
                >
                  Continue to Packaging & R&D <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}

          {/* ======================================================== */}
          {/* STEP 3: PACKAGING, R&D & DELIVERY REQUIREMENTS */}
          {/* ======================================================== */}
          {activeStep === 'details' ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layers className="h-5 w-5 text-primary" />
                    Packaging & Artwork Specifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label>Primary Packaging Type</Label>
                      <Select value={packagingType} onValueChange={setPackagingType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PACKAGING_TYPES.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label>Packaging Material (PM) Sourced By</Label>
                      <Select value={pmSource} onValueChange={(v: any) => setPmSource(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dermat">Dermat India Sourced</SelectItem>
                          <SelectItem value="client">Client / Party Supplied</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label>Artwork & Label Requirement</Label>
                      <Select value={artworkRequirement} onValueChange={(v: any) => setArtworkRequirement(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="client">Client Provided Artwork</SelectItem>
                          <SelectItem value="in_house">In-House Design Studio</SelectItem>
                          <SelectItem value="approved">Existing Approved Artwork</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FlaskConical className="h-5 w-5 text-primary" />
                    R&D / Sampling Requirement
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox
                      checked={sampleRequired}
                      onCheckedChange={(checked) => setSampleRequired(checked === true)}
                    />
                    R&D Sample / Lab Trial Required Before Full Batch Production
                  </label>

                  {sampleRequired ? (
                    <div className="rounded-lg border bg-muted/20 p-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label>Sample Quantity (Pcs/Units)</Label>
                        <Input
                          type="number"
                          min={1}
                          value={sampleQty}
                          onChange={(e) => setSampleQty(e.target.value)}
                          placeholder="2"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Sample Due Date</Label>
                        <Input
                          type="date"
                          value={sampleDueDate}
                          onChange={(e) => setSampleDueDate(e.target.value)}
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-1">
                    <Label>Order Notes & Special Production Instructions</Label>
                    <Textarea
                      rows={3}
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="e.g. Specific fragrance concentration, outer carton bundling instructions, batch code formatting..."
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    Payment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox
                      checked={advanceRequired}
                      onCheckedChange={(checked) => setAdvanceRequired(checked === true)}
                    />
                    Advance Payment Required Before Order Is Verified/Official
                  </label>

                  {advanceRequired ? (
                    <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold">Advance Money (₹)</Label>
                            {grandTotal > 0 && advanceAmount ? (
                              <span className="text-[10px] font-semibold text-primary">
                                {Math.round((Number(advanceAmount) / grandTotal) * 100)}%
                              </span>
                            ) : null}
                          </div>
                          <Input
                            type="number"
                            min={0}
                            value={advanceAmount}
                            onChange={(e) => {
                              const val = e.target.value
                              setAdvanceAmount(val)
                              if (grandTotal > 0 && val) {
                                setAdvancePercent(String(Math.round((Number(val) / grandTotal) * 100)))
                              }
                            }}
                            placeholder={grandTotal > 0 ? String(Math.round((grandTotal * (Number(advancePercent) || 40)) / 100)) : 'e.g. 50000'}
                            className="font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs font-semibold">Advance %</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={advancePercent}
                            onChange={(e) => {
                              const val = e.target.value
                              setAdvancePercent(val)
                              if (grandTotal > 0 && val) {
                                setAdvanceAmount(String(Math.round((grandTotal * Number(val)) / 100)))
                              }
                            }}
                            placeholder="40"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs font-semibold">Payment Reference / UTR #</Label>
                          <Input
                            value={paymentRef}
                            onChange={(e) => setPaymentRef(e.target.value)}
                            placeholder="UTR / cheque no. (optional)"
                          />
                        </div>
                      </div>

                      {/* Quick fill presets */}
                      {grandTotal > 0 ? (
                        <div className="flex items-center gap-2 flex-wrap pt-0.5">
                          <span className="text-xs text-muted-foreground font-medium">Quick Presets:</span>
                          {[
                            { label: '25%', pct: 0.25 },
                            { label: '40%', pct: 0.40 },
                            { label: '50%', pct: 0.50 },
                            { label: '100% (Full)', pct: 1.0 },
                          ].map((p) => {
                            const amt = Math.round(grandTotal * p.pct)
                            return (
                              <button
                                key={p.label}
                                type="button"
                                onClick={() => {
                                  setAdvancePercent(String(Math.round(p.pct * 100)))
                                  setAdvanceAmount(String(amt))
                                }}
                                className="text-xs px-2.5 py-1 rounded bg-background hover:bg-muted border border-border text-foreground font-medium transition-colors"
                              >
                                {p.label} (₹{amt.toLocaleString('en-IN')})
                              </button>
                            )
                          })}
                        </div>
                      ) : null}

                      <label className="flex items-center gap-2 text-sm pt-1">
                        <Checkbox
                          checked={advanceReceivedNow}
                          onCheckedChange={(checked) => {
                            const next = checked === true
                            setAdvanceReceivedNow(next)
                            if (next && !advanceReceivedDate) {
                              setAdvanceReceivedDate(new Date().toISOString().slice(0, 10))
                            }
                          }}
                        />
                        Advance already received from client
                      </label>

                      {advanceReceivedNow ? (
                        <div className="space-y-1 max-w-xs">
                          <Label className="text-xs">Advance Received Date</Label>
                          <Input
                            type="date"
                            value={advanceReceivedDate}
                            onChange={(e) => setAdvanceReceivedDate(e.target.value)}
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          If advance is not yet received, the order will wait in the Advance stage and you can record the exact money received when verifying the order.
                        </p>
                      )}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <div className="flex items-center justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setActiveStep('lines')}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to Products
                </Button>
                <Button type="button" onClick={() => setActiveStep('review')}>
                  Review & Book Order <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}

          {/* ======================================================== */}
          {/* STEP 4: REVIEW & CONFIRM ORDER */}
          {/* ======================================================== */}
          {activeStep === 'review' ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    Order Summary & Verification
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Customer & Header Summary */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-lg border bg-muted/20 p-4 text-xs">
                    <div className="space-y-1">
                      <div className="text-muted-foreground uppercase tracking-wide font-semibold text-[10px]">Customer Details</div>
                      <div className="text-sm font-bold">{selectedCustomer?.displayName}</div>
                      {selectedCustomer?.gstin ? <div>GST: {selectedCustomer.gstin}</div> : null}
                      {selectedCustomer?.phone ? <div>Phone: {selectedCustomer.phone}</div> : null}
                      {selectedCustomer?.address ? <div>Address: {selectedCustomer.address}</div> : null}
                    </div>
                    <div className="space-y-1 sm:text-right">
                      <div className="text-muted-foreground uppercase tracking-wide font-semibold text-[10px]">Commercial Terms</div>
                      <div>Order Date: <strong>{orderDate}</strong></div>
                      <div>Delivery Target: <strong>{deliveryDate}</strong></div>
                      {customerPoRef ? <div>PO Ref: <strong>{customerPoRef}</strong></div> : null}
                      <div>Type: <StatusBadge variant="neutral">{orderType}</StatusBadge> Priority: <StatusBadge variant={priority === 'Urgent' ? 'error' : 'neutral'}>{priority}</StatusBadge></div>
                    </div>
                  </div>

                  {/* Lines Summary Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground uppercase font-semibold text-[10px]">
                          <th className="py-2">Item</th>
                          <th className="py-2">Category</th>
                          <th className="py-2">Pack</th>
                          <th className="py-2">Qty</th>
                          <th className="py-2">Rate</th>
                          <th className="py-2">GST</th>
                          <th className="py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {lines.map((l) => (
                          <tr key={l.key}>
                            <td className="py-2.5 font-medium">
                              <div>{l.productLabel || 'Custom Formulation'}</div>
                              <div className="text-[11px] text-muted-foreground">
                                Brand: <strong>{l.brandName || selectedCustomer?.displayName}</strong>
                              </div>
                            </td>
                            <td className="py-2.5">{l.category || 'Serum'}</td>
                            <td className="py-2.5">{l.packSize} {l.uom}</td>
                            <td className="py-2.5 font-semibold">{l.quantity}</td>
                            <td className="py-2.5">{formatINR(Number(l.rate) || 0)}</td>
                            <td className="py-2.5">{l.gstPercent}%</td>
                            <td className="py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                              {formatINR(calcLineTotal(l))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Specifications Summary */}
                  <div className="rounded-lg border p-3 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2 bg-background">
                    <div>
                      <span className="text-muted-foreground">Packaging:</span>
                      <div className="font-semibold">{packagingType}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">PM Source:</span>
                      <div className="font-semibold">{pmSource === 'dermat' ? 'Dermat India' : 'Client Supplied'}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Artwork:</span>
                      <div className="font-semibold">{artworkRequirement}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">R&D Lab Trial:</span>
                      <div className="font-semibold">{sampleRequired ? `Yes (${sampleQty} pcs by ${sampleDueDate})` : 'No'}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Advance:</span>
                      <div className="font-semibold">
                        {advanceRequired
                          ? `${advancePercent}% ${advanceReceivedNow ? `(received ${formatINR(Math.round((grandTotal * (Number(advancePercent) || 0)) / 100))})` : '(pending)'}`
                          : 'Not required'}
                      </div>
                    </div>
                  </div>

                  {/* Grand Totals */}
                  <div className="rounded-xl border bg-primary/5 p-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">Total Payable (INR)</div>
                      <div className="text-xs text-muted-foreground">Includes {formatINR(totalTax)} GST</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                        {formatINR(grandTotal)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setActiveStep('details')}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to Specifications
                </Button>
                <Button
                  type="button"
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? 'Booking Order...' : 'Confirm & Book Order'}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </PageBody>
    </Page>
  )
}
