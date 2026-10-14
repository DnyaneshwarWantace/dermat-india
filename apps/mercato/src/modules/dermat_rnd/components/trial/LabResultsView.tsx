"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { KeyValueList } from '../shared/KeyValueList'
import { dateTimeText } from '../labels'
import type { Observations } from '../types'

export function LabResultsView({ observations }: { observations: Observations | null }) {
  const t = useT()
  if (!observations) return <p className="text-sm text-muted-foreground">{t('dermat_rnd.trial.noResults', 'No lab results yet. Send the trial for testing, then record what QC found.')}</p>
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge variant={observations.result === 'pass' ? 'success' : 'error'}>{observations.result === 'pass' ? t('dermat_rnd.pass', 'Pass') : t('dermat_rnd.fail', 'Fail')}</StatusBadge>
        <span className="text-xs text-muted-foreground">{[observations.by, observations.at ? dateTimeText(observations.at) : null].filter(Boolean).join(' · ')}</span>
      </div>
      <KeyValueList className="sm:grid-cols-3" rows={[...Object.entries(observations.values).map(([label, value]) => ({ label, value })), ...(observations.remarks ? [{ label: t('dermat_rnd.remarks', 'Remarks'), value: observations.remarks, wide: true }] : [])]} />
    </div>
  )
}
