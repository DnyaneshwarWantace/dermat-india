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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@open-mercato/ui/primitives/dialog'
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

const VARIANT_NAME_OPTIONS = [
  { value: 'Standard', label: 'Standard' },
  { value: 'Small', label: 'Small / Travel (15-30ml)' },
  { value: 'Medium', label: 'Medium (50ml)' },
  { value: 'Large', label: 'Large (100ml+)' },
  { value: 'Mini', label: 'Mini' },
  { value: 'Sample', label: 'Lab Sample (5-10ml)' },
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
  customerName?: string | null
  clientBrand?: string | null
  minFloorQty?: number | null
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

  // Inline Product / Formulation Dialog state
  const [newProductDialogOpen, setNewProductDialogOpen] = React.useState(false)
  const [targetLineKey, setTargetLineKey] = React.useState<string | null>(null)
  const [prodModalMode, setProdModalMode] = React.useState<'existing' | 'new'>('existing')
  const [selectedExistingProdId, setSelectedExistingProdId] = React.useState<string>('')
  const [variantMode, setVariantMode] = React.useState<'existing' | 'new_variant'>('existing')
  const [selectedExistingVariantId, setSelectedExistingVariantId] = React.useState<string>('Standard')
  const [existingVariants, setExistingVariants] = React.useState<
    Array<{ id: string; name: string; sku?: string | null; packSize?: string; uom?: string; mrp?: string; rate?: string | null; shelfLife?: string; isDefault?: boolean }>
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
                customerName: cf.customer_name || meta.customer_name || null,
                clientBrand: cf.client_brand || meta.client_brand || null,
                minFloorQty: cf.min_floor_qty || meta.min_floor_qty || null,
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
          setSelectedExistingVariantId(mapped[0].id)
          setNewProdVariantName(mapped[0].name)
          setNewProdPackSize(mapped[0].packSize || '50')
          setNewProdUom(mapped[0].uom || 'ml')
          setNewProdMrp(mapped[0].mrp || '599')
          if (mapped[0].rate) setNewProdRate(mapped[0].rate)
          if (mapped[0].gstPercent) setNewProdGstPercent(mapped[0].gstPercent)
          if (mapped[0].shelfLife) setNewProdShelfLife(mapped[0].shelfLife)
        }
      } else {
        setExistingVariants([{ id: 'Standard', name: 'Standard (50ml)', packSize: '50', uom: 'ml', mrp: '599', gstPercent: '18', shelfLife: '24 Months' }])
        setSelectedExistingVariantId('Standard')
      }
    } catch {
      setExistingVariants([{ id: 'Standard', name: 'Standard (50ml)', packSize: '50', uom: 'ml', mrp: '599', gstPercent: '18', shelfLife: '24 Months' }])
      setSelectedExistingVariantId('Standard')
    } finally {
      setLoadingVariants(false)
    }
  }, [])

  // Open inline formulation dialog (supports both existing catalog formulation and new recipe modes)
  const openNewProductDialog = React.useCallback(
    (lineKey: string, mode: 'existing' | 'new' = 'existing', preselectedProdId?: string) => {
      setTargetLineKey(lineKey)
      const currentLine = lines.find((l) => l.key === lineKey)
      setProdModalMode(mode)

      const effectiveProdId = preselectedProdId || currentLine?.productId || catalogProducts[0]?.id || ''
      setSelectedExistingProdId(effectiveProdId)
      setVariantMode('existing')

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

      setNewProductDialogOpen(true)
    },
    [lines, selectedCustomer, catalogProducts, loadVariantsForProduct]
  )

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
      let variantName = newProdVariantName.trim() || 'Standard'
      let packSize = newProdPackSize.trim()
      let packUom = newProdUom.trim()
      let mrp = newProdMrp.trim()

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

      // Create variant if new variant mode or if creating brand new product
      if (prodModalMode === 'new' || variantMode === 'new_variant') {
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
      } else if (prodModalMode === 'existing' && variantMode === 'existing') {
        const matchedVar = existingVariants.find((v) => v.id === selectedExistingVariantId)
        if (matchedVar) {
          variantName = matchedVar.name
          packSize = matchedVar.packSize || packSize
          packUom = matchedVar.uom || packUom
          mrp = matchedVar.mrp || mrp
        }
      }

      // Attach to active target line
      if (targetLineKey) {
        setLines((prev) =>
          prev.map((l) =>
            l.key === targetLineKey
              ? {
                  ...l,
                  productId,
                  productLabel: productTitle,
                  productCode,
                  category: productCategory || 'Serum',
                  variantSku: variantName || 'Standard',
                  brandName: clientBrand,
                  packSize: packSize || l.packSize || '50',
                  uom: packUom || l.uom || 'ml',
                  quantity: newProdQuantity.trim() || l.quantity || '500',
                  rate: newProdRate.trim() || l.rate || '180',
                  gstPercent: newProdGstPercent.trim() || l.gstPercent || '18',
                  mrp: mrp || l.mrp || '599',
                }
              : l
          )
        )
      }

      flash(
        prodModalMode === 'new'
          ? `New product "${productTitle}" created & attached to order!`
          : `Product "${productTitle}" attached to order!`,
        'success'
      )
      setNewProductDialogOpen(false)
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to save product', 'error')
    } finally {
      setCreatingProduct(false)
    }
  }, [
    prodModalMode,
    selectedExistingProdId,
    variantMode,
    selectedExistingVariantId,
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
                      onClick={() => openNewProductDialog(lines[0]?.key || '', 'existing')}
                      className="text-xs"
                    >
                      <PackageCheck className="mr-1.5 h-3.5 w-3.5 text-primary" />
                      Select Product / Variant
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openNewProductDialog(lines[0]?.key || '', 'new')}
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
                          <tr key={line.key} className="hover:bg-muted/20 transition-colors">
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
                                    const matched = catalogProducts.find((p) => p.id === val)
                                    updateLine(line.key, {
                                      productId: val,
                                      productLabel: matched?.title ?? '',
                                      productCode: matched?.sku || '',
                                      category: matched?.category || line.category || 'Serum',
                                      uom: matched?.baseUom || line.uom || 'ml',
                                      brandName: matched?.clientBrand || line.brandName || selectedCustomer?.displayName || '',
                                      variantSku: 'Standard',
                                    })
                                  }}
                                >
                                  <SelectTrigger className="text-xs h-8">
                                    <SelectValue placeholder="Select product from Catalog…" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-64">
                                    {catalogProducts.map((p) => (
                                      <SelectItem key={p.id} value={p.id} className="text-xs">
                                        <div className="flex flex-col">
                                          <span className="font-medium">{p.title}</span>
                                          <span className="text-[10px] text-muted-foreground">
                                            {p.sku ? `SKU: ${p.sku}` : ''} {p.category ? `• ${p.category}` : ''} {p.clientBrand ? `• Brand: ${p.clientBrand}` : ''}
                                          </span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                <div className="flex items-center justify-between text-[11px] gap-2">
                                  {line.productCode ? (
                                    <span className="font-mono text-muted-foreground text-[10px] truncate max-w-[120px]">
                                      Code: {line.productCode}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground text-[10px]">Custom Item</span>
                                  )}
                                  <div className="flex items-center gap-2">
                                    {line.productId ? (
                                      <button
                                        type="button"
                                        onClick={() => openNewProductDialog(line.key, 'existing', line.productId)}
                                        className="text-primary hover:underline text-[10px] font-medium inline-flex items-center gap-1"
                                      >
                                        <Boxes className="h-2.5 w-2.5 text-primary" />
                                        Select / Add Variant
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={() => openNewProductDialog(line.key, 'new')}
                                      className="text-amber-600 dark:text-amber-400 hover:underline text-[10px] font-medium inline-flex items-center gap-1"
                                    >
                                      <Sparkles className="h-2.5 w-2.5" />
                                      + New Product
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Column 3: Client Brand */}
                            <td className="py-3 px-3 align-middle">
                              <Input
                                value={line.brandName}
                                onChange={(e) => updateLine(line.key, { brandName: e.target.value })}
                                placeholder={selectedCustomer?.displayName || 'Brand Name'}
                                className="text-xs h-8"
                              />
                            </td>

                            {/* Column 4: Category */}
                            <td className="py-3 px-3 align-middle">
                              <Select
                                value={line.category}
                                onValueChange={(val) => updateLine(line.key, { category: val })}
                              >
                                <SelectTrigger className="text-xs h-8">
                                  <SelectValue placeholder="Category" />
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

                            {/* Column 5: Pack Size & UOM */}
                            <td className="py-3 px-3 align-middle">
                              <div className="flex items-center gap-1">
                                <Input
                                  value={line.packSize}
                                  onChange={(e) => updateLine(line.key, { packSize: e.target.value })}
                                  placeholder="50"
                                  className="text-xs h-8 w-16 text-center"
                                />
                                <Select
                                  value={line.uom}
                                  onValueChange={(val) => updateLine(line.key, { uom: val })}
                                >
                                  <SelectTrigger className="text-xs h-8 w-20">
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

        {/* ======================================================== */}
        {/* INLINE CREATE PRODUCT FORMULATION DIALOG */}
        {/* ======================================================== */}
        {/* ======================================================== */}
        {/* INLINE PRODUCT & VARIATION SELECTION / CREATION DIALOG */}
        {/* ======================================================== */}
        <Dialog open={newProductDialogOpen} onOpenChange={setNewProductDialogOpen}>
          <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between gap-2">
                <DialogTitle className="flex items-center gap-2 text-lg">
                  {prodModalMode === 'existing' ? (
                    <>
                      <PackageCheck className="h-5 w-5 text-primary" />
                      Select Product & Variation
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 text-amber-500" />
                      Create New Product
                    </>
                  )}
                </DialogTitle>
              </div>
              <p className="text-xs text-muted-foreground">
                {prodModalMode === 'existing'
                  ? 'Choose an available product from the catalog, pick an existing variation or add a new variation, and attach it to your order.'
                  : 'Register a brand-new product in the master catalog and attach it to your active order line.'}
              </p>
            </DialogHeader>

            <div className="space-y-4 py-2">
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
                        {catalogProducts.length} Available in Catalog
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
                          {catalogProducts.map((p) => (
                            <SelectItem key={p.id} value={p.id} className="text-xs py-2">
                              <div className="flex flex-col">
                                <span className="font-semibold text-foreground">{p.title}</span>
                                <span className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                                  {p.sku ? <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">SKU: {p.sku}</span> : null}
                                  {p.category ? <span>• {p.category}</span> : null}
                                  {p.clientBrand ? <span>• Brand: {p.clientBrand}</span> : null}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
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

                  {/* VARIANT CONFIGURATION (EXISTING VS NEW VARIANT) */}
                  <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div className="flex items-center gap-2">
                        <Boxes className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                          2. Pack Size & Variation Choice
                        </h3>
                      </div>

                      {/* Variant Sub-mode toggle */}
                      <SegmentedControl
                        value={variantMode}
                        onValueChange={(val: any) => setVariantMode(val)}
                        className="text-xs"
                      >
                        <SegmentedControlItem value="existing" className="text-[11px] px-3 py-1">
                          Use Existing Variation
                        </SegmentedControlItem>
                        <SegmentedControlItem value="new_variant" className="text-[11px] px-3 py-1">
                          + Add New Variation
                        </SegmentedControlItem>
                      </SegmentedControl>
                    </div>

                    {variantMode === 'existing' ? (
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium">Select Variation</Label>
                            <span className="text-[11px] text-muted-foreground">{existingVariants.length} variation(s) available</span>
                          </div>

                          {loadingVariants ? (
                            <div className="text-xs text-muted-foreground py-3 font-mono text-center bg-background rounded border">
                              Loading product variations...
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                              {existingVariants.map((v) => {
                                const isSelected = selectedExistingVariantId === v.id
                                return (
                                  <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedExistingVariantId(v.id)
                                      setNewProdVariantName(v.name)
                                      setNewProdPackSize(v.packSize || '50')
                                      setNewProdUom(v.uom || 'ml')
                                      setNewProdMrp(v.mrp || '599')
                                      if (v.rate) setNewProdRate(v.rate)
                                      if (v.gstPercent) setNewProdGstPercent(v.gstPercent)
                                      if (v.shelfLife) setNewProdShelfLife(v.shelfLife)
                                    }}
                                    className={`text-left p-2.5 rounded-lg border transition-all flex flex-col gap-1 cursor-pointer ${
                                      isSelected
                                        ? 'border-primary bg-primary/10 ring-1 ring-primary shadow-xs'
                                        : 'border-border bg-background hover:bg-muted/40'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                                        <Boxes className="h-3.5 w-3.5 text-primary" />
                                        {v.name}
                                      </span>
                                      {v.isDefault ? (
                                        <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded border border-emerald-200">
                                          Default
                                        </span>
                                      ) : null}
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-0.5">
                                      <span className="font-semibold bg-muted px-1.5 py-0.5 rounded text-foreground font-mono text-[11px]">
                                        {v.packSize} {v.uom}
                                      </span>
                                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                        MRP: ₹{v.mrp || '—'}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-0.5">
                                      {v.rate ? (
                                        <span>Rate: <strong className="text-foreground">₹{v.rate}</strong></span>
                                      ) : <span />}
                                      <span className="font-mono bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-1.5 py-0.2 rounded font-medium">
                                        GST: {v.gstPercent || '18'}%
                                      </span>
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-4 gap-2 text-xs bg-background p-2.5 rounded border">
                          <div>
                            <span className="text-muted-foreground text-[10px]">Selected Pack:</span>{' '}
                            <strong>{newProdPackSize} {newProdUom}</strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-[10px]">MRP:</span>{' '}
                            <strong className="font-mono text-emerald-600 dark:text-emerald-400">₹{newProdMrp || '599'}</strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-[10px]">GST Rate:</span>{' '}
                            <strong className="font-mono text-blue-600 dark:text-blue-400">{newProdGstPercent || '18'}%</strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-[10px]">Variant:</span>{' '}
                            <strong>{newProdVariantName || 'Standard'}</strong>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Add New Variant Fields */
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className="space-y-1">
                            <Label className="text-xs">New Variant Name</Label>
                            <Select value={newProdVariantName} onValueChange={setNewProdVariantName}>
                              <SelectTrigger className="text-xs bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {VARIANT_NAME_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Pack Size *</Label>
                            <Input
                              value={newProdPackSize}
                              onChange={(e) => setNewProdPackSize(e.target.value)}
                              placeholder="50"
                              className="text-xs text-center font-mono bg-background"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Pack UOM</Label>
                            <Select value={newProdUom} onValueChange={setNewProdUom}>
                              <SelectTrigger className="text-xs bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {UOM_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Declared MRP (₹)</Label>
                            <Input
                              type="number"
                              min={0}
                              value={newProdMrp}
                              onChange={(e) => setNewProdMrp(e.target.value)}
                              placeholder="599"
                              className="text-xs font-mono bg-background"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Wholesale Rate (₹)</Label>
                            <Input
                              type="number"
                              min={0}
                              value={newProdRate}
                              onChange={(e) => setNewProdRate(e.target.value)}
                              placeholder="180"
                              className="text-xs font-mono bg-background"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">GST Rate (%)</Label>
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

                          <div className="space-y-1 sm:col-span-3">
                            <Label className="text-xs">Shelf Life</Label>
                            <Input
                              value={newProdShelfLife}
                              onChange={(e) => setNewProdShelfLife(e.target.value)}
                              placeholder="24 Months"
                              className="text-xs bg-background"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* ======================================================== */
                /* MODE 2: CREATE BRAND NEW PRODUCT */
                /* ======================================================== */
                <div className="space-y-4">
                  {/* PRODUCT & CATALOG DETAILS */}
                  <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center gap-2 border-b pb-2">
                      <Package className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                        1. Product Details
                      </h3>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Product Name *</Label>
                      <Input
                        value={newProdTitle}
                        onChange={(e) => setNewProdTitle(e.target.value)}
                        placeholder="e.g. 10% Niacinamide Face Serum with Zinc PCA"
                        className="text-xs bg-background"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Product Code / SKU</Label>
                        <Input
                          value={newProdCode}
                          onChange={(e) => setNewProdCode(e.target.value)}
                          placeholder="e.g. DER-FORM-NIA-01"
                          className="text-xs font-mono bg-background"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Category</Label>
                        <Select value={newProdCategory} onValueChange={setNewProdCategory}>
                          <SelectTrigger className="text-xs bg-background">
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
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Minimum Batch MOQ (Units)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={newProdMinFloorQty}
                          onChange={(e) => setNewProdMinFloorQty(e.target.value)}
                          placeholder="500"
                          className="text-xs font-mono bg-background"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Base UOM</Label>
                        <Select value={newProdBaseUom} onValueChange={setNewProdBaseUom}>
                          <SelectTrigger className="text-xs bg-background">
                            <SelectValue placeholder="Select unit..." />
                          </SelectTrigger>
                          <SelectContent>
                            {UOM_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Description & Specifications</Label>
                      <Textarea
                        value={newProdDescription}
                        onChange={(e) => setNewProdDescription(e.target.value)}
                        rows={2}
                        placeholder="Active ingredients (e.g. 10% Niacinamide, 1% Zinc PCA), target texture, packaging details..."
                        className="text-xs bg-background"
                      />
                    </div>
                  </div>

                  {/* VARIANT & PACKAGING DETAILS */}
                  <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center gap-2 border-b pb-2">
                      <Boxes className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                        2. Pack Size & Variation Configuration
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Variant Name</Label>
                        <Select value={newProdVariantName} onValueChange={setNewProdVariantName}>
                          <SelectTrigger className="text-xs bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VARIANT_NAME_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Pack Size</Label>
                        <Input
                          value={newProdPackSize}
                          onChange={(e) => setNewProdPackSize(e.target.value)}
                          placeholder="50"
                          className="text-xs text-center font-mono bg-background"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Pack UOM</Label>
                        <Select value={newProdUom} onValueChange={setNewProdUom}>
                          <SelectTrigger className="text-xs bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {UOM_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Declared MRP (₹)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={newProdMrp}
                          onChange={(e) => setNewProdMrp(e.target.value)}
                          placeholder="599"
                          className="text-xs font-mono bg-background"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Wholesale Rate (₹)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={newProdRate}
                          onChange={(e) => setNewProdRate(e.target.value)}
                          placeholder="180"
                          className="text-xs font-mono bg-background"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">GST Rate (%)</Label>
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

                      <div className="space-y-1 sm:col-span-3">
                        <Label className="text-xs">Shelf Life</Label>
                        <Input
                          value={newProdShelfLife}
                          onChange={(e) => setNewProdShelfLife(e.target.value)}
                          placeholder="24 Months"
                          className="text-xs bg-background"
                        />
                      </div>
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

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewProductDialogOpen(false)}
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
                    : variantMode === 'new_variant'
                      ? 'Add Variant & Apply to Order'
                      : 'Apply Product to Order'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageBody>
    </Page>
  )
}
