import type { ModuleInjectionTable } from '@open-mercato/shared/modules/widgets/injection'

export const injectionTable: ModuleInjectionTable = {
  'backend:topbar:actions': {
    widgetId: 'dermat_departments.injection.app-chrome',
    priority: 50,
  },
}

export default injectionTable
