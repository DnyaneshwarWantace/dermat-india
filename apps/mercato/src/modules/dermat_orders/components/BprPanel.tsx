'use client'

import * as React from 'react'
import { BadgeCheck, ClipboardList, Printer, Trash2 } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@open-mercato/ui/primitives/select'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import type { BprView } from '../lib/bprRecord'
import type { BprSection } from '../lib/bpr'
import { useGranted } from '../../dermat_departments/components/useGranted'
import { formatDateTime, formatQty } from './format'
import { printBpr } from './bprPrint'
import type { DocCompany } from './printDocs'

type Action =
  | { kind: 'cleaning'; equipment: string; equipmentId: string | null; method: string | null; status: 'Clean' | 'Not clean' }
  | { kind: 'leak'; tested: number; failed: number; note: string | null }
  | { kind: 'destroyed'; productId: string; quantity: number }
  | { kind: 'verify'; section: BprSection }
  | { kind: 'remove'; list: 'cleaning' | 'leak'; at: string }

const PRODUCTION = ['dermat_orders.work.production', 'dermat_orders.work.filling', 'dermat_orders.work.packing', 'dermat_orders.manage']
const QA = ['dermat_orders.work.qa', 'dermat_orders.work.ipqa']

export function BprPanel({ batchNo }: { batchNo: string }) {
  const t = useT()
  const granted = useGranted()
  const { runMutation } = useGuardedMutation({ contextId: `dermat-bpr-${batchNo}` })
  const [bpr, setBpr] = React.useState<BprView | null>(null)
  const [denied, setDenied] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [equipment, setEquipment] = React.useState({ name: '', id: '', method: '', status: 'Clean' as 'Clean' | 'Not clean' })
  const [leak, setLeak] = React.useState({ tested: '', failed: '0', note: '' })
  const [destroyed, setDestroyed] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    apiCall<BprView>(`/api/dermat_orders/bpr?batch=${encodeURIComponent(batchNo)}`, { headers: { 'x-om-forbidden-redirect': '0' } }).then((call) => {
      if (call.ok && call.result) setBpr(call.result)
      else setDenied(true)
    })
  }, [batchNo])

  if (denied || !bpr) return null
  const production = PRODUCTION.some((feature) => granted.has(feature))
  const qa = QA.some((feature) => granted.has(feature))

  const send = async (action: Action) => {
    setBusy(true)
    try {
      const body = { batch: batchNo, action }
      const call = await runMutation({
        context: { batchNo, kind: action.kind },
        mutationPayload: body,
        operation: () => apiCall<BprView & { error?: string }>('/api/dermat_orders/bpr', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
      })
      if (!call.ok || !call.result) {
        flash(call.result?.error ?? t('dermat_orders.bpr.error', 'Could not save the entry.'), 'error')
        return false
      }
      setBpr(call.result)
      flash(t('dermat_orders.bpr.saved', 'Saved to the batch packing record'), 'success')
      return true
    } finally {
      setBusy(false)
    }
  }

  const verifyButton = (section: BprSection) => {
    const done = bpr.verify[section]
    if (done) return <StatusBadge variant="success">{t('dermat_orders.bpr.verifiedBy', 'QA verified · {name}', { name: done.by ?? '' })}</StatusBadge>
    if (!qa) return <StatusBadge variant="neutral">{t('dermat_orders.bpr.notVerified', 'Not verified by QA')}</StatusBadge>
    return (
      <Button type="button" size="sm" variant="outline" className="h-7" disabled={busy} onClick={() => void send({ kind: 'verify', section })}>
        <BadgeCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
        {t('dermat_orders.bpr.verify', 'QA verify')}
      </Button>
    )
  }

  const section = (key: BprSection, title: string, summary: string, body?: React.ReactNode) => (
    <li key={key} className="space-y-2 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-xs text-muted-foreground">{summary}</span>
        </span>
        {verifyButton(key)}
      </div>
      {body}
    </li>
  )

  const log = bpr.fillingLog
  const packRows = bpr.pm.filter((row) => row.stageKey === 'packing' || row.stageKey === 'filling')

  return (
    <section className="space-y-2" aria-labelledby="batch-bpr">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="batch-bpr" className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardList className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {t('dermat_orders.bpr.title', 'Batch packing record · {no}', { no: bpr.bprNo })}
        </h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            const call = await apiCall<DocCompany>('/api/dermat_accounts/company', { headers: { 'x-om-forbidden-redirect': '0' } }, { fallback: null as unknown as DocCompany })
            if (!printBpr(bpr, call.ok ? call.result ?? null : null)) flash(t('dermat_orders.batch.popup', 'Allow pop-ups to print the batch record.'), 'error')
          }}
        >
          <Printer className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {t('dermat_orders.bpr.print', 'Print BPR')}
        </Button>
      </div>
      <ul className="divide-y rounded-lg border bg-card">
        {section('pm_issue', t('dermat_orders.bpr.pm', 'Packing material issued'), t('dermat_orders.bpr.pmSummary', '{count} items from the store requests', { count: bpr.pm.length }))}
        {section(
          'cleaning',
          t('dermat_orders.bpr.cleaning', 'Equipment cleaning (packing section)'),
          bpr.cleaning.length ? bpr.cleaning.map((row) => `${row.equipment} · ${row.status}`).join(', ') : t('dermat_orders.bpr.none', 'Nothing written yet'),
          <div className="space-y-2">
            {bpr.cleaning.length ? (
              <ul className="space-y-1 text-xs">
                {bpr.cleaning.map((row) => (
                  <li key={String(row.at)} className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-2 py-1">
                    <span>
                      {[row.equipment, row.equipmentId, row.method, row.status].filter(Boolean).join(' · ')}
                      <span className="text-muted-foreground"> — {row.by} · {formatDateTime(String(row.at))}</span>
                    </span>
                    {production ? (
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5" disabled={busy} aria-label={t('dermat_orders.bpr.remove', 'Remove')} onClick={() => void send({ kind: 'remove', list: 'cleaning', at: String(row.at) })}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {production ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <Input id="bpr-eq-name" placeholder={t('dermat_orders.bpr.eqName', 'Equipment name')} value={equipment.name} onChange={(event) => setEquipment({ ...equipment, name: event.target.value })} />
                <Input id="bpr-eq-id" placeholder={t('dermat_orders.bpr.eqId', 'Equipment ID')} value={equipment.id} onChange={(event) => setEquipment({ ...equipment, id: event.target.value })} />
                <Input id="bpr-eq-method" placeholder={t('dermat_orders.bpr.eqMethod', 'How cleaned')} value={equipment.method} onChange={(event) => setEquipment({ ...equipment, method: event.target.value })} />
                <Select value={equipment.status} onValueChange={(value) => setEquipment({ ...equipment, status: value as 'Clean' | 'Not clean' })}>
                  <SelectTrigger aria-label={t('dermat_orders.bpr.eqStatus', 'Cleaned status')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Clean">{t('dermat_orders.bpr.clean', 'Clean')}</SelectItem>
                    <SelectItem value="Not clean">{t('dermat_orders.bpr.notClean', 'Not clean')}</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || !equipment.name.trim()}
                  onClick={async () => {
                    if (await send({ kind: 'cleaning', equipment: equipment.name.trim(), equipmentId: equipment.id.trim() || null, method: equipment.method.trim() || null, status: equipment.status })) setEquipment({ name: '', id: '', method: '', status: 'Clean' })
                  }}
                >
                  {t('dermat_orders.bpr.add', 'Add')}
                </Button>
              </div>
            ) : null}
          </div>,
        )}
        {section(
          'filling_log',
          t('dermat_orders.bpr.fillingLog', 'Filling / sealing / crimping'),
          [log.startedAt ? `${formatDateTime(log.startedAt)} → ${log.stoppedAt ? formatDateTime(log.stoppedAt) : t('dermat_orders.bpr.running', 'running')}` : t('dermat_orders.bpr.notStarted', 'Filling not started'), log.operator, log.areaTemp !== null ? `${log.areaTemp} °C` : null, log.areaRh !== null ? `${log.areaRh}% RH` : null, bpr.weight.limits ? t('dermat_orders.bpr.limits', 'weight {min}–{max} g', { min: bpr.weight.limits.min, max: bpr.weight.limits.max }) : t('dermat_orders.bpr.noLimits', 'weight limits not set')].filter(Boolean).join(' · '),
        )}
        {section('in_process', t('dermat_orders.bpr.inProcess', 'In-process checks'), t('dermat_orders.bpr.inProcessSummary', '{count} checks · {bad} not OK', { count: bpr.inProcess.length, bad: bpr.inProcess.filter((row) => !row.weightOk || row.bottleOk === false || row.capOk === false || row.leakOk === false).length }))}
        {section(
          'leak',
          t('dermat_orders.bpr.leak', 'Leak test'),
          bpr.leak.length ? t('dermat_orders.bpr.leakSummary', '{count} tests · {failed} bottles failed', { count: bpr.leak.length, failed: bpr.leak.reduce((sum, row) => sum + Number(row.failed ?? 0), 0) }) : t('dermat_orders.bpr.none', 'Nothing written yet'),
          production || qa ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="bpr-leak-tested" className="text-xs">{t('dermat_orders.bpr.tested', 'Bottles tested')}</Label>
                <Input id="bpr-leak-tested" type="number" inputMode="numeric" value={leak.tested} onChange={(event) => setLeak({ ...leak, tested: event.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bpr-leak-failed" className="text-xs">{t('dermat_orders.bpr.failed', 'Bottles failed')}</Label>
                <Input id="bpr-leak-failed" type="number" inputMode="numeric" value={leak.failed} onChange={(event) => setLeak({ ...leak, failed: event.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bpr-leak-note" className="text-xs">{t('dermat_orders.bpr.note', 'Note')}</Label>
                <Input id="bpr-leak-note" value={leak.note} onChange={(event) => setLeak({ ...leak, note: event.target.value })} />
              </div>
              <Button
                type="button"
                size="sm"
                className="self-end"
                disabled={busy || !leak.tested.trim()}
                onClick={async () => {
                  if (await send({ kind: 'leak', tested: Number(leak.tested), failed: Number(leak.failed || 0), note: leak.note.trim() || null })) setLeak({ tested: '', failed: '0', note: '' })
                }}
              >
                {t('dermat_orders.bpr.addLeak', 'Save leak test')}
              </Button>
            </div>
          ) : null,
        )}
        {section(
          'packing_report',
          t('dermat_orders.bpr.packingReport', 'Packing report'),
          [bpr.packingReport.packed !== null ? t('dermat_orders.bpr.packed', '{count} packed', { count: formatQty(bpr.packingReport.packed) }) : null, bpr.packingReport.labelCodedBy ? t('dermat_orders.bpr.labels', 'labels by {name}', { name: bpr.packingReport.labelCodedBy }) : null, bpr.packingReport.cartonsCodedBy ? t('dermat_orders.bpr.cartons', 'cartons by {name}', { name: bpr.packingReport.cartonsCodedBy }) : null].filter(Boolean).join(' · ') || t('dermat_orders.bpr.none', 'Nothing written yet'),
          packRows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-1 text-left font-medium">{t('dermat_orders.bpr.material', 'Material')}</th>
                    <th className="py-1 text-right font-medium">{t('dermat_orders.bpr.issued', 'Issued')}</th>
                    <th className="py-1 text-right font-medium">{t('dermat_orders.bpr.used', 'Used')}</th>
                    <th className="py-1 text-right font-medium">{t('dermat_orders.bpr.returned', 'Returned')}</th>
                    <th className="py-1 text-right font-medium">{t('dermat_orders.bpr.destroyed', 'Destroyed')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {packRows.map((row) => (
                    <tr key={`${row.requestCode}-${row.productId}`}>
                      <td className="py-1.5">{row.title}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatQty(row.issued)}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatQty(row.used)}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatQty(row.returned)}</td>
                      <td className="py-1.5 text-right">
                        {production ? (
                          <span className="inline-flex items-center gap-1">
                            <Input
                              id={`bpr-destroyed-${row.productId}`}
                              className="h-7 w-20 text-right"
                              type="number"
                              inputMode="decimal"
                              aria-label={t('dermat_orders.bpr.destroyedFor', 'Destroyed {item}', { item: row.title })}
                              value={destroyed[row.productId] ?? (row.destroyed === null ? '' : String(row.destroyed))}
                              onChange={(event) => setDestroyed({ ...destroyed, [row.productId]: event.target.value })}
                            />
                            {destroyed[row.productId] !== undefined && destroyed[row.productId] !== String(row.destroyed ?? '') ? (
                              <Button type="button" size="sm" className="h-7" disabled={busy || destroyed[row.productId].trim() === ''} onClick={() => void send({ kind: 'destroyed', productId: row.productId, quantity: Number(destroyed[row.productId]) })}>
                                {t('dermat_orders.sheet.save', 'Save')}
                              </Button>
                            ) : null}
                          </span>
                        ) : (
                          <span className="tabular-nums">{row.destroyed === null ? '—' : formatQty(row.destroyed)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null,
        )}
      </ul>
      <p className="text-xs text-muted-foreground">{t('dermat_orders.bpr.hint', 'Filling times, weights and in-process checks come from the Filling stage; packing details from Packing; the release part from QA release.')}</p>
    </section>
  )
}

export default BprPanel
