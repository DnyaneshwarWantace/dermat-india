import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'dermat_bom',
  title: 'BOM',
  version: '0.1.0',
  description: 'Bill of Materials for Dermat India — one flat raw-material and packaging-material list per product, matching the Procuzy BOM layout.',
  author: 'Wantace',
  license: 'UNLICENSED',
  ejectable: false,
}

export { features } from './acl'
