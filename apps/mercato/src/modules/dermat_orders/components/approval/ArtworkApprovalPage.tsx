'use client'

import * as React from 'react'
import { CheckCircle2, FileText, MessageSquareWarning } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
import { Spinner } from '@open-mercato/ui/primitives/spinner'
import { SegmentedControl, SegmentedControlItem } from '@open-mercato/ui/primitives/segmented-control'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { SignaturePad } from './SignaturePad'

type View = {
  status: 'open' | 'approved' | 'changes' | 'closed' | 'expired'
  orderNo: string
  customerName: string | null
  products: Array<{ title: string; brandName: string | null; packSize: string | null; quantity: number }>
  composition: string | null
  files: Array<{ id: string; fileName: string; mimeType: string }>
  decision: { clientName: string | null; clientDesignation: string | null; decidedAt: string | null; comments: string | null } | null
}

const QUIET = { headers: { 'x-om-forbidden-redirect': '0' } }

function when(value: string | null): string {
  return value ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
}

export function ArtworkApprovalPage({ token }: { token: string }) {
  const t = useT()
  const [view, setView] = React.useState<View | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [decision, setDecision] = React.useState<'approve' | 'changes'>('approve')
  const [name, setName] = React.useState('')
  const [designation, setDesignation] = React.useState('')
  const [comments, setComments] = React.useState('')
  const [signature, setSignature] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  React.useEffect(() => {
    apiCall<View & { error?: string }>(`/api/dermat_orders/artwork-approval/public?token=${encodeURIComponent(token)}`, QUIET).then((call) => {
      if (call.ok && call.result) setView(call.result)
      else setError(call.result?.error ?? t('dermat_orders.approval.invalid', 'This link is not valid.'))
    })
  }, [token, t])

  const submit = async () => {
    setFormError(null)
    if (name.trim().length < 2) return setFormError(t('dermat_orders.approval.needName', 'Please type your name.'))
    if (!signature) return setFormError(t('dermat_orders.approval.needSign', 'Please sign in the box.'))
    if (decision === 'changes' && !comments.trim()) return setFormError(t('dermat_orders.approval.needComments', 'Please write what should change.'))
    setBusy(true)
    try {
      const call = await apiCall<View & { error?: string }>('/api/dermat_orders/artwork-approval/public', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-om-forbidden-redirect': '0' },
        body: JSON.stringify({ token, decision, name, designation: designation || null, signature, comments: comments || null }),
      })
      if (call.ok && call.result) setView(call.result)
      else setFormError(call.result?.error ?? t('dermat_orders.approval.failed', 'Could not send. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <header className="flex items-end justify-between gap-3 border-b pb-3">
          <div>
            <p className="text-lg font-extrabold tracking-wider">DERMAT INDIA</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{t('dermat_orders.approval.kicker', 'Artwork approval')}</p>
          </div>
          {view ? <p className="font-mono text-sm font-semibold">{view.orderNo}</p> : null}
        </header>

        {error ? <p className="rounded-md border border-status-error-border bg-status-error-bg p-4 text-sm text-status-error-text">{error}</p> : null}
        {!view && !error ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : null}

        {view ? (
          <>
            <section className="space-y-2 rounded-lg border bg-card p-4">
              {view.customerName ? <p className="text-sm text-muted-foreground">{t('dermat_orders.approval.for', 'For {name}', { name: view.customerName })}</p> : null}
              <ul className="space-y-1 text-sm">
                {view.products.map((product, index) => (
                  <li key={index} className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">{[product.title, product.brandName].filter(Boolean).join(' · ')}</span>
                    <span className="text-muted-foreground">{[product.packSize, `${product.quantity.toLocaleString('en-IN')} pcs`].filter(Boolean).join(' · ')}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-3 rounded-lg border bg-card p-4">
              <h2 className="text-sm font-semibold">{t('dermat_orders.approval.files', 'Artwork to approve')}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {view.files.map((file) => {
                  const href = `/api/dermat_orders/artwork-approval/file?token=${encodeURIComponent(token)}&id=${file.id}`
                  return file.mimeType.startsWith('image/') ? (
                    <a key={file.id} href={href} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border bg-white">
                      <img src={href} alt={file.fileName} className="max-h-96 w-full object-contain" />
                      <span className="block truncate px-2 py-1 text-xs text-muted-foreground">{file.fileName}</span>
                    </a>
                  ) : (
                    <a key={file.id} href={href} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-md border p-3 text-sm text-primary hover:underline">
                      <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{file.fileName}</span>
                    </a>
                  )
                })}
              </div>
              {view.composition ? (
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('dermat_orders.approval.composition', 'Composition on the pack')}</h3>
                  <p className="whitespace-pre-line rounded-md bg-muted/40 p-3 text-sm">{view.composition}</p>
                </div>
              ) : null}
            </section>

            {view.status === 'open' ? (
              <section className="space-y-4 rounded-lg border bg-card p-4">
                <SegmentedControl value={decision} onValueChange={(value) => setDecision(value as typeof decision)} aria-label={t('dermat_orders.approval.decision', 'Your decision')}>
                  <SegmentedControlItem value="approve">{t('dermat_orders.approval.approve', 'Approve')}</SegmentedControlItem>
                  <SegmentedControlItem value="changes">{t('dermat_orders.approval.changes', 'Ask for changes')}</SegmentedControlItem>
                </SegmentedControl>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="approval-name">{t('dermat_orders.approval.name', 'Your name *')}</Label>
                    <Input id="approval-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="approval-designation">{t('dermat_orders.approval.designation', 'Designation')}</Label>
                    <Input id="approval-designation" value={designation} onChange={(event) => setDesignation(event.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="approval-comments">{decision === 'changes' ? t('dermat_orders.approval.whatChange', 'What should change *') : t('dermat_orders.approval.comments', 'Comments')}</Label>
                  <Textarea id="approval-comments" rows={3} value={comments} onChange={(event) => setComments(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('dermat_orders.approval.signature', 'Signature *')}</Label>
                  <SignaturePad onChange={setSignature} />
                </div>
                {formError ? <p className="text-sm text-status-error-text">{formError}</p> : null}
                <p className="text-xs text-muted-foreground">{t('dermat_orders.approval.legal', 'Your name, signature, the date and time, and your internet address are saved with this decision.')}</p>
                <Button type="button" className="w-full sm:w-auto" disabled={busy} onClick={() => void submit()}>
                  {decision === 'approve' ? t('dermat_orders.approval.sendApprove', 'Approve this artwork') : t('dermat_orders.approval.sendChanges', 'Send my changes')}
                </Button>
              </section>
            ) : (
              <section className={cn('flex items-start gap-3 rounded-lg border p-4 text-sm', view.status === 'approved' ? 'border-status-success-border bg-status-success-bg text-status-success-text' : 'border-status-warning-border bg-status-warning-bg text-status-warning-text')}>
                {view.status === 'approved' ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> : <MessageSquareWarning className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />}
                <div>
                  <p className="font-semibold">
                    {view.status === 'approved'
                      ? t('dermat_orders.approval.doneApproved', 'Approved on {when}', { when: when(view.decision?.decidedAt ?? null) })
                      : view.status === 'changes'
                        ? t('dermat_orders.approval.doneChanges', 'Changes sent on {when}', { when: when(view.decision?.decidedAt ?? null) })
                        : view.status === 'expired'
                          ? t('dermat_orders.approval.expired', 'This link has expired. Ask Dermat India for a new one.')
                          : t('dermat_orders.approval.closed', 'A newer version of this artwork was sent. Please use the latest link.')}
                  </p>
                  {view.decision?.clientName ? <p>{[view.decision.clientName, view.decision.clientDesignation].filter(Boolean).join(', ')}</p> : null}
                  {view.decision?.comments ? <p className="mt-1">{view.decision.comments}</p> : null}
                </div>
              </section>
            )}
          </>
        ) : null}
      </div>
    </main>
  )
}

export default ArtworkApprovalPage
