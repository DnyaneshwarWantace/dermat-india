// `crypto.randomUUID()` is only exposed in a secure context (HTTPS, or
// http://localhost) — browsers throw "crypto.randomUUID is not a function"
// on a plain-HTTP origin (e.g. a bare-IP deployment with no TLS cert yet).
// Node/server code is unaffected; this only matters for browser call sites.
export function randomUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
