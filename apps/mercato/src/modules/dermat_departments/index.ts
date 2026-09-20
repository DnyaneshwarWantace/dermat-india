import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'dermat_departments',
  title: 'Departments',
  version: '0.1.0',
  description: 'Department master data for Dermat India (sales, procurement, production, quality, finance, research, admin).',
  author: 'Wantace',
  license: 'UNLICENSED',
  ejectable: false,
}

export { features } from './acl'
