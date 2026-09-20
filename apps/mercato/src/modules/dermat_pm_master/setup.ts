import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: [
      'dermat_pm_master.*',
    ],
    employee: [
      'dermat_pm_master.view',
      'dermat_pm_master.manage',
    ],
    pm_store: ['dermat_pm_master.view', 'dermat_pm_master.manage'],
    procurement: ['dermat_pm_master.view'],
    production_staff: ['dermat_pm_master.view'],
    supervisor: ['dermat_pm_master.view'],
  },
}

export default setup
