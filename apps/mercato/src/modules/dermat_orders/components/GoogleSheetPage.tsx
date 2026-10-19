'use client'

import * as React from 'react'
import { ExternalLink, FileSpreadsheet, RefreshCw } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { flash } from '@open-mercato/ui/backend/FlashMessages'

type Status = { ready: boolean; missing: string[]; shareWith: string | null; sheetUrl: string | null; lastSyncAt: string | null; rows: number | null; error: string | null }

function when(value: string | null): string {
  return value ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
}

export function GoogleSheetPage() {
  const t = useT()
  const { runMutation } = useGuardedMutation({ contextId: 'dermat-google-sheet' })
  const [status, setStatus] = React.useState<Status | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [link, setLink] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    apiCall<Status & { error?: string }>('/api/dermat_orders/google-sheet').then((call) => {
      if (!call.ok || !call.result) return setError(t('dermat_orders.sheet.loadError', 'Could not load the Google Sheet settings.'))
      setStatus(call.result)
      setLink(call.result.sheetUrl ?? '')
    })
  }, [t])

  const send = async (method: 'PUT' | 'POST', body: Record<string, unknown>, done: string) => {
    setBusy(true)
    try {
      const call = await runMutation({
        context: { action: method === 'PUT' ? 'google_sheet_link' : 'google_sheet_sync' },
        mutationPayload: body,
        operation: () => apiCall<Status & { error?: string }>('/api/dermat_orders/google-sheet', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
      })
      if (!call.ok || !call.result || !('ready' in call.result)) {
        flash(call.result?.error ?? t('dermat_orders.sheet.failed', 'Could not update the sheet.'), 'error')
        const fresh = await apiCall<Status>('/api/dermat_orders/google-sheet')
        if (fresh.ok && fresh.result) setStatus(fresh.result)
        return
      }
      setStatus(call.result)
      flash(done, 'success')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page>
      <PageBody>
        <div className="flex max-w-3xl flex-col gap-5">
          <header className="space-y-1 border-b pb-4">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <FileSpreadsheet className="h-6 w-6 text-primary" aria-hidden="true" />
              {t('dermat_orders.sheet.title', 'Order book on Google Sheets')}
            </h1>
            <p className="text-sm text-muted-foreground">{t('dermat_orders.sheet.lede', 'The order book is written to a tab called "Order book" in your Google Sheet: one row per product, where each order is now, packing material and every stage. Money is left out. The sheet is for viewing; changes are made in the ERP.')}</p>
          </header>
          {error ? <ErrorMessage label={error} /> : null}
          {!status && !error ? <LoadingMessage label={t('dermat_orders.sheet.loading', 'Loading…')} /> : null}
          {status ? (
            <>
              {!status.ready ? (
                <section className="space-y-1 rounded-lg border bg-card p-4 text-sm">
                  <StatusBadge variant="warning">{t('dermat_orders.sheet.off', 'Not set up yet')}</StatusBadge>
                  <p className="text-muted-foreground">{t('dermat_orders.sheet.setup', 'Your developer creates a Google service account and sets these on the server:')}</p>
                  <ul className="list-disc pl-5 font-mono text-xs text-muted-foreground">
                    {status.missing.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
              <section className="space-y-3 rounded-lg border bg-card p-4">
                <div className="space-y-1">
                  <Label htmlFor="sheet-link">{t('dermat_orders.sheet.link', 'Google Sheet link')}</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input id="sheet-link" value={link} placeholder="https://docs.google.com/spreadsheets/d/…" onChange={(event) => setLink(event.target.value)} />
                    <Button type="button" variant="outline" disabled={busy} onClick={() => void send('PUT', { sheet: link }, t('dermat_orders.sheet.saved', 'Link saved'))}>
                      {t('dermat_orders.sheet.save', 'Save link')}
                    </Button>
                  </div>
                  {status.shareWith ? <p className="text-xs text-muted-foreground">{t('dermat_orders.sheet.share', 'In Google Sheets, share the sheet with {email} as Editor.', { email: status.shareWith })}</p> : null}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm">
                  <span className="text-muted-foreground">
                    {status.error ? (
                      <span className="text-status-error-text">{status.error}</span>
                    ) : status.lastSyncAt ? (
                      t('dermat_orders.sheet.last', 'Last written {when} · {rows} rows', { when: when(status.lastSyncAt), rows: status.rows ?? 0 })
                    ) : (
                      t('dermat_orders.sheet.never', 'Not written yet')
                    )}
                  </span>
                  <span className="flex gap-2">
                    {status.sheetUrl ? (
                      <Button asChild variant="outline" size="sm">
                        <a href={status.sheetUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          {t('dermat_orders.sheet.open', 'Open sheet')}
                        </a>
                      </Button>
                    ) : null}
                    <Button type="button" size="sm" disabled={busy || !status.ready || !status.sheetUrl} onClick={() => void send('POST', {}, t('dermat_orders.sheet.synced', 'Order book written to the sheet'))}>
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      {t('dermat_orders.sheet.sync', 'Write now')}
                    </Button>
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{t('dermat_orders.sheet.auto', 'To keep it up to date on its own, the server runs "mercato dermat_orders sync-sheet" every few minutes.')}</p>
              </section>
            </>
          ) : null}
        </div>
      </PageBody>
    </Page>
  )
}

export default GoogleSheetPage
