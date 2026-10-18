import type { PackagingCodeView } from '../types'

export const PACKAGING_KIND_LABEL: Record<PackagingCodeView['kind'], { key: string; fallback: string }> = {
  tube: { key: 'dermat_boms.packaging.kind.tube', fallback: 'Tube' },
  jar: { key: 'dermat_boms.packaging.kind.jar', fallback: 'Jar' },
  bottle: { key: 'dermat_boms.packaging.kind.bottle', fallback: 'Bottle' },
  other: { key: 'dermat_boms.packaging.kind.other', fallback: 'Other' },
}

export const DEFAULT_PRINTED: Record<PackagingCodeView['kind'], string[]> = {
  tube: ['Tube', 'Carton'],
  jar: ['Label', 'Carton'],
  bottle: ['Label', 'Carton'],
  other: ['Carton'],
}

export function setSummary(code: Pick<PackagingCodeView, 'components' | 'printedItems'>, perProduct: (item: string) => string): string {
  const parts = code.components.map((part) => (part.qty === 1 ? part.name : `${part.qty} × ${part.name}`))
  const printed = code.printedItems.map(perProduct)
  return [...parts, ...printed].join(' + ')
}
