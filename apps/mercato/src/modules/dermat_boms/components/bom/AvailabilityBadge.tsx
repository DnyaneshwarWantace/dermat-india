"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'

export function AvailabilityBadge({ need, onHand }: { need: number; onHand: number }) {
  const t = useT()
  if (!(need > 0)) return <span className="text-xs text-muted-foreground">—</span>
  return onHand >= need ? (
    <StatusBadge variant="success">{t('dermat_boms.availability.available', 'Available')}</StatusBadge>
  ) : (
    <StatusBadge variant="error">{t('dermat_boms.availability.short', 'Not available')}</StatusBadge>
  )
}

export default AvailabilityBadge
