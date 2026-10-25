'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, ClipboardList, ListTodo, Menu, Package, WifiOff } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { Button } from '@open-mercato/ui/primitives/button'

const LABEL_BUTTON = 'main button:not([role=combobox]):not([role=tab]):not([role=checkbox]):not([role=radio]):not([role=switch]):not([class*="size-"])'

export const PHONE_CSS = [
  '@media (max-width:767px){main.flex-1{padding-bottom:calc(4.5rem + env(safe-area-inset-bottom,0px))!important}}',
  '@media (max-width:767px){main input,main select,main textarea{font-size:16px}}',
  'main{overflow-wrap:break-word}',
  `${LABEL_BUTTON}{max-width:100%;white-space:normal;height:auto;text-align:center;line-height:1.25;padding-top:.25rem;padding-bottom:.25rem}`,
  ...[['6', '1.5rem'], ['7', '1.75rem'], ['8', '2rem'], ['9', '2.25rem'], ['10', '2.5rem'], ['11', '2.75rem'], ['12', '3rem']].map(([size, rem]) => `${LABEL_BUTTON}.h-${size}{min-height:${rem}}`),
  `${LABEL_BUTTON}:not([class*="h-"]){min-height:2.25rem}`,
  ...[['7', '1.75rem'], ['8', '2rem'], ['9', '2.25rem'], ['10', '2.5rem']].map(([size, rem]) => `@media (min-width:768px){${LABEL_BUTTON}[class*="md:h-${size} "],${LABEL_BUTTON}[class$="md:h-${size}"]{min-height:${rem}}}`),
  'main a.inline-flex,main a.flex{max-width:100%;min-width:0}',
  'main .truncate{min-width:0}',
  'main [data-slot="segmented-control"]{max-width:100%;overflow-x:auto;scrollbar-width:none}',
  'main [data-slot="segmented-control-item"]{flex-shrink:0}',
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
          {t('dermat_departments.phone.offline', 'No signal. Step Done, Save and filling checks are kept on this phone and sent when the signal is back.')}
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
        <Button type="button" variant="ghost" className={cn(item, 'h-auto rounded-none')} onClick={() => clickHeaderButton((value) => /notification/i.test(value))}>
          <Bell className="h-5 w-5" aria-hidden="true" />
          <span className={label}>{t('dermat_departments.phone.alerts', 'Alerts')}</span>
        </Button>
        <Button type="button" variant="ghost" className={cn(item, 'h-auto rounded-none')} onClick={() => clickHeaderButton((value) => /menu/i.test(value))}>
          <Menu className="h-5 w-5" aria-hidden="true" />
          <span className={label}>{t('dermat_departments.phone.menu', 'Menu')}</span>
        </Button>
      </nav>
    </>,
    document.body,
  )
}

export default PhoneBar
