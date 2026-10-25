import { NextResponse } from 'next/server'

const WINDOW_MS = 60_000
const buckets = new Map<string, { count: number; resetAt: number }>()

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  return (forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip'))?.trim() || 'local'
}

export function publicRateLimit(req: Request, bucket: string, limit = 60): NextResponse | null {
  const now = Date.now()
  if (buckets.size > 5000) for (const [key, entry] of buckets) if (entry.resetAt < now) buckets.delete(key)
  const key = `${bucket}:${clientIp(req)}`
  const entry = buckets.get(key)
  if (!entry || entry.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return null
  }
  entry.count += 1
  if (entry.count <= limit) return null
  return NextResponse.json({ error: 'Too many tries. Wait a minute and open the link again.' }, { status: 429, headers: { 'retry-after': String(Math.ceil((entry.resetAt - now) / 1000)) } })
}
