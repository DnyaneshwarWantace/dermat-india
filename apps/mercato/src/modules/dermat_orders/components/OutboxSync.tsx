'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { CloudUpload } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { OUTBOX_EVENT, isOffline, readOutbox, removeFromOutbox, type OutboxEntry } from './outbox'
import type { Order } from './types'

type Outcome = 'sent' | 'refused' | 'later'

export function OutboxSync() {
  const t = useT()
  const { runMutation } = useGuardedMutation({ contextId: 'dermat-outbox' })
  const [count, setCount] = React.useState(0)
  const [mounted, setMounted] = React.useState(false)
  const sending = React.useRef(false)

  const sendOne = React.useCallback(
    async (entry: OutboxEntry): Promise<Outcome> => {
      try {
        const fresh = await apiCall<Order>(`/api/dermat_orders/orders?id=${encodeURIComponent(entry.orderId)}`)
        if (!fresh.ok || !fresh.result) return fresh.status >= 500 ? 'later' : 'refused'
        const stage = fresh.result.stages.find((item) => item.key === entry.stageKey)
        const body = { orderId: entry.orderId, stageKey: entry.stageKey, ...entry.request }
        const call = await runMutation({
          context: { orderId: entry.orderId, stageKey: entry.stageKey, action: entry.request.action, outbox: true },
          mutationPayload: body,
          operation: () =>
            apiCall<{ error?: string }>('/api/dermat_orders/orders/stage', {
              method: 'POST',
              headers: { 'content-type': 'application/json', 'x-om-if-match': fresh.result?.updatedAt ?? '', ...(stage?.updatedAt ? { 'x-dermat-stage-version': stage.updatedAt } : {}) },
              body: JSON.stringify(body),
            }),
        })
        if (call.ok) {
          flash(t('dermat_orders.outbox.sent', 'Sent: {label} ({order})', { label: entry.label, order: entry.orderNo }), 'success')
          return 'sent'
        }
        if (call.status >= 500) return 'later'
        flash(t('dermat_orders.outbox.refused', 'Could not send "{label}" for {order}: {reason}', { label: entry.label, order: entry.orderNo, reason: call.result?.error ?? String(call.status) }), 'error')
        return 'refused'
      } catch {
        return 'later'
      }
    },
    [runMutation, t],
  )

  const flush = React.useCallback(async () => {
    if (sending.current || isOffline()) return
    sending.current = true
    try {
      for (const entry of readOutbox()) {
        const outcome = await sendOne(entry)
        if (outcome === 'later') break
        removeFromOutbox(entry.id)
      }
    } finally {
      sending.current = false
      setCount(readOutbox().length)
    }
  }, [sendOne])

  React.useEffect(() => {
    setMounted(true)
    setCount(readOutbox().length)
    const onChange = () => setCount(readOutbox().length)
    const onOnline = () => void flush()
    window.addEventListener(OUTBOX_EVENT, onChange)
    window.addEventListener('online', onOnline)
    const timer = window.setInterval(() => {
      if (readOutbox().length) void flush()
    }, 30_000)
    void flush()
    return () => {
      window.removeEventListener(OUTBOX_EVENT, onChange)
      window.removeEventListener('online', onOnline)
      window.clearInterval(timer)
    }
  }, [flush])

  if (!mounted || !count) return null
  return createPortal(
    <div role="status" className="fixed inset-x-0 bottom-20 z-50 mx-auto flex w-fit max-w-full items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs font-medium shadow-md md:bottom-4">
      <CloudUpload className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      {t('dermat_orders.outbox.waiting', '{count} saved on this phone, waiting to send', { count })}
    </div>,
    document.body,
  )
}

export default OutboxSync
