import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { PriceKindSettings } from '../../../components/PriceKindSettings'
import { UnitPriceDisplaySettings } from '../../../components/UnitPriceDisplaySettings'
import { AutoSkuPrefixSettings } from '../../../components/AutoSkuPrefixSettings'

export default function CatalogConfigurationPage() {
  return (
    <Page>
      <PageBody className="space-y-8">
        <PriceKindSettings />
        <UnitPriceDisplaySettings />
        <AutoSkuPrefixSettings />
      </PageBody>
    </Page>
  )
}
