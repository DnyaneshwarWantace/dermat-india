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
import { signOffStageSchema, type SignOffStageInput } from '../../../data/validators'

const logger = createLogger('dermat_production')

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['dermat_production.sign_off'] },
}

export async function POST(req: Request) {
  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromRequest(req)
    const { translate } = await resolveTranslations()
    if (!auth || !auth.tenantId) {
      throw new CrudHttpError(401, { error: translate('dermat_production.errors.unauthorized', 'Unauthorized') })
    }
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const ctx: CommandRuntimeContext = {
      container,
      auth,
      organizationScope: scope,
      selectedOrganizationId: scope?.selectedId ?? auth.orgId ?? null,
      organizationIds: scope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
      request: req,
    }

    const body = await readJsonSafe<Record<string, unknown>>(req, {})
    const parsed = signOffStageSchema.parse(body)

    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    await commandBus.execute<SignOffStageInput, { stageId: string }>(
      'dermat_production.batch_stages.sign_off',
      { input: parsed, ctx },
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (isCrudHttpError(err)) {
      return NextResponse.json(err.body, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.issues }, { status: 400 })
    }
    logger.error('dermat_production.batch_stages.sign_off failed', { err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const okResponseSchema = z.object({ ok: z.boolean() })
const errorSchema = z.object({ error: z.string() })

export const openApi: OpenApiRouteDoc = {
  tag: 'DermatProduction',
  summary: 'Sign off a production batch stage',
  methods: {
    POST: {
      summary: 'Sign off a batch stage',
      description: 'Marks a batch stage as done, records who signed off, and readies the next non-skipped stage.',
      requestBody: { contentType: 'application/json', schema: signOffStageSchema },
      responses: [
        { status: 200, description: 'Stage signed off', schema: okResponseSchema },
      ],
      errors: [
        { status: 400, description: 'Validation failed', schema: errorSchema },
        { status: 401, description: 'Unauthorized', schema: errorSchema },
        { status: 404, description: 'Batch stage not found', schema: errorSchema },
      ],
    },
  },
}
