import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'dermat_pm_master',
  title: 'Packaging Materials',
  version: '0.1.0',
  description: 'Packaging material master data for Dermat India (cosmetics manufacturing) — cartons, bottles, tubes, labels, leaflets, spatulas, seals, boxes.',
  author: 'Wantace',
  license: 'UNLICENSED',
  ejectable: false,
}

export { features } from './acl'
