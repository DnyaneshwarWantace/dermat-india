'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, ClipboardList, ListTodo, Menu, Package, WifiOff } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'

export const PHONE_CSS = [
  '@media (max-width:767px){main.flex-1{padding-bottom:calc(4.5rem + env(safe-area-inset-bottom,0px))!important}}',
  '@media (max-width:767px){main input,main select,main textarea{font-size:16px}}',
].join('\n')

function clickHeaderButton(match: (label: string) => boolean) {
  const buttons = Array.from(document.querySelectorAll('header button[aria-label]')) as HTMLButtonElement[]
  buttons.find((button) => match(button.getAttribute('aria-label') ?? ''))?.click()
}

function useOnline(): boolean {
  const [online, setOnline] = React.useState(true)
  React.useEffect(() => {
    setOnline(navigator.onLine)
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}

export function PhoneBar({ taskCount }: { taskCount: number | null }) {
  const t = useT()
  const pathname = usePathname() ?? ''
  const online = useOnline()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  if (!mounted) return null

  const item = 'flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 font-medium text-muted-foreground'
  const label = 'text-xs'
  const active = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`)

  return createPortal(
    <>
      {online ? null : (
        <div role="status" className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-status-warning-bg px-3 py-1.5 text-xs font-medium text-status-warning-text" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)' }}>
          <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
          {t('dermat_departments.phone.offline', 'No signal. What you typed stays on screen; press Done again when the signal is back.')}
        </div>
      )}
      <nav aria-label={t('dermat_departments.phone.bar', 'Quick links')} className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background/95 backdrop-blur md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <Link href="/backend/my-work" className={cn(item, active('/backend/my-work') && 'text-primary')} aria-current={active('/backend/my-work') ? 'page' : undefined}>
          <span className="relative">
            <ListTodo className="h-5 w-5" aria-hidden="true" />
            {taskCount ? <span className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-primary px-1 text-center text-xs leading-4 text-primary-foreground tabular-nums">{taskCount}</span> : null}
          </span>
          <span className={label}>{t('dermat_departments.phone.tasks', 'My tasks')}</span>
        </Link>
        <Link href="/backend/orders" className={cn(item, active('/backend/orders') && 'text-primary')} aria-current={active('/backend/orders') ? 'page' : undefined}>
          <ClipboardList className="h-5 w-5" aria-hidden="true" />
          <span className={label}>{t('dermat_departments.phone.orders', 'Orders')}</span>
        </Link>
        <Link href="/backend/store/stock" className={cn(item, active('/backend/store') && 'text-primary')} aria-current={active('/backend/store') ? 'page' : undefined}>
          <Package className="h-5 w-5" aria-hidden="true" />
          <span className={label}>{t('dermat_departments.phone.stock', 'Stock')}</span>
        </Link>
        <button type="button" className={item} onClick={() => clickHeaderButton((value) => /notification/i.test(value))}>
          <Bell className="h-5 w-5" aria-hidden="true" />
          <span className={label}>{t('dermat_departments.phone.alerts', 'Alerts')}</span>
        </button>
        <button type="button" className={item} onClick={() => clickHeaderButton((value) => /menu/i.test(value))}>
          <Menu className="h-5 w-5" aria-hidden="true" />
          <span className={label}>{t('dermat_departments.phone.menu', 'Menu')}</span>
        </button>
      </nav>
    </>,
    document.body,
  )
}

export default PhoneBar
