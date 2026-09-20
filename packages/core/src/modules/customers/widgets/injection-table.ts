import type { ModuleInjectionTable } from '@open-mercato/shared/modules/widgets/injection'

/**
 * Step 4.10 — customers module injection table.
 *
 * Drops the `ai-assistant-trigger` widget on the Companies (unified
 * "Customer") `DataTable` `:search-trailing` slot, which renders adjacent
 * to the list search input.
 *
 * The People list, Deals list, and Deal detail pages were removed for this
 * deployment (customers consolidated into a single Companies/"Customer"
 * list) — their injection-table entries were removed with them since the
 * target spots no longer exist. `ai-deal-analyzer-trigger` and
 * `ai-deal-detail-trigger` widget files remain in `widgets/injection/` but
 * are currently unregistered; re-wire them if a Deals surface returns.
 *
 * Widgets embed `<AiChat agent="…" …>` with a selection- or record-aware
 * `pageContext`. The page files themselves only register the shared
 * `<InjectionSpot>` mount point — the trigger, sheet, and chat surface
 * live entirely in the injection widgets so third-party modules can copy
 * the pattern unchanged.
 */
export const injectionTable: ModuleInjectionTable = {
  'data-table:customers.companies.list:search-trailing': [
    {
      widgetId: 'customers.injection.ai-assistant-trigger',
      priority: 100,
    },
  ],
}

export default injectionTable
