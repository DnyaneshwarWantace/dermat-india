import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'dermat_production',
  title: 'Production',
  version: '0.1.0',
  description: 'Production batch tracking for Dermat India — Bulk, Semi-Finished (skippable), and Finished Goods stages with sign-off.',
  author: 'Wantace',
  license: 'UNLICENSED',
  ejectable: false,
}

export { features } from './acl'
