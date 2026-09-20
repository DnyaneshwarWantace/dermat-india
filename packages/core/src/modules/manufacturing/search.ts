import type { ModuleSearchConfig } from '@wantace/shared/modules/search'

export const search: ModuleSearchConfig[] = [
  {
    entityType: 'manufacturing:work_center',
    entity: 'WorkCenter',
    label: 'Work Centers',
    fieldPolicy: {
      searchable: ['name', 'code', 'location'],
      filterable: ['status'],
      sortable: ['name', 'code', 'createdAt'],
    },
    formatResult: (item) => ({
      title: item.name,
      subtitle: item.code,
      icon: 'factory',
    }),
  },
  {
    entityType: 'manufacturing:machine',
    entity: 'Machine',
    label: 'Machines',
    fieldPolicy: {
      searchable: ['name', 'code', 'serialNumber', 'makeModel'],
      filterable: ['status'],
      sortable: ['name', 'code', 'createdAt'],
    },
    formatResult: (item) => ({
      title: item.name,
      subtitle: item.code,
      icon: 'cog',
    }),
  },
  {
    entityType: 'manufacturing:bom',
    entity: 'BillOfMaterials',
    label: 'Bills of Materials',
    fieldPolicy: {
      searchable: ['name', 'code', 'productName'],
      filterable: ['status', 'isDefault'],
      sortable: ['name', 'code', 'productName', 'createdAt'],
    },
    formatResult: (item) => ({
      title: item.name,
      subtitle: item.productName,
      icon: 'clipboard-list',
    }),
  },
]

export default search
