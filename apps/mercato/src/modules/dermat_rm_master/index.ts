import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'dermat_rm_master',
  title: 'Raw Materials',
  version: '0.1.0',
  description: 'Raw material master data for Dermat India (cosmetics manufacturing) — name, INCI name, code, stock, unit, supplier, and physical properties.',
  author: 'Wantace',
  license: 'UNLICENSED',
  ejectable: false,
}

export { features } from './acl'
