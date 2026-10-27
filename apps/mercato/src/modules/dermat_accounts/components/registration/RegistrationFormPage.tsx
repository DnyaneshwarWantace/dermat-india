'use client'

import * as React from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
import { Spinner } from '@open-mercato/ui/primitives/spinner'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { REGISTRATION_GROUPS, registrationProblems, visibleRegistrationFields, type RegistrationOptions } from '../../lib/registrationFields'

type View = { status: 'open' | 'submitted'; customerName: string | null; submittedAt: string | null; options?: RegistrationOptions }

const QUIET = { 'x-om-forbidden-redirect': '0' }

export function RegistrationFormPage({ token }: { token: string }) {
  const t = useT()
  const [view, setView] = React.useState<View | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [answers, setAnswers] = React.useState<Record<string, string>>({})
  const [website, setWebsite] = React.useState('')
  const [problems, setProblems] = React.useState<string[]>([])
  const [busy, setBusy] = React.useState(false)
  const startedAt = React.useRef(Date.now())

  React.useEffect(() => {
    apiCall<View & { error?: string }>(`/api/dermat_accounts/registrations/public?token=${encodeURIComponent(token)}`, { headers: QUIET }).then((call) => {
      if (call.ok && call.result) {
        setView(call.result)
        if (call.result.options?.askCountry) setAnswers((prev) => ({ country: 'India', ...prev }))
        if (call.result.customerName) setAnswers((prev) => ({ ...prev, customer_name: prev.customer_name || call.result?.customerName || '' }))
      } else setError(call.result?.error ?? t('dermat_accounts.reg.invalid', 'This link is not valid.'))
    })
  }, [token, t])

  const submit = async () => {
    const found = registrationProblems(answers)
    setProblems(found)
    if (found.length) return
    setBusy(true)
    try {
      const call = await apiCall<{ ok?: boolean; error?: string }>('/api/dermat_accounts/registrations/public', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...QUIET },
        body: JSON.stringify({ token, answers, website, startedAt: startedAt.current }),
      })
      if (call.ok) setView({ status: 'submitted', customerName: answers.customer_name, submittedAt: new Date().toISOString() })
      else setProblems([call.result?.error ?? t('dermat_accounts.reg.failed', 'Could not send. Please try again.')])
    } finally {
      setBusy(false)
    }
  }

  const set = (key: string, value: string) => setAnswers((prev) => ({ ...prev, [key]: value }))

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <header className="border-b pb-3">
          <p className="text-lg font-extrabold tracking-wider">DERMAT INDIA</p>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{t('dermat_accounts.reg.kicker', 'Customer registration form')}</p>
        </header>
        {error ? <p className="rounded-lg border bg-card p-6 text-sm">{error}</p> : null}
        {!view && !error ? <Spinner /> : null}
        {view?.status === 'submitted' ? (
          <section className="flex flex-col items-center gap-2 rounded-lg border bg-card p-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-status-success-icon" aria-hidden="true" />
            <h1 className="text-lg font-semibold">{t('dermat_accounts.reg.thanks', 'Thank you, we have your details')}</h1>
            <p className="max-w-md text-sm text-muted-foreground">{t('dermat_accounts.reg.thanksBody', 'Our accounts team will check them and set you up. You do not need to send the Word form.')}</p>
          </section>
        ) : null}
        {view?.status === 'open' ? (
          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') void submit()
            }}
          >
            <p className="text-sm text-muted-foreground">{t('dermat_accounts.reg.ledeSimple', 'Please fill your company details once. Only the customer name is needed; fill the rest if you have it.')}</p>
            <section className="divide-y rounded-lg border bg-card">
              {REGISTRATION_GROUPS.map((group) => {
                const fields = visibleRegistrationFields(view.options ?? { askCountry: false }).filter((field) => field.group === group)
                if (!fields.length) return null
                const several = fields.length > 1
                return (
                  <div key={group} className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-3 sm:gap-4">
                    <span className="text-sm font-medium sm:pt-2">
                      {group}
                      {fields.some((field) => field.required) ? ' *' : ''}
                    </span>
                    <div className={several ? 'grid grid-cols-1 gap-2 sm:col-span-2 sm:grid-cols-3' : 'sm:col-span-2'}>
                      {fields.map((field) => {
                        const label = several ? field.label : group
                        return field.kind === 'address' ? (
                          <Textarea key={field.key} id={`reg-${field.key}`} aria-label={label} rows={2} value={answers[field.key] ?? ''} onChange={(event) => set(field.key, event.target.value)} />
                        ) : (
                          <Input
                            key={field.key}
                            id={`reg-${field.key}`}
                            aria-label={label}
                            placeholder={several ? field.label : undefined}
                            type={field.kind ?? 'text'}
                            value={answers[field.key] ?? ''}
                            className={field.key === 'gst_no' || field.key === 'pan_no' ? 'uppercase' : undefined}
                            onChange={(event) => set(field.key, event.target.value)}
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </section>
            <div className="sr-only" aria-hidden="true">
              <label htmlFor="reg-website">Website</label>
              <input id="reg-website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
            </div>
            {problems.length ? (
              <ul className="space-y-1 rounded-lg border border-status-error-border bg-status-error-bg p-3 text-sm text-status-error-text" role="alert">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            ) : null}
            <div className="flex justify-end">
              <Button type="submit" disabled={busy}>
                {busy ? <Spinner className="mr-2 h-4 w-4" /> : null}
                {t('dermat_accounts.reg.submit', 'Send my details')}
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </main>
  )
}

export default RegistrationFormPage
