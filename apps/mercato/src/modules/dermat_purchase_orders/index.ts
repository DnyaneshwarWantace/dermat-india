import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'dermat_purchase_orders',
  title: 'Purchase Orders',
  version: '0.1.0',
  description: 'Purchase order data raised against vendors for raw material and packaging material, entered from the BOM page.',
  author: 'Wantace',
  license: 'UNLICENSED',
  ejectable: false,
}

export { features } from './acl'
