import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: [
      'dermat_departments.*',
    ],
    employee: [
      'dermat_departments.view',
    ],
    sales: ['dermat_departments.view'],
    procurement: ['dermat_departments.view'],
    research: ['dermat_departments.view'],
    production_staff: ['dermat_departments.view'],
    supervisor: ['dermat_departments.view'],
    operator: ['dermat_departments.view'],
    quality_control: ['dermat_departments.view'],
    quality_assurance: ['dermat_departments.view'],
    pm_store: ['dermat_departments.view'],
    accounts: ['dermat_departments.view'],
  },
}

export default setup
