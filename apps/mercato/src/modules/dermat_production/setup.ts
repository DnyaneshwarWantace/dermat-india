import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: [
      'dermat_production.*',
    ],
    employee: [
      'dermat_production.view',
      'dermat_production.manage',
      'dermat_production.sign_off',
    ],
    production_staff: ['dermat_production.view', 'dermat_production.manage'],
    supervisor: ['dermat_production.view', 'dermat_production.manage', 'dermat_production.sign_off'],
    operator: ['dermat_production.view', 'dermat_production.manage'],
    quality_control: ['dermat_production.view'],
  },
}

export default setup
