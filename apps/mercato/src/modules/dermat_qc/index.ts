import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'dermat_qc',
  title: 'Quality Control',
  version: '0.1.0',
  description: 'Dual Chemical (B) + Micro (C) quality control sign-off for Dermat India, with per-material/product QC policy configuration.',
  author: 'Wantace',
  license: 'UNLICENSED',
  ejectable: false,
}

export { features } from './acl'
