"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { useGranted } from './useGranted'

export const IN_APP_NAV_KEY = 'om:inAppNavigation'

const HOME_HREF = '/backend/my-work'

function cameFromThisApp(): boolean {
  try {
    return window.history.length > 1 && window.sessionStorage.getItem(IN_APP_NAV_KEY) === '1'
  } catch {
    return false
  }
}

type BackLinkProps = {
  href: string
  label: string
  feature?: string
  className?: string
}

export function BackLink({ href, label, feature, className }: BackLinkProps) {
  const t = useT()
  const router = useRouter()
  const granted = useGranted()
  const [canGoBack, setCanGoBack] = React.useState(false)

  React.useEffect(() => setCanGoBack(cameFromThisApp()), [])

  const fallback = feature && granted.ready && !granted.has(feature) ? HOME_HREF : href

  return (
    <Link
      href={fallback}
      onClick={(event) => {
        if (!canGoBack || event.metaKey || event.ctrlKey || event.shiftKey) return
        event.preventDefault()
        router.back()
      }}
      className={cn('inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground', className)}
    >
      <ArrowLeft className="size-3" aria-hidden="true" />
      {canGoBack ? t('dermat_departments.back', 'Back') : label}
    </Link>
  )
}

export default BackLink
