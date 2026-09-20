import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: [
      'dermat_qc.*',
    ],
    employee: [
      'dermat_qc.view',
      'dermat_qc.manage',
    ],
    quality_control: ['dermat_qc.view', 'dermat_qc.manage'],
    quality_assurance: ['dermat_qc.view'],
  },
}

export default setup
