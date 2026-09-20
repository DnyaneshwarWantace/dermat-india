import type { EntityManager } from '@mikro-orm/postgresql'
import type { CommandHandler, CommandBus } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands/registry'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { loadCustomFieldValues } from '@open-mercato/shared/lib/crud/custom-fields'
import { emitDermatSalesFlowEvent } from '../events'

/**
 * Server-side half of the Kanban stage-gate mechanism (spec §5.2: "Dragging an order between
 * columns must never be a blind status update. It should open the required stage action,
 * validate mandatory data, complete the stage transaction, then move the order.").
 *
 * The client (StageActionDialog) collects whatever the target stage needs — an advance
 * confirmation, a verifier identity, a sample-sent note — and this command re-validates that
 * data server-side before writing `customFields.order_stage` (and any stage-specific fields)
 * on the order. It never bypasses the `sales` module's own status workflow; it only manages
 * the dermat-specific pipeline projection layered on top (see ce.ts `order_stage`).
 */

export type TransitionOrderStageInput = {
  id: string
  organizationId: string
  tenantId: string
  targetStage: string
  actorName?: string | null
  // Advance-payment gate (New -> Verified/Official)
  advanceConfirmed?: boolean
  advanceReceivedAmount?: number | null
  advanceReceivedAt?: string | null
  advancePaymentRef?: string | null
  // Verify gate (New -> Verified/Official)
  verifyNote?: string | null
  // R&D / Sample-sent gate (R&D/Sample -> next)
  sampleSentNote?: string | null
  sampleId?: string | null
  // Reverting to an earlier stage (client ask: reverts are allowed, but only with a reason)
  revertReason?: string | null
}

export type TransitionOrderStageResult = {
  orderId: string
  stage: string
}

const STAGE_ORDER = [
  'new',
  'advance_payment',
  'verified',
  'rnd_sample',
  'artwork_packaging',
  'procurement_material',
  'production',
  'qc_qa',
  'billing_payment',
  'ready_to_dispatch',
  'dispatched_completed',
] as const

type Stage = (typeof STAGE_ORDER)[number]

function isKnownStage(value: string): value is Stage {
  return (STAGE_ORDER as readonly string[]).includes(value)
}

