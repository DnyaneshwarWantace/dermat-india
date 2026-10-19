'use client'

import * as React from 'react'
import { FileText, Printer, Truck } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { Spinner } from '@open-mercato/ui/primitives/spinner'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { buildPiHtml } from '../../../dermat_accounts/components/piPrint'
import { buildInvoiceHtml } from '../../../dermat_accounts/components/invoicePrint'
import type { CompanyView, InvoiceView, PiView } from '../../../dermat_accounts/components/types'
import { buildPurchaseOrderHtml } from '../../../dermat_purchase/components/printPo'
import type { PoView } from '../../../dermat_purchase/components/shared'
import { buildClientSheetHtml, type ClientSheetLabels } from '../../../dermat_rnd/components/trial/clientSheet'
import type { RdRequest, Trial } from '../../../dermat_rnd/components/types'

type Dispatch = { orderNo: string; customerName: string | null; products: Array<{ title: string; packSize: string | null; quantity: number; batchNo: string | null }>; dispatchDate: string | null; transporter: string | null; lrNumber: string | null; vehicleNo: string | null; boxes: string | null; ewayBillNo: string | null; invoiceNo: string | null; files: Array<{ id: string; fileName: string; mimeType: string }> }
type Doc = { kind: 'pi' | 'invoice' | 'po' | 'dispatch' | 'sample'; title: string; pi?: PiView; invoice?: InvoiceView; company?: CompanyView; po?: PoView; request?: RdRequest; trial?: Trial; dispatch?: Dispatch }

const SAMPLE_LABELS: ClientSheetLabels = {
  title: 'Sample details for client', client: 'Client', brand: 'Brand', product: 'Product', sampleNo: 'Sample no.', packSize: 'Pack size', sentOn: 'Sample sent on', request: 'What was asked', texture: 'Texture', fragrance: 'Fragrance', colour: 'Colour', claims: 'Claims', ingredients: 'Key ingredients', instruction: 'Client instruction', results: 'Lab results', parameter: 'Parameter', value: 'Observation', result: 'Result', pass: 'Pass', fail: 'Fail', remarks: 'Remarks', note: 'Lab sample for evaluation only. Final product may vary slightly in colour and fragrance.', preparedBy: 'R&D, Dermat India', receivedBy: 'Received by (client)', newProduct: 'New product',
}

function htmlFor(doc: Doc, forPrint: boolean): string | null {
  if (doc.kind === 'pi' && doc.pi && doc.company) return buildPiHtml(doc.pi, doc.company, forPrint)
  if (doc.kind === 'invoice' && doc.invoice && doc.company) return buildInvoiceHtml(doc.invoice, doc.company, forPrint)
  if (doc.kind === 'po' && doc.po) return buildPurchaseOrderHtml(doc.po)
  if (doc.kind === 'sample' && doc.request && doc.trial) return buildClientSheetHtml(doc.request, doc.trial, SAMPLE_LABELS)
  return null
}

function withoutAutoPrint(html: string): string {
  return html.replace(/<script>[\s\S]*?window\.print\(\)[\s\S]*?<\/script>/g, '')
}

export function DocLinkPage({ token }: { token: string }) {
  const t = useT()
  const [doc, setDoc] = React.useState<Doc | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    apiCall<Doc & { error?: string }>(`/api/dermat_orders/doc-links/public?token=${encodeURIComponent(token)}`, { headers: { 'x-om-forbidden-redirect': '0' } }).then((call) => {
      if (call.ok && call.result) setDoc(call.result)
      else setError(call.result?.error ?? t('dermat_orders.docLink.invalid', 'This link is not valid.'))
    })
  }, [token, t])

  const html = doc ? htmlFor(doc, false) : null
  const print = () => {
    if (!doc) return
    const printable = htmlFor(doc, true)
    if (!printable) return window.print()
    const popup = window.open('', '_blank', 'width=960,height=1100')
    if (!popup) return
    popup.document.open()
    popup.document.write(printable)
    popup.document.close()
  }

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
          <div>
            <p className="text-lg font-extrabold tracking-wider">DERMAT INDIA</p>
            <p className="text-sm text-muted-foreground">{doc?.title ?? ''}</p>
          </div>
          {doc ? (
            <Button type="button" variant="outline" size="sm" onClick={print}>
              <Printer className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {t('dermat_orders.docLink.print', 'Print / save as PDF')}
            </Button>
          ) : null}
        </header>
        {error ? <p className="rounded-md border border-status-error-border bg-status-error-bg p-4 text-sm text-status-error-text">{error}</p> : null}
        {!doc && !error ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : null}
        {html ? <iframe title={doc?.title ?? 'Document'} srcDoc={withoutAutoPrint(html)} className="h-screen w-full rounded-lg border bg-white" /> : null}
        {doc?.kind === 'dispatch' && doc.dispatch ? <DispatchView token={token} dispatch={doc.dispatch} /> : null}
      </div>
    </main>
  )
}

function DispatchView({ token, dispatch }: { token: string; dispatch: Dispatch }) {
  const t = useT()
  const rows: Array<[string, string | null]> = [
    [t('dermat_orders.docLink.order', 'Order'), dispatch.orderNo],
    [t('dermat_orders.docLink.invoice', 'Invoice no.'), dispatch.invoiceNo],
    [t('dermat_orders.docLink.date', 'Dispatched on'), dispatch.dispatchDate],
    [t('dermat_orders.docLink.transporter', 'Transporter'), dispatch.transporter],
    [t('dermat_orders.docLink.lr', 'LR / docket no.'), dispatch.lrNumber],
    [t('dermat_orders.docLink.vehicle', 'Vehicle no.'), dispatch.vehicleNo],
    [t('dermat_orders.docLink.boxes', 'Boxes'), dispatch.boxes],
    [t('dermat_orders.docLink.eway', 'E-way bill no.'), dispatch.ewayBillNo],
  ]
  return (
    <section className="space-y-4 rounded-lg border bg-card p-4">
      <p className="flex items-center gap-2 text-base font-semibold">
        <Truck className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        {dispatch.customerName ? t('dermat_orders.docLink.dispatchFor', 'Dispatch for {name}', { name: dispatch.customerName }) : t('dermat_orders.docLink.dispatch', 'Dispatch details')}
      </p>
      <ul className="space-y-1 text-sm">
        {dispatch.products.map((product, index) => (
          <li key={index} className="flex flex-wrap justify-between gap-2">
            <span className="font-medium">{[product.title, product.packSize].filter(Boolean).join(' · ')}</span>
            <span className="text-muted-foreground">{[`${product.quantity.toLocaleString('en-IN')} pcs`, product.batchNo ? `Batch ${product.batchNo}` : null].filter(Boolean).join(' · ')}</span>
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
      </dl>
      {dispatch.files.length ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('dermat_orders.docLink.files', 'Bilty and e-way bill')}</p>
          <div className="flex flex-wrap gap-2">
            {dispatch.files.map((file) => (
              <a key={file.id} href={`/api/dermat_orders/doc-links/file?token=${encodeURIComponent(token)}&id=${file.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm text-primary hover:underline">
                <FileText className="h-4 w-4" aria-hidden="true" />
                {file.fileName}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default DocLinkPage
