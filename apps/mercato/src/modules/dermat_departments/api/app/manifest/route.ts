import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  GET: { requireAuth: false },
}

const ICON = '/api/dermat_departments/app/icon'

async function GET() {
  return new NextResponse(
    JSON.stringify({
      id: '/backend/my-work',
      name: 'Dermat India ERP',
      short_name: 'Dermat ERP',
      description: 'Orders, production, store, QC and dispatch for Dermat India',
      start_url: '/backend/my-work',
      scope: '/',
      display: 'standalone',
      orientation: 'any',
      background_color: '#f6f7f9',
      theme_color: '#0e6b66',
      icons: [
        { src: `${ICON}?size=192`, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: `${ICON}?size=512`, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: `${ICON}?size=512`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
      shortcuts: [
        { name: 'My tasks', url: '/backend/my-work' },
        { name: 'Order book', url: '/backend/orders' },
      ],
    }),
    { headers: { 'content-type': 'application/manifest+json', 'cache-control': 'public, max-age=3600' } },
  )
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat Departments',
  summary: 'Phone app manifest',
  methods: { GET: { summary: 'Web app manifest so the ERP installs on a phone home screen', tags: ['Dermat Departments'], responses: [{ status: 200, description: 'Manifest', schema: z.object({ name: z.string() }).passthrough() }] } },
}

export { GET }
