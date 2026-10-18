"use client"

import * as React from 'react'
import { X } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { IconButton } from '@open-mercato/ui/primitives/icon-button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { PackagingCodePicker } from '../../../dermat_boms/components/packaging/PackagingCodePicker'
import { setSummary } from '../../../dermat_boms/components/packaging/labels'
import type { PackagingCodeView } from '../../../dermat_boms/components/types'

type PackingCodeFieldProps = {
  value: string
  onPick: (code: PackagingCodeView) => void
  onClear: () => void
}

export function PackingCodeField({ value, onPick, onClear }: PackingCodeFieldProps) {
  const t = useT()
  const [detail, setDetail] = React.useState<PackagingCodeView | null>(null)

  React.useEffect(() => {
    if (!value.trim()) {
      setDetail(null)
      return
    }
    let cancelled = false
    apiCall<{ items?: PackagingCodeView[] }>(`/api/dermat_boms/packaging-codes?code=${encodeURIComponent(value)}&pageSize=1`, undefined, { fallback: { items: [] } }).then((call) => {
      if (!cancelled) setDetail(call.result?.items?.[0] ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [value])

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <PackagingCodePicker label={t('dermat_orders.form.pickPackingCode', 'Pick packing code')} value={value} onSelect={onPick} />
        </div>
        {value ? (
          <IconButton type="button" variant="ghost" size="sm" aria-label={t('dermat_orders.form.clearPackingCode', 'Clear packing code')} onClick={onClear}>
            <X className="size-4" aria-hidden="true" />
          </IconButton>
        ) : null}
      </div>
      {value && detail ? (
        <p className="text-xs text-muted-foreground">
          {t('dermat_orders.form.packingSet', 'Set: {set}', { set: setSummary(detail, (item) => t('dermat_boms.packaging.perProduct', '{item} (made per product)', { item })) || detail.name })}
        </p>
      ) : null}
      {value && !detail ? (
        <p className="text-xs text-status-warning-text">{t('dermat_orders.form.packingCodeMissing', 'This code is not in Masters → Packaging codes yet. Artwork waits until it is added.')}</p>
      ) : null}
    </div>
  )
}

export default PackingCodeField
