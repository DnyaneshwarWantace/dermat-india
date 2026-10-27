const SIZE_IN_TEXT = /\d+(?:\.\d+)?\s*(?:ml|gms?|g|kg|ltrs?|l|mg)\b/i

export function compactSize(size: string): string {
  return size.replace(/\s+/g, '').toUpperCase()
}

export function sizedName(title: string, size: string): string {
  const clean = size.trim()
  if (!clean) return title
  return SIZE_IN_TEXT.test(title) ? title.replace(SIZE_IN_TEXT, clean) : `${title} ${clean}`
}

export function sizedCode(code: string, size: string): string {
  const clean = compactSize(size)
  if (!code.trim() || !clean) return ''
  return SIZE_IN_TEXT.test(code) ? code.replace(SIZE_IN_TEXT, clean) : `${code}-${clean}`
}
