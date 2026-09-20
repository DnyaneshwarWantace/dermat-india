import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: [
      'dermat_rm_master.*',
    ],
    employee: [
      'dermat_rm_master.view',
      'dermat_rm_master.manage',
    ],
    procurement: ['dermat_rm_master.view', 'dermat_rm_master.manage'],
    research: ['dermat_rm_master.view'],
    production_staff: ['dermat_rm_master.view'],
    supervisor: ['dermat_rm_master.view'],
    operator: ['dermat_rm_master.view'],
    pm_store: ['dermat_rm_master.view'],
  },
}

export default setup
