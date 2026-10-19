'use client'

import * as React from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
import { Spinner } from '@open-mercato/ui/primitives/spinner'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { REGISTRATION_FIELDS, REGISTRATION_GROUPS, registrationProblems } from '../../lib/registrationFields'

type View = { status: 'open' | 'submitted'; customerName: string | null; submittedAt: string | null }

const QUIET = { 'x-om-forbidden-redirect': '0' }

export function RegistrationFormPage({ token }: { token: string }) {
  const t = useT()
  const [view, setView] = React.useState<View | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [answers, setAnswers] = React.useState<Record<string, string>>({ country: 'India' })
  const [website, setWebsite] = React.useState('')
  const [problems, setProblems] = React.useState<string[]>([])
  const [busy, setBusy] = React.useState(false)
  const startedAt = React.useRef(Date.now())

  React.useEffect(() => {
    apiCall<View & { error?: string }>(`/api/dermat_accounts/registrations/public?token=${encodeURIComponent(token)}`, { headers: QUIET }).then((call) => {
      if (call.ok && call.result) {
        setView(call.result)
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
            <p className="text-sm text-muted-foreground">{t('dermat_accounts.reg.lede', 'Please fill your company details once. Fields with * are needed. Customers outside India can give the PAN or VAT number instead of GST.')}</p>
            {REGISTRATION_GROUPS.map((group) => (
              <section key={group} className="space-y-3 rounded-lg border bg-card p-4">
                <h2 className="text-sm font-semibold">{group}</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {REGISTRATION_FIELDS.filter((field) => field.group === group).map((field) => (
                    <div key={field.key} className={field.kind === 'address' ? 'space-y-1 sm:col-span-2' : 'space-y-1'}>
                      <Label htmlFor={`reg-${field.key}`} className="text-xs text-muted-foreground">
                        {field.label}
                        {field.required ? ' *' : ''}
                      </Label>
                      {field.kind === 'address' ? (
                        <Textarea id={`reg-${field.key}`} rows={2} value={answers[field.key] ?? ''} onChange={(event) => set(field.key, event.target.value)} />
                      ) : (
                        <Input
                          id={`reg-${field.key}`}
                          type={field.kind ?? 'text'}
                          value={answers[field.key] ?? ''}
                          className={field.key === 'gst_no' || field.key === 'pan_no' ? 'uppercase' : undefined}
                          onChange={(event) => set(field.key, event.target.value)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
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
