'use client'

import * as React from 'react'
import Link from 'next/link'
import { Check, X } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { Button } from '@open-mercato/ui/primitives/button'
import { Label } from '@open-mercato/ui/primitives/label'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
import { Radio, RadioGroup } from '@open-mercato/ui/primitives/radio'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { SegmentedControl, SegmentedControlItem } from '@open-mercato/ui/primitives/segmented-control'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@open-mercato/ui/primitives/sheet'
import { apiCall, withScopedApiRequestHeaders } from '@open-mercato/ui/backend/utils/apiCall'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { Switch } from '@open-mercato/ui/primitives/switch'
import { buildOptimisticLockHeader } from '@open-mercato/ui/backend/utils/optimisticLock'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useGranted } from '../../../dermat_departments/components/useGranted'
import { REGISTRATION_FIELDS, REGISTRATION_GROUPS } from '../../lib/registrationFields'
import { SendRegistrationButton } from './SendRegistrationButton'

type Registration = {
  id: string
  path: string
  customerId: string | null
  customerName: string | null
  status: 'open' | 'submitted' | 'approved' | 'rejected'
  answers: Record<string, string>
  submittedAt: string | null
  ip: string | null
  decidedByName: string | null
  decidedAt: string | null
  note: string | null
  createdByName: string | null
  createdAt: string
  updatedAt: string
}

type Company = { id: string; display_name?: string; updated_at?: string; cf_gstin?: string | null }
type View = 'submitted' | 'open' | 'approved' | 'rejected'

function when(value: string | null): string {
  return value ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
}

const JSON_HEADERS = { 'content-type': 'application/json' }

