import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { issueSchema } from '../../../data/validators'
import { issueMaterial } from '../../../lib/service'
import { storeAction } from '../../../lib/action'
import { notifyIssued } from '../../../lib/notify'
import { currentUserName } from '../../../../dermat_orders/lib/server'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['dermat_store.issue'] },
}

const POST = storeAction(issueSchema, 'Enter the quantity to issue', async (ctx, request, input) => {
  await issueMaterial(ctx, request, input)
  await notifyIssued(ctx, request, await currentUserName(ctx))
})

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat Store',
  summary: 'Issue material from the store to production',
  methods: {
    POST: {
      summary: 'Move stock from the RM / PM store to PRODUCTION, per batch; the order reservation is used first',
      tags: ['Dermat Store'],
      requestBody: { schema: issueSchema },
      responses: [{ status: 200, description: 'The updated request', schema: z.object({ id: z.string() }).passthrough() }],
      errors: [{ status: 409, description: 'Not enough free stock, request closed, or the request changed' }],
    },
  },
}

export { POST }
