import type { CommandRuntimeContext } from '@wantace/shared/lib/commands'
import { CrudHttpError } from '@wantace/shared/lib/crud/errors'
import { ensureOrganizationScope } from '@wantace/shared/lib/commands/scope'
import type { EntityManager } from '@mikro-orm/postgresql'

export function ensureTenantScope(ctx: CommandRuntimeContext, tenantId: string): void {
  const currentTenant = ctx.auth?.tenantId ?? null
  if (currentTenant && currentTenant !== tenantId) {
    throw new CrudHttpError(403, { error: 'Forbidden' })
  }
}

export function requireId(id: string | null | undefined, label: string): string {
  if (typeof id === 'string' && id.trim().length > 0) return id.trim()
  throw new CrudHttpError(400, { error: `${label} id is required.` })
}

export function normalizeOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function resolveScope(ctx: CommandRuntimeContext, fallback?: { tenantId?: string | null; organizationId?: string | null }) {
  return {
    tenantId: fallback?.tenantId ?? ctx.auth?.tenantId ?? null,
    organizationId: fallback?.organizationId ?? ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null,
  }
}

export function resolveEm(ctx: CommandRuntimeContext): EntityManager {
  return (ctx.container.resolve('em') as EntityManager).fork()
}

export { ensureOrganizationScope }
