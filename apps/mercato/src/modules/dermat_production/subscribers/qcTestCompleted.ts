import type { EntityManager } from '@mikro-orm/postgresql'

export const metadata = {
  event: 'dermat_qc.test.completed',
  persistent: true,
  id: 'dermat_production:qc-test-completed',
}

type QcTestCompletedPayload = {
  referenceType?: string
  referenceId?: string
  organizationId?: string
  tenantId?: string
  result?: 'pass' | 'fail'
}

type SubscriberContext = {
  resolve: <T = unknown>(name: string) => T
}

/**
 * Reacts to QC completing all policy-required tests for a batch stage.
 *
 * This module never imports `dermat_qc`'s entities (cross-module ORM
 * relations are banned in this repo), and `dermat_qc` never imports
 * `dermat_production`'s `BatchStage` entity either — the only coupling is
 * this event. Because the peer's table also lives in this module (BatchStage
 * is owned by dermat_production), we can safely use the typed EntityManager
 * with a raw `nativeUpdate` against our own table by entity metadata name.
 */
export default async function handle(payload: QcTestCompletedPayload, ctx: SubscriberContext): Promise<void> {
  if (payload.referenceType !== 'batch_stage' || !payload.referenceId) return

  const em = ctx.resolve<EntityManager>('em').fork()

  const nextStatus = payload.result === 'fail' ? 'qc_failed' : 'qc_passed'

  await em.getConnection().execute(
    `update dermat_batch_stages set status = ?, updated_at = now() where id = ? and organization_id = ? and tenant_id = ? and deleted_at is null`,
    [nextStatus, payload.referenceId, payload.organizationId ?? null, payload.tenantId ?? null],
  )
}
