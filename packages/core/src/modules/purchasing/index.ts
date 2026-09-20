import type { ModuleInfo } from '@wantace/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'purchasing',
  title: 'Purchasing',
  version: '0.1.0',
  description: 'Supplier management, purchase orders, and goods receipts for procurement workflows.',
  author: 'Wantace ERP',
  license: 'MIT',
  ejectable: true,
}

export { features } from './acl'
