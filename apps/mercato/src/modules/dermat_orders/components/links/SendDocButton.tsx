'use client'

import * as React from 'react'
import { Copy, Mail, MessageCircle, Send, XCircle } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@open-mercato/ui/primitives/dialog'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'

export type DocKind = 'pi' | 'invoice' | 'po' | 'dispatch' | 'sample'
type LinkView = { id: string; title: string; path: string; sends: Array<{ via: string; by: string | null; at: string; to: string | null }>; openedCount: number; lastOpenedAt: string | null }

function when(value: string | null): string {
  return value ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
}

export function SendDocButton({ kind, recordId, label, size = 'sm', variant = 'outline' }: { kind: DocKind; recordId: string; label?: string; size?: 'sm' | 'default'; variant?: 'outline' | 'default' }) {
  const t = useT()
  const { runMutation } = useGuardedMutation({ contextId: `dermat-doc-link-${kind}-${recordId}` })
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [open, setOpen] = React.useState(false)
  const [link, setLink] = React.useState<LinkView | null>(null)
  const [email, setEmail] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [name, setName] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const start = async () => {
    setOpen(true)
    setBusy(true)
    try {
      const body = { kind, recordId }
      const call = await runMutation({
        context: { kind, recordId, action: 'doc_link' },
        mutationPayload: body,
        operation: () => apiCall<{ link?: LinkView; to?: { name: string | null; email: string | null; phone: string | null }; error?: string }>('/api/dermat_orders/doc-links', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
      })
      if (!call.ok || !call.result?.link) {
        flash(call.result?.error ?? t('dermat_orders.sendDoc.failed', 'Could not make the link.'), 'error')
        setOpen(false)
        return
      }
      setLink(call.result.link)
      setEmail(call.result.to?.email ?? '')
      setPhone(call.result.to?.phone ?? '')
      setName(call.result.to?.name ?? '')
    } finally {
      setBusy(false)
    }
  }

  const url = link ? `${window.location.origin}${link.path}` : ''
  const message = link ? t('dermat_orders.sendDoc.message', 'Dear {name}, please find {title} here: {url}\n\nRegards, Dermat India', { name: name || 'Sir / Madam', title: link.title, url }) : ''

  const logged = async (via: 'email' | 'whatsapp' | 'copy', to: string | null) => {
    if (!link) return
    const call = await apiCall<LinkView>('/api/dermat_orders/doc-links/sent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: link.id, via, to }) })
    if (call.ok && call.result) setLink(call.result)
  }

  const revoke = async () => {
    if (!link) return
    const ok = await confirm({ title: t('dermat_orders.sendDoc.revokeTitle', 'Stop this link?'), text: t('dermat_orders.sendDoc.revokeText', 'Anyone who has it will no longer be able to open the document. A new link can be made later.'), variant: 'destructive' })
    if (!ok) return
    const call = await runMutation({
      context: { linkId: link.id, action: 'revoke' },
      mutationPayload: { id: link.id },
      operation: () => apiCall(`/api/dermat_orders/doc-links?id=${link.id}`, { method: 'DELETE' }),
    })
    if (call.ok) {
      flash(t('dermat_orders.sendDoc.revoked', 'Link stopped'), 'success')
      setOpen(false)
      setLink(null)
    }
  }

  return (
    <>
      <Button type="button" size={size} variant={variant} onClick={() => void start()}>
        <Send className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
        {label ?? t('dermat_orders.sendDoc.send', 'Send link')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{link?.title ?? t('dermat_orders.sendDoc.title', 'Send document')}</DialogTitle>
            <DialogDescription>{t('dermat_orders.sendDoc.hint', 'Opens your own email or WhatsApp with a link. The link shows the document without login and keeps working until you stop it.')}</DialogDescription>
          </DialogHeader>
          {link ? (
            <div className="space-y-4">
              <Input readOnly value={url} aria-label={t('dermat_orders.sendDoc.link', 'Link')} onFocus={(event) => event.target.select()} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="send-email">{t('dermat_orders.sendDoc.email', 'Email')}</Label>
                  <Input id="send-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="send-phone">{t('dermat_orders.sendDoc.phone', 'WhatsApp number')}</Label>
                  <Input id="send-phone" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <a href={`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(link.title)}&body=${encodeURIComponent(message)}`} onClick={() => void logged('email', email || null)}>
                    <Mail className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    {t('dermat_orders.sendDoc.byEmail', 'Send by email')}
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" onClick={() => void logged('whatsapp', phone || null)}>
                    <MessageCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    WhatsApp
                  </a>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard?.writeText(url)
                    flash(t('dermat_orders.sendDoc.copied', 'Link copied'), 'success')
                    void logged('copy', null)
                  }}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  {t('dermat_orders.sendDoc.copy', 'Copy link')}
                </Button>
                <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={() => void revoke()}>
                  <XCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  {t('dermat_orders.sendDoc.revoke', 'Stop link')}
                </Button>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>{link.openedCount ? t('dermat_orders.sendDoc.opened', 'Opened {count} time(s), last {when}', { count: link.openedCount, when: when(link.lastOpenedAt) }) : t('dermat_orders.sendDoc.notOpened', 'Not opened yet')}</p>
                {link.sends.slice(-5).reverse().map((send, index) => (
                  <p key={`${send.at}-${index}`}>{t('dermat_orders.sendDoc.sentLine', '{via} {to} · {who} · {when}', { via: send.via === 'email' ? 'Email' : send.via === 'whatsapp' ? 'WhatsApp' : 'Copied', to: send.to ?? '', who: send.by ?? '', when: when(send.at) })}</p>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{busy ? t('dermat_orders.sendDoc.making', 'Making the link…') : ''}</p>
          )}
        </DialogContent>
      </Dialog>
      {ConfirmDialogElement}
    </>
  )
}

export default SendDocButton
