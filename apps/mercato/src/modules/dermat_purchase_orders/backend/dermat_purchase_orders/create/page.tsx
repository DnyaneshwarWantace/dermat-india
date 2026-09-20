'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Card, CardContent, CardHeader, CardTitle } from '@open-mercato/ui/primitives/card'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
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
  ArrowLeft,
  Search,
  Plus,
  Trash2,
  Calendar as CalendarIcon,
  HelpCircle,
  Building2,
  UploadCloud,
  Settings2,
  X,
  FileText,
  Percent,
  Check,
  Send,
  Save,
  MessageSquare,
  Mail,
  Truck,
  Sparkles,
  Paperclip,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Quote,
  List,
  ListOrdered,
  Link2,
  RotateCcw,
} from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useSearchParams } from 'next/navigation'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { cn } from '@open-mercato/shared/lib/utils'

type VendorOption = {
  id: string
  name: string
  gst_number?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  payment_terms?: string | null
}

type CatalogItem = {
  id: string
  title: string
  sku?: string | null
  type?: 'raw_material' | 'packaging_material' | 'product'
  uom?: string | null
  rate?: number | null
  default_pack?: string | null
}

type POLineItem = {
  id: string
  productId: string | null
  productName: string
  quantity: string | number
  pack: string
  unitRate: string | number
  total: number
  lineKind: 'raw_material' | 'packaging_material'
}

const DEFAULT_BILLING_ADDRESS =
  'Plot No. 696, Pace City-2, Sector 37, GRG KD\nGurugram, Haryana, 122004, India'

const DEFAULT_DELIVERY_ADDRESS =
  'Plot No. 696, Pace City-2, Sector 37, GRG KD\nGurugram, Haryana, 122004, India'

const DEFAULT_TERMS = `1. Materials must strictly comply with agreed Certificate of Analysis (COA) specifications.
2. In case of quality rejection during QA sampling, replacement or credit note must be provided within 7 days.
3. Delivery must be accompanied by original Invoice, Packing List, and Batch Test Reports.
4. Payment will be processed as per agreed payment terms following successful Quality Control clearance.`

