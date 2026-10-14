"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { Button } from '@open-mercato/ui/primitives/button'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { TRIAL_STATUS, dayText } from '../labels'
import type { Trial } from '../types'

type TrialListProps = { trials: Trial[]; selectedId: string | null; approvedId: string | null; onSelect: (id: string) => void }

export function TrialList({ trials, selectedId, approvedId, onSelect }: TrialListProps) {
  const t = useT()
  return (
    <ul className="flex flex-col gap-1">
      {trials.map((trial) => {
        const status = TRIAL_STATUS[trial.status]
        return (
          <li key={trial.id}>
            <Button
              type="button"
              variant="ghost"
              aria-current={trial.id === selectedId ? 'true' : undefined}
              className={cn('h-auto w-full flex-col items-start gap-1 border px-3 py-2 text-left', trial.id === selectedId ? 'border-primary bg-muted' : 'border-transparent')}
              onClick={() => onSelect(trial.id)}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold">{trial.code}</span>
                <StatusBadge variant={status.variant}>{t(status.key, status.fallback)}</StatusBadge>
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {[dayText(trial.batchDate), trial.chemistName, trial.id === approvedId ? t('dermat_rnd.trial.approvedMark', 'approved formula') : null].filter(Boolean).join(' · ')}
              </span>
            </Button>
          </li>
        )
      })}
    </ul>
  )
}
