'use client'

import * as React from 'react'

const STORAGE_KEY = 'dermat.sheetView'
const EVENT = 'dermat-sheet-view'

export function readSheetMode(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function applySheetMode(on: boolean): void {
  document.documentElement.dataset.dermatSheet = on ? 'on' : 'off'
}

export function setSheetMode(on: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    // storage blocked: the choice lasts for this page only
  }
  applySheetMode(on)
  window.dispatchEvent(new CustomEvent(EVENT, { detail: on }))
}

export function useSheetMode(): boolean {
  const [on, setOn] = React.useState(true)
  React.useEffect(() => {
    setOn(readSheetMode())
    const listener = (event: Event) => setOn(Boolean((event as CustomEvent<boolean>).detail))
    window.addEventListener(EVENT, listener)
    return () => window.removeEventListener(EVENT, listener)
  }, [])
  return on
}

const ON = 'html[data-dermat-sheet="on"]'

export const SHEET_CSS = [
  `${ON} main.flex-1{max-width:none!important;padding:8px 12px!important}`,
  `${ON} main table th,${ON} main table td{padding-top:3px!important;padding-bottom:3px!important;line-height:1.3!important}`,
  `${ON} main table td{font-size:12px}`,
  `${ON} main table th{font-size:11px}`,
  `${ON} main table tr{height:auto!important}`,
  `${ON} main [data-sheet-hide]{display:none!important}`,
  `${ON} main [data-sheet-compact]{display:flex!important;flex-wrap:wrap;gap:6px!important}`,
  `${ON} main [data-sheet-compact]>*{flex:1 1 150px;padding:4px 10px!important;gap:8px!important;box-shadow:none!important;align-items:baseline!important}`,
  `${ON} main [data-sheet-compact] .rounded-full,${ON} main [data-sheet-compact] svg{display:none!important}`,
  `${ON} main [data-sheet-compact] .text-xl,${ON} main [data-sheet-compact] .text-2xl{font-size:.95rem!important;line-height:1.3!important}`,
  `${ON} main [data-sheet-compact] .mt-1{margin-top:0!important}`,
  `${ON} main header.border-b{padding-bottom:6px!important;gap:6px!important}`,
  `${ON} main header p.text-muted-foreground[class*="max-w-"],${ON} main h1~p.text-muted-foreground[class*="max-w-"]{display:none!important}`,
  `${ON} main table :is(.h-8,.h-9){height:1.5rem!important}`,
  `${ON} main table :is(.h-7){height:1.375rem!important}`,
  `${ON} main table td :is(div,span):has(>:is(div,span,p).text-xs.text-muted-foreground){display:flex!important;flex-direction:row!important;align-items:baseline;gap:6px;min-width:0}`,
  `${ON} main table td :is(div,span):has(>:is(div,span,p).text-xs.text-muted-foreground)>:first-child{flex:0 0 auto;max-width:70%}`,
  `${ON} main table td :is(div,span,p).text-xs.text-muted-foreground{display:inline-block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:22rem;min-width:0;flex:0 1 auto;margin-top:0!important;vertical-align:baseline}`,
  `${ON} main table td>.block:has(+.text-muted-foreground){display:inline;margin-right:.5rem}`,
  `${ON} main table td>.block+.text-muted-foreground{display:inline}`,
  `${ON} main header.border-b h1{font-size:1.125rem!important;line-height:1.5rem!important}`,
  `${ON} main .space-y-6>:not(:first-child){margin-top:.75rem!important}`,
  `${ON} main .space-y-4>:not(:first-child){margin-top:.5rem!important}`,
  `${ON} main .gap-5{gap:.75rem!important}`,
  `${ON} main ul.divide-y>li>:is(a,div,button):first-child,${ON} main ul.divide-y>li[class*="py-"]{padding-top:4px!important;padding-bottom:4px!important;gap:8px!important}`,
  `${ON} main ul.divide-y>li :is(.h-9.w-9,.h-10.w-10){display:none!important}`,
  `${ON} main ul.divide-y>li div:has(>p+p){display:flex!important;align-items:baseline;gap:6px;min-width:0}`,
  `${ON} main ul.divide-y>li div:has(>p+p)>p{margin-top:0!important}`,
  `${ON} main ul.divide-y>li :is(.mt-1,.mt-1\\.5,.mt-0\\.5){margin-top:0!important}`,
].join('\n')
