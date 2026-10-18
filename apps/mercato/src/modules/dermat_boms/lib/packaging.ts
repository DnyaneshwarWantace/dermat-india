import { PackagingCode } from '../data/entities'
import type { PackagingCodeInput } from '../data/validators'
import { BomError } from './service'
import { loadProducts, loadStock, type BomRequestContext } from './server'

export type PackagingPartView = {
  productId: string
  qty: number
  name: string
  code: string | null
  kind: string | null
  unit: string | null
  onHand: number
}

export type PackagingCodeView = {
  id: string
  code: string
  name: string
  kind: string
  size: string | null
  specs: string | null
  notes: string | null
  printedItems: string[]
  components: PackagingPartView[]
  updatedAt: string
}

export function normalizeCode(code: string): string {
  return code.replace(/\s+/g, ' ').trim().toUpperCase()
}

export async function findPackagingCode(ctx: BomRequestContext, id: string): Promise<PackagingCode> {
  const row = await ctx.em.findOne(PackagingCode, { id, tenantId: ctx.tenantId, organizationId: ctx.organizationId, deletedAt: null })
  if (!row) throw new BomError('Packaging code not found', 404)
  return row
}

export async function assertCodeFree(ctx: BomRequestContext, code: string, exceptId?: string): Promise<void> {
  const rows = await ctx.em.getConnection().execute<Array<{ id: string }>>(
    `select id from dermat_packaging_codes
      where tenant_id = ? and organization_id = ? and deleted_at is null
        and upper(regexp_replace(code, '\\s+', ' ', 'g')) = ?`,
    [ctx.tenantId, ctx.organizationId, normalizeCode(code)],
  )
  if (rows.some((row) => row.id !== exceptId)) throw new BomError(`Packaging code ${normalizeCode(code)} already exists`, 409)
}

export async function validateParts(ctx: BomRequestContext, input: PackagingCodeInput): Promise<void> {
  const products = await loadProducts(ctx, input.components.map((part) => part.productId))
  const seen = new Set<string>()
  for (const part of input.components) {
    const product = products.get(part.productId)
    if (!product) throw new BomError('A part of this set was not found')
    if (product.kind !== 'packing_material') throw new BomError(`${product.title} is not a packing material`)
    if (seen.has(part.productId)) throw new BomError(`${product.title} is added twice`)
    seen.add(part.productId)
  }
}

export function applyInput(row: PackagingCode, input: PackagingCodeInput): void {
  row.code = normalizeCode(input.code)
  row.name = input.name.trim()
  row.kind = input.kind
  row.size = input.size?.trim() || null
  row.specs = input.specs?.trim() || null
  row.notes = input.notes?.trim() || null
  row.components = input.components.map((part) => ({ productId: part.productId, qty: part.qty }))
  row.printedItems = Array.from(new Set(input.printedItems.map((item) => item.trim()).filter(Boolean)))
}

export async function serializePackagingCodes(ctx: BomRequestContext, rows: PackagingCode[]): Promise<PackagingCodeView[]> {
  const ids = rows.flatMap((row) => (row.components ?? []).map((part) => part.productId))
  const [products, stock] = await Promise.all([loadProducts(ctx, ids), loadStock(ctx, ids)])
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    kind: row.kind,
    size: row.size ?? null,
    specs: row.specs ?? null,
    notes: row.notes ?? null,
    printedItems: row.printedItems ?? [],
    components: (row.components ?? []).map((part) => {
      const product = products.get(part.productId)
      return {
        productId: part.productId,
        qty: Number(part.qty) || 1,
        name: product?.title ?? '(deleted product)',
        code: product?.code ?? null,
        kind: product?.kind ?? null,
        unit: product?.unit ?? null,
        onHand: stock.get(part.productId)?.onHand ?? 0,
      }
    }),
    updatedAt: row.updatedAt.toISOString(),
  }))
}
