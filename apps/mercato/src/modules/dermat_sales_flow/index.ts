import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'dermat_sales_flow',
  title: 'Sales Flow',
  version: '0.1.0',
  description: 'Dermat India business rules layered on the generic Customers CRM: converts a Lead-pipeline deal into a real customer once advance payment is received, and moves it into the Customer/Order pipeline.',
  author: 'Wantace',
  license: 'UNLICENSED',
  ejectable: false,
}
