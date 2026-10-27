"use client"

import * as React from 'react'
import { FlaskConical, Plus } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
import { apiCall, withScopedApiRequestHeaders } from '@open-mercato/ui/backend/utils/apiCall'
import { buildOptimisticLockHeader } from '@open-mercato/ui/backend/utils/optimisticLock'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { FormDialog } from '../../dermat_rnd/components/shared/FormDialog'
import { Field } from '../../dermat_rnd/components/shared/Field'
import { useGranted } from '../../dermat_departments/components/useGranted'
import { rupeeText } from '../../dermat_products/lib/whatsapp'

type Charge = { id: string; rdRequestId: string | null; rdCode: string | null; amount: number; paidOn: string; mode: string | null; reference: string | null; note: string | null; byName: string | null; voided: boolean; voidReason: string | null; updatedAt: string }

type SampleChargesCardProps = { customerId: string | null; rdRequestId?: string; rdCode?: string }

function day(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function SampleChargesCard({ customerId, rdRequestId, rdCode }: SampleChargesCardProps) {
  const t = useT()
  const granted = useGranted()
  const canRecord = granted.ready && granted.has('dermat_accounts.record')
  const { runMutation } = useGuardedMutation({ contextId: `dermat-sample-charges-${rdRequestId ?? customerId ?? 'none'}` })
  const [items, setItems] = React.useState<Charge[] | null>(null)
  const [total, setTotal] = React.useState(0)
  const [hidden, setHidden] = React.useState(false)
  const [dialog, setDialog] = React.useState<'record' | Charge | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [draft, setDraft] = React.useState({ amount: '', paidOn: '', mode: '', reference: '', note: '', reason: '' })

  const load = React.useCallback(async () => {
    const params = rdRequestId ? `rdRequestId=${encodeURIComponent(rdRequestId)}` : customerId ? `customerId=${encodeURIComponent(customerId)}` : ''
    if (!params) return
    const call = await apiCall<{ items?: Charge[]; total?: number }>(`/api/dermat_accounts/sample-charges?${params}`, { headers: { 'x-om-forbidden-redirect': '0' } }, { fallback: { items: [] } })
    if (call.status === 403) {
      setHidden(true)
      return
    }
    setItems(call.result?.items ?? [])
    setTotal(call.result?.total ?? 0)
  }, [customerId, rdRequestId])

  React.useEffect(() => {
    void load()
  }, [load])

  if (hidden) return null

  const record = async () => {
    if (!customerId) return flash(t('dermat_accounts.sample.noCustomer', 'Link this request to a customer first.'), 'error')
    const amount = Number(draft.amount)
    if (!(amount > 0)) return flash(t('dermat_accounts.sample.amount', 'Enter the amount received.'), 'error')
    const body = { customerId, rdRequestId: rdRequestId ?? null, amount, paidOn: draft.paidOn || null, mode: draft.mode || null, reference: draft.reference || null, note: draft.note || null }
    setBusy(true)
    try {
      const call = await runMutation({
        context: { sampleCharge: 'record' },
        mutationPayload: body,
        operation: () => apiCall<{ error?: string }>('/api/dermat_accounts/sample-charges', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
      })
      if (!call.ok) return flash(call.result?.error ?? t('dermat_accounts.sample.saveError', 'Could not record the sample charge.'), 'error')
      flash(t('dermat_accounts.sample.saved', 'Sample charge recorded'), 'success')
      setDialog(null)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const voidCharge = async (charge: Charge) => {
    if (!draft.reason.trim()) return flash(t('dermat_accounts.sample.reason', 'Write why it is voided.'), 'error')
    const body = { id: charge.id, reason: draft.reason.trim() }
    setBusy(true)
    try {
      const call = await runMutation({
        context: { sampleCharge: charge.id },
        mutationPayload: body,
        operation: () =>
          withScopedApiRequestHeaders(buildOptimisticLockHeader(charge.updatedAt), () =>
            apiCall<{ error?: string }>('/api/dermat_accounts/sample-charges', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
          ),
      })
      if (!call.ok) return flash(call.result?.error ?? t('dermat_accounts.sample.voidError', 'Could not void it.'), 'error')
      flash(t('dermat_accounts.sample.voided', 'Sample charge voided'), 'success')
      setDialog(null)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const open = (target: 'record' | Charge) => {
    setDraft({ amount: '', paidOn: '', mode: '', reference: '', note: '', reason: '' })
    setDialog(target)
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <FlaskConical className="size-4 text-muted-foreground" aria-hidden="true" />
            {t('dermat_accounts.sample.title', 'Sample charges')}
          </h3>
          <p className="text-xs text-muted-foreground">{t('dermat_accounts.sample.hint', 'Money taken for R&D samples. Kept apart from the order advance; counted in the customer total.')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tabular-nums">{rupeeText(total)}</span>
          {canRecord ? (
            <Button type="button" variant="outline" size="sm" onClick={() => open('record')}>
              <Plus className="mr-1.5 size-4" aria-hidden="true" />
              {t('dermat_accounts.sample.record', 'Record sample charge')}
            </Button>
          ) : null}
        </div>
      </div>
      {items && items.length ? (
        <ul className="flex flex-col divide-y rounded-md border text-sm">
          {items.map((charge) => (
            <li key={charge.id} className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2', charge.voided && 'opacity-60')}>
              <span className="w-24 shrink-0 tabular-nums">{day(charge.paidOn)}</span>
              <span className="font-mono text-xs">{charge.rdCode ?? '—'}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{[charge.mode, charge.reference, charge.byName].filter(Boolean).join(' · ')}</span>
              <span className={cn('font-semibold tabular-nums', charge.voided && 'line-through')}>{rupeeText(charge.amount)}</span>
              {charge.voided ? (
                <span className="text-xs text-status-error-text">{t('dermat_accounts.sample.isVoided', 'Voided: {reason}', { reason: charge.voidReason ?? '' })}</span>
              ) : canRecord ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => open(charge)}>
                  {t('dermat_accounts.sample.void', 'Void')}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : items ? (
        <p className="text-xs text-muted-foreground">{rdCode ? t('dermat_accounts.sample.noneForRequest', 'No sample charge for {code}.', { code: rdCode }) : t('dermat_accounts.sample.none', 'No sample charges yet.')}</p>
      ) : null}
      <FormDialog
        open={dialog === 'record'}
        title={t('dermat_accounts.sample.recordTitle', 'Record a sample charge')}
        description={t('dermat_accounts.sample.recordHint', 'This is not the order advance. It stays on the customer even if no order follows.')}
        submitLabel={t('dermat_accounts.sample.save', 'Record')}
        busy={busy}
        onClose={() => setDialog(null)}
        onSubmit={() => void record()}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="sc-amount" label={t('dermat_accounts.sample.amountLabel', 'Amount received (₹)')}>
            <Input id="sc-amount" type="number" min={0} step="any" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} />
          </Field>
          <Field id="sc-date" label={t('dermat_accounts.sample.date', 'Received on (blank = today)')}>
            <Input id="sc-date" type="date" value={draft.paidOn} onChange={(event) => setDraft({ ...draft, paidOn: event.target.value })} />
          </Field>
          <Field id="sc-mode" label={t('dermat_accounts.sample.mode', 'Mode')}>
            <Input id="sc-mode" value={draft.mode} placeholder="UPI / NEFT / Cash" onChange={(event) => setDraft({ ...draft, mode: event.target.value })} />
          </Field>
          <Field id="sc-ref" label={t('dermat_accounts.sample.ref', 'UTR / reference')}>
            <Input id="sc-ref" value={draft.reference} onChange={(event) => setDraft({ ...draft, reference: event.target.value })} />
          </Field>
        </div>
        <Field id="sc-note" label={t('dermat_accounts.sample.note', 'Note')}>
          <Textarea id="sc-note" rows={2} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
        </Field>
      </FormDialog>
      <FormDialog
        open={Boolean(dialog && dialog !== 'record')}
        title={t('dermat_accounts.sample.voidTitle', 'Void this sample charge')}
        submitLabel={t('dermat_accounts.sample.void', 'Void')}
        destructive
        busy={busy}
        onClose={() => setDialog(null)}
        onSubmit={() => (dialog && dialog !== 'record' ? void voidCharge(dialog) : undefined)}
      >
        <Field id="sc-reason" label={t('dermat_accounts.sample.reasonLabel', 'Why')}>
          <Textarea id="sc-reason" rows={2} value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} />
        </Field>
      </FormDialog>
    </section>
  )
}

export default SampleChargesCard
