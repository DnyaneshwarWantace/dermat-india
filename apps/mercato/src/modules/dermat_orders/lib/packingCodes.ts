import { DermatOrderLine } from '../data/entities'
import { loadProducts, type OrderContext } from './server'

export type PackingCodeIssue = { lineId: string; product: string; code: string | null }

function normalize(code: string): string {
  return code.replace(/\s+/g, ' ').trim().toUpperCase()
}

export function linePackingCode(line: Pick<DermatOrderLine, 'specs'>, productCode: string | null): string | null {
  const typed = line.specs?.primary?.packing_code
  const value = typeof typed === 'string' && typed.trim() ? typed : productCode
  return value?.trim() ? normalize(value) : null
}

export async function packingCodeIssues(ctx: OrderContext, orderId: string): Promise<PackingCodeIssue[]> {
  const lines = await ctx.em.find(DermatOrderLine, { orderId }, { orderBy: { position: 'asc' } })
  if (!lines.length) return []
  const products = await loadProducts(ctx, lines.map((line) => line.productId))
  const rows = await ctx.em.getConnection().execute<Array<{ code: string }>>(
    `select upper(regexp_replace(code, '\\s+', ' ', 'g')) as code from dermat_packaging_codes where tenant_id = ? and organization_id = ? and deleted_at is null`,
    [ctx.tenantId, ctx.organizationId],
  )
  const known = new Set(rows.map((row) => row.code))
  return lines
    .map((line) => {
      const product = products.get(line.productId)
      return { line, product, code: linePackingCode(line, product?.packagingCode ?? null) }
    })
    .filter((entry) => !entry.code || !known.has(entry.code))
    .map((entry) => ({ lineId: entry.line.id, product: entry.product?.title ?? 'a product', code: entry.code }))
}

export function packingCodeMessage(issues: PackingCodeIssue[]): string {
  const missing = issues.filter((issue) => !issue.code).map((issue) => issue.product)
  const unknown = issues.filter((issue) => issue.code).map((issue) => `${issue.code} (${issue.product})`)
  const parts: string[] = []
  if (missing.length) parts.push(`no packing code for ${missing.join(', ')}`)
  if (unknown.length) parts.push(`packing code not in Masters → Packaging codes: ${unknown.join(', ')}`)
  return `Artwork cannot be finished: ${parts.join('; ')}. Add the code to the order line or create it in Packaging codes.`
}

export type PackingSet = {
  lineId: string
  product: string
  code: string | null
  name: string | null
  kind: string | null
  size: string | null
  specs: string | null
  parts: Array<{ name: string; qty: number }>
  printed: string[]
}

export async function packingSets(ctx: OrderContext, orderId: string): Promise<PackingSet[]> {
  const lines = await ctx.em.find(DermatOrderLine, { orderId }, { orderBy: { position: 'asc' } })
  if (!lines.length) return []
  const products = await loadProducts(ctx, lines.map((line) => line.productId))
  const rows = await ctx.em.getConnection().execute<Array<{ code: string; name: string; kind: string; size: string | null; specs: string | null; components: Array<{ productId: string; qty: number }> | null; printed_items: string[] | null }>>(
    `select upper(regexp_replace(code, '\\s+', ' ', 'g')) as code, name, kind, size, specs, components, printed_items from dermat_packaging_codes where tenant_id = ? and organization_id = ? and deleted_at is null`,
    [ctx.tenantId, ctx.organizationId],
  )
  const byCode = new Map(rows.map((row) => [row.code, row]))
  const partIds = rows.flatMap((row) => (row.components ?? []).map((part) => part.productId))
  const parts = await loadProducts(ctx, partIds)
  return lines.map((line) => {
    const product = products.get(line.productId)
    const code = linePackingCode(line, product?.packagingCode ?? null)
    const set = code ? byCode.get(code) : undefined
    return {
      lineId: line.id,
      product: product?.title ?? 'a product',
      code,
      name: set?.name ?? null,
      kind: set?.kind ?? null,
      size: set?.size ?? null,
      specs: set?.specs ?? null,
      parts: (set?.components ?? []).map((part) => ({ name: parts.get(part.productId)?.title ?? 'a part', qty: Number(part.qty) || 1 })),
      printed: set?.printed_items ?? [],
    }
  })
}
