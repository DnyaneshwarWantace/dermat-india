'use client'

import * as React from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Switch } from '@open-mercato/ui/primitives/switch'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { flash } from '@open-mercato/ui/backend/FlashMessages'

type Person = { userId: string; name: string; phone: string | null; enabled: boolean; sentCount: number; lastSentAt: string | null; lastError: string | null }
type Status = { ready: boolean; missing: string[]; template: string; language: string; items: Person[] }

function when(value: string | null): string {
  return value ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
}

export function WhatsappPage() {
  const t = useT()
  const { runMutation } = useGuardedMutation({ contextId: 'dermat-whatsapp' })
  const [status, setStatus] = React.useState<Status | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [drafts, setDrafts] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    const call = await apiCall<Status & { error?: string }>('/api/dermat_departments/whatsapp')
    if (!call.ok || !call.result) return setError(call.result?.error ?? t('dermat_departments.whatsapp.loadError', 'Could not load WhatsApp settings.'))
    setStatus(call.result)
    setDrafts(Object.fromEntries(call.result.items.map((person) => [person.userId, person.phone ?? ''])))
  }, [t])

  React.useEffect(() => {
    void load()
  }, [load])

  const save = async (person: Person, enabled: boolean) => {
    setBusy(person.userId)
    try {
      const body = { userId: person.userId, phone: (drafts[person.userId] ?? '').trim(), enabled }
      const call = await runMutation({
        context: { userId: person.userId, action: 'whatsapp_number' },
        mutationPayload: body,
        operation: () => apiCall<{ error?: string }>('/api/dermat_departments/whatsapp', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
      })
      if (!call.ok) return flash(call.result?.error ?? t('dermat_departments.whatsapp.saveError', 'Could not save.'), 'error')
      flash(t('dermat_departments.whatsapp.saved', 'Saved'), 'success')
      await load()
    } finally {
      setBusy(null)
    }
  }

  const test = async (person: Person) => {
    setBusy(person.userId)
    try {
      const body = { userId: person.userId }
      const call = await runMutation({
        context: { userId: person.userId, action: 'whatsapp_test' },
        mutationPayload: body,
        operation: () => apiCall<{ error?: string }>('/api/dermat_departments/whatsapp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
      })
      flash(call.ok ? t('dermat_departments.whatsapp.testSent', 'Test message sent') : (call.result?.error ?? t('dermat_departments.whatsapp.testFailed', 'Could not send.')), call.ok ? 'success' : 'error')
      await load()
    } finally {
      setBusy(null)
    }
  }

  return (
    <Page>
      <PageBody>
        <div className="flex flex-col gap-5">
          <header className="space-y-1 border-b pb-4">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <MessageCircle className="h-6 w-6 text-primary" aria-hidden="true" />
              {t('dermat_departments.whatsapp.title', 'WhatsApp alerts')}
            </h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              {t('dermat_departments.whatsapp.lede', 'When work reaches a person (a stage, a store request, an approval, a client approval) they also get a WhatsApp message, next to the bell and My pending work. Each person can switch it off in their notification settings.')}
            </p>
          </header>
          {error ? <ErrorMessage label={error} /> : null}
          {!status && !error ? <LoadingMessage label={t('dermat_departments.whatsapp.loading', 'Loading…')} /> : null}
          {status ? (
            <>
              <section className="space-y-2 rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold">{t('dermat_departments.whatsapp.account', 'WhatsApp Business account')}</h2>
                  {status.ready ? (
                    <StatusBadge variant="success">{t('dermat_departments.whatsapp.on', 'Connected')}</StatusBadge>
                  ) : (
                    <StatusBadge variant="warning">{t('dermat_departments.whatsapp.off', 'Off until the API keys are set')}</StatusBadge>
                  )}
                </div>
                {status.ready ? (
                  <p className="text-sm text-muted-foreground">{t('dermat_departments.whatsapp.templateLine', 'Messages use the Meta-approved template "{template}" ({language}) with three fields: what happened, details, link.', { template: status.template, language: status.language })}</p>
                ) : (
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>{t('dermat_departments.whatsapp.setup', 'Dermat needs a WhatsApp Business Cloud API number from Meta and an approved message template. Your developer then sets these on the server:')}</p>
                    <ul className="list-disc pl-5 font-mono text-xs">
                      {status.missing.map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                      <li>WHATSAPP_TEMPLATE ({status.template})</li>
                    </ul>
                    <p>{t('dermat_departments.whatsapp.setupAfter', 'Numbers saved below start getting messages as soon as it is connected.')}</p>
                  </div>
                )}
              </section>
              <div className="overflow-x-auto rounded-lg border bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">{t('dermat_departments.whatsapp.person', 'Person')}</th>
                      <th className="px-3 py-2 text-left font-semibold">{t('dermat_departments.whatsapp.number', 'WhatsApp number')}</th>
                      <th className="px-3 py-2 text-left font-semibold">{t('dermat_departments.whatsapp.onOff', 'On')}</th>
                      <th className="px-3 py-2 text-left font-semibold">{t('dermat_departments.whatsapp.last', 'Last message')}</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {status.items.map((person) => {
                      const changed = (drafts[person.userId] ?? '') !== (person.phone ?? '')
                      return (
                        <tr key={person.userId} className="align-middle">
                          <td className="px-3 py-2 font-medium">{person.name}</td>
                          <td className="px-3 py-2">
                            <Input
                              aria-label={t('dermat_departments.whatsapp.numberFor', 'WhatsApp number for {name}', { name: person.name })}
                              inputMode="tel"
                              placeholder="+91 98200 00000"
                              className="h-8 w-48"
                              value={drafts[person.userId] ?? ''}
                              onChange={(event) => setDrafts((prev) => ({ ...prev, [person.userId]: event.target.value }))}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') void save(person, person.phone ? person.enabled : true)
                              }}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Switch checked={Boolean(person.phone) && person.enabled} disabled={!person.phone || busy === person.userId} onCheckedChange={(value) => void save(person, value)} aria-label={t('dermat_departments.whatsapp.toggle', 'WhatsApp on for {name}', { name: person.name })} />
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {person.lastError ? <span className="text-status-error-text">{person.lastError}</span> : person.lastSentAt ? <span className="text-muted-foreground">{t('dermat_departments.whatsapp.sentLine', '{when} · {count} sent', { when: when(person.lastSentAt), count: person.sentCount })}</span> : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {changed ? (
                              <Button type="button" size="sm" disabled={busy === person.userId} onClick={() => void save(person, person.phone ? person.enabled : true)}>
                                {t('dermat_departments.whatsapp.save', 'Save')}
                              </Button>
                            ) : person.phone ? (
                              <Button type="button" size="sm" variant="outline" disabled={!status.ready || busy === person.userId} onClick={() => void test(person)}>
                                <Send className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                                {t('dermat_departments.whatsapp.test', 'Send test')}
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      </PageBody>
    </Page>
  )
}

export default WhatsappPage
