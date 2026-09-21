import { InjectionPosition } from '@open-mercato/shared/modules/widgets/injection-position'
import type { InjectionMenuItemWidget } from '@open-mercato/shared/modules/widgets/injection'

/**
 * The Operations dashboard at /backend has no module page, so it never appears
 * in the auto-discovered sidebar nav — the only way in was clicking the brand
 * logo. This pins a "Dashboard" entry at the very top of the main sidebar.
 */
const widget: InjectionMenuItemWidget = {
  metadata: {
    id: 'dermat_departments.injection.dashboard-menu',
    title: 'Dashboard sidebar link',
  },
  menuItems: [
    {
      id: 'dermat-dashboard-link',
      labelKey: 'dashboard.nav.title',
      label: 'Dashboard',
      icon: 'LayoutDashboard',
      href: '/backend',
      placement: { position: InjectionPosition.First },
    },
  ],
}

export default widget
