import QRCode from 'qrcode'

export type LabelInfo = {
  token: string
  orderNo: string
  batchNo: string | null
  mfgDate: string | null
  mfgMonth: string | null
  expiryMonth: string | null
  products: Array<{ title: string; brandName: string | null; packSize: string | null; quantity: number }>
}

export function shipperBoxes(total: number, perBox: number): number[] {
  if (!(total > 0) || !(perBox > 0)) return []
  const full = Math.floor(total / perBox)
  const rest = total - full * perBox
  return [...Array.from({ length: full }, () => perBox), ...(rest > 0 ? [rest] : [])]
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)
}

export async function buildLabelsHtml(info: LabelInfo, boxes: number[], origin: string): Promise<string> {
  const product = info.products[0]
  const title = [product?.title, product?.packSize].filter(Boolean).join(' · ')
  const dates = [info.mfgMonth || info.mfgDate ? `MFG ${info.mfgMonth ?? info.mfgDate}` : null, info.expiryMonth ? `EXP ${info.expiryMonth}` : null].filter(Boolean).join('   ')
  const codes = await Promise.all(
    boxes.map((pieces, index) => {
      const url = `${origin}/scan/shipper/${info.token}?box=${index + 1}&of=${boxes.length}&pcs=${pieces}`
      return QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }).then((svg) => ({ url, svg }))
    }),
  )
  const pages = boxes
    .map((pieces, index) => {
      const { url, svg } = codes[index]
      return `<section class="label">
  <div class="top"><span class="brand">DERMAT INDIA</span><span class="order">${escapeHtml(info.orderNo)}</span></div>
  <p class="product">${escapeHtml(title)}</p>
  ${product?.brandName ? `<p class="sub">${escapeHtml(product.brandName)}</p>` : ''}
  <div class="grid">
    <div><span>Batch</span><b>${escapeHtml(info.batchNo ?? '—')}</b></div>
    <div><span>Pieces</span><b>${pieces}</b></div>
    <div class="wide"><span>Dates</span><b>${escapeHtml(dates || '—')}</b></div>
  </div>
  <div class="bottom"><span class="box">BOX ${index + 1} OF ${boxes.length}</span><span class="qr">${svg}<span class="scan">${escapeHtml(url.replace(/^https?:\/\//, ''))}</span></span></div>
</section>`
    })
    .join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(`Shipper labels ${info.orderNo}`)}</title>
<style>
  @page { size: 100mm 75mm; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #000; background: #fff; }
  .label { width: 100mm; height: 75mm; padding: 5mm; display: flex; flex-direction: column; gap: 2mm; page-break-after: always; border: 1px dashed #bbb; }
  .top { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1.5px solid #000; padding-bottom: 1.5mm; }
  .brand { font-weight: 800; letter-spacing: .08em; font-size: 12pt; }
  .order { font-family: Menlo, Consolas, monospace; font-size: 9pt; }
  .product { margin: 0; font-size: 13pt; font-weight: 700; line-height: 1.2; }
  .sub { margin: 0; font-size: 9pt; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5mm 4mm; font-size: 10pt; }
  .grid span { display: block; font-size: 7pt; text-transform: uppercase; letter-spacing: .06em; color: #444; }
  .grid .wide { grid-column: 1 / -1; }
  .bottom { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; gap: 3mm; }
  .box { font-size: 15pt; font-weight: 800; }
  .qr { display: flex; flex-direction: column; align-items: flex-end; gap: 1mm; }
  .qr svg { width: 22mm; height: 22mm; }
  .scan { font-family: Menlo, Consolas, monospace; font-size: 5pt; text-align: right; word-break: break-all; max-width: 40mm; }
  @media screen { body { padding: 10px; background: #eee; } .label { background: #fff; margin: 0 auto 10px; } }
</style></head><body>${pages}
<script>window.addEventListener('load', function () { setTimeout(function () { window.print() }, 300) })</script>
</body></html>`
}

export function openLabels(info: LabelInfo, boxes: number[]): boolean {
  const popup = window.open('', '_blank', 'width=520,height=760')
  if (!popup) return false
  void buildLabelsHtml(info, boxes, window.location.origin).then((html) => {
    popup.document.open()
    popup.document.write(html)
    popup.document.close()
  })
  return true
}