export function RegistrationsPage() {
  const t = useT()
  const granted = useGranted()
  const canApprove = granted.has('dermat_accounts.record')
  const { runMutation } = useGuardedMutation({ contextId: 'dermat-registrations' })
  const [askCountry, setAskCountry] = React.useState<boolean | null>(null)
  const [savingOption, setSavingOption] = React.useState(false)

  React.useEffect(() => {
    apiCall<{ askCountry?: boolean }>('/api/dermat_accounts/registrations/options', undefined, { fallback: {} }).then((call) => {
      if (call.ok) setAskCountry(Boolean(call.result?.askCountry))
    })
  }, [])

  const saveAskCountry = async (next: boolean) => {
    setSavingOption(true)
    try {
      const body = { askCountry: next }
      const call = await runMutation({
        context: { action: 'registration_options' },
        mutationPayload: body,
        operation: () => apiCall<{ askCountry?: boolean; error?: string }>('/api/dermat_accounts/registrations/options', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
      })
      if (!call.ok) {
        flash(call.result?.error ?? t('dermat_accounts.regs.optionError', 'Could not save the form option.'), 'error')
        return
      }
      setAskCountry(Boolean(call.result?.askCountry))
      flash(next ? t('dermat_accounts.regs.countryOn', 'The form now asks for the country.') : t('dermat_accounts.regs.countryOff', 'The form is for customers in India only.'), 'success')
    } finally {
      setSavingOption(false)
    }
  }
  const [view, setView] = React.useState<View>('submitted')
  const [rows, setRows] = React.useState<Registration[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<Registration | null>(null)
  const [matches, setMatches] = React.useState<Company[]>([])
  const [target, setTarget] = React.useState<string>('new')
  const [note, setNote] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    const call = await apiCall<{ items?: Registration[]; error?: string }>('/api/dermat_accounts/registrations')
    if (!call.ok) setError(call.result?.error ?? t('dermat_accounts.regs.loadError', 'Could not load registrations.'))
    else setRows(call.result?.items ?? [])
  }, [t])

  React.useEffect(() => {
    void load()
  }, [load])

  const openRow = async (row: Registration) => {
    setSelected(row)
    setNote('')
    setTarget(row.customerId ?? 'new')
    setMatches([])
    if (row.status !== 'submitted') return
    const found = new Map<string, Company>()
    for (const term of [row.answers.gst_no, row.answers.customer_name].filter(Boolean)) {
      const call = await apiCall<{ items?: Company[] }>(`/api/customers/companies?search=${encodeURIComponent(term)}&pageSize=5`, undefined, { fallback: { items: [] } })
      for (const company of call.result?.items ?? []) found.set(company.id, company)
    }
    if (row.customerId && !found.has(row.customerId)) found.set(row.customerId, { id: row.customerId, display_name: row.customerName ?? row.customerId })
    setMatches([...found.values()])
    if (!row.customerId && found.size) setTarget([...found.values()][0].id)
  }

  const decide = async (decision: 'approve' | 'reject') => {
    if (!selected) return
    if (decision === 'reject' && !note.trim()) return flash(t('dermat_accounts.regs.needNote', 'Write why it is rejected.'), 'error')
    setBusy(true)
    try {
      const body = { id: selected.id, decision, target: decision === 'approve' ? target : null, note: note.trim() || null }
      const result = await runMutation({
        context: { registrationId: selected.id, decision },
        mutationPayload: body,
        operation: () =>
          withScopedApiRequestHeaders(buildOptimisticLockHeader(selected.updatedAt), () =>
            apiCall<{ error?: string }>('/api/dermat_accounts/registrations', { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(body) }),
          ),
      })
      if (!result.ok) throw new Error(result.result?.error ?? 'not saved')
      flash(decision === 'approve' ? t('dermat_accounts.regs.approved', 'Customer set up') : t('dermat_accounts.regs.rejected', 'Registration rejected'), 'success')
      setSelected(null)
      await load()
    } catch (err) {
      flash(err instanceof Error && err.message !== 'not saved' && !err.message.startsWith('[internal]') ? err.message : t('dermat_accounts.regs.failed', 'Could not save. Please try again.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const shown = (rows ?? []).filter((row) => row.status === view)
  const counts = (status: View) => (rows ?? []).filter((row) => row.status === status).length

  return (
    <Page>
      <PageBody>
        <div className="flex flex-col gap-5">
          <header className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">{t('dermat_accounts.regs.title', 'Customer registrations')}</h1>
              <p className="max-w-3xl text-sm text-muted-foreground">{t('dermat_accounts.regs.lede', 'Send a new customer the registration link instead of the Word form. What they fill comes here; check it and approve to set up the customer with contacts and addresses.')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {canApprove && askCountry !== null ? (
                <label htmlFor="reg-ask-country" className="flex items-center gap-2 text-sm">
                  <Switch id="reg-ask-country" checked={askCountry} disabled={savingOption} onCheckedChange={(checked) => void saveAskCountry(checked)} />
                  {t('dermat_accounts.regs.askCountry', 'Ask the country (customers outside India)')}
                </label>
              ) : null}
              <SendRegistrationButton variant="default" onMade={() => void load()} />
            </div>
          </header>

          <SegmentedControl value={view} onValueChange={(value) => setView(value as View)} aria-label={t('dermat_accounts.regs.show', 'Show')}>
            <SegmentedControlItem value="submitted">{t('dermat_accounts.regs.toCheck', 'To check ({count})', { count: counts('submitted') })}</SegmentedControlItem>
            <SegmentedControlItem value="open">{t('dermat_accounts.regs.waiting', 'Link sent ({count})', { count: counts('open') })}</SegmentedControlItem>
            <SegmentedControlItem value="approved">{t('dermat_accounts.regs.approvedTab', 'Approved')}</SegmentedControlItem>
            <SegmentedControlItem value="rejected">{t('dermat_accounts.regs.rejectedTab', 'Rejected')}</SegmentedControlItem>
          </SegmentedControl>

          {error ? <ErrorMessage label={error} /> : null}
          {!rows && !error ? <LoadingMessage label={t('dermat_accounts.regs.loading', 'Loading…')} /> : null}
          {rows ? (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">{t('dermat_accounts.regs.colCustomer', 'Customer')}</th>
                    <th className="px-3 py-2 text-left font-semibold">{t('dermat_accounts.regs.colContact', 'Purchase contact')}</th>
                    <th className="px-3 py-2 text-left font-semibold">{t('dermat_accounts.regs.colTax', 'GST / PAN / VAT')}</th>
                    <th className="px-3 py-2 text-left font-semibold">{t('dermat_accounts.regs.colWhen', 'When')}</th>
                    <th className="px-3 py-2 text-left font-semibold">{t('dermat_accounts.regs.colStatus', 'Status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {shown.map((row) => (
                    <tr key={row.id} className="cursor-pointer align-top hover:bg-muted/30" onClick={() => void openRow(row)}>
                      <td className="px-3 py-2">
                        <span className="block font-medium">{row.answers.customer_name ?? row.customerName ?? t('dermat_accounts.regs.general', 'New customer (general link)')}</span>
                        {row.answers.country && row.answers.country !== 'India' ? <span className="block text-xs text-muted-foreground">{row.answers.country}</span> : null}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <span className="block">{row.answers.purchase_name ?? '—'}</span>
                        <span className="block text-muted-foreground">{[row.answers.purchase_phone, row.answers.purchase_email].filter(Boolean).join(' · ')}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{row.answers.gst_no ?? row.answers.pan_no ?? row.answers.vat_no ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {row.status === 'open' ? t('dermat_accounts.regs.sentBy', 'Link by {who} {when}', { who: row.createdByName ?? '—', when: when(row.createdAt) }) : row.status === 'submitted' ? t('dermat_accounts.regs.filled', 'Filled {when}', { when: when(row.submittedAt) }) : t('dermat_accounts.regs.decided', '{who} {when}', { who: row.decidedByName ?? '', when: when(row.decidedAt) })}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge variant={row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'error' : row.status === 'submitted' ? 'warning' : 'neutral'}>
                          {row.status === 'approved' ? t('dermat_accounts.regs.sApproved', 'Approved') : row.status === 'rejected' ? t('dermat_accounts.regs.sRejected', 'Rejected') : row.status === 'submitted' ? t('dermat_accounts.regs.sSubmitted', 'To check') : t('dermat_accounts.regs.sOpen', 'Not filled yet')}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                  {!shown.length ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-10 text-center text-sm text-muted-foreground">
                        {t('dermat_accounts.regs.empty', 'Nothing here.')}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <Sheet open={Boolean(selected)} onOpenChange={(open) => (open ? null : setSelected(null))}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
            {selected ? (
              <div
                className="flex flex-col gap-4"
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && selected.status === 'submitted' && canApprove) void decide('approve')
                }}
              >
                <SheetHeader>
                  <SheetTitle>{selected.answers.customer_name ?? selected.customerName ?? t('dermat_accounts.regs.general', 'New customer (general link)')}</SheetTitle>
                  <SheetDescription>
                    {selected.status === 'open'
                      ? t('dermat_accounts.regs.notFilled', 'The customer has not filled the form yet. Link: {url}', { url: `${typeof window === 'undefined' ? '' : window.location.origin}${selected.path}` })
                      : t('dermat_accounts.regs.filledFrom', 'Filled {when}{ip}', { when: when(selected.submittedAt), ip: selected.ip ? ` from ${selected.ip}` : '' })}
                  </SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-4 px-4 pb-6">
                {selected.status !== 'open'
                  ? REGISTRATION_GROUPS.map((group) => {
                      const filled = REGISTRATION_FIELDS.filter((field) => field.group === group && selected.answers[field.key])
                      if (!filled.length) return null
                      return (
                        <section key={group} className="space-y-1.5">
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</h3>
                          <dl className="divide-y rounded-lg border text-sm">
                            {filled.map((field) => (
                              <div key={field.key} className="grid grid-cols-5 gap-2 px-3 py-1.5">
                                <dt className="col-span-2 text-muted-foreground">{field.label}</dt>
                                <dd className="col-span-3 whitespace-pre-line break-words">{selected.answers[field.key]}</dd>
                              </div>
                            ))}
                          </dl>
                        </section>
                      )
                    })
                  : null}
                {selected.status === 'approved' && selected.customerId ? (
                  <Button asChild variant="outline" size="sm" className="self-start">
                    <Link href={`/backend/customers/companies/${selected.customerId}`}>{t('dermat_accounts.regs.openCustomer', 'Open customer')}</Link>
                  </Button>
                ) : null}
                {selected.note ? <p className="text-sm">{t('dermat_accounts.regs.noteLine', 'Note: {note}', { note: selected.note })}</p> : null}
                {selected.status === 'submitted' && canApprove ? (
                  <section className="space-y-3 rounded-lg border bg-muted/30 p-3">
                    <fieldset className="space-y-1.5">
                      <legend className="text-sm font-semibold">{t('dermat_accounts.regs.setUp', 'Set up as')}</legend>
                      <RadioGroup value={target} onValueChange={setTarget} aria-label={t('dermat_accounts.regs.setUp', 'Set up as')}>
                        <label htmlFor="reg-target-new" className="flex items-center gap-2 text-sm">
                          <Radio id="reg-target-new" value="new" />
                          {t('dermat_accounts.regs.newCustomer', 'A new customer')}
                        </label>
                        {matches.map((company) => (
                          <label key={company.id} htmlFor={`reg-target-${company.id}`} className="flex items-center gap-2 text-sm">
                            <Radio id={`reg-target-${company.id}`} value={company.id} />
                            {t('dermat_accounts.regs.addTo', 'Add to existing: {name}', { name: company.display_name ?? company.id })}
                            {company.cf_gstin ? <span className="font-mono text-xs text-muted-foreground">{company.cf_gstin}</span> : null}
                          </label>
                        ))}
                      </RadioGroup>
                    </fieldset>
                    <div className="space-y-1">
                      <Label htmlFor="reg-note" className="text-xs text-muted-foreground">{t('dermat_accounts.regs.note', 'Note (needed to reject)')}</Label>
                      <Textarea id="reg-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void decide('reject')}>
                        <X className="mr-1.5 h-4 w-4" aria-hidden="true" />
                        {t('dermat_accounts.regs.reject', 'Reject')}
                      </Button>
                      <Button type="button" size="sm" disabled={busy} onClick={() => void decide('approve')}>
                        <Check className="mr-1.5 h-4 w-4" aria-hidden="true" />
                        {target === 'new' ? t('dermat_accounts.regs.approveNew', 'Approve and create customer') : t('dermat_accounts.regs.approveAdd', 'Approve and add to customer')}
                      </Button>
                    </div>
                  </section>
                ) : null}
                </div>
              </div>
            ) : null}
          </SheetContent>
        </Sheet>
      </PageBody>
    </Page>
  )
}

export default RegistrationsPage
