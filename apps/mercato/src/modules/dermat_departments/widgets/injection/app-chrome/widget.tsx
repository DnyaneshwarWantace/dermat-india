"use client"

import * as React from 'react'
import Link from 'next/link'
import { ListTodo, Rows3, Rows2 } from 'lucide-react'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { InjectionWidgetModule } from '@open-mercato/shared/modules/widgets/injection'
import { SHEET_CSS, applySheetMode, readSheetMode, setSheetMode, useSheetMode } from '../../../components/sheetMode'

const ICON = '/api/dermat_departments/app/icon'

function ensureHead(selector: string, create: () => HTMLElement) {
  if (!document.head.querySelector(selector)) document.head.appendChild(create())
}

function element(tag: string, attrs: Record<string, string>): HTMLElement {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
  return node
}

type TaskRow = { overdue: boolean }

function useTaskCount(): { count: number; overdue: number } | null {
  const [state, setState] = React.useState<{ count: number; overdue: number } | null>(null)
  React.useEffect(() => {
    let alive = true
    const load = async () => {
      const call = await apiCall<{ items?: TaskRow[] }>('/api/dermat_orders/tasks?scope=department', { headers: { 'x-om-forbidden-redirect': '0' } }, { fallback: { items: [] } })
      if (!alive) return
      if (!call.ok) return setState(null)
      const items = call.result?.items ?? []
      setState({ count: items.length, overdue: items.filter((item) => item.overdue).length })
    }
    void load()
    const timer = window.setInterval(() => void load(), 120_000)
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => {
      alive = false
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [])
  return state
}

function AppChrome() {
  const t = useT()
  const on = useSheetMode()
  const tasks = useTaskCount()

  React.useEffect(() => {
    applySheetMode(readSheetMode())
    ensureHead('style#dermat-sheet-css', () => {
      const style = element('style', { id: 'dermat-sheet-css' })
      style.textContent = SHEET_CSS
      return style
    })
    ensureHead('link[rel="manifest"]', () => element('link', { rel: 'manifest', href: '/api/dermat_departments/app/manifest' }))
    ensureHead('link[rel="apple-touch-icon"]', () => element('link', { rel: 'apple-touch-icon', href: `${ICON}?size=180` }))
    ensureHead('meta[name="theme-color"]', () => element('meta', { name: 'theme-color', content: '#0e6b66' }))
    ensureHead('meta[name="apple-mobile-web-app-capable"]', () => element('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }))
    ensureHead('meta[name="mobile-web-app-capable"]', () => element('meta', { name: 'mobile-web-app-capable', content: 'yes' }))
    ensureHead('meta[name="apple-mobile-web-app-title"]', () => element('meta', { name: 'apple-mobile-web-app-title', content: 'Dermat ERP' }))
  }, [])

  const label = on ? t('dermat_departments.sheet.on', 'Sheet view on: tap for normal view') : t('dermat_departments.sheet.off', 'Normal view: tap for sheet view')
  const Icon = on ? Rows3 : Rows2
  return (
    <span className="flex items-center gap-1.5">
      {tasks ? (
        <Link
          href="/backend/my-work"
          title={t('dermat_departments.tasks.title', '{count} open tasks for you and your department', { count: tasks.count })}
          aria-label={t('dermat_departments.tasks.title', '{count} open tasks for you and your department', { count: tasks.count })}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ListTodo className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t('dermat_departments.tasks.label', 'Tasks')}</span>
          <span className={tasks.overdue ? 'rounded-full bg-status-error-bg px-1.5 tabular-nums text-status-error-text' : 'rounded-full bg-muted px-1.5 tabular-nums text-foreground'}>{tasks.count}</span>
        </Link>
      ) : null}
    <button
      type="button"
      onClick={() => setSheetMode(!on)}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-pressed:border-primary/40 aria-pressed:bg-primary/10 aria-pressed:text-primary"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">{t('dermat_departments.sheet.label', 'Sheet view')}</span>
    </button>
    </span>
  )
}

const widget: InjectionWidgetModule = {
  metadata: {
    id: 'dermat_departments.injection.app-chrome',
    title: 'Sheet view and phone app',
    description: 'Sheet view switch (tight Excel-like lists) and the home-screen app tags.',
  },
  Widget: AppChrome,
}

export default widget
