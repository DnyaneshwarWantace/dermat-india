import type { ModuleSetupConfig } from '@wantace/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: [
      'purchasing.*',
    ],
    employee: [
      'purchasing.suppliers.view',
      'purchasing.purchase_orders.view',
      'purchasing.goods_receipts.view',
      'purchasing.supplier_pricing.view',
      'purchasing.purchase_invoices.view',
    ],
  },

  async seedDefaults({ em, tenantId, organizationId }) {
    // Purchasing module default settings will be seeded here
    // (numbering sequences, default payment terms, etc.)
  },

  async seedExamples({ em, tenantId, organizationId }) {
    // Demo suppliers and purchase orders will be seeded here
  },
}

export default setup
