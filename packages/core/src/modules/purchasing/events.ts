import { createModuleEvents } from '@wantace/shared/modules/events'

const events = [
  // Suppliers
  { id: 'purchasing.supplier.created', label: 'Supplier Created', entity: 'supplier', category: 'crud' },
  { id: 'purchasing.supplier.updated', label: 'Supplier Updated', entity: 'supplier', category: 'crud' },
  { id: 'purchasing.supplier.deleted', label: 'Supplier Deleted', entity: 'supplier', category: 'crud' },

  // Purchase Orders
  { id: 'purchasing.purchase_order.created', label: 'Purchase Order Created', entity: 'purchase_order', category: 'crud' },
  { id: 'purchasing.purchase_order.updated', label: 'Purchase Order Updated', entity: 'purchase_order', category: 'crud' },
  { id: 'purchasing.purchase_order.deleted', label: 'Purchase Order Deleted', entity: 'purchase_order', category: 'crud' },
  { id: 'purchasing.purchase_order.sent', label: 'Purchase Order Sent', entity: 'purchase_order', category: 'lifecycle' },
  { id: 'purchasing.purchase_order.confirmed', label: 'Purchase Order Confirmed', entity: 'purchase_order', category: 'lifecycle' },
  { id: 'purchasing.purchase_order.cancelled', label: 'Purchase Order Cancelled', entity: 'purchase_order', category: 'lifecycle' },
  { id: 'purchasing.purchase_order.closed', label: 'Purchase Order Closed', entity: 'purchase_order', category: 'lifecycle' },

  // Goods Receipts
  { id: 'purchasing.goods_receipt.created', label: 'Goods Receipt Created', entity: 'goods_receipt', category: 'crud' },
  { id: 'purchasing.goods_receipt.updated', label: 'Goods Receipt Updated', entity: 'goods_receipt', category: 'crud' },
  { id: 'purchasing.goods_receipt.completed', label: 'Goods Receipt Completed', entity: 'goods_receipt', category: 'lifecycle' },
  { id: 'purchasing.goods_receipt.cancelled', label: 'Goods Receipt Cancelled', entity: 'goods_receipt', category: 'lifecycle' },

  // Supplier Pricing
  { id: 'purchasing.supplier_pricing.created', label: 'Supplier Pricing Created', entity: 'supplier_pricing', category: 'crud' },
  { id: 'purchasing.supplier_pricing.updated', label: 'Supplier Pricing Updated', entity: 'supplier_pricing', category: 'crud' },
  { id: 'purchasing.supplier_pricing.deleted', label: 'Supplier Pricing Deleted', entity: 'supplier_pricing', category: 'crud' },

  // Purchase Invoices
  { id: 'purchasing.purchase_invoice.created', label: 'Purchase Invoice Created', entity: 'purchase_invoice', category: 'crud' },
  { id: 'purchasing.purchase_invoice.updated', label: 'Purchase Invoice Updated', entity: 'purchase_invoice', category: 'crud' },
  { id: 'purchasing.purchase_invoice.approved', label: 'Purchase Invoice Approved', entity: 'purchase_invoice', category: 'lifecycle' },
  { id: 'purchasing.purchase_invoice.paid', label: 'Purchase Invoice Paid', entity: 'purchase_invoice', category: 'lifecycle' },
  { id: 'purchasing.purchase_invoice.cancelled', label: 'Purchase Invoice Cancelled', entity: 'purchase_invoice', category: 'lifecycle' },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'purchasing',
  events,
})

export const emitPurchasingEvent = eventsConfig.emit
export type PurchasingEventId = typeof events[number]['id']

export default eventsConfig