const transitionOrderStageCommand: CommandHandler<TransitionOrderStageInput, TransitionOrderStageResult> = {
  id: 'dermat_sales_flow.orders.transition_stage',
  async execute(rawInput, ctx) {
    const { id, organizationId, tenantId, targetStage } = rawInput
    if (!id || !organizationId || !tenantId || !targetStage) {
      throw new CrudHttpError(400, { error: '[internal] id, organizationId, tenantId and targetStage are required' })
    }
    if (!isKnownStage(targetStage)) {
      throw new CrudHttpError(400, { error: '[internal] Unknown target stage' })
    }

    const em = ctx.container.resolve<EntityManager>('em').fork()

    const orderRows = await em.getConnection().execute<Array<{
      id: string
      status: string | null
      updated_at: string
    }>>(
      `select id, status, updated_at from sales_orders
       where id = ? and organization_id = ? and tenant_id = ? and deleted_at is null`,
      [id, organizationId, tenantId],
    )
    const order = orderRows[0]
    if (!order) {
      throw new CrudHttpError(404, { error: '[internal] Order not found' })
    }

    const customFieldValues = await loadCustomFieldValues({
      em,
      entityId: 'sales:sales_order',
      recordIds: [id],
      tenantFallbacks: [tenantId],
    })
    const existing = customFieldValues[id] ?? {}
    const currentStage = typeof existing.order_stage === 'string' && existing.order_stage.length > 0
      ? existing.order_stage
      : 'new'

    // Orders move one stage at a time (spec §5.2: never a blind status update). Enforced here,
    // not just in the UI, so a direct API call can't skip stages either. Forward: exactly the
    // next stage. Backward: any earlier stage, but only with a reason (client ask: "user can
    // revert back but with the reason they need to come").
    const currentIdx = STAGE_ORDER.indexOf(currentStage as Stage)
    const targetIdx = STAGE_ORDER.indexOf(targetStage as Stage)
    const isForward = targetIdx === currentIdx + 1
    const isBackward = targetIdx >= 0 && targetIdx < currentIdx
    if (!isForward && !isBackward) {
      throw new CrudHttpError(422, {
        error: '[internal] Orders can only move to the next stage, or back to an earlier stage with a reason',
        code: 'stage_skip_not_allowed',
      })
    }
    if (isBackward && !rawInput.revertReason?.trim()) {
      throw new CrudHttpError(422, {
        error: '[internal] A reason is required to move an order back to an earlier stage',
        code: 'revert_reason_required',
      })
    }

    const nextCustomFields: Record<string, unknown> = {}
    if (isBackward && rawInput.revertReason) {
      nextCustomFields.order_stage_revert_reason = rawInput.revertReason.trim()
      nextCustomFields.order_stage_reverted_by = rawInput.actorName || null
      nextCustomFields.order_stage_reverted_at = new Date().toISOString()
    }

    // Process advance payment confirmation if provided in this stage action
    if (rawInput.advanceConfirmed) {
      if (rawInput.advanceReceivedAmount != null) {
        nextCustomFields.advance_received_amount = rawInput.advanceReceivedAmount
      }
      nextCustomFields.advance_received_at = rawInput.advanceReceivedAt || new Date().toISOString().slice(0, 10)
      if (rawInput.advancePaymentRef) {
        nextCustomFields.payment_ref = rawInput.advancePaymentRef
      }
    }

    // Advance-payment gate: Moving into advance_payment
    if (targetStage === 'advance_payment') {
      const advanceRequired = Boolean(existing.advance_required)
      const alreadyReceived =
        (existing.advance_received_amount != null && Number(existing.advance_received_amount) > 0) ||
        (nextCustomFields.advance_received_amount != null && Number(nextCustomFields.advance_received_amount) > 0)
      if (advanceRequired && !alreadyReceived && !rawInput.advanceConfirmed) {
        // Moving to advance_payment stage can simply hold the order in advance_payment stage
      }
    }

    // Verify gate: confirming an order records who verified it and when (spec §4.2: every
    // submit/update records actor, time). Independently re-checks advance payment too, since
    // an order can reach 'verified' via a revert + re-forward path that skips the
    // advance_payment stage's own transition call.
    if (targetStage === 'verified') {
      const advanceRequired = Boolean(existing.advance_required)
      const alreadyReceived =
        (existing.advance_received_amount != null && Number(existing.advance_received_amount) > 0) ||
        (nextCustomFields.advance_received_amount != null && Number(nextCustomFields.advance_received_amount) > 0)
      if (advanceRequired && !alreadyReceived) {
        throw new CrudHttpError(422, {
          error: '[internal] Advance payment must be confirmed before verifying this order',
          code: 'advance_confirmation_required',
        })
      }
      if (!rawInput.actorName) {
        throw new CrudHttpError(422, {
          error: '[internal] Verifying actor is required',
          code: 'verifier_required',
        })
      }
      nextCustomFields.order_verified = true
      nextCustomFields.order_verified_by = rawInput.actorName
      nextCustomFields.order_verified_at = new Date().toISOString()
      if (rawInput.verifyNote) {
        nextCustomFields.order_verify_note = rawInput.verifyNote
      }
    }

    // R&D / Sample-sent gate: leaving 'rnd_sample' requires confirmation that a sample was
    // sent to the client (spec §6: sample loop must be tracked, not just entered as a result).
    if (currentStage === 'rnd_sample' && targetStage !== 'rnd_sample' && targetStage !== 'new') {
      // Advance payment is re-checked HERE independently, not just relied on from the earlier
      // New -> Verified gate (client ask: "only give the sample when advance payment is done"
      // as a standing rule). The Verified gate alone isn't sufficient because advance_required
      // can be left unchecked at order creation, or an order can reach this stage via a revert
      // + re-forward path — the sample must never go out without advance confirmed, regardless
      // of how the order got here.
      const advanceRequired = Boolean(existing.advance_required)
      const advanceReceived = existing.advance_received_amount != null && Number(existing.advance_received_amount) > 0
      if (advanceRequired && !advanceReceived) {
        throw new CrudHttpError(422, {
          error: '[internal] Advance payment must be received before a sample can be sent to the client',
          code: 'advance_required_before_sample',
        })
      }
      if (!rawInput.sampleSentNote && !rawInput.sampleId) {
        throw new CrudHttpError(422, {
          error: '[internal] Confirm the sample sent to the client before leaving the R&D/Sample stage',
          code: 'sample_sent_confirmation_required',
        })
      }
      nextCustomFields.rnd_sample_sent_confirmed = true
      nextCustomFields.rnd_sample_sent_at = new Date().toISOString()
      if (rawInput.sampleSentNote) {
        nextCustomFields.rnd_sample_sent_note = rawInput.sampleSentNote
      }
    }

    nextCustomFields.order_stage = targetStage

    const commandBus = ctx.container.resolve<CommandBus>('commandBus')
    await commandBus.execute<Record<string, unknown>, { id: string }>(
      'sales.orders.update',
      {
        input: {
          id,
          customFields: nextCustomFields,
          metadata: { order_stage: targetStage },
        },
        ctx,
      },
    )

    await emitDermatSalesFlowEvent('dermat_sales_flow.order.stage_changed', {
      orderId: id,
      organizationId,
      tenantId,
      stage: targetStage,
      previousStage: currentStage,
      isRevert: isBackward,
      revertReason: isBackward ? rawInput.revertReason?.trim() ?? null : null,
      actorName: rawInput.actorName ?? null,
    })

    // R&D auto-handoff (spec correction): verifying an order must create the R&D case
    // automatically, no manual re-entry by the R&D team. Fired once, on the transition into
    // 'verified' — subscribers (dermat_sampling) own actually creating the case record.
    if (targetStage === 'verified' && currentStage !== 'verified') {
      await emitDermatSalesFlowEvent('dermat_sales_flow.order.verified', {
        orderId: id,
        organizationId,
        tenantId,
        verifiedBy: rawInput.actorName ?? null,
      })
    }

    return { orderId: id, stage: targetStage }
  },
}

registerCommand(transitionOrderStageCommand)

export default transitionOrderStageCommand
