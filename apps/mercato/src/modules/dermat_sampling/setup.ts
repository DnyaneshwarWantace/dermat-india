import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: [
      'dermat_sampling.*',
    ],
    employee: [
      'dermat_sampling.view',
      'dermat_sampling.manage',
    ],
    sales: ['dermat_sampling.view', 'dermat_sampling.manage'],
    research: ['dermat_sampling.view', 'dermat_sampling.manage'],
  },
}

export default setup
