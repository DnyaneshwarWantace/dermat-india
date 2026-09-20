import type { ModuleSearchConfig } from '@wantace/shared/modules/search'

export const search: ModuleSearchConfig[] = [
  {
    entityType: 'purchasing:supplier',
    entity: 'Supplier',
    label: 'Suppliers',
    fieldPolicy: {
      searchable: ['name', 'code', 'contactName', 'contactEmail', 'city', 'country'],
      filterable: ['status', 'isActive', 'country', 'currencyCode'],
      sortable: ['name', 'code', 'createdAt', 'updatedAt'],
    },
    formatResult: (item) => ({
      title: item.name,
      subtitle: item.code,
      icon: 'truck',
    }),
  },
  {
    entityType: 'purchasing:purchase_order',
    entity: 'PurchaseOrder',
    label: 'Purchase Orders',
    fieldPolicy: {
      searchable: ['orderNumber', 'notes'],
      filterable: ['status', 'orderDate', 'expectedDeliveryDate'],
      sortable: ['orderNumber', 'orderDate', 'totalCents', 'createdAt', 'status'],
    },
    formatResult: (item) => ({
      title: item.orderNumber,
      subtitle: item.status,
      icon: 'file-text',
    }),
  },
  {
    entityType: 'purchasing:goods_receipt',
    entity: 'GoodsReceipt',
    label: 'Goods Receipts',
    fieldPolicy: {
      searchable: ['receiptNumber', 'notes'],
      filterable: ['status', 'receiptDate'],
      sortable: ['receiptNumber', 'receiptDate', 'createdAt'],
    },
    formatResult: (item) => ({
      title: item.receiptNumber,
      subtitle: item.status,
      icon: 'package-check',
    }),
  },
  {
    entityType: 'purchasing:supplier_pricing',
    entity: 'SupplierPricing',
    label: 'Supplier Pricing',
    fieldPolicy: {
      searchable: ['productName', 'productSku'],
      filterable: ['isActive', 'currencyCode'],
      sortable: ['productName', 'unitPriceCents', 'createdAt'],
    },
    formatResult: (item) => ({
      title: item.productName,
      subtitle: item.productSku ?? '',
      icon: 'tag',
    }),
  },
  {
    entityType: 'purchasing:purchase_invoice',
    entity: 'PurchaseInvoice',
    label: 'Purchase Invoices',
    fieldPolicy: {
      searchable: ['invoiceNumber', 'supplierInvoiceNumber'],
      filterable: ['status', 'invoiceDate', 'dueDate'],
      sortable: ['invoiceNumber', 'invoiceDate', 'totalCents', 'balanceCents', 'createdAt', 'status'],
    },
    formatResult: (item) => ({
      title: item.invoiceNumber,
      subtitle: item.status,
      icon: 'receipt',
    }),
  },
]

export default search
