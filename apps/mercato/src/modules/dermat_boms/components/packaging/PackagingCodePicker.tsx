"use client"

import * as React from 'react'
import { Boxes, Search } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Popover, PopoverContent, PopoverTrigger } from '@open-mercato/ui/primitives/popover'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import type { PackagingCodeView } from '../types'
import { PACKAGING_KIND_LABEL, setSummary } from './labels'

type PackagingCodePickerProps = {
  label: string
  value?: string | null
  variant?: 'button' | 'field'
  disabled?: boolean
  onSelect: (code: PackagingCodeView) => void
}

export function PackagingCodePicker({ label, value, variant = 'field', disabled, onSelect }: PackagingCodePickerProps) {
  const t = useT()
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [options, setOptions] = React.useState<PackagingCodeView[]>([])
  const [loading, setLoading] = React.useState(false)
  const [active, setActive] = React.useState(0)
  const perProduct = (item: string) => t('dermat_boms.packaging.perProduct', '{item} (made per product)', { item })

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    const handle = window.setTimeout(async () => {
      const params = new URLSearchParams({ pageSize: '30' })
      if (search.trim()) params.set('search', search.trim())
      const call = await apiCall<{ items?: PackagingCodeView[] }>(`/api/dermat_boms/packaging-codes?${params.toString()}`, undefined, { fallback: { items: [] } })
      if (cancelled) return
      setOptions(call.result?.items ?? [])
      setActive(0)
      setLoading(false)
    }, 200)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [open, search])

  const choose = (option: PackagingCodeView | undefined) => {
    if (!option) return
    onSelect(option)
    setOpen(false)
    setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === 'button' ? (
          <Button type="button" variant="outline" size="sm" disabled={disabled}>
            <Boxes className="mr-1.5 size-4" aria-hidden="true" />
            {label}
          </Button>
        ) : (
          <Button type="button" variant="outline" disabled={disabled} className="h-8 w-full justify-start gap-2 px-2 font-normal">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className={cn('truncate', !value && 'text-muted-foreground')}>{value || label}</span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 p-0">
        <div className="border-b p-2">
          <Input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('dermat_boms.packaging.search', 'Search code or name (e.g. CT 11, 50 g jar)')}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActive((current) => Math.min(current + 1, options.length - 1))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActive((current) => Math.max(current - 1, 0))
              } else if (event.key === 'Enter') {
                event.preventDefault()
                choose(options[active])
              }
            }}
          />
        </div>
        <ul className="max-h-80 overflow-auto py-1 text-sm">
          {loading && !options.length ? <li className="px-3 py-2 text-muted-foreground">{t('dermat_boms.picker.loading', 'Searching…')}</li> : null}
          {!loading && !options.length ? (
            <li className="px-3 py-2 text-muted-foreground">{t('dermat_boms.packaging.none', 'No packaging code found. Add it in Masters → Packaging codes.')}</li>
          ) : null}
          {options.map((option, index) => {
            const kind = PACKAGING_KIND_LABEL[option.kind]
            return (
              <li key={option.id}>
                <Button
                  type="button"
                  variant="ghost"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(option)}
                  className={cn('h-auto w-full flex-col items-start gap-0.5 rounded-none px-3 py-2 text-left font-normal', index === active && 'bg-muted')}
                >
                  <span className="flex w-full items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-primary">{option.code}</span>
                    <span className="truncate font-medium">{option.name}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{t(kind.key, kind.fallback)}</span>
                  </span>
                  <span className="w-full truncate text-xs text-muted-foreground">{setSummary(option, perProduct) || '—'}</span>
                </Button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

export default PackagingCodePicker
