import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects } from '@open-mercato/shared/lib/commands/helpers'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError, notFound } from '@open-mercato/shared/lib/crud/errors'
import type { CrudIndexerConfig, CrudEventsConfig } from '@open-mercato/shared/lib/crud/types'
import { E } from '@/.mercato/generated/entities.ids.generated'
import { QcPolicy, QcTest } from '../data/entities'
import {
  qcTestCreateSchema,
  qcTestResultUpdateSchema,
  type QcTestCreateInput,
  type QcTestResultUpdateInput,
} from '../data/validators'
import { emitDermatQcEvent } from '../events'

const qcTestCrudIndexer: CrudIndexerConfig<QcTest> = {
  entityType: (E as { dermat_qc?: { qc_test?: string } }).dermat_qc?.qc_test ?? 'dermat_qc:qc_test',
}

const qcTestCrudEvents: CrudEventsConfig = {
  module: 'dermat_qc',
  entity: 'qc_test',
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

const createQcTestCommand: CommandHandler<QcTestCreateInput, { qcTestId: string }> = {
  id: 'dermat_qc.qc_tests.create',
  async execute(rawInput, ctx) {
    const parsed = qcTestCreateSchema.parse(rawInput)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const qcTest = em.create(QcTest, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      referenceType: parsed.referenceType,
      referenceId: parsed.referenceId ?? null,
      testType: parsed.testType,
      result: parsed.result ?? 'pending',
      testedBy: parsed.testedBy ?? null,
      testedAt: parsed.result && parsed.result !== 'pending' ? new Date() : null,
      remarks: parsed.remarks ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    em.persist(qcTest)
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: qcTest,
      identifiers: {
        id: qcTest.id,
        organizationId: qcTest.organizationId,
        tenantId: qcTest.tenantId,
      },
      indexer: qcTestCrudIndexer,
      events: qcTestCrudEvents,
    })

    return { qcTestId: qcTest.id }
  },
}

async function resolvePolicyRequirements(
  em: EntityManager,
  organizationId: string,
  tenantId: string,
  appliesTo: string | null | undefined,
): Promise<{ chemicalRequired: boolean; microRequired: boolean }> {
  if (!appliesTo) return { chemicalRequired: true, microRequired: true }
  const policy = await em.findOne(QcPolicy, { organizationId, tenantId, appliesTo })
  if (!policy) return { chemicalRequired: true, microRequired: true }
  return { chemicalRequired: policy.chemicalRequired, microRequired: policy.microRequired }
}

const updateQcTestResultCommand: CommandHandler<QcTestResultUpdateInput, { qcTestId: string; policyComplete: boolean }> = {
  id: 'dermat_qc.qc_tests.update_result',
  async execute(rawInput, ctx) {
    const parsed = qcTestResultUpdateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const qcTest = await em.findOne(QcTest, { id: parsed.id })
    if (!qcTest) throw notFound('QC test not found')
    ensureTenantScope(ctx, qcTest.tenantId)
    ensureOrganizationScope(ctx, qcTest.organizationId)

    qcTest.result = parsed.result
    qcTest.testedBy = parsed.testedBy ?? qcTest.testedBy ?? null
    qcTest.remarks = parsed.remarks !== undefined ? parsed.remarks ?? null : qcTest.remarks
    qcTest.testedAt = new Date()

    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: qcTest,
      identifiers: {
        id: qcTest.id,
        organizationId: qcTest.organizationId,
        tenantId: qcTest.tenantId,
      },
      indexer: qcTestCrudIndexer,
      events: qcTestCrudEvents,
    })

    let policyComplete = false

    if (qcTest.referenceType === 'batch_stage' && qcTest.referenceId) {
      const siblingTests = await em.find(QcTest, {
        organizationId: qcTest.organizationId,
        tenantId: qcTest.tenantId,
        referenceType: 'batch_stage',
        referenceId: qcTest.referenceId,
      })

      // No formal product/RM link exists on BatchStage yet (plain text fields only,
      // per this repo's no-cross-module-ORM-relation rule), so policy lookup by
      // `appliesTo` cannot be resolved from here — default to both-required.
      const { chemicalRequired, microRequired } = await resolvePolicyRequirements(
        em,
        qcTest.organizationId,
        qcTest.tenantId,
        null,
      )

      const chemicalPass = !chemicalRequired || siblingTests.some((row) => row.testType === 'chemical' && row.result === 'pass')
      const microPass = !microRequired || siblingTests.some((row) => row.testType === 'micro' && row.result === 'pass')

      policyComplete = chemicalPass && microPass

      if (policyComplete) {
        await emitDermatQcEvent('dermat_qc.test.completed', {
          referenceType: 'batch_stage',
          referenceId: qcTest.referenceId,
          organizationId: qcTest.organizationId,
          tenantId: qcTest.tenantId,
          result: 'pass',
        })
      } else if (parsed.result === 'fail') {
        await emitDermatQcEvent('dermat_qc.test.completed', {
          referenceType: 'batch_stage',
          referenceId: qcTest.referenceId,
          organizationId: qcTest.organizationId,
          tenantId: qcTest.tenantId,
          result: 'fail',
        })
      }
    }

    return { qcTestId: qcTest.id, policyComplete }
  },
}

const deleteQcTestCommand: CommandHandler<{ id: string }, { qcTestId: string }> = {
  id: 'dermat_qc.qc_tests.delete',
  async execute(rawInput, ctx) {
    const id = typeof rawInput?.id === 'string' ? rawInput.id : null
    if (!id) throw new CrudHttpError(400, { error: '[internal] QC test id is required' })
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const qcTest = await em.findOne(QcTest, { id })
    if (!qcTest) throw notFound('QC test not found')
    ensureTenantScope(ctx, qcTest.tenantId)
    ensureOrganizationScope(ctx, qcTest.organizationId)

    qcTest.deletedAt = new Date()
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: qcTest,
      identifiers: {
        id: qcTest.id,
        organizationId: qcTest.organizationId,
        tenantId: qcTest.tenantId,
      },
      indexer: qcTestCrudIndexer,
      events: qcTestCrudEvents,
    })

    return { qcTestId: qcTest.id }
  },
}

registerCommand(createQcTestCommand)
registerCommand(updateQcTestResultCommand)
registerCommand(deleteQcTestCommand)
