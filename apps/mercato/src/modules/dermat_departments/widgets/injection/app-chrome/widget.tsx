"use client"

import * as React from 'react'
import { Rows3, Rows2 } from 'lucide-react'
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

function AppChrome() {
  const t = useT()
  const on = useSheetMode()

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
