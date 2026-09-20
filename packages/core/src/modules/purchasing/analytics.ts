import type { AnalyticsModuleConfig } from '@wantace/shared/modules/analytics'

export const analyticsConfig: AnalyticsModuleConfig = {
  entities: [
    {
      entityId: 'purchasing:supplier',
      requiredFeatures: ['purchasing.suppliers.view'],
      entityConfig: {
        tableName: 'purchasing_suppliers',
        dateField: 'created_at',
        defaultScopeFields: ['tenant_id', 'organization_id'],
      },
      fieldMappings: {
        id: { dbColumn: 'id', type: 'uuid' },
        name: { dbColumn: 'name', type: 'text' },
        status: { dbColumn: 'status', type: 'text' },
        country: { dbColumn: 'country', type: 'text' },
        createdAt: { dbColumn: 'created_at', type: 'timestamp' },
      },
    },
    {
      entityId: 'purchasing:purchase_order',
      requiredFeatures: ['purchasing.purchase_orders.view'],
      entityConfig: {
        tableName: 'purchasing_purchase_orders',
        dateField: 'order_date',
        defaultScopeFields: ['tenant_id', 'organization_id'],
      },
      fieldMappings: {
        id: { dbColumn: 'id', type: 'uuid' },
        orderNumber: { dbColumn: 'order_number', type: 'text' },
        status: { dbColumn: 'status', type: 'text' },
        totalCents: { dbColumn: 'total_cents', type: 'numeric' },
        orderDate: { dbColumn: 'order_date', type: 'timestamp' },
        createdAt: { dbColumn: 'created_at', type: 'timestamp' },
      },
    },
    {
      entityId: 'purchasing:supplier_pricing',
      requiredFeatures: ['purchasing.supplier_pricing.view'],
      entityConfig: {
        tableName: 'purchasing_supplier_pricing',
        dateField: 'created_at',
        defaultScopeFields: ['tenant_id', 'organization_id'],
      },
      fieldMappings: {
        id: { dbColumn: 'id', type: 'uuid' },
        productName: { dbColumn: 'product_name', type: 'text' },
        unitPriceCents: { dbColumn: 'unit_price_cents', type: 'numeric' },
        isActive: { dbColumn: 'is_active', type: 'boolean' },
        createdAt: { dbColumn: 'created_at', type: 'timestamp' },
      },
    },
    {
      entityId: 'purchasing:purchase_invoice',
      requiredFeatures: ['purchasing.purchase_invoices.view'],
      entityConfig: {
        tableName: 'purchasing_purchase_invoices',
        dateField: 'invoice_date',
        defaultScopeFields: ['tenant_id', 'organization_id'],
      },
      fieldMappings: {
        id: { dbColumn: 'id', type: 'uuid' },
        invoiceNumber: { dbColumn: 'invoice_number', type: 'text' },
        status: { dbColumn: 'status', type: 'text' },
        totalCents: { dbColumn: 'total_cents', type: 'numeric' },
        balanceCents: { dbColumn: 'balance_cents', type: 'numeric' },
        invoiceDate: { dbColumn: 'invoice_date', type: 'timestamp' },
        createdAt: { dbColumn: 'created_at', type: 'timestamp' },
      },
    },
  ],
}

export default analyticsConfig
export const config = analyticsConfig
