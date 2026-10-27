"use client"

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Button } from '@open-mercato/ui/primitives/button'
import { IconButton } from '@open-mercato/ui/primitives/icon-button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
import { Checkbox } from '@open-mercato/ui/primitives/checkbox'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { BackLink } from '../../dermat_departments/components/BackLink'
import { SearchPicker } from '../../dermat_orders/components/SearchPicker'
import { loadCustomer, searchCustomers, searchFinishedGoods } from '../../dermat_orders/components/loaders'
import type { Customer } from '../../dermat_orders/components/types'
import { priceLine, priceOrder } from '../../dermat_orders/lib/pricing'
import { rupeeText } from '../../dermat_products/lib/whatsapp'

type Line = { key: string; productId: string | null; title: string; packSize: string; quantity: string; rate: string; gstPercent: string; discountPercent: string }

let counter = 0
function newLine(title = ''): Line {
  counter += 1
  return { key: `l${counter}`, productId: null, title, packSize: '', quantity: title ? '1' : '', rate: '', gstPercent: '18', discountPercent: '' }
}

function num(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function NewProformaPage() {
  const t = useT()
  const router = useRouter()
  const params = useSearchParams()
  const { runMutation } = useGuardedMutation({ contextId: 'dermat-new-proforma' })
  const [customer, setCustomer] = React.useState<Customer | null>(null)
  const [lines, setLines] = React.useState<Line[]>([newLine()])
  const [includeGst, setIncludeGst] = React.useState(false)
  const [advance, setAdvance] = React.useState('40')
  const [validDays, setValidDays] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    const id = params?.get('customerId')
    if (id) void loadCustomer(id).then((found) => found && setCustomer(found))
  }, [params])

  const patch = (key: string, next: Partial<Line>) => setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...next } : line)))
  const priced = lines.map((line) => ({ quantity: num(line.quantity), rate: num(line.rate), gstPercent: num(line.gstPercent), discountPercent: num(line.discountPercent) }))
  const totals = priceOrder(priced, includeGst)

  const save = async () => {
    if (!customer) return flash(t('dermat_accounts.newPi.customer', 'Pick the customer.'), 'error')
    const filled = lines.filter((line) => line.title.trim() && num(line.quantity) > 0)
    if (!filled.length) return flash(t('dermat_accounts.newPi.lines', 'Add at least one line with a description and quantity.'), 'error')
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    const validUntil = num(validDays) > 0 ? new Date(Date.now() + num(validDays) * 86400000).toISOString().slice(0, 10) : null
    const body = {
      customerId: customer.id,
      pricesIncludeGst: includeGst,
      piDate: today,
      validUntil,
      advancePercent: advance.trim() ? num(advance) : null,
      notes: notes.trim() || null,
      lines: filled.map((line) => ({ productId: line.productId, title: line.title.trim(), packSize: line.packSize || null, quantity: num(line.quantity), rate: num(line.rate), gstPercent: num(line.gstPercent), discountPercent: num(line.discountPercent) })),
    }
    setSaving(true)
    try {
      const call = await runMutation({
        context: { proforma: 'new' },
        mutationPayload: body,
        operation: () => apiCall<{ id?: string; code?: string; error?: string }>('/api/dermat_accounts/proformas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
      })
      if (!call.ok || !call.result?.id) return flash(call.result?.error ?? t('dermat_accounts.newPi.error', 'Could not make the proforma invoice.'), 'error')
      flash(t('dermat_accounts.newPi.saved', 'Proforma {code} made', { code: call.result.code ?? '' }), 'success')
      router.push(`/backend/accounts/proformas/${call.result.id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Page>
      <PageBody>
        <div
          className="mx-auto flex max-w-6xl flex-col gap-5 pb-16"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              if (!saving) void save()
            }
          }}
        >
          <header className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 space-y-1">
              <BackLink href="/backend/accounts/proformas" label={t('dermat_accounts.pi.back', 'All proforma invoices')} />
              <h1 className="text-xl font-bold">{t('dermat_accounts.newPi.title', 'New proforma invoice (before the order)')}</h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                {t('dermat_accounts.newPi.lede', 'For the advance when the order details are not known yet. A line can be just a description and pack size (e.g. "Cream 50 g"). Add plate or design charges as their own lines. When the money comes, make the order from this proforma.')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => router.push('/backend/accounts/proformas')}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="button" onClick={() => void save()} disabled={saving}>
                {saving ? t('dermat_accounts.newPi.saving', 'Saving…') : t('dermat_accounts.newPi.save', 'Make proforma')}
              </Button>
            </div>
          </header>

          <section className="grid grid-cols-1 gap-4 rounded-lg border bg-card p-4 md:grid-cols-12">
            <div className="flex flex-col gap-1 md:col-span-6">
              <Label>{t('dermat_accounts.newPi.customerLabel', 'Customer')}</Label>
              <SearchPicker
                value={customer ? { id: customer.id, primary: customer.name, secondary: customer.gstin ? `GSTIN ${customer.gstin}` : null, value: customer } : null}
                placeholder={t('dermat_accounts.newPi.customerPick', 'Customer name or GSTIN')}
                searchPlaceholder={t('dermat_accounts.newPi.customerSearch', 'Search customers')}
                load={searchCustomers}
                onSelect={(option) => setCustomer(option.value)}
              />
            </div>
            <div className="flex flex-col gap-1 md:col-span-2">
              <Label htmlFor="npi-adv">{t('dermat_accounts.newPi.advance', 'Advance %')}</Label>
              <Input id="npi-adv" type="number" min={0} max={100} step="any" value={advance} onChange={(event) => setAdvance(event.target.value)} />
            </div>
            <div className="flex flex-col gap-1 md:col-span-2">
              <Label htmlFor="npi-valid">{t('dermat_accounts.newPi.valid', 'Valid for (days)')}</Label>
              <Input id="npi-valid" type="number" min={0} step="1" value={validDays} placeholder="15" onChange={(event) => setValidDays(event.target.value)} />
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm md:col-span-2">
              <Checkbox checked={includeGst} onCheckedChange={(checked) => setIncludeGst(checked === true)} />
              {t('dermat_accounts.newPi.inclGst', 'Rates include GST')}
            </label>
          </section>

          <section className="flex flex-col gap-2 rounded-lg border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-max table-fixed text-sm lg:min-w-0">
                <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="w-80 px-3 py-2 text-left font-semibold">{t('dermat_accounts.newPi.item', 'Product or description')}</th>
                    <th className="w-28 px-3 py-2 text-left font-semibold">{t('dermat_accounts.newPi.pack', 'Pack size')}</th>
                    <th className="w-24 px-3 py-2 text-right font-semibold">{t('dermat_accounts.newPi.qty', 'Qty')}</th>
                    <th className="w-28 px-3 py-2 text-right font-semibold">{t('dermat_accounts.newPi.rate', 'Rate (₹)')}</th>
                    <th className="w-20 px-3 py-2 text-right font-semibold">{t('dermat_accounts.newPi.gst', 'GST %')}</th>
                    <th className="w-20 px-3 py-2 text-right font-semibold">{t('dermat_accounts.newPi.disc', 'Disc. %')}</th>
                    <th className="w-28 px-3 py-2 text-right font-semibold">{t('dermat_accounts.newPi.total', 'Total')}</th>
                    <th className="w-10 px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lines.map((line, index) => (
                    <tr key={line.key} className="align-top">
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          <Input value={line.title} placeholder={t('dermat_accounts.newPi.desc', 'e.g. Cream 50 g, or Plate charges')} onChange={(event) => patch(line.key, { title: event.target.value, productId: line.productId && event.target.value !== line.title ? null : line.productId })} />
                          <SearchPicker
                            value={null}
                            placeholder={t('dermat_accounts.newPi.pickProduct', 'or pick a product…')}
                            searchPlaceholder={t('dermat_accounts.newPi.productSearch', 'Product name or code')}
                            load={searchFinishedGoods}
                            onSelect={(option) => patch(line.key, { productId: option.id, title: option.primary })}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2"><Input value={line.packSize} placeholder="50 g" onChange={(event) => patch(line.key, { packSize: event.target.value })} /></td>
                      <td className="px-3 py-2"><Input type="number" min={0} step="any" className="text-right" value={line.quantity} onChange={(event) => patch(line.key, { quantity: event.target.value })} /></td>
                      <td className="px-3 py-2"><Input type="number" min={0} step="any" className="text-right" value={line.rate} onChange={(event) => patch(line.key, { rate: event.target.value })} /></td>
                      <td className="px-3 py-2"><Input type="number" min={0} max={40} step="any" className="text-right" value={line.gstPercent} onChange={(event) => patch(line.key, { gstPercent: event.target.value })} /></td>
                      <td className="px-3 py-2"><Input type="number" min={0} max={100} step="any" className="text-right" value={line.discountPercent} placeholder="0" onChange={(event) => patch(line.key, { discountPercent: event.target.value })} /></td>
                      <td className="px-3 py-2 pt-4 text-right font-medium tabular-nums">{rupeeText(priceLine(priced[index], includeGst).total)}</td>
                      <td className="px-3 py-2">
                        {lines.length > 1 ? (
                          <IconButton type="button" variant="ghost" size="sm" aria-label={t('dermat_accounts.newPi.remove', 'Remove line')} onClick={() => setLines((prev) => prev.filter((entry) => entry.key !== line.key))}>
                            <Trash2 className="size-4" aria-hidden="true" />
                          </IconButton>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-muted/20 text-sm">
                  <tr>
                    <td colSpan={6} className="px-3 py-2 text-right text-muted-foreground">{t('dermat_accounts.newPi.grand', 'Total with GST')}</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">{rupeeText(totals.total)}</td>
                    <td />
                  </tr>
                  {num(advance) > 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-2 text-right text-muted-foreground">{t('dermat_accounts.newPi.advanceAmount', 'Advance {pct}%', { pct: advance })}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{rupeeText((totals.total * num(advance)) / 100)}</td>
                      <td />
                    </tr>
                  ) : null}
                </tfoot>
              </table>
            </div>
            <div className="flex flex-wrap gap-2 border-t p-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, newLine()])}>
                <Plus className="mr-1.5 size-4" aria-hidden="true" />
                {t('dermat_accounts.newPi.addLine', 'Add line')}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, newLine(t('dermat_accounts.newPi.plate', 'Plate charges'))])}>
                <Plus className="mr-1.5 size-4" aria-hidden="true" />
                {t('dermat_accounts.newPi.addPlate', 'Add plate charges')}
              </Button>
            </div>
          </section>

          <section className="flex flex-col gap-1 rounded-lg border bg-card p-4">
            <Label htmlFor="npi-notes">{t('dermat_accounts.pi.notes', 'Note to the customer')}</Label>
            <Textarea id="npi-notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
            <p className="text-xs text-muted-foreground">{t('dermat_accounts.newPi.bankHint', 'Bank details and terms come from Accounts → Company and can be changed on the proforma page.')}</p>
          </section>
        </div>
      </PageBody>
    </Page>
  )
}

export default NewProformaPage
