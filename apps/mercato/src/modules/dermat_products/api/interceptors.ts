import type { ApiInterceptor } from '@open-mercato/shared/lib/crud/api-interceptor'

const SUPPLIER_FEATURE = 'dermat_products.supplier'
const SUPPLIER_KEY = 'supplier'

type RbacLike = { userHasAllFeatures: (userId: string, features: string[], scope: { tenantId: string; organizationId: string }) => Promise<boolean> }

function stripSupplier(item: unknown): unknown {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item
  const copy: Record<string, unknown> = { ...(item as Record<string, unknown>) }
  delete copy[`cf_${SUPPLIER_KEY}`]
  delete copy[`cf:${SUPPLIER_KEY}`]
  for (const key of ['customValues', 'custom']) {
    const values = copy[key]
    if (values && typeof values === 'object' && !Array.isArray(values)) {
      const next = { ...(values as Record<string, unknown>) }
      delete next[SUPPLIER_KEY]
      copy[key] = next
    }
  }
  if (Array.isArray(copy.customFields)) copy.customFields = copy.customFields.filter((field) => !(field && typeof field === 'object' && (field as { key?: unknown }).key === SUPPLIER_KEY))
  return copy
}

export const interceptors: ApiInterceptor[] = [
  {
    id: 'dermat_products.catalog.products.hide-supplier',
    targetRoute: 'catalog/products',
    methods: ['GET'],
    priority: 40,
    async after(_request, response, context) {
      if (response.statusCode !== 200 || !Array.isArray(response.body.items)) return {}
      try {
        const rbac = context.container.resolve('rbacService') as RbacLike
        if (await rbac.userHasAllFeatures(context.userId, [SUPPLIER_FEATURE], { tenantId: context.tenantId, organizationId: context.organizationId })) return {}
      } catch {
        return { merge: { items: response.body.items.map(stripSupplier) } }
      }
      return { merge: { items: response.body.items.map(stripSupplier) } }
    },
  },
]
