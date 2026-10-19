'use client'

import * as React from 'react'
import { Send } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

type LinkRow = { id: string; kind: string; title: string; path: string; sends: Array<{ via: string; by: string | null; at: string; to: string | null }>; openedCount: number; lastOpenedAt: string | null; revokedAt: string | null; createdAt: string }

function when(value: string | null): string {
  return value ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
}

export function LinksSentPanel({ orderId, customerId }: { orderId?: string; customerId?: string }) {
  const t = useT()
  const [rows, setRows] = React.useState<LinkRow[] | null>(null)

  React.useEffect(() => {
    const query = orderId ? `orderId=${orderId}` : `customerId=${customerId}`
    apiCall<{ items?: LinkRow[] }>(`/api/dermat_orders/doc-links?${query}`, { headers: { 'x-om-forbidden-redirect': '0' } }, { fallback: { items: [] } }).then((call) => setRows(call.result?.items ?? []))
  }, [orderId, customerId])

  if (!rows) return null
  return (
    <section className="space-y-2 rounded-lg border bg-card p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <Send className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        {t('dermat_orders.linksSent.title', 'Links sent')}
      </h3>
      {rows.length ? (
        <ul className="divide-y text-sm">
          {rows.map((row) => {
            const last = row.sends[row.sends.length - 1]
            return (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="block font-medium">{row.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {last
                      ? t('dermat_orders.linksSent.last', 'Sent {count}× · last by {who} {when}{to}', { count: row.sends.length, who: last.by ?? '—', when: when(last.at), to: last.to ? ` to ${last.to}` : '' })
                      : t('dermat_orders.linksSent.notSent', 'Link made {when}, not sent yet', { when: when(row.createdAt) })}
                  </span>
                </span>
                {row.revokedAt ? (
                  <StatusBadge variant="neutral">{t('dermat_orders.linksSent.stopped', 'Stopped')}</StatusBadge>
                ) : row.openedCount ? (
                  <StatusBadge variant="success">{t('dermat_orders.linksSent.opened', 'Opened {count}×', { count: row.openedCount })}</StatusBadge>
                ) : (
                  <StatusBadge variant="warning">{t('dermat_orders.linksSent.unopened', 'Not opened')}</StatusBadge>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t('dermat_orders.linksSent.none', 'No document has been sent as a link yet.')}</p>
      )}
    </section>
  )
}

export default LinksSentPanel
