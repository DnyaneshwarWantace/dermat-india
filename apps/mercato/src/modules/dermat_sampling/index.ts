import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'dermat_sampling',
  title: 'R&D Sampling',
  version: '0.1.0',
  description: 'Tracks R&D sample requests against sales orders — a sample must be prepared, sent, and approved by the customer before production can start.',
  author: 'Wantace',
  license: 'UNLICENSED',
  ejectable: false,
}

export { features } from './acl'
