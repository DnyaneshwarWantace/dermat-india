import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: [
      'dermat_bom.*',
    ],
    employee: [
      'dermat_bom.view',
      'dermat_bom.manage',
    ],
    sales: ['dermat_bom.view'],
    research: ['dermat_bom.view', 'dermat_bom.manage'],
    production_staff: ['dermat_bom.view'],
    supervisor: ['dermat_bom.view'],
    operator: ['dermat_bom.view'],
    quality_assurance: ['dermat_bom.view'],
  },
}

export default setup
