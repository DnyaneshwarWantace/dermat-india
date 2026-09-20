import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext, CommandBus } from '@open-mercato/shared/lib/commands'
import { CrudHttpError, isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { readJsonSafe } from '@open-mercato/shared/lib/http/readJsonSafe'
import { createLogger } from '@open-mercato/shared/lib/logger'
import type { TransitionOrderStageInput, TransitionOrderStageResult } from '../../../../commands/transitionOrderStage'

const logger = createLogger('dermat_sales_flow')

const requestSchema = z.object({
  targetStage: z.enum([
    'new',
    'verified',
    'rnd_sample',
    'artwork_packaging',
    'procurement_material',
    'production',
    'qc_qa',
    'billing_payment',
    'ready_to_dispatch',
    'dispatched_completed',
  ]),
  actorName: z.string().optional().nullable(),
  advanceConfirmed: z.boolean().optional(),
  advanceReceivedAmount: z.number().optional().nullable(),
  advanceReceivedAt: z.string().optional().nullable(),
  advancePaymentRef: z.string().optional().nullable(),
  verifyNote: z.string().optional().nullable(),
  sampleSentNote: z.string().optional().nullable(),
  sampleId: z.string().optional().nullable(),
})

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['sales.orders.manage'] },
}

export async function POST(req: Request, routeCtx: { params: { id: string } }) {
  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromRequest(req)
    const { translate } = await resolveTranslations()
    if (!auth || !auth.tenantId) {
      throw new CrudHttpError(401, { error: translate('dermat_sales_flow.errors.unauthorized', 'Unauthorized') })
    }
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const organizationId = scope?.selectedId ?? auth.orgId ?? null
    if (!organizationId) {
      throw new CrudHttpError(400, { error: translate('dermat_sales_flow.errors.no_organization', 'No organization selected') })
    }
    const ctx: CommandRuntimeContext = {
      container,
      auth,
      organizationScope: scope,
      selectedOrganizationId: organizationId,
      organizationIds: scope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
      request: req,
    }

    const body = await readJsonSafe<Record<string, unknown>>(req, {})
    const parsed = requestSchema.parse(body)

    const commandBus = ctx.container.resolve<CommandBus>('commandBus')
    const result = await commandBus.execute<TransitionOrderStageInput, TransitionOrderStageResult>(
      'dermat_sales_flow.orders.transition_stage',
      {
        input: {
          id: routeCtx.params.id,
          organizationId,
          tenantId: auth.tenantId,
          targetStage: parsed.targetStage,
          actorName: parsed.actorName ?? auth.email ?? auth.userId ?? null,
          advanceConfirmed: parsed.advanceConfirmed,
          advanceReceivedAmount: parsed.advanceReceivedAmount,
          advanceReceivedAt: parsed.advanceReceivedAt,
          advancePaymentRef: parsed.advancePaymentRef,
          verifyNote: parsed.verifyNote,
          sampleSentNote: parsed.sampleSentNote,
          sampleId: parsed.sampleId,
        },
        ctx,
      },
    )

    return NextResponse.json(result.result ?? result)
  } catch (err) {
    if (isCrudHttpError(err)) {
      return NextResponse.json(err.body, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.issues }, { status: 400 })
    }
    logger.error('dermat_sales_flow.orders.transition_stage failed', { err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const resultSchema = z.object({ orderId: z.string(), stage: z.string() })
const errorSchema = z.object({ error: z.string(), code: z.string().optional() })

export const openApi: OpenApiRouteDoc = {
  tag: 'DermatSalesFlow',
  summary: 'Transition an order to a new Kanban pipeline stage',
  methods: {
    POST: {
      summary: 'Stage transition (gated)',
      description: 'Validates and applies a Kanban stage transition for an order per spec §5.2 — never a blind status write. Enforces the advance-payment gate before New -> Verified/Official, records verifier identity/timestamp, and requires a sample-sent confirmation before leaving R&D/Sample.',
      requestBody: { contentType: 'application/json', schema: requestSchema },
      responses: [
        { status: 200, description: 'Stage transitioned', schema: resultSchema },
      ],
      errors: [
        { status: 400, description: 'Validation failed', schema: errorSchema },
        { status: 401, description: 'Unauthorized', schema: errorSchema },
        { status: 404, description: 'Order not found', schema: errorSchema },
        { status: 422, description: 'Required stage data missing (advance/verify/sample gate)', schema: errorSchema },
      ],
    },
  },
}
