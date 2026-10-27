'use client'

import * as React from 'react'
import { Copy, Link2, Mail, MessageCircle, Send } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { formatDateTime } from '../format'
import type { Order } from '../types'

type Approval = { id: string; status: 'open' | 'approved' | 'changes' | 'closed'; clientName: string | null; clientDesignation: string | null; signature: string | null; comments: string | null; ip: string | null; userAgent: string | null; decidedAt: string | null; expiresAt: string; fileCount: number; createdByName: string | null; createdAt: string }

const STATUS: Record<Approval['status'], { label: string; variant: 'info' | 'success' | 'warning' | 'neutral' }> = {
  open: { label: 'Waiting for the client', variant: 'info' },
  approved: { label: 'Approved', variant: 'success' },
  changes: { label: 'Changes asked', variant: 'warning' },
  closed: { label: 'Replaced by a newer link', variant: 'neutral' },
}

export function ClientApprovalPanel({ order, canSend }: { order: Order; canSend: boolean }) {
  const t = useT()
  const { runMutation } = useGuardedMutation({ contextId: `dermat-artwork-approval-${order.id}` })
  const [items, setItems] = React.useState<Approval[]>([])
  const [link, setLink] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    const call = await apiCall<{ items?: Approval[] }>(`/api/dermat_orders/artwork-approval?orderId=${encodeURIComponent(order.id)}`, undefined, { fallback: { items: [] } })
    setItems(call.result?.items ?? [])
  }, [order.id])

  React.useEffect(() => {
    void load()
  }, [load, order.updatedAt])

  const send = async () => {
    setBusy(true)
    try {
      const body = { orderId: order.id }
      const call = await runMutation({
        context: { orderId: order.id, action: 'artwork_approval' },
        mutationPayload: body,
        operation: () => apiCall<{ path?: string; error?: string }>('/api/dermat_orders/artwork-approval', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
      })
      if (!call.ok || !call.result?.path) {
        flash(call.result?.error ?? t('dermat_orders.approvalLink.failed', 'Could not make the link.'), 'error')
        return
      }
      setLink(`${window.location.origin}${call.result.path}`)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const message = link ? t('dermat_orders.approvalLink.message', 'Dear {name}, please check and approve the artwork for order {order}: {link}', { name: order.customer?.name ?? '', order: order.orderNo, link }) : ''
  const phone = order.customer?.phone?.replace(/[^0-9]/g, '') ?? ''
  const email = order.customer?.email ?? ''

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Link2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {t('dermat_orders.approvalLink.title', 'Client approval online')}
        </p>
        {canSend ? (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void send()}>
            <Send className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {items.some((item) => item.status === 'open') ? t('dermat_orders.approvalLink.resend', 'New link for this version') : t('dermat_orders.approvalLink.send', 'Send for client approval')}
          </Button>
        ) : null}
      </div>
      {link ? (
        <div className="space-y-2 rounded-md bg-muted/40 p-2">
          <Input readOnly value={link} aria-label={t('dermat_orders.approvalLink.link', 'Approval link')} onFocus={(event) => event.target.select()} />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard?.writeText(link)
                flash(t('dermat_orders.approvalLink.copied', 'Link copied'), 'success')
              }}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {t('dermat_orders.approvalLink.copy', 'Copy')}
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                WhatsApp
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={`mailto:${email}?subject=${encodeURIComponent(t('dermat_orders.approvalLink.subject', 'Artwork approval for order {order}', { order: order.orderNo }))}&body=${encodeURIComponent(message)}`}>
                <Mail className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                {t('dermat_orders.approvalLink.email', 'Email')}
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('dermat_orders.approvalLink.once', 'The link works once and opens without login. Keep it: it is shown only now.')}</p>
        </div>
      ) : null}
      {items.length ? (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="space-y-1 rounded-md border p-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusBadge variant={STATUS[item.status].variant}>{STATUS[item.status].label}</StatusBadge>
                <span className="text-muted-foreground">{t('dermat_orders.approvalLink.sentBy', 'Sent {when} by {who}', { when: formatDateTime(item.createdAt), who: item.createdByName ?? '—' })}</span>
              </div>
              {item.decidedAt ? (
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{[item.clientName, item.clientDesignation].filter(Boolean).join(', ')}</p>
                    <p className="text-muted-foreground">{[formatDateTime(item.decidedAt), item.ip ? `IP ${item.ip}` : null].filter(Boolean).join(' · ')}</p>
                    {item.comments ? <p>{item.comments}</p> : null}
                  </div>
                  {item.signature ? <img src={item.signature} alt={t('dermat_orders.approvalLink.signatureOf', 'Signature of {name}', { name: item.clientName ?? '' })} className="h-14 rounded-sm border bg-white" /> : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs text-muted-foreground">{t('dermat_orders.approvalLink.or', 'Or upload the signed copy / email reply below, as before.')}</p>
    </div>
  )
}

export default ClientApprovalPanel
