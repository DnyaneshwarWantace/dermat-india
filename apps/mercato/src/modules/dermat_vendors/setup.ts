import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: [
      'dermat_vendors.*',
    ],
    employee: [
      'dermat_vendors.view',
    ],
    procurement: ['dermat_vendors.view', 'dermat_vendors.manage'],
  },
}

export default setup
