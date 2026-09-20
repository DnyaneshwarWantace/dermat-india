import type { ModuleInfo } from '@wantace/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'manufacturing',
  title: 'Manufacturing',
  version: '0.1.0',
  description: 'Bill of materials, production orders, and manufacturing workflows.',
  author: 'Wantace ERP',
  license: 'MIT',
  ejectable: true,
}

export { features } from './acl'

export * from './data/entities'
