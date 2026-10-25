'use client'

import type { StageActionRequest } from './StageSheet'

export type OutboxEntry = { id: string; at: string; orderId: string; orderNo: string; stageKey: string; label: string; request: StageActionRequest }

const KEY = 'dermat.outbox'
export const OUTBOX_EVENT = 'dermat-outbox'
export const QUEUEABLE: ReadonlyArray<StageActionRequest['action']> = ['step', 'save', 'filling_check', 'checklist']

export function readOutbox(): OutboxEntry[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? (parsed as OutboxEntry[]) : []
  } catch {
    return []
  }
}

function write(entries: OutboxEntry[]): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries))
    window.dispatchEvent(new CustomEvent(OUTBOX_EVENT, { detail: entries.length }))
    return true
  } catch {
    return false
  }
}

export function addToOutbox(entry: Omit<OutboxEntry, 'id' | 'at'>): boolean {
  return write([...readOutbox(), { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: new Date().toISOString() }])
}

export function removeFromOutbox(id: string): void {
  write(readOutbox().filter((entry) => entry.id !== id))
}

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}
