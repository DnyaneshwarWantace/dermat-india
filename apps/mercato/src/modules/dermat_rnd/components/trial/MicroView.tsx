"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { KeyValueList } from '../shared/KeyValueList'
import { dateTimeText, dayText } from '../labels'
import type { Micro } from '../types'

export function MicroView({ micro }: { micro: Micro | null }) {
  const t = useT()
  if (!micro) return <p className="text-sm text-muted-foreground">{t('dermat_rnd.micro.none', 'No micro result yet.')}</p>
  const stamp = [micro.by, micro.at ? dateTimeText(micro.at) : null].filter(Boolean).join(' · ')
  if (!micro.required) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge variant="neutral">{t('dermat_rnd.micro.notRequiredShort', 'Micro not required')}</StatusBadge>
        <span className="text-xs text-muted-foreground">{stamp}</span>
        {micro.remarks ? <p className="w-full text-sm">{micro.remarks}</p> : null}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {micro.result ? <StatusBadge variant={micro.result === 'pass' ? 'success' : 'error'}>{micro.result === 'pass' ? t('dermat_rnd.pass', 'Pass') : t('dermat_rnd.fail', 'Fail')}</StatusBadge> : null}
        <span className="text-xs text-muted-foreground">{stamp}</span>
      </div>
      <KeyValueList
        className="sm:grid-cols-3"
        rows={[
          { label: t('dermat_rnd.micro.testingDate', 'Testing date'), value: micro.testingDate ? dayText(micro.testingDate) : null },
          { label: t('dermat_rnd.micro.releasedDate', 'Released date'), value: micro.releasedDate ? dayText(micro.releasedDate) : null },
          ...Object.entries(micro.values).map(([label, value]) => ({ label, value })),
          ...(micro.remarks ? [{ label: t('dermat_rnd.remarks', 'Remarks'), value: micro.remarks, wide: true }] : []),
        ]}
      />
    </div>
  )
}
