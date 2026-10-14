"use client"

import * as React from 'react'
import Link from 'next/link'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { Input } from '@open-mercato/ui/primitives/input'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { Section } from './shared/Section'
import { TRIAL_STATUS, dayText, todayIst } from './labels'
import type { TrialStatus } from './types'

type Report = {
  month: string
  totals: { trials: number; passed: number; failed: number; pending: number; passRate: number | null; requestsRaised: number; samplesSent: number; approvedFormulas: number }
  byChemist: Array<{ chemist: string; trials: number; passed: number; failed: number; approved: number; pending: number }>
  trend: Array<{ month: string; trials: number }>
  trials: Array<{ id: string; requestId: string; code: string; batchDate: string | null; chemistName: string | null; status: TrialStatus }>
}

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border bg-card px-4 py-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xl font-semibold tabular-nums">{value}</span>
    </div>
  )
}

function Trend({ trend }: { trend: Report['trend'] }) {
  const max = Math.max(1, ...trend.map((entry) => entry.trials))
  return (
    <div className="flex h-40 items-end gap-2">
      {trend.map((entry) => (
        <div key={entry.month} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-xs tabular-nums text-muted-foreground">{entry.trials}</span>
          <div className="w-full rounded-t bg-primary/70" style={{ height: `${Math.max(4, (entry.trials / max) * 120)}px` }} />
          <span className="text-xs text-muted-foreground">{monthLabel(entry.month)}</span>
        </div>
      ))}
    </div>
  )
}

export function RdReportPage() {
  const t = useT()
  const [month, setMonth] = React.useState(todayIst().slice(0, 7))
  const [report, setReport] = React.useState<Report | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setReport(null)
    void apiCall<Report & { error?: string }>(`/api/dermat_rnd/report?month=${month}`).then((call) => {
      if (cancelled) return
      if (!call.ok || !call.result) setError(call.result?.error ?? t('dermat_rnd.report.error', 'Could not load the report.'))
      else {
        setError(null)
        setReport(call.result)
      }
    })
    return () => {
      cancelled = true
    }
  }, [month, t])

  return (
    <Page>
      <PageBody>
        <div className="mx-auto flex max-w-6xl flex-col gap-4 pb-16">
          <header className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('dermat_rnd.report.title', 'R&D monthly report')}</h1>
              <p className="text-sm text-muted-foreground">{t('dermat_rnd.report.lede', 'Trial batches made, lab results, approved formulas and samples sent.')}</p>
            </div>
            <Input type="month" aria-label={t('dermat_rnd.report.month', 'Month')} className="w-44" value={month} onChange={(event) => event.target.value && setMonth(event.target.value)} />
          </header>
          {error ? <ErrorMessage label={error} /> : null}
          {!report && !error ? <LoadingMessage label={t('dermat_rnd.loading', 'Loading…')} /> : null}
          {report ? (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Kpi label={t('dermat_rnd.report.trials', 'Trial batches')} value={report.totals.trials} />
                <Kpi label={t('dermat_rnd.report.passRate', 'Lab pass rate')} value={report.totals.passRate == null ? '—' : `${report.totals.passRate}%`} />
                <Kpi label={t('dermat_rnd.report.raised', 'Requests raised')} value={report.totals.requestsRaised} />
                <Kpi label={t('dermat_rnd.report.samples', 'Samples sent')} value={report.totals.samplesSent} />
                <Kpi label={t('dermat_rnd.report.passed', 'Passed')} value={report.totals.passed} />
                <Kpi label={t('dermat_rnd.report.failed', 'Failed or rejected')} value={report.totals.failed} />
                <Kpi label={t('dermat_rnd.report.pending', 'Still in the lab')} value={report.totals.pending} />
                <Kpi label={t('dermat_rnd.report.approved', 'Formulas approved')} value={report.totals.approvedFormulas} />
              </div>
              <Section title={t('dermat_rnd.report.trend', 'Trial batches, last 12 months')}>
                <Trend trend={report.trend} />
              </Section>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Section title={t('dermat_rnd.report.byChemist', 'By chemist')} bodyClassName="p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">{t('dermat_rnd.trial.chemist', 'Chemist')}</th>
                        <th className="px-3 py-2 text-right font-semibold">{t('dermat_rnd.report.trials', 'Trial batches')}</th>
                        <th className="px-3 py-2 text-right font-semibold">{t('dermat_rnd.report.passed', 'Passed')}</th>
                        <th className="px-3 py-2 text-right font-semibold">{t('dermat_rnd.report.failedShort', 'Failed')}</th>
                        <th className="px-3 py-2 text-right font-semibold">{t('dermat_rnd.report.approvedShort', 'Approved')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byChemist.map((row) => (
                        <tr key={row.chemist} className="border-t tabular-nums">
                          <td className="px-3 py-2">{row.chemist}</td>
                          <td className="px-3 py-2 text-right">{row.trials}</td>
                          <td className="px-3 py-2 text-right">{row.passed}</td>
                          <td className="px-3 py-2 text-right">{row.failed}</td>
                          <td className="px-3 py-2 text-right">{row.approved}</td>
                        </tr>
                      ))}
                      {!report.byChemist.length ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">{t('dermat_rnd.report.none', 'No trial batches this month.')}</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </Section>
                <Section title={t('dermat_rnd.report.list', 'Trial batches this month')} bodyClassName="p-0">
                  <ul className="divide-y text-sm">
                    {report.trials.map((trial) => {
                      const status = TRIAL_STATUS[trial.status]
                      return (
                        <li key={trial.id} className="flex items-center justify-between gap-2 px-3 py-2">
                          <Link href={`/backend/rnd/requests/${trial.requestId}`} className="font-mono text-primary hover:underline">
                            {trial.code}
                          </Link>
                          <span className="flex-1 truncate text-xs text-muted-foreground">{[dayText(trial.batchDate), trial.chemistName].filter(Boolean).join(' · ')}</span>
                          <StatusBadge variant={status.variant}>{t(status.key, status.fallback)}</StatusBadge>
                        </li>
                      )
                    })}
                    {!report.trials.length ? <li className="px-3 py-6 text-center text-muted-foreground">{t('dermat_rnd.report.none', 'No trial batches this month.')}</li> : null}
                  </ul>
                </Section>
              </div>
            </>
          ) : null}
        </div>
      </PageBody>
    </Page>
  )
}

export default RdReportPage
