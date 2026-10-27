'use client'

import * as React from 'react'
import { BellOff, BellRing } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'

const WORKER = '/api/dermat_departments/app/sw'

type State = 'unsupported' | 'unset' | 'blocked' | 'off' | 'on'

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index)
  return bytes
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration('/')
  return registration ? registration.pushManager.getSubscription() : null
}

export function PhoneAlertsButton() {
  const t = useT()
  const { runMutation } = useGuardedMutation({ contextId: 'dermat-phone-alerts' })
  const [state, setState] = React.useState<State | null>(null)
  const [publicKey, setPublicKey] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return setState('unsupported')
      const call = await apiCall<{ ready?: boolean; publicKey?: string | null }>('/api/dermat_departments/push', undefined, { fallback: {} })
      if (cancelled) return
      if (!call.result?.ready || !call.result.publicKey) return setState('unset')
      setPublicKey(call.result.publicKey)
      if (Notification.permission === 'denied') return setState('blocked')
      setState((await currentSubscription()) ? 'on' : 'off')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const save = (method: 'POST' | 'DELETE', body: Record<string, unknown>) =>
    runMutation({
      context: { action: method === 'POST' ? 'phone_alerts_on' : 'phone_alerts_off' },
      mutationPayload: body,
      operation: () => apiCall<{ ok?: boolean; error?: string }>('/api/dermat_departments/push', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    })

  const turnOn = async () => {
    if (!publicKey) return
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'blocked' : 'off')
        return
      }
      const registration = await navigator.serviceWorker.register(WORKER, { scope: '/' })
      await navigator.serviceWorker.ready
      const subscription = (await registration.pushManager.getSubscription()) ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }))
      const call = await save('POST', { ...subscription.toJSON(), test: true })
      if (!call.ok) {
        flash(call.result?.error ?? t('dermat_departments.push.error', 'Could not turn on phone alerts.'), 'error')
        return
      }
      setState('on')
      flash(t('dermat_departments.push.on', 'Phone alerts are on for this phone.'), 'success')
    } catch {
      flash(t('dermat_departments.push.error', 'Could not turn on phone alerts.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const turnOff = async () => {
    setBusy(true)
    try {
      const subscription = await currentSubscription()
      if (subscription) {
        await save('DELETE', { endpoint: subscription.endpoint })
        await subscription.unsubscribe()
      }
      setState('off')
      flash(t('dermat_departments.push.off', 'Phone alerts are off for this phone.'), 'success')
    } finally {
      setBusy(false)
    }
  }

  if (!state || state === 'unsupported' || state === 'unset') return null
  if (state === 'blocked') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <BellOff className="h-3.5 w-3.5" aria-hidden="true" />
        {t('dermat_departments.push.blocked', 'Pop-ups are blocked for this site in the browser settings')}
      </span>
    )
  }
  return state === 'on' ? (
    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void turnOff()}>
      <BellRing className="mr-1.5 h-4 w-4" aria-hidden="true" />
      {t('dermat_departments.push.turnOff', 'Phone alerts on')}
    </Button>
  ) : (
    <Button type="button" size="sm" disabled={busy} onClick={() => void turnOn()}>
      <BellRing className="mr-1.5 h-4 w-4" aria-hidden="true" />
      {t('dermat_departments.push.turnOn', 'Turn on phone alerts')}
    </Button>
  )
}

export default PhoneAlertsButton
