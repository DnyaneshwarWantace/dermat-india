import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { appIconPng } from '../../../lib/appIcon'

export const metadata = {
  GET: { requireAuth: false },
}

const SIZES = [180, 192, 512] as const
const querySchema = z.object({ size: z.coerce.number().int().refine((value) => (SIZES as readonly number[]).includes(value)).default(192) })

async function GET(req: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  const size = parsed.success ? parsed.data.size : 192
  return new NextResponse(new Uint8Array(appIconPng(size)), { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=604800' } })
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat Departments',
  summary: 'Phone app icon',
  methods: { GET: { summary: 'Home-screen icon of the Dermat ERP (180, 192 or 512 px PNG)', tags: ['Dermat Departments'], query: querySchema, responses: [{ status: 200, description: 'PNG image', schema: z.string() }] } },
}

export { GET }
