'use client'

import * as React from 'react'
import { Copy, Mail, MessageCircle, UserPlus } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@open-mercato/ui/primitives/dialog'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { flash } from '@open-mercato/ui/backend/FlashMessages'

export function SendRegistrationButton({ customerId = null, customerName = null, email: startEmail = '', phone: startPhone = '', onMade, size = 'sm', variant = 'outline' }: { customerId?: string | null; customerName?: string | null; email?: string; phone?: string; onMade?: () => void; size?: 'sm' | 'default'; variant?: 'outline' | 'default' }) {
  const t = useT()
  const { runMutation } = useGuardedMutation({ contextId: `dermat-registration-${customerId ?? 'new'}` })
  const [open, setOpen] = React.useState(false)
  const [path, setPath] = React.useState<string | null>(null)
  const [email, setEmail] = React.useState(startEmail)
  const [phone, setPhone] = React.useState(startPhone)

  const start = async () => {
    setPath(null)
    setOpen(true)
    const body = { customerId }
    const call = await runMutation({
      context: { customerId, action: 'registration_link' },
      mutationPayload: body,
      operation: () => apiCall<{ path?: string; error?: string }>('/api/dermat_accounts/registrations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    })
    if (!call.ok || !call.result?.path) {
      flash(call.result?.error ?? t('dermat_accounts.reg.linkFailed', 'Could not make the link.'), 'error')
      setOpen(false)
      return
    }
    setPath(call.result.path)
    onMade?.()
  }

  const url = path ? `${window.location.origin}${path}` : ''
  const subject = t('dermat_accounts.reg.subject', 'Dermat India – customer registration form')
  const message = t('dermat_accounts.reg.message', 'Dear {name}, please fill your company details for Dermat India here: {url}\n\nIt takes a few minutes. Regards, Dermat India', { name: customerName || 'Sir / Madam', url })

  return (
    <>
      <Button type="button" size={size} variant={variant} onClick={() => void start()}>
        <UserPlus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
        {t('dermat_accounts.reg.send', 'Send registration link')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('dermat_accounts.reg.sendTitle', 'Registration link')}</DialogTitle>
            <DialogDescription>{t('dermat_accounts.reg.sendHint', 'The customer fills their details once. You will see them under Accounts → Customer registrations to check and approve.')}</DialogDescription>
          </DialogHeader>
          {path ? (
            <div className="space-y-4">
              <Input readOnly value={url} aria-label={t('dermat_accounts.reg.link', 'Link')} onFocus={(event) => event.target.select()} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-send-email">{t('dermat_accounts.reg.email', 'Email')}</Label>
                  <Input id="reg-send-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-send-phone">{t('dermat_accounts.reg.phone', 'WhatsApp number')}</Label>
                  <Input id="reg-send-phone" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <a href={`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`}>
                    <Mail className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    {t('dermat_accounts.reg.byEmail', 'Send by email')}
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
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
                    flash(t('dermat_accounts.reg.copied', 'Link copied'), 'success')
                  }}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  {t('dermat_accounts.reg.copy', 'Copy link')}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('dermat_accounts.reg.making', 'Making the link…')}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

export default SendRegistrationButton
