/** @jest-environment node */

import { metadata as rulesLogsMetadata } from '../business_rules/backend/logs/page.meta'
import { metadata as rulesMetadata } from '../business_rules/backend/rules/page.meta'
import { metadata as ruleSetsMetadata } from '../business_rules/backend/sets/page.meta'
import { metadata as categoriesMetadata } from '../catalog/backend/catalog/categories/page.meta'
import { metadata as productsMetadata } from '../catalog/backend/catalog/products/page.meta'
import { metadata as communicationChannelsMetadata } from '../communication_channels/backend/communication_channels/channels/page.meta'
import { metadata as currenciesMetadata } from '../currencies/backend/currencies/page.meta'
import { metadata as exchangeRatesMetadata } from '../currencies/backend/exchange-rates/page.meta'
import { metadata as calendarMetadata } from '../customers/backend/calendar/page.meta'
import { metadata as companiesMetadata } from '../customers/backend/customers/companies/page.meta'
import { metadata as dealsMetadata } from '../customers/backend/customers/deals/page.meta'
import { metadata as peopleMetadata } from '../customers/backend/customers/people/page.meta'
import { metadata as customerTasksMetadata } from '../customers/backend/customer-tasks/page.meta'
import { metadata as inboxOpsMetadata } from '../inbox_ops/backend/inbox-ops/page.meta'
import { metadata as messagesMetadata } from '../messages/backend/page.meta'
import { metadata as resourceTypesMetadata } from '../resources/backend/resources/resource-types/page.meta'
import { metadata as resourcesMetadata } from '../resources/backend/resources/resources/page.meta'
import { metadata as createSalesDocumentMetadata } from '../sales/backend/sales/documents/create/page.meta'
import { metadata as ordersMetadata } from '../sales/backend/sales/orders/page.meta'
import { metadata as quotesMetadata } from '../sales/backend/sales/quotes/page.meta'

const mainSidebarMetadata = [
  ['rules logs', rulesLogsMetadata],
  ['rules', rulesMetadata],
  ['rule sets', ruleSetsMetadata],
  ['categories', categoriesMetadata],
  ['products', productsMetadata],
  ['communication channels', communicationChannelsMetadata],
  ['currencies', currenciesMetadata],
  ['exchange rates', exchangeRatesMetadata],
  ['calendar', calendarMetadata],
  ['companies', companiesMetadata],
  ['deals', dealsMetadata],
  ['people', peopleMetadata],
  ['customer tasks', customerTasksMetadata],
  ['inbox ops', inboxOpsMetadata],
  ['messages', messagesMetadata],
  ['resource types', resourceTypesMetadata],
  ['resources', resourcesMetadata],
  ['create sales document', createSalesDocumentMetadata],
  ['orders', ordersMetadata],
  ['quotes', quotesMetadata],
] as const

describe('backend sidebar icon metadata', () => {
  it('uses registry-safe string icon ids for visible core sidebar pages', () => {
    for (const [label, metadata] of mainSidebarMetadata) {
      expect(typeof metadata.icon).toBe('string')
      expect(`${label}:${metadata.icon ?? ''}`).not.toMatch(/:$/)
    }
  })
})
