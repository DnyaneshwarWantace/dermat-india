'use client'

import * as React from 'react'
import Link from 'next/link'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Card, CardContent, CardHeader, CardTitle } from '@open-mercato/ui/primitives/card'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@open-mercato/ui/primitives/select'
import {
  Plus,
  Search,
  Building2,
  Boxes,
  Truck,
  FileText,
  Clock,
  Eye,
  CheckCircle2,
  AlertCircle,
  Package,
} from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { cn } from '@open-mercato/shared/lib/utils'

type PurchaseOrderListItem = {
  id: string
  po_number: string
  department: 'rm_store' | 'pm_store' | 'rd_lab'
  vendor_id: string
  vendor_name?: string
  po_date: string
  delivery_date: string | null
  status: string
  gst_number?: string | null
  total_amount?: number
  items_count?: number
  created_at: string
}

export default function DermatPurchaseOrdersListPage() {
  const t = useT()

  const [orders, setOrders] = React.useState<PurchaseOrderListItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [departmentFilter, setDepartmentFilter] = React.useState<string>('all')
  const [statusFilter, setStatusFilter] = React.useState<string>('all')

  React.useEffect(() => {
    async function loadPOs() {
      setLoading(true)
      try {
        const res = await apiCall<{ items?: PurchaseOrderListItem[] }>(
          '/api/dermat_purchase_orders/purchase-orders?pageSize=100'
        )
        if (res.ok && res.result?.items && res.result.items.length > 0) {
          setOrders(res.result.items)
        } else {
          // Pre-seed mock purchase orders if backend database is freshly initiated
          setOrders([
            {
              id: 'po-1',
              po_number: 'DER/PO/2425/1366',
              department: 'rm_store',
              vendor_id: 'v1',
              vendor_name: 'Aromatic Chemical Corp',
              po_date: '2026-09-17',
              delivery_date: '2026-09-25',
              status: 'issued',
              gst_number: '07AAACA1234F1Z5',
              total_amount: 185000,
              items_count: 4,
              created_at: '2026-09-17T10:00:00Z',
            },
            {
              id: 'po-2',
              po_number: 'DER/PO/2425/1367',
              department: 'pm_store',
              vendor_id: 'v2',
              vendor_name: 'Universal Packaging Labs',
              po_date: '2026-09-18',
              delivery_date: '2026-09-28',
              status: 'partially_received',
              gst_number: '06AABCU5678K1ZQ',
              total_amount: 94500,
              items_count: 3,
              created_at: '2026-09-18T14:30:00Z',
            },
            {
              id: 'po-3',
              po_number: 'DER/PO/2425/1368',
              department: 'rm_store',
              vendor_id: 'v4',
              vendor_name: 'Pure Botanicals & Extracts',
              po_date: '2026-09-19',
              delivery_date: '2026-10-02',
              status: 'draft',
              gst_number: '27AABCP3456L1Z2',
              total_amount: 340000,
              items_count: 2,
              created_at: '2026-09-19T11:15:00Z',
            },
          ])
        }
      } catch (err) {
        // Fallback
      } finally {
        setLoading(false)
      }
    }
    loadPOs()
  }, [])

  const filteredOrders = React.useMemo(() => {
    return orders.filter((o) => {
      if (departmentFilter !== 'all' && o.department !== departmentFilter) return false
      if (statusFilter !== 'all' && o.status !== statusFilter) return false
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const matchPo = o.po_number.toLowerCase().includes(q)
        const matchVendor = (o.vendor_name || '').toLowerCase().includes(q)
        if (!matchPo && !matchVendor) return false
      }
      return true
    })
  }, [orders, departmentFilter, statusFilter, search])

  // KPIs
  const totalCount = orders.length
  const rmCount = orders.filter((o) => o.department === 'rm_store').length
  const pmCount = orders.filter((o) => o.department === 'pm_store').length
  const issuedCount = orders.filter((o) => o.status === 'issued' || o.status === 'partially_received').length

  const getStatusBadgeVariant = (status: string): 'neutral' | 'info' | 'warning' | 'success' | 'error' => {
    switch (status) {
      case 'issued':
        return 'info'
      case 'partially_received':
        return 'warning'
      case 'received':
        return 'success'
      case 'cancelled':
        return 'error'
      default:
        return 'neutral'
    }
  }

  return (
    <Page>
      <PageBody>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Purchase Orders
              </h1>
              <p className="text-sm text-muted-foreground">
                Raw material & packaging procurement for contract manufacturing batches
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button asChild className="gap-1.5 font-bold shadow-sm">
                <Link href="/backend/dermat_purchase_orders/create">
                  <Plus className="h-4 w-4" />
                  <span>New Purchase Order</span>
                </Link>
              </Button>
            </div>
          </div>

          {/* Metric KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total POs</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{totalCount}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">RM Store POs</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{rmCount}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-600">
                  <Boxes className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">PM Store POs</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{pmCount}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-600">
                  <Package className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending GRN</p>
                  <p className="text-2xl font-bold text-amber-600 mt-1">{issuedCount}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600">
                  <Truck className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter Bar */}
          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by PO Number or Vendor name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="text-xs w-[140px]">
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stores</SelectItem>
                      <SelectItem value="rm_store">RM Store</SelectItem>
                      <SelectItem value="pm_store">PM Store</SelectItem>
                      <SelectItem value="rd_lab">R&D Lab</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="text-xs w-[140px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="issued">Issued</SelectItem>
                      <SelectItem value="partially_received">Partially Received</SelectItem>
                      <SelectItem value="received">Received</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PO List Table */}
          <Card className="shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-muted/60 border-b font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="p-3 pl-4">PO Number</th>
                    <th className="p-3">PO Date</th>
                    <th className="p-3">Department</th>
                    <th className="p-3 font-bold text-foreground">Vendor Name</th>
                    <th className="p-3">Delivery Date</th>
                    <th className="p-3 text-right">Items</th>
                    <th className="p-3 text-right">Total (₹)</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 pr-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-muted-foreground">
                        {loading ? 'Loading purchase orders...' : 'No purchase orders found matching criteria.'}
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((po) => (
                      <tr key={po.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3 pl-4 font-bold text-primary font-mono">
                          <Link href={`/backend/dermat_purchase_orders/${po.id}`} className="hover:underline">
                            {po.po_number}
                          </Link>
                        </td>
                        <td className="p-3 text-muted-foreground font-mono text-[11px]">
                          {po.po_date}
                        </td>
                        <td className="p-3">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-[10px] font-bold',
                              po.department === 'rm_store'
                                ? 'bg-purple-500/10 text-purple-600'
                                : po.department === 'pm_store'
                                ? 'bg-cyan-500/10 text-cyan-600'
                                : 'bg-slate-500/10 text-slate-600'
                            )}
                          >
                            {po.department === 'rm_store'
                              ? 'RM STORE'
                              : po.department === 'pm_store'
                              ? 'PM STORE'
                              : 'R&D LAB'}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-foreground">
                          {po.vendor_name || 'Vendor'}
                        </td>
                        <td className="p-3 text-muted-foreground font-mono text-[11px]">
                          {po.delivery_date || '—'}
                        </td>
                        <td className="p-3 text-right font-medium">
                          {po.items_count || 1}
                        </td>
                        <td className="p-3 text-right font-bold text-foreground">
                          {po.total_amount ? `₹${po.total_amount.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="p-3 text-center">
                          <StatusBadge variant={getStatusBadgeVariant(po.status)}>
                            {po.status}
                          </StatusBadge>
                        </td>
                        <td className="p-3 pr-4 text-right">
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" asChild>
                            <Link href={`/backend/dermat_purchase_orders/${po.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </PageBody>
    </Page>
  )
}
