import type { InjectionColumnWidget } from '@open-mercato/shared/modules/widgets/injection'
import { mapDictionaryColorToTone } from '@open-mercato/shared/lib/query/advanced-filter'
import { StatusBadge, type StatusBadgeVariant } from '@open-mercato/ui/primitives/status-badge'

const STATUS_BADGE_VARIANTS: ReadonlySet<StatusBadgeVariant> = new Set(['success', 'warning', 'error', 'info', 'neutral'])

function coerceStatusBadgeVariant(tone: ReturnType<typeof mapDictionaryColorToTone>): StatusBadgeVariant {
  if (tone && STATUS_BADGE_VARIANTS.has(tone as StatusBadgeVariant)) return tone as StatusBadgeVariant
  return 'neutral'
}

type DealStageValue = { id: string; label: string; color: string | null } | null | undefined

const widget: InjectionColumnWidget = {
  metadata: {
    id: 'dermat_sales_flow.injection.order-deal-stage-column',
    requiredModules: ['sales', 'customers'],
    priority: 40,
  },
  columns: [
    {
      id: 'dermat_sales_flow_deal_stage',
      header: 'Deal stage',
      headerKey: 'dermat_sales_flow.orderBook.list.col.dealStage',
      accessorKey: '_dermat_sales_flow.dealStage',
      sortable: false,
      cell: ({ getValue }) => {
        const value = getValue() as DealStageValue
        if (!value) return null
        const variant = coerceStatusBadgeVariant(mapDictionaryColorToTone(value.color))
        return <StatusBadge variant={variant} dot>{value.label}</StatusBadge>
      },
    },
  ],
}

export default widget
