import type { AnalyticsModuleConfig } from '@wantace/shared/modules/analytics'

export const analyticsConfig: AnalyticsModuleConfig = {
  entities: [
    {
      entityId: 'manufacturing:work_center',
      requiredFeatures: ['manufacturing.work_centers.view'],
      entityConfig: {
        tableName: 'manufacturing_work_centers',
        dateField: 'created_at',
        defaultScopeFields: ['tenant_id', 'organization_id'],
      },
      fieldMappings: {
        id: { dbColumn: 'id', type: 'uuid' },
        name: { dbColumn: 'name', type: 'text' },
        status: { dbColumn: 'status', type: 'text' },
        costPerHourCents: { dbColumn: 'cost_per_hour_cents', type: 'numeric' },
        createdAt: { dbColumn: 'created_at', type: 'timestamp' },
      },
    },
    {
      entityId: 'manufacturing:bom',
      requiredFeatures: ['manufacturing.bom.view'],
      entityConfig: {
        tableName: 'manufacturing_boms',
        dateField: 'created_at',
        defaultScopeFields: ['tenant_id', 'organization_id'],
      },
      fieldMappings: {
        id: { dbColumn: 'id', type: 'uuid' },
        name: { dbColumn: 'name', type: 'text' },
        status: { dbColumn: 'status', type: 'text' },
        productName: { dbColumn: 'product_name', type: 'text' },
        totalCostCents: { dbColumn: 'total_cost_cents', type: 'numeric' },
        createdAt: { dbColumn: 'created_at', type: 'timestamp' },
      },
    },
  ],
}

export default analyticsConfig
export const config = analyticsConfig