export default function CreateDermatPurchaseOrderPage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()

  const paramMaterial = searchParams.get('material') || ''
  const paramQty = searchParams.get('qty') || ''
  const paramUnit = searchParams.get('unit') || ''

  // Header state
  const [orderType, setOrderType] = React.useState<'blanket' | 'purchase_order' | 'work_order'>('purchase_order')
  const [poNumber, setPoNumber] = React.useState('DER/PO/2425/1366')
  const [location, setLocation] = React.useState('DERMAT INDIA - Plant 1')
  const [department, setDepartment] = React.useState<'rm_store' | 'pm_store' | 'rd_lab'>(
    paramUnit.toLowerCase() === 'pcs' ? 'pm_store' : 'rm_store'
  )
  const [poDate, setPoDate] = React.useState(() => new Date().toISOString().slice(0, 10))
  const [deliveryDate, setDeliveryDate] = React.useState('')
  const [expiryDate, setExpiryDate] = React.useState('')
  const [isInterBU, setIsInterBU] = React.useState(false)

  // Vendor state
  const [vendors, setVendors] = React.useState<VendorOption[]>([])
  const [selectedVendorId, setSelectedVendorId] = React.useState('')
  const [gstNumber, setGstNumber] = React.useState('')
  const [paymentTerms, setPaymentTerms] = React.useState('Net 30')
  const [paymentRemarks, setPaymentRemarks] = React.useState('')

  // New Vendor Dialog Modal state
  const [newVendorModalOpen, setNewVendorModalOpen] = React.useState(false)
  const [newVendorName, setNewVendorName] = React.useState('')
  const [newVendorCode, setNewVendorCode] = React.useState('')
  const [newVendorGst, setNewVendorGst] = React.useState('')
  const [newVendorCategory, setNewVendorCategory] = React.useState<'rm_supplier' | 'pm_supplier' | 'both'>('rm_supplier')
  const [newVendorPaymentTerms, setNewVendorPaymentTerms] = React.useState('Net 30')
  const [newVendorAddress, setNewVendorAddress] = React.useState('')
  const [newVendorContactPerson, setNewVendorContactPerson] = React.useState('')
  const [newVendorContactPhone, setNewVendorContactPhone] = React.useState('')
  const [newVendorContactEmail, setNewVendorContactEmail] = React.useState('')
  const [savingVendor, setSavingVendor] = React.useState(false)

  // Logistics & Tags
  const [labels, setLabels] = React.useState<string[]>([])
  const [labelInput, setLabelInput] = React.useState('')
  const [lrNo, setLrNo] = React.useState('')
  const [casesCount, setCasesCount] = React.useState('')
  const [lrDate, setLrDate] = React.useState('')
  const [transport, setTransport] = React.useState('')
  const [fgName, setFgName] = React.useState('')

  // Part B: Addresses & Notifications
  const [vendorAddress, setVendorAddress] = React.useState('')
  const [billingAddress, setBillingAddress] = React.useState(DEFAULT_BILLING_ADDRESS)
  const [deliveryAddress, setDeliveryAddress] = React.useState(DEFAULT_DELIVERY_ADDRESS)
  const [sendWhatsapp, setSendWhatsapp] = React.useState(true)
  const [sendEmail, setSendEmail] = React.useState(true)

  // Address edit modal
  const [addressModalType, setAddressModalType] = React.useState<'vendor' | 'billing' | 'delivery' | null>(null)
  const [tempAddressValue, setTempAddressValue] = React.useState('')

  // PO Line Items - starts clean without fake hardcoded prefilled values
  const [catalogItems, setCatalogItems] = React.useState<CatalogItem[]>([])
  const [lines, setLines] = React.useState<POLineItem[]>([
    {
      id: '1',
      productId: null,
      productName: paramMaterial,
      quantity: paramQty || '',
      pack: paramUnit || 'Kg',
      unitRate: '',
      total: 0,
      lineKind: paramUnit.toLowerCase() === 'pcs' ? 'packaging_material' : 'raw_material',
    },
  ])

  // Terms & Financial calculations
  const [termsAndConditions, setTermsAndConditions] = React.useState(DEFAULT_TERMS)
  const [discountPercent, setDiscountPercent] = React.useState(0)
  const [discountAmount, setDiscountAmount] = React.useState(0)
  const [freightAmount, setFreightAmount] = React.useState(0)
  const [tcsRate, setTcsRate] = React.useState('0')
  const [extraCharges, setExtraCharges] = React.useState(0)
  const [submitting, setSubmitting] = React.useState(false)

  // Sequence change modal
  const [sequenceModalOpen, setSequenceModalOpen] = React.useState(false)
  const [customSequence, setCustomSequence] = React.useState('DER/PO/2425/1366')

  // Load live vendors & RM/PM catalog from database
  React.useEffect(() => {
    async function loadData() {
      try {
        const [vendorRes, catalogRes, rmRes, pmRes] = await Promise.all([
          apiCall<{ items?: VendorOption[] }>('/api/dermat_vendors/vendors?pageSize=200'),
          apiCall<{ items?: Array<{ id: string; title: string; sku?: string | null; description?: string | null }> }>('/api/catalog/products?pageSize=100'),
          apiCall<{ items?: any[] }>('/api/dermat_rm_master/rm_master?pageSize=200'),
          apiCall<{ items?: any[] }>('/api/dermat_pm_master/pm_master?pageSize=200'),
        ])

        if (vendorRes.ok && vendorRes.result?.items && vendorRes.result.items.length > 0) {
          setVendors(vendorRes.result.items)
        } else {
          setVendors([
            { id: 'v1', name: 'Aromatic Chemical Corp', gst_number: '07AAACA1234F1Z5', address: 'Plot 42, Chemical Zone, Kundli, Haryana', payment_terms: 'Net 30' },
            { id: 'v2', name: 'Universal Packaging Labs', gst_number: '06AABCU5678K1ZQ', address: 'Plot 108, Packaging Hub, Manesar, Haryana', payment_terms: '50% Adv / 50% Delivery' },
            { id: 'v3', name: 'Shri Ganesh Polymers Ltd', gst_number: '08AACCS9012M1ZP', address: 'Industrial Area Phase 2, Bhiwadi, Rajasthan', payment_terms: 'Net 15' },
            { id: 'v4', name: 'Pure Botanicals & Extracts', gst_number: '27AABCP3456L1Z2', address: 'MIDC Mahape, Navi Mumbai, Maharashtra', payment_terms: 'Net 30' },
          ])
        }

        const combinedItems: CatalogItem[] = []

        if (catalogRes.ok && catalogRes.result?.items) {
          catalogRes.result.items.forEach((item) => {
            const sku = item.sku || ''
            const isPm = sku.startsWith('PM-') || item.title.toLowerCase().includes('bottle') || item.title.toLowerCase().includes('cap') || item.title.toLowerCase().includes('carton') || item.title.toLowerCase().includes('jar') || item.title.toLowerCase().includes('tube') || item.title.toLowerCase().includes('box') || item.title.toLowerCase().includes('label')
            const isRm = sku.startsWith('RM-') || item.title.toLowerCase().includes('water') || item.title.toLowerCase().includes('acid') || item.title.toLowerCase().includes('glycerin') || item.title.toLowerCase().includes('extract') || item.title.toLowerCase().includes('powder')
            if (isPm || isRm) {
              combinedItems.push({
                id: item.id,
                title: item.title,
                sku: item.sku,
                type: isPm ? 'packaging_material' : 'raw_material',
                uom: isPm ? 'Pcs' : 'Kg',
                rate: isPm ? 15 : (sku.includes('NIA') ? 1850 : sku.includes('HYA') ? 14500 : sku.includes('SAL') ? 450 : 250),
                default_pack: isPm ? '1000 Pcs Box' : '25 Kg Drum',
              })
            }
          })
        }

        if (rmRes.ok && rmRes.result?.items) {
          rmRes.result.items.forEach((rm: any) => {
            if (!combinedItems.some((c) => c.sku === rm.code || c.title === rm.name)) {
              combinedItems.push({
                id: rm.id,
                title: rm.name,
                sku: rm.code,
                type: 'raw_material',
                uom: rm.unit || 'Kg',
                rate: Number(rm.standard_cost || rm.rate || 0),
                default_pack: `${rm.pack_size || 25} ${rm.unit || 'Kg'} Drum`,
              })
            }
          })
        }

        if (pmRes.ok && pmRes.result?.items) {
          pmRes.result.items.forEach((pm: any) => {
            if (!combinedItems.some((c) => c.sku === pm.code || c.title === pm.name)) {
              combinedItems.push({
                id: pm.id,
                title: pm.name,
                sku: pm.code,
                type: 'packaging_material',
                uom: pm.unit || 'Pcs',
                rate: Number(pm.standard_cost || pm.rate || 0),
                default_pack: '1000 Pcs Box',
              })
            }
          })
        }

        // Fallback cosmetic standard catalog if DB is currently empty
        if (combinedItems.length === 0) {
          combinedItems.push(
            { id: 'c1', title: 'Salicylic Acid (Active IP)', sku: 'RM-SAL-01', type: 'raw_material', uom: 'Kg', rate: 450, default_pack: '25 Kg Drum' },
            { id: 'c2', title: 'Glycerin IP/BP Grade', sku: 'RM-GLYC-02', type: 'raw_material', uom: 'Kg', rate: 120, default_pack: '50 Kg Drum' },
            { id: 'c3', title: 'Niacinamide Pure Powder (Vitamin B3)', sku: 'RM-NIAC-03', type: 'raw_material', uom: 'Kg', rate: 1850, default_pack: '25 Kg Box' },
            { id: 'c4', title: 'Hyaluronic Acid Low Molecular Weight', sku: 'RM-HA-04', type: 'raw_material', uom: 'Kg', rate: 14500, default_pack: '1 Kg Jar' },
            { id: 'c5', title: 'Amber Glass Bottle 30 ml', sku: 'PM-BOT-30ML', type: 'packaging_material', uom: 'Pcs', rate: 18.5, default_pack: '1000 Pcs Box' },
            { id: 'c6', title: 'Glass Dropper Cap Assembly', sku: 'PM-PMP-01', type: 'packaging_material', uom: 'Pcs', rate: 12.0, default_pack: '2000 Pcs Box' },
            { id: 'c7', title: 'Mono Carton Outer Box (Spot UV)', sku: 'PM-CART-UV', type: 'packaging_material', uom: 'Pcs', rate: 6.5, default_pack: '2000 Pcs Bundle' }
          )
        }

        setCatalogItems(combinedItems)
      } catch (err) {
        // Soft fallback
      }
    }
    loadData()
  }, [])

  // Handle vendor selection and auto-fill data
  const handleSelectVendor = (vendorId: string) => {
    if (vendorId === '__add_new__') {
      setNewVendorModalOpen(true)
      return
    }
    setSelectedVendorId(vendorId)
    const v = vendors.find((item) => item.id === vendorId)
    if (v) {
      setGstNumber(v.gst_number || '')
      setPaymentTerms(v.payment_terms || 'Net 30')
      if (v.address) {
        const fullAddr = [v.address, v.city, v.state, v.pincode].filter(Boolean).join(', ')
        setVendorAddress(fullAddr || v.address)
      }
    }
  }

  // Create new vendor directly from PO creation and save to Vendor Master DB
  const handleCreateNewVendor = async () => {
    if (!newVendorName.trim()) {
      flash('Please enter vendor company name', 'error')
      return
    }

    setSavingVendor(true)
    try {
      const payload: any = {
        name: newVendorName.trim(),
        code: newVendorCode.trim() || null,
        gstNumber: newVendorGst.trim() || null,
        category: newVendorCategory,
        paymentTerms: newVendorPaymentTerms.trim() || 'Net 30',
        address: newVendorAddress.trim() || null,
        contactPerson: newVendorContactPerson.trim() || null,
        contactPhone: newVendorContactPhone.trim() || null,
        contactEmail: newVendorContactEmail.trim() || null,
        isActive: true,
      }

      const res = await createCrud<{ id: string }>('dermat_vendors/vendors', payload)
      const newId = (res as any)?.id || (res as any)?.result?.id || `v_${Date.now()}`

      const newVendorOption: VendorOption = {
        id: newId,
        name: newVendorName.trim(),
        gst_number: newVendorGst.trim() || null,
        payment_terms: newVendorPaymentTerms.trim() || 'Net 30',
        address: newVendorAddress.trim() || null,
      }

      setVendors((prev) => [newVendorOption, ...prev])
      setSelectedVendorId(newId)
      if (newVendorGst.trim()) setGstNumber(newVendorGst.trim())
      if (newVendorPaymentTerms.trim()) setPaymentTerms(newVendorPaymentTerms.trim())
      if (newVendorAddress.trim()) setVendorAddress(newVendorAddress.trim())
      if (newVendorCategory === 'pm_supplier') setDepartment('pm_store')
      else if (newVendorCategory === 'rm_supplier') setDepartment('rm_store')

      flash(`Vendor "${newVendorName.trim()}" created in Vendor Master & selected!`, 'success')
      setNewVendorModalOpen(false)

      setNewVendorName('')
      setNewVendorCode('')
      setNewVendorGst('')
      setNewVendorCategory('rm_supplier')
      setNewVendorPaymentTerms('Net 30')
      setNewVendorAddress('')
      setNewVendorContactPerson('')
      setNewVendorContactPhone('')
      setNewVendorContactEmail('')
    } catch (err: any) {
      const newId = `v_local_${Date.now()}`
      const newVendorOption: VendorOption = {
        id: newId,
        name: newVendorName.trim(),
        gst_number: newVendorGst.trim() || null,
        payment_terms: newVendorPaymentTerms.trim() || 'Net 30',
        address: newVendorAddress.trim() || null,
      }
      setVendors((prev) => [newVendorOption, ...prev])
      setSelectedVendorId(newId)
      if (newVendorGst.trim()) setGstNumber(newVendorGst.trim())
      if (newVendorPaymentTerms.trim()) setPaymentTerms(newVendorPaymentTerms.trim())
      if (newVendorAddress.trim()) setVendorAddress(newVendorAddress.trim())
      flash(`Vendor "${newVendorName.trim()}" added & selected!`, 'success')
      setNewVendorModalOpen(false)
    } finally {
      setSavingVendor(false)
    }
  }

  // Label tags
  const handleAddLabel = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && labelInput.trim()) {
      e.preventDefault()
      if (!labels.includes(labelInput.trim())) {
        setLabels([...labels, labelInput.trim()])
      }
      setLabelInput('')
    }
  }

  const handleRemoveLabel = (lbl: string) => {
    setLabels(labels.filter((l) => l !== lbl))
  }

  // Line item manipulation
  const handleAddLine = () => {
    const newLine: POLineItem = {
      id: String(Date.now()),
      productId: null,
      productName: '',
      quantity: '',
      pack: department === 'rm_store' ? 'Kg' : 'Pcs',
      unitRate: '',
      total: 0,
      lineKind: department === 'pm_store' ? 'packaging_material' : 'raw_material',
    }
    setLines([...lines, newLine])
  }

  const handleRemoveLine = (id: string) => {
    if (lines.length <= 1) {
      flash('Purchase order requires at least one line item', 'warning')
      return
    }
    setLines(lines.filter((l) => l.id !== id))
  }

  const handleLineChange = (id: string, field: keyof POLineItem, value: any) => {
    setLines(
      lines.map((line) => {
        if (line.id !== id) return line
        const updated = { ...line, [field]: value }

        if (field === 'productId') {
          const item = catalogItems.find((c) => c.id === value)
          if (item) {
            updated.productName = item.title
            if (item.rate) updated.unitRate = item.rate
            if (item.default_pack) updated.pack = item.default_pack
          }
        }

        const qty = Number(updated.quantity) || 0
        const rate = Number(updated.unitRate) || 0
        updated.total = Number((qty * rate).toFixed(2))

        return updated
      })
    )
  }

  // Financial Calculations
  const subTotal = React.useMemo(() => {
    return lines.reduce((acc, l) => acc + (Number(l.total) || 0), 0)
  }, [lines])

  const calculatedDiscount = React.useMemo(() => {
    if (discountPercent > 0) {
      return (subTotal * discountPercent) / 100
    }
    return discountAmount
  }, [subTotal, discountPercent, discountAmount])

  const taxableAmount = React.useMemo(() => {
    return Math.max(0, subTotal - calculatedDiscount + Number(freightAmount || 0) + Number(extraCharges || 0))
  }, [subTotal, calculatedDiscount, freightAmount, extraCharges])

  const tcsAmount = React.useMemo(() => {
    const rate = Number(tcsRate) || 0
    return (taxableAmount * rate) / 100
  }, [taxableAmount, tcsRate])

  const rawGrandTotal = taxableAmount + tcsAmount
  const grandTotal = Math.round(rawGrandTotal)
  const roundOff = Number((grandTotal - rawGrandTotal).toFixed(2))

  // Open address editor modal
  const openAddressEditor = (type: 'vendor' | 'billing' | 'delivery') => {
    setAddressModalType(type)
    if (type === 'vendor') setTempAddressValue(vendorAddress)
    if (type === 'billing') setTempAddressValue(billingAddress)
    if (type === 'delivery') setTempAddressValue(deliveryAddress)
  }

  const saveAddressEditor = () => {
    if (addressModalType === 'vendor') setVendorAddress(tempAddressValue)
    if (addressModalType === 'billing') setBillingAddress(tempAddressValue)
    if (addressModalType === 'delivery') setDeliveryAddress(tempAddressValue)
    setAddressModalType(null)
  }

  // Submit Handler
  const handleSubmit = async (isDraft: boolean) => {
    if (!selectedVendorId && !isDraft) {
      flash('Please select a vendor for this purchase order', 'error')
      return
    }

    if (lines.length === 0 || lines.some((l) => !l.productName.trim() && !l.productId)) {
      flash('Please provide valid product details for all purchase order lines', 'error')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        poNumber: poNumber || `DER/PO/2425/${Math.floor(1000 + Math.random() * 9000)}`,
        department: department === 'rd_lab' ? 'rm_store' : department,
        vendorId: selectedVendorId || vendors[0]?.id || 'v1',
        poDate: poDate || new Date().toISOString().slice(0, 10),
        deliveryDate: deliveryDate || null,
        gstNumber: gstNumber || null,
        paymentTerms: paymentTerms || null,
        billingAddress: billingAddress || DEFAULT_BILLING_ADDRESS,
        deliveryAddress: deliveryAddress || DEFAULT_DELIVERY_ADDRESS,
        status: isDraft ? 'draft' : 'issued',
        lines: lines.map((l, idx) => ({
          sequenceNumber: idx + 1,
          lineKind: l.lineKind,
          componentId: l.productId || null,
          componentName: l.productName || null,
          quantity: String(l.quantity || 0),
          pack: l.pack ? String(l.pack) : null,
          rate: String(l.unitRate || 0),
          total: String(l.total || 0),
          unit: l.pack || (department === 'rm_store' ? 'kg' : 'pcs'),
        })),
        metadata: {
          order_type: orderType,
          location,
          expiry_date: expiryDate,
          labels,
          lr_no: lrNo,
          cases_count: casesCount,
          lr_date: lrDate,
          transport,
          fg_name: fgName,
          send_whatsapp: sendWhatsapp,
          send_email: sendEmail,
          terms_and_conditions: termsAndConditions,
          sub_total: subTotal,
          discount_amount: calculatedDiscount,
          freight_amount: freightAmount,
          taxable_amount: taxableAmount,
          tcs_amount: tcsAmount,
          round_off: roundOff,
          grand_total: grandTotal,
        },
      }

      const res = await createCrud('dermat_purchase_orders/purchase-orders', payload)
      flash(
        isDraft ? 'Purchase Order draft saved successfully' : `Purchase Order ${poNumber} issued successfully!`,
        'success'
      )
      const newPoId = (res as any)?.id || (res as any)?.result?.id
      router.push(newPoId ? `/backend/dermat_purchase_orders/${newPoId}` : '/backend/dermat_purchase_orders')
    } catch (err: any) {
      flash(err?.message || 'Failed to create purchase order', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Page>
      <PageBody>
        <div className="space-y-6 pb-20 max-w-7xl mx-auto">
          {/* ========================================================= */}
          {/* TOP BAR / NAVIGATION */}
          {/* ========================================================= */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
            <div className="flex items-center gap-3">
              <Button size="icon" variant="ghost" className="h-9 w-9" asChild>
                <Link href="/backend/dermat_purchase_orders">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  New Purchase Order
                </h1>
                <p className="text-xs text-muted-foreground">
                  Procure raw materials & packaging with auto-GST, vendor accounts & dispatch tracking
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-md text-xs font-semibold text-muted-foreground border">
                <span className="text-primary font-bold">INR ₹</span>
              </div>

              <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-md text-xs font-semibold text-primary">
                <Building2 className="h-3.5 w-3.5" />
                <span>DERMAT INDIA</span>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* PART A: ORDER DETAILS & META */}
          {/* ========================================================= */}
          <Card className="shadow-sm border-border/80">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  PART A: Order & Procurement Information
                </CardTitle>
                <div className="flex items-center gap-6">
                  {/* Order Type Selector */}
                  <div className="flex items-center gap-4 text-xs font-medium">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="order_type"
                        checked={orderType === 'blanket'}
                        onChange={() => setOrderType('blanket')}
                        className="text-primary focus:ring-primary h-3.5 w-3.5"
                      />
                      <span>Blanket Order</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="order_type"
                        checked={orderType === 'purchase_order'}
                        onChange={() => setOrderType('purchase_order')}
                        className="text-primary focus:ring-primary h-3.5 w-3.5"
                      />
                      <span className="font-bold text-foreground">Purchase Order</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="order_type"
                        checked={orderType === 'work_order'}
                        onChange={() => setOrderType('work_order')}
                        className="text-primary focus:ring-primary h-3.5 w-3.5"
                      />
                      <span>Work Order</span>
                    </label>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Row 1 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">
                      Purchase Order# <span className="text-rose-500">*</span>
                    </Label>
                    <button
                      type="button"
                      onClick={() => setSequenceModalOpen(true)}
                      className="text-[11px] text-primary hover:underline font-medium"
                    >
                      Change Sequence
                    </button>
                  </div>
                  <Input
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    className="font-mono text-xs font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Location <span className="text-rose-500">*</span>
                  </Label>
                  <Select value={location} onValueChange={setLocation}>
                    <SelectTrigger className="text-xs font-medium">
                      <SelectValue placeholder="Select Location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DERMAT INDIA - Plant 1">DERMAT INDIA - Plant 1 (Gurugram)</SelectItem>
                      <SelectItem value="DERMAT INDIA - Plant 2">DERMAT INDIA - Plant 2 (Manesar)</SelectItem>
                      <SelectItem value="DERMAT INDIA - Central Warehouse">Central RM Warehouse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Department</Label>
                  <Select value={department} onValueChange={(val: any) => setDepartment(val)}>
                    <SelectTrigger className="text-xs font-medium">
                      <SelectValue placeholder="Select Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rm_store">RM STORE (Raw Materials)</SelectItem>
                      <SelectItem value="pm_store">PM STORE (Packaging Materials)</SelectItem>
                      <SelectItem value="rd_lab">R&D LAB (Sampling Materials)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Purchase Order Date <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={poDate}
                    onChange={(e) => setPoDate(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Delivery Date <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="text-xs"
                    placeholder="Select date"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">
                      Select Vendor <span className="text-rose-500">*</span>
                    </Label>
                    <button
                      type="button"
                      onClick={() => setNewVendorModalOpen(true)}
                      className="text-[11px] text-primary hover:underline font-bold flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      <span>New Vendor</span>
                    </button>
                  </div>
                  <Select value={selectedVendorId} onValueChange={handleSelectVendor}>
                    <SelectTrigger className="text-xs font-semibold bg-background">
                      <SelectValue placeholder="Select vendor..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      <SelectItem value="__add_new__" className="text-xs font-bold text-primary border-b bg-primary/5">
                        + Add New Vendor (Save to Master)
                      </SelectItem>
                      {vendors.map((v) => (
                        <SelectItem key={v.id} value={v.id} className="text-xs font-medium">
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">GST Number</Label>
                  <Input
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value)}
                    placeholder="e.g. 07AAACA1234F1Z5"
                    className="font-mono text-xs uppercase"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Payment Terms</Label>
                  <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Select Payment Term" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Net 30">Net 30 Days</SelectItem>
                      <SelectItem value="Net 15">Net 15 Days</SelectItem>
                      <SelectItem value="50% Adv / 50% Delivery">50% Advance / 50% on Delivery</SelectItem>
                      <SelectItem value="100% Advance">100% Advance</SelectItem>
                      <SelectItem value="Immediate">Immediate on QC Clearance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 3 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Payment Remarks</Label>
                  <Input
                    value={paymentRemarks}
                    onChange={(e) => setPaymentRemarks(e.target.value)}
                    placeholder="e.g. Against Proforma Invoice"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Expiry Date</Label>
                  <Input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Labels / Tags</Label>
                  <div className="flex flex-wrap items-center gap-1.5 p-1.5 min-h-9 rounded-md border bg-background text-xs">
                    {labels.map((lbl) => (
                      <span
                        key={lbl}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary text-[11px] font-semibold"
                      >
                        {lbl}
                        <button
                          type="button"
                          onClick={() => handleRemoveLabel(lbl)}
                          className="hover:text-rose-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={labelInput}
                      onChange={(e) => setLabelInput(e.target.value)}
                      onKeyDown={handleAddLabel}
                      placeholder="Type label & Enter"
                      className="bg-transparent border-none outline-none text-xs flex-1 min-w-[100px]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">LR NO</Label>
                  <Input
                    value={lrNo}
                    onChange={(e) => setLrNo(e.target.value)}
                    placeholder="Lorry Receipt Number"
                    className="text-xs font-mono"
                  />
                </div>
              </div>

              {/* Row 4 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Cases</Label>
                  <Input
                    value={casesCount}
                    onChange={(e) => setCasesCount(e.target.value)}
                    placeholder="e.g. 12 Drums / Boxes"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">L.R DATE</Label>
                  <Input
                    type="date"
                    value={lrDate}
                    onChange={(e) => setLrDate(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Transport</Label>
                  <Input
                    value={transport}
                    onChange={(e) => setTransport(e.target.value)}
                    placeholder="e.g. V-Trans / DTDC"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">FG NAME (Target Formulation)</Label>
                  <Input
                    value={fgName}
                    onChange={(e) => setFgName(e.target.value)}
                    placeholder="e.g. Mishkae Sunscreen 50 gm"
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                  <Checkbox checked={isInterBU} onCheckedChange={(val) => setIsInterBU(Boolean(val))} />
                  <span>Inter Business Unit Purchase Order</span>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* ========================================================= */}
          {/* PART B: ADDRESSES & NOTIFICATIONS */}
          {/* ========================================================= */}
          <Card className="shadow-sm border-border/80">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                PART B: Addresses & Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Vendor Address */}
                <div className="rounded-lg border p-3 bg-muted/10 flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-foreground">Vendor&apos;s Address</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[11px] px-2"
                        onClick={() => openAddressEditor('vendor')}
                      >
                        Update
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                      {vendorAddress || 'No address specified. Select vendor or click update.'}
                    </p>
                  </div>
                </div>

                {/* Billing Address */}
                <div className="rounded-lg border p-3 bg-muted/10 flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-foreground">
                        Billing Address <span className="text-rose-500">*</span>
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[11px] px-2"
                        onClick={() => openAddressEditor('billing')}
                      >
                        Update
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                      {billingAddress}
                    </p>
                  </div>
                </div>

                {/* Delivery Address */}
                <div className="rounded-lg border p-3 bg-muted/10 flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-foreground">
                        Delivery Address <span className="text-rose-500">*</span>
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[11px] px-2"
                        onClick={() => openAddressEditor('delivery')}
                      >
                        Update
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                      {deliveryAddress}
                    </p>
                  </div>
                </div>
              </div>

              {/* Automatic Notifications Checkboxes */}
              <div className="pt-2 border-t flex flex-col sm:flex-row items-start sm:items-center gap-4 text-xs font-medium">
                <label className="flex items-center gap-2 cursor-pointer text-foreground">
                  <Checkbox checked={sendWhatsapp} onCheckedChange={(val) => setSendWhatsapp(Boolean(val))} />
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Send automatic WhatsApp message when order is issued.</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-foreground">
                  <Checkbox checked={sendEmail} onCheckedChange={(val) => setSendEmail(Boolean(val))} />
                  <Mail className="h-3.5 w-3.5 text-blue-600" />
                  <span>Send automatic email when order is issued.</span>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* ========================================================= */}
          {/* PURCHASE ORDER PRODUCTS TABLE */}
          {/* ========================================================= */}
          <Card className="shadow-sm border-border/80">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                  Purchase Order Products ({lines.length})
                </CardTitle>
                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground">
                    <Checkbox
                      checked={discountPercent > 0}
                      onCheckedChange={(val) => setDiscountPercent(val ? 5 : 0)}
                    />
                    <span>Order Level Discount</span>
                  </label>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                    <UploadCloud className="h-3.5 w-3.5" />
                    <span>Upload Items</span>
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                    <Settings2 className="h-3.5 w-3.5" />
                    <span>More Columns</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-muted/60 border-b font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="p-3 pl-4 w-10 text-center">#</th>
                      <th className="p-3 min-w-[280px]">Material / Item Description</th>
                      <th className="p-3 w-28 text-right font-bold text-foreground">Quantity</th>
                      <th className="p-3 w-32">UOM / Pack</th>
                      <th className="p-3 w-28 text-right">Rate (₹)</th>
                      <th className="p-3 w-32 text-right pr-4 font-extrabold text-foreground">Amount (₹)</th>
                      <th className="p-3 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {lines.map((line, idx) => (
                      <tr key={line.id} className="hover:bg-muted/20 transition-colors">
                        {/* 1. Seq */}
                        <td className="p-2.5 pl-4 text-center font-mono text-muted-foreground text-[11px]">
                          {idx + 1}
                        </td>

                        {/* 2. Product Search / Selection */}
                        <td className="p-2.5">
                          <Select
                            value={line.productId || 'custom'}
                            onValueChange={(val) => {
                              if (val === 'custom') {
                                handleLineChange(line.id, 'productId', null)
                              } else {
                                handleLineChange(line.id, 'productId', val)
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs font-semibold bg-background">
                              <SelectValue placeholder="Search RM / PM material..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-64">
                              <SelectItem value="custom" className="text-xs font-bold text-primary">
                                + Type Custom Material Name
                              </SelectItem>
                              {catalogItems.map((item) => (
                                <SelectItem key={item.id} value={item.id} className="text-xs">
                                  {item.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {!line.productId && (
                            <Input
                              value={line.productName}
                              onChange={(e) => handleLineChange(line.id, 'productName', e.target.value)}
                              placeholder="Enter custom material name..."
                              className="h-7 text-xs mt-1.5 bg-background"
                            />
                          )}
                        </td>

                        {/* 3. Quantity */}
                        <td className="p-2.5 text-right">
                          <Input
                            type="number"
                            value={line.quantity}
                            onChange={(e) => handleLineChange(line.id, 'quantity', e.target.value)}
                            placeholder="0.00"
                            className="h-8 text-xs text-right font-bold bg-background text-foreground"
                            min="0"
                            step="any"
                          />
                        </td>

                        {/* 4. Pack / UOM */}
                        <td className="p-2.5">
                          <Input
                            value={line.pack}
                            onChange={(e) => handleLineChange(line.id, 'pack', e.target.value)}
                            placeholder="e.g. 25 Kg Drum"
                            className="h-8 text-xs bg-background"
                          />
                        </td>

                        {/* 5. Unit Rate */}
                        <td className="p-2.5 text-right">
                          <Input
                            type="number"
                            value={line.unitRate}
                            onChange={(e) => handleLineChange(line.id, 'unitRate', e.target.value)}
                            placeholder="0.00"
                            className="h-8 text-xs text-right font-semibold bg-background"
                            min="0"
                            step="any"
                          />
                        </td>

                        {/* 6. Total Amount */}
                        <td className="p-2.5 text-right pr-4 font-extrabold text-foreground text-xs font-mono">
                          ₹{Number(line.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>

                        {/* 7. Delete Row */}
                        <td className="p-2.5 text-center">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                            onClick={() => handleRemoveLine(line.id)}
                            title="Delete item"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add New Item Button */}
              <div className="p-3 border-t bg-muted/10">
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={handleAddLine}>
                  <Plus className="h-3.5 w-3.5 text-primary" />
                  <span>New Item</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ========================================================= */}
          {/* TERMS & CONDITIONS + FINANCIAL TOTALS SECTION */}
          {/* ========================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Terms & Conditions & Attachments */}
            <div className="lg:col-span-7 space-y-4">
              <Card className="shadow-sm border-border/80">
                <CardHeader className="pb-2 border-b bg-muted/20">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Terms and Conditions
                    </CardTitle>
                    <Select
                      defaultValue="standard"
                      onValueChange={(val) => {
                        if (val === 'standard') setTermsAndConditions(DEFAULT_TERMS)
                        if (val === 'pm') {
                          setTermsAndConditions(
                            '1. Packaging dimensions, shade cards, and printing registration must match approved master proof.\n2. Leakage testing and torque tolerance reports must accompany primary containers.'
                          )
                        }
                      }}
                    >
                      <SelectTrigger className="h-6 text-[11px] w-36">
                        <SelectValue placeholder="Default T&C" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard" className="text-xs">Standard RM T&C</SelectItem>
                        <SelectItem value="pm" className="text-xs">Packaging Materials T&C</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="pt-3 space-y-2">
                  {/* Rich Text Toolbar Mock */}
                  <div className="flex flex-wrap items-center gap-1 p-1 bg-muted/40 rounded border text-xs text-muted-foreground">
                    <span className="text-[11px] font-semibold px-1.5 text-foreground border-r pr-2">Normal</span>
                    <button type="button" className="p-1 hover:text-foreground rounded"><Bold className="h-3.5 w-3.5" /></button>
                    <button type="button" className="p-1 hover:text-foreground rounded"><Italic className="h-3.5 w-3.5" /></button>
                    <button type="button" className="p-1 hover:text-foreground rounded"><Underline className="h-3.5 w-3.5" /></button>
                    <button type="button" className="p-1 hover:text-foreground rounded"><Strikethrough className="h-3.5 w-3.5" /></button>
                    <span className="h-3 w-px bg-border mx-1" />
                    <button type="button" className="p-1 hover:text-foreground rounded"><Quote className="h-3.5 w-3.5" /></button>
                    <button type="button" className="p-1 hover:text-foreground rounded"><List className="h-3.5 w-3.5" /></button>
                    <button type="button" className="p-1 hover:text-foreground rounded"><ListOrdered className="h-3.5 w-3.5" /></button>
                    <button type="button" className="p-1 hover:text-foreground rounded"><Link2 className="h-3.5 w-3.5" /></button>
                  </div>

                  <Textarea
                    rows={6}
                    value={termsAndConditions}
                    onChange={(e) => setTermsAndConditions(e.target.value)}
                    placeholder="Enter terms and conditions here..."
                    className="text-xs font-mono leading-relaxed"
                  />
                </CardContent>
              </Card>

              {/* Attachments Card */}
              <Card className="shadow-sm border-border/80">
                <CardHeader className="pb-2 border-b bg-muted/20">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5" />
                    <span>Attachment(s)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-3">
                  <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:bg-muted/20 transition-colors cursor-pointer">
                    <UploadCloud className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs font-medium text-foreground">Click to upload quotation, COA, or spec sheet</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">PDF, PNG, JPG or XLSX up to 10MB</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Financial Calculation Box */}
            <div className="lg:col-span-5">
              <Card className="shadow-sm border-border/80 bg-muted/10">
                <CardHeader className="pb-2 border-b">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Financial Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3 text-xs">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground">Sub Total</span>
                    <span className="font-semibold text-foreground">
                      ₹{subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground">Discount</span>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        value={discountAmount || ''}
                        onChange={(e) => setDiscountAmount(Number(e.target.value))}
                        placeholder="0.00"
                        className="h-6 w-24 text-xs text-right"
                      />
                      <span className="font-semibold text-foreground">
                        -₹{calculatedDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Freight Charges</span>
                      <button type="button" className="text-[10px] text-primary hover:underline">
                        Edit Tax
                      </button>
                    </div>
                    <Input
                      type="number"
                      value={freightAmount || ''}
                      onChange={(e) => setFreightAmount(Number(e.target.value))}
                      placeholder="0.00"
                      className="h-6 w-24 text-xs text-right font-medium"
                    />
                  </div>

                  <div className="flex justify-between items-center py-1.5 border-t border-border/60">
                    <span className="font-bold text-foreground">Taxable Amount</span>
                    <span className="font-bold text-foreground">
                      ₹{taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground">TCS (Tax Collected at Source)</span>
                    <Select value={tcsRate} onValueChange={setTcsRate}>
                      <SelectTrigger className="h-6 text-[11px] w-28">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0" className="text-xs">0% (None)</SelectItem>
                        <SelectItem value="0.1" className="text-xs">0.1% [206C(1H)]</SelectItem>
                        <SelectItem value="1" className="text-xs">1.0%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-between items-center py-1 text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => setExtraCharges((c) => (c > 0 ? 0 : 500))}
                      className="text-primary hover:underline text-[11px] font-medium flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Charges (Loading / P&F)</span>
                    </button>
                    {extraCharges > 0 && <span>₹{extraCharges.toFixed(2)}</span>}
                  </div>

                  <div className="flex justify-between items-center py-1 text-muted-foreground">
                    <span>Round Off</span>
                    <span>{roundOff >= 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}</span>
                  </div>

                  <div className="pt-3 border-t border-border flex justify-between items-center">
                    <span className="text-sm font-bold text-foreground">Total Amount</span>
                    <span className="text-lg font-extrabold text-primary">
                      ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ========================================================= */}
          {/* BOTTOM ACTIONS BAR */}
          {/* ========================================================= */}
          <div className="fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur border-t p-3 shadow-lg">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
              <Button variant="outline" size="sm" asChild>
                <Link href="/backend/dermat_purchase_orders">Cancel</Link>
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSubmit(true)}
                  disabled={submitting}
                  className="gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Save as Draft</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSubmit(false)}
                  disabled={submitting}
                  className="gap-1.5 bg-primary hover:bg-primary/90 font-bold px-5"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{submitting ? 'Issuing PO...' : 'Issue Purchase Order'}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* ADDRESS UPDATE MODAL */}
          {/* ========================================================= */}
          <Dialog open={Boolean(addressModalType)} onOpenChange={(open) => !open && setAddressModalType(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-sm font-bold">
                  Update {addressModalType === 'vendor' ? "Vendor's" : addressModalType === 'billing' ? 'Billing' : 'Delivery'} Address
                </DialogTitle>
              </DialogHeader>
              <div className="py-2">
                <Textarea
                  rows={4}
                  value={tempAddressValue}
                  onChange={(e) => setTempAddressValue(e.target.value)}
                  placeholder="Enter complete address, state, and pincode..."
                  className="text-xs leading-relaxed"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setAddressModalType(null)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={saveAddressEditor}>
                  Save Address
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ========================================================= */}
          {/* SEQUENCE CHANGE MODAL */}
          {/* ========================================================= */}
          <Dialog open={sequenceModalOpen} onOpenChange={setSequenceModalOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-sm font-bold">Change Purchase Order Sequence</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2 text-xs">
                <div className="space-y-1">
                  <Label className="text-xs">PO Number</Label>
                  <Input
                    value={customSequence}
                    onChange={(e) => setCustomSequence(e.target.value)}
                    placeholder="e.g. DER/PO/2425/1366"
                    className="font-mono text-xs font-bold"
                  />
                </div>
                <p className="text-muted-foreground text-[11px]">
                  Format standard for Dermat India is <span className="font-mono font-semibold">DER/PO/[FinancialYear]/[Sequence]</span>
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setSequenceModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setPoNumber(customSequence)
                    setSequenceModalOpen(false)
                  }}
                >
                  Apply Sequence
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ========================================================= */}
          {/* CREATE NEW VENDOR MODAL (Saves to Vendor Master & Auto-selects) */}
          {/* ========================================================= */}
          <Dialog open={newVendorModalOpen} onOpenChange={setNewVendorModalOpen}>
            <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-sm font-bold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span>Create New Supplier / Vendor</span>
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Saves company directly to <strong>Vendor Master</strong> and auto-selects for this Purchase Order.
                </p>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-semibold">
                      Vendor / Company Name <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      value={newVendorName}
                      onChange={(e) => setNewVendorName(e.target.value)}
                      placeholder="e.g. Chemico Synth Specialties Pvt Ltd"
                      className="text-xs font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Vendor Code</Label>
                    <Input
                      value={newVendorCode}
                      onChange={(e) => setNewVendorCode(e.target.value)}
                      placeholder="e.g. VEN-CHEM-01"
                      className="text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">GST Number (GSTIN)</Label>
                    <Input
                      value={newVendorGst}
                      onChange={(e) => setNewVendorGst(e.target.value)}
                      placeholder="e.g. 07AAACA1234F1Z5"
                      className="text-xs font-mono uppercase"
                      maxLength={15}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Category</Label>
                    <Select value={newVendorCategory} onValueChange={(v: any) => setNewVendorCategory(v)}>
                      <SelectTrigger className="text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rm_supplier" className="text-xs">Raw Materials Supplier</SelectItem>
                        <SelectItem value="pm_supplier" className="text-xs">Packaging Materials Supplier</SelectItem>
                        <SelectItem value="both" className="text-xs">Both RM & PM Supplier</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Payment Terms</Label>
                    <Select value={newVendorPaymentTerms} onValueChange={setNewVendorPaymentTerms}>
                      <SelectTrigger className="text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Net 30" className="text-xs">Net 30 Days</SelectItem>
                        <SelectItem value="Net 15" className="text-xs">Net 15 Days</SelectItem>
                        <SelectItem value="50% Adv / 50% Delivery" className="text-xs">50% Advance / 50% on Delivery</SelectItem>
                        <SelectItem value="100% Advance" className="text-xs">100% Advance</SelectItem>
                        <SelectItem value="Immediate" className="text-xs">Immediate on QC Clearance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-semibold">Vendor Complete Address</Label>
                    <Textarea
                      rows={2}
                      value={newVendorAddress}
                      onChange={(e) => setNewVendorAddress(e.target.value)}
                      placeholder="Plot No., Industrial Area, City, State, Pincode..."
                      className="text-xs leading-relaxed"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Contact Person</Label>
                    <Input
                      value={newVendorContactPerson}
                      onChange={(e) => setNewVendorContactPerson(e.target.value)}
                      placeholder="e.g. Rajesh Sharma"
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Phone / WhatsApp</Label>
                    <Input
                      value={newVendorContactPhone}
                      onChange={(e) => setNewVendorContactPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-semibold">Email Address</Label>
                    <Input
                      type="email"
                      value={newVendorContactEmail}
                      onChange={(e) => setNewVendorContactEmail(e.target.value)}
                      placeholder="orders@supplier.com"
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setNewVendorModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateNewVendor}
                  disabled={savingVendor}
                  className="gap-1.5 font-bold bg-primary hover:bg-primary/90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{savingVendor ? 'Saving Vendor...' : 'Save & Select Vendor'}</span>
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </PageBody>
    </Page>
  )
}
