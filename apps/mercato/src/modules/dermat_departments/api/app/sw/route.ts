import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  GET: { requireAuth: false },
}

const WORKER = `
self.addEventListener('install', function () { self.skipWaiting() })
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()) })
self.addEventListener('push', function (event) {
  var data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) { data = { title: 'Dermat ERP', body: event.data ? event.data.text() : '' } }
  var icon = '/api/dermat_departments/app/icon?size=192'
  event.waitUntil(self.registration.showNotification(data.title || 'Dermat ERP', { body: data.body || '', icon: icon, badge: icon, tag: data.tag || undefined, data: { url: data.url || '/backend/my-work' } }))
})
self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  var url = (event.notification.data && event.notification.data.url) || '/backend/my-work'
  if (url.charAt(0) !== '/') url = '/backend/my-work'
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if ('focus' in list[i]) { list[i].navigate(url); return list[i].focus() } }
    return self.clients.openWindow(url)
  }))
})
`

async function GET() {
  return new NextResponse(WORKER, {
    headers: { 'content-type': 'application/javascript; charset=utf-8', 'service-worker-allowed': '/', 'cache-control': 'no-cache' },
  })
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat Departments',
  summary: 'Background script that shows phone pop-ups',
  methods: { GET: { summary: 'Service worker for phone pop-ups', tags: ['Dermat Departments'], responses: [{ status: 200, description: 'JavaScript', schema: z.string() }] } },
}

export { GET }
