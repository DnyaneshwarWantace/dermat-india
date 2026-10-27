import { NextResponse } from 'next/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { resolveOrderContext } from '../../../../dermat_orders/lib/server'
import { RdRequest, RdTrial } from '../../../data/entities'
import { rdExportSchema } from '../../../data/validators'
import { requestFilter } from '../../../lib/service'
import { approvalProofCounts } from '../../../lib/trials'
import { TRIAL_INDEX_COLUMNS, TRIAL_INDEX_GROUPS, trialIndexRow } from '../../../lib/trialIndex'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['dermat_rnd.view'] },
}

function cell(value: string): string {
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

async function GET(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = rdExportSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
  const requests = await ctx.em.find(RdRequest, requestFilter(ctx, parsed.data), { orderBy: { code: 'asc' }, limit: 2000 })
  const byId = new Map(requests.map((request) => [request.id, request]))
  const trials = requests.length
    ? await ctx.em.find(RdTrial, { requestId: { $in: requests.map((request) => request.id) }, tenantId: ctx.tenantId, organizationId: ctx.organizationId, deletedAt: null }, { orderBy: { code: 'asc' } })
    : []
  const proofs = await approvalProofCounts(ctx, trials.map((trial) => trial.id))
  const groupRow = TRIAL_INDEX_GROUPS.flatMap((group) => [group.title, ...Array(group.span - 1).fill('')])
  const rows = [groupRow, TRIAL_INDEX_COLUMNS, ...trials.map((trial) => trialIndexRow(byId.get(trial.requestId) as RdRequest, trial, proofs.get(trial.id) ?? 0))]
  const body = '﻿' + rows.map((row) => row.map((value) => cell(String(value ?? ''))).join(',')).join('\r\n')
  const stamp = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  return new Response(body, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="rnd-trial-index-${stamp}.csv"` } })
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat R&D',
  summary: 'R&D trial index',
  methods: {
    GET: { summary: 'Download every trial as the R&D trial index (35 columns, CSV for Excel)', tags: ['Dermat R&D'], responses: [{ status: 200, description: 'CSV file' }] },
  },
}

export { GET }
