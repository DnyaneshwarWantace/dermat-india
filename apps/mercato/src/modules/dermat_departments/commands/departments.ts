import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects } from '@open-mercato/shared/lib/commands/helpers'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError, notFound } from '@open-mercato/shared/lib/crud/errors'
import type { CrudIndexerConfig, CrudEventsConfig } from '@open-mercato/shared/lib/crud/types'
import { E } from '@/.mercato/generated/entities.ids.generated'
import { Department } from '../data/entities'
import {
  departmentCreateSchema,
  departmentUpdateSchema,
  type DepartmentCreateInput,
  type DepartmentUpdateInput,
} from '../data/validators'

const departmentCrudIndexer: CrudIndexerConfig<Department> = {
  entityType: (E as { dermat_departments?: { department?: string } }).dermat_departments?.department
    ?? 'dermat_departments:department',
}

const departmentCrudEvents: CrudEventsConfig = {
  module: 'dermat_departments',
  entity: 'department',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    organizationId: ctx.identifiers.organizationId,
    tenantId: ctx.identifiers.tenantId,
  }),
}

function ensureTenantScope(ctx: { auth?: { tenantId?: string | null } | null }, tenantId: string): void {
  if (ctx.auth?.tenantId && ctx.auth.tenantId !== tenantId) {
    throw new CrudHttpError(403, { error: '[internal] tenant scope mismatch' })
  }
}

function ensureOrganizationScope(
  ctx: { selectedOrganizationId?: string | null; auth?: { orgId?: string | null } | null },
  organizationId: string | undefined,
): void {
  const scopedOrgId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (organizationId && scopedOrgId && organizationId !== scopedOrgId) {
    throw new CrudHttpError(403, { error: '[internal] organization scope mismatch' })
  }
}

const createDepartmentCommand: CommandHandler<DepartmentCreateInput, { departmentId: string }> = {
  id: 'dermat_departments.departments.create',
  async execute(rawInput, ctx) {
    const parsed = departmentCreateSchema.parse(rawInput)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const department = em.create(Department, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      name: parsed.name,
      type: parsed.type,
      contactEmail: parsed.contactEmail ?? null,
      contactPhone: parsed.contactPhone ?? null,
      isActive: parsed.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    em.persist(department)
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: department,
      identifiers: {
        id: department.id,
        organizationId: department.organizationId,
        tenantId: department.tenantId,
      },
      indexer: departmentCrudIndexer,
      events: departmentCrudEvents,
    })

    return { departmentId: department.id }
  },
}

const updateDepartmentCommand: CommandHandler<DepartmentUpdateInput, { departmentId: string }> = {
  id: 'dermat_departments.departments.update',
  async execute(rawInput, ctx) {
    const parsed = departmentUpdateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const department = await em.findOne(Department, { id: parsed.id })
    if (!department) throw notFound('Department not found')
    ensureTenantScope(ctx, department.tenantId)
    ensureOrganizationScope(ctx, department.organizationId)

    if (parsed.name !== undefined) department.name = parsed.name
    if (parsed.type !== undefined) department.type = parsed.type
    if (parsed.contactEmail !== undefined) department.contactEmail = parsed.contactEmail ?? null
    if (parsed.contactPhone !== undefined) department.contactPhone = parsed.contactPhone ?? null
    if (parsed.isActive !== undefined) department.isActive = parsed.isActive

    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: department,
      identifiers: {
        id: department.id,
        organizationId: department.organizationId,
        tenantId: department.tenantId,
      },
      indexer: departmentCrudIndexer,
      events: departmentCrudEvents,
    })

    return { departmentId: department.id }
  },
}

const deleteDepartmentCommand: CommandHandler<{ id: string }, { departmentId: string }> = {
  id: 'dermat_departments.departments.delete',
  async execute(rawInput, ctx) {
    const id = typeof rawInput?.id === 'string' ? rawInput.id : null
    if (!id) throw new CrudHttpError(400, { error: '[internal] Department id is required' })
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const department = await em.findOne(Department, { id })
    if (!department) throw notFound('Department not found')
    ensureTenantScope(ctx, department.tenantId)
    ensureOrganizationScope(ctx, department.organizationId)

    department.deletedAt = new Date()
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: department,
      identifiers: {
        id: department.id,
        organizationId: department.organizationId,
        tenantId: department.tenantId,
      },
      indexer: departmentCrudIndexer,
      events: departmentCrudEvents,
    })

    return { departmentId: department.id }
  },
}

registerCommand(createDepartmentCommand)
registerCommand(updateDepartmentCommand)
registerCommand(deleteDepartmentCommand)
