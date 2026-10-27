export type WeightLimits = { min: number; max: number; target: number; percent: number }

const amount = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function weightLimits(data: Record<string, unknown> | null | undefined): WeightLimits | null {
  const filled = amount(data?.filled_weight)
  const percent = amount(data?.weight_limit_percent)
  if (filled === null || percent === null || filled <= 0) return null
  const empty = amount(data?.empty_weight) ?? 0
  const tolerance = ((filled - empty) * percent) / 100
  const round = (value: number) => Math.round(value * 100) / 100
  return { min: round(filled - tolerance), max: round(filled + tolerance), target: filled, percent }
}

export type FillingCheck = {
  at: string
  by: string | null
  weights?: number[]
  avg?: number | null
  temp?: number | null
  rh?: number | null
  weightOk: boolean
  bottleOk?: boolean
  capOk?: boolean
  leakOk?: boolean
  weightG?: number | null
  note: string | null
}

export type BprEntry = { at: string; by: string | null } & Record<string, string | number | boolean | null>

export const BPR_SECTIONS = ['pm_issue', 'cleaning', 'filling_log', 'in_process', 'leak', 'packing_report'] as const
export type BprSection = (typeof BPR_SECTIONS)[number]
