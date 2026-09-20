import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: ['dermat_purchase_orders.*'],
    employee: ['dermat_purchase_orders.view', 'dermat_purchase_orders.manage'],
    research: ['dermat_purchase_orders.view', 'dermat_purchase_orders.manage'],
    quality_assurance: ['dermat_purchase_orders.view', 'dermat_purchase_orders.manage'],
    supervisor: ['dermat_purchase_orders.view'],
  },
}

export default setup
