export const entities = [
  {
    id: 'purchasing:supplier',
    label: 'Supplier',
    description: 'A vendor or supplier providing raw materials or services.',
    labelField: 'name',
    showInSidebar: false,
    fields: [],
  },
  {
    id: 'purchasing:purchase_order',
    label: 'Purchase Order',
    description: 'A document to order goods or services from a supplier.',
    labelField: 'orderNumber',
    showInSidebar: false,
    fields: [],
  },
  {
    id: 'purchasing:goods_receipt',
    label: 'Goods Receipt',
    description: 'Records the physical receipt of goods against a purchase order.',
    labelField: 'receiptNumber',
    showInSidebar: false,
    fields: [],
  },
  {
    id: 'purchasing:supplier_pricing',
    label: 'Supplier Pricing',
    description: 'Per-supplier price list for a product with date ranges and quantity breaks.',
    labelField: 'productName',
    showInSidebar: false,
    fields: [],
  },
  {
    id: 'purchasing:purchase_invoice',
    label: 'Purchase Invoice',
    description: 'An invoice received from a supplier for goods or services.',
    labelField: 'invoiceNumber',
    showInSidebar: false,
    fields: [],
  },
]

export default entities
