"use client"

import * as React from 'react'
import { FileUp, Lock, Save } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@open-mercato/ui/primitives/select'
import { apiCall, withScopedApiRequestHeaders } from '@open-mercato/ui/backend/utils/apiCall'
import { buildOptimisticLockHeader } from '@open-mercato/ui/backend/utils/optimisticLock'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { ExportButton } from '../../dermat_products/components/ExportButton'
import { downloadCsv } from '../../dermat_products/lib/csvExport'
import { parseCsv } from '../../dermat_products/lib/csv'
import { hasFeature, roleLabel } from '../lib/access'

type Role = { id: string; name: string }
type RoleAcl = { isSuperAdmin: boolean; features: string[] }
type Person = { id: string; email: string; name: string | null; roles: string[] }
type Level = 'none' | 'view' | 'work' | 'lead'

type Legacy = { work: string; see: string }
const PRODUCTION_LEGACY: Legacy = { work: 'dermat_orders.work.production', see: 'dermat_orders.see.production' }
const PRODUCTION_STAGES = ['manufacturing', 'filling', 'packing']

const DEPARTMENTS: Array<{ key: string; label: string; work: string; see: string | null; base: string[]; legacy?: Legacy }> = [
  { key: 'sales', label: 'Order (Sales)', work: 'dermat_orders.manage', see: 'dermat_orders.see.sales', base: ['dermat_orders.view'] },
  { key: 'accounts', label: 'Advance & billing', work: 'dermat_orders.work.accounts', see: 'dermat_orders.see.accounts', base: ['dermat_orders.view', 'dermat_orders.stages'] },
  { key: 'rnd', label: 'Sampling & formula', work: 'dermat_orders.work.rnd', see: 'dermat_orders.see.rnd', base: ['dermat_orders.view', 'dermat_orders.stages'] },
  { key: 'artwork', label: 'Artwork', work: 'dermat_orders.work.artwork', see: 'dermat_orders.see.artwork', base: ['dermat_orders.view', 'dermat_orders.stages'] },
  { key: 'planning', label: 'Planning', work: 'dermat_orders.work.planning', see: 'dermat_orders.see.planning', base: ['dermat_orders.view', 'dermat_orders.stages'] },
  { key: 'manufacturing', label: 'Manufacturing', work: 'dermat_orders.work.manufacturing', see: 'dermat_orders.see.manufacturing', base: ['dermat_orders.view', 'dermat_orders.stages'], legacy: PRODUCTION_LEGACY },
  { key: 'filling', label: 'Filling', work: 'dermat_orders.work.filling', see: 'dermat_orders.see.filling', base: ['dermat_orders.view', 'dermat_orders.stages'], legacy: PRODUCTION_LEGACY },
  { key: 'packing', label: 'Packing', work: 'dermat_orders.work.packing', see: 'dermat_orders.see.packing', base: ['dermat_orders.view', 'dermat_orders.stages'], legacy: PRODUCTION_LEGACY },
  { key: 'ipqa', label: 'In-process QA (bottle and box requests)', work: 'dermat_orders.work.ipqa', see: null, base: ['dermat_orders.view', 'dermat_orders.stages'] },
  { key: 'qa', label: 'QA release', work: 'dermat_orders.work.qa', see: 'dermat_orders.see.qa', base: ['dermat_orders.view', 'dermat_orders.stages'] },
  { key: 'dispatch', label: 'Dispatch', work: 'dermat_orders.work.dispatch', see: 'dermat_orders.see.dispatch', base: ['dermat_orders.view', 'dermat_orders.stages'] },
  { key: 'purchase', label: 'Purchase cards', work: 'dermat_orders.work.purchase', see: null, base: ['dermat_orders.view', 'dermat_orders.stages'] },
  { key: 'store', label: 'Store cards', work: 'dermat_orders.work.store', see: null, base: ['dermat_orders.view', 'dermat_orders.stages'] },
]

const FLAGS: Array<{ key: string; label: string; feature: string }> = [
  { key: 'full', label: 'Whole order', feature: 'dermat_orders.full' },
  { key: 'money', label: 'Money', feature: 'dermat_orders.money' },
  { key: 'supplier', label: 'Supplier names', feature: 'dermat_products.supplier' },
]

const LEVEL_WORD: Record<Level, string> = { none: 'None', view: 'View', work: 'Work', lead: 'Lead' }

function levelOf(features: string[], dept: (typeof DEPARTMENTS)[number]): Level {
  const works = hasFeature(features, false, dept.work) || Boolean(dept.legacy && hasFeature(features, false, dept.legacy.work))
  const sees = Boolean(dept.see && hasFeature(features, false, dept.see)) || Boolean(dept.legacy && hasFeature(features, false, dept.legacy.see))
  if (works) return sees ? 'lead' : 'work'
  if (sees) return 'view'
  return 'none'
}

function withoutLegacy(features: string[], dept: (typeof DEPARTMENTS)[number]): string[] {
  if (!dept.legacy) return features
  const legacy = dept.legacy
  const next = new Set(features)
  const siblings = DEPARTMENTS.filter((entry) => entry.legacy === legacy && PRODUCTION_STAGES.includes(entry.key))
  if (next.has(legacy.work)) {
    next.delete(legacy.work)
    for (const sibling of siblings) next.add(sibling.work)
  }
  if (next.has(legacy.see)) {
    next.delete(legacy.see)
    for (const sibling of siblings) if (sibling.see) next.add(sibling.see)
  }
  return Array.from(next)
}

function withLevel(features: string[], dept: (typeof DEPARTMENTS)[number], level: Level): string[] {
  const next = new Set(withoutLegacy(features, dept).filter((feature) => feature !== dept.work && feature !== dept.see))
  if (level === 'work' || level === 'lead') {
    next.add(dept.work)
    for (const feature of dept.base) next.add(feature)
  }
  if (level === 'lead' && dept.see) next.add(dept.see)
  if (level === 'view' && dept.see) {
    next.add(dept.see)
    next.add('dermat_orders.view')
  }
  return Array.from(next)
}

function withFlag(features: string[], feature: string, on: boolean): string[] {
  const next = new Set(features.filter((entry) => entry !== feature))
  if (on) next.add(feature)
  return Array.from(next)
}

function locked(features: string[], superAdmin: boolean): boolean {
  return superAdmin || features.includes('*') || features.includes('dermat_orders.*')
}

export function AllowancePage() {
  const t = useT()
  const { runMutation } = useGuardedMutation({ contextId: 'dermat-allowance' })
  const [people, setPeople] = React.useState<Person[] | null>(null)
  const [roleAcls, setRoleAcls] = React.useState<Record<string, RoleAcl>>({})
  const [personal, setPersonal] = React.useState<Record<string, { features: string[]; updatedAt: string | null }>>({})
  const [draft, setDraft] = React.useState<Record<string, string[]>>({})
  const [logVersion, setLogVersion] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const fileRef = React.useRef<HTMLInputElement | null>(null)

  const load = React.useCallback(async () => {
    const [roleCall, userCall] = await Promise.all([
      apiCall<{ items?: Role[]; error?: string }>('/api/auth/roles?pageSize=100'),
      apiCall<{ items?: Person[] }>('/api/auth/users?pageSize=100', undefined, { fallback: { items: [] } }),
    ])
    if (!roleCall.ok) {
      setError(t('dermat_departments.allowance.loadError', 'Could not load the team. You need the access-management permission.'))
      return
    }
    const roles = roleCall.result?.items ?? []
    const acls = await Promise.all(roles.map((role) => apiCall<RoleAcl>(`/api/auth/roles/acl?roleId=${role.id}`, undefined, { fallback: { isSuperAdmin: false, features: [] } })))
    const byName: Record<string, RoleAcl> = {}
    roles.forEach((role, index) => {
      byName[role.name] = acls[index].result ?? { isSuperAdmin: false, features: [] }
    })
    const list = (userCall.result?.items ?? []).sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email))
    const own = await Promise.all(list.map((person) => apiCall<{ hasCustomAcl?: boolean; features?: string[]; updatedAt?: string | null }>(`/api/auth/users/acl?userId=${person.id}`, undefined, { fallback: { hasCustomAcl: false } })))
    const personalMap: Record<string, { features: string[]; updatedAt: string | null }> = {}
    list.forEach((person, index) => {
      if (own[index].result?.hasCustomAcl) personalMap[person.id] = { features: own[index].result?.features ?? [], updatedAt: own[index].result?.updatedAt ?? null }
    })
    setRoleAcls(byName)
    setPersonal(personalMap)
    setPeople(list)
    setDraft({})
    setLogVersion((value) => value + 1)
  }, [t])

  React.useEffect(() => {
    void load()
  }, [load])

  const superAdmin = (person: Person) => person.roles.some((role) => roleAcls[role]?.isSuperAdmin)
  const effective = (person: Person): string[] => draft[person.id] ?? personal[person.id]?.features ?? Array.from(new Set(person.roles.flatMap((role) => roleAcls[role]?.features ?? [])))
  const change = (person: Person, next: string[]) => setDraft((prev) => ({ ...prev, [person.id]: next }))

  const save = async () => {
    const changed = Object.entries(draft)
    if (!changed.length) return
    setSaving(true)
    let failed = 0
    try {
      for (const [userId, features] of changed) {
        const body = { userId, features }
        const version = personal[userId]?.updatedAt ?? null
        const request = () => apiCall('/api/auth/users/acl', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
        const call = await runMutation({
          context: { resourceKind: 'auth.user_acl', resourceId: userId },
          mutationPayload: body,
          operation: () => (version ? withScopedApiRequestHeaders(buildOptimisticLockHeader(version), request) : request()),
        })
        if (!call.ok) {
          failed += 1
          continue
        }
        const person = people?.find((entry) => entry.id === userId)
        const before = new Set(person ? (personal[userId]?.features ?? Array.from(new Set(person.roles.flatMap((role) => roleAcls[role]?.features ?? [])))) : [])
        const after = new Set(features)
        const added = Array.from(after).filter((feature) => !before.has(feature))
        const removed = Array.from(before).filter((feature) => !after.has(feature))
        if (added.length || removed.length) {
          const entry = { userId, userName: person?.name ?? person?.email ?? null, added, removed }
          await runMutation({
            context: { resourceKind: 'dermat_departments.access_log', resourceId: userId },
            mutationPayload: entry,
            operation: () => apiCall('/api/dermat_departments/access-log', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(entry) }),
          })
        }
      }
      if (failed) flash(t('dermat_departments.allowance.partly', '{count} people could not be saved. Reload and try again.', { count: failed }), 'error')
      else flash(t('dermat_departments.allowance.saved', 'Allowance sheet saved for {count} people', { count: changed.length }), 'success')
      await load()
    } finally {
      setSaving(false)
    }
  }

  const exportSheet = () => {
    if (!people) return
    downloadCsv('allowance-sheet', [
      { header: 'Email', value: (person: Person) => person.email },
      { header: 'Name', value: (person: Person) => person.name ?? '' },
      { header: 'Roles', value: (person: Person) => person.roles.map((role) => roleLabel(role)).join(', ') },
      ...DEPARTMENTS.map((dept) => ({ header: dept.label, value: (person: Person) => LEVEL_WORD[levelOf(effective(person), dept)] })),
      ...FLAGS.map((flag) => ({ header: flag.label, value: (person: Person) => (hasFeature(effective(person), false, flag.feature) ? 'Yes' : 'No') })),
    ], people)
  }

  const importSheet = async (file: File) => {
    if (!people) return
    const table = parseCsv(await file.text())
    const column = (label: string) => table.headers.findIndex((header) => header.trim().toLowerCase() === label.toLowerCase())
    const emailAt = column('Email')
    if (emailAt < 0) {
      flash(t('dermat_departments.allowance.noEmail', 'The file needs an Email column.'), 'error')
      return
    }
    let matched = 0
    const next: Record<string, string[]> = { ...draft }
    for (const row of table.rows) {
      const person = people.find((entry) => entry.email.toLowerCase() === (row[emailAt] ?? '').trim().toLowerCase())
      if (!person || locked(effective(person), superAdmin(person))) continue
      let features = next[person.id] ?? effective(person)
      for (const dept of DEPARTMENTS) {
        const at = column(dept.label)
        if (at < 0) continue
        const word = (row[at] ?? '').trim().toLowerCase()
        const level: Level | null = word === 'lead' ? (dept.see ? 'lead' : 'work') : word === 'work' ? 'work' : word === 'view' ? (dept.see ? 'view' : 'none') : word === 'none' || word === '' ? 'none' : null
        if (level) features = withLevel(features, dept, level)
      }
      for (const flag of FLAGS) {
        const at = column(flag.label)
        if (at < 0) continue
        const word = (row[at] ?? '').trim().toLowerCase()
        if (word === 'yes' || word === 'no') features = withFlag(features, flag.feature, word === 'yes')
      }
      next[person.id] = features
      matched += 1
    }
    setDraft(next)
    flash(t('dermat_departments.allowance.imported', '{count} people read from the file. Check the sheet, then Save.', { count: matched }), 'info')
  }

  if (error) return <Page><PageBody><ErrorMessage label={error} /></PageBody></Page>
  if (!people) return <Page><PageBody><LoadingMessage label={t('dermat_departments.allowance.loading', 'Loading the team…')} /></PageBody></Page>

  const term = search.trim().toLowerCase()
  const shown = people.filter((person) => !term || `${person.name ?? ''} ${person.email} ${person.roles.join(' ')}`.toLowerCase().includes(term))
  const dirty = Object.keys(draft).length

  return (
    <Page>
      <PageBody>
        <div className="flex flex-col gap-4 pb-16">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-xl font-bold">{t('dermat_departments.allowance.title', 'Allowance sheet')}</h1>
              <p className="max-w-3xl text-sm text-muted-foreground">
                {t('dermat_departments.allowance.lede', 'For every person, what they may do on each stage of an order: None (sees only the stage name and where it is), View (reads every step), Work (fills and finishes their own steps and sees only those steps in full), Lead (works their steps and sees every step). Saving gives the person their own access; their department role stays as it is.')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ExportButton onExport={exportSheet} label={t('dermat_departments.allowance.export', 'Export to Excel')} />
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                <FileUp className="mr-2 h-4 w-4" aria-hidden="true" />
                {t('dermat_departments.allowance.import', 'Import')}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                aria-label={t('dermat_departments.allowance.importFile', 'Allowance sheet file')}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void importSheet(file)
                  event.target.value = ''
                }}
              />
              <Button type="button" disabled={!dirty || saving} onClick={() => void save()}>
                <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                {dirty ? t('dermat_departments.allowance.saveCount', 'Save {count} changes', { count: dirty }) : t('dermat_departments.allowance.save', 'Save')}
              </Button>
            </div>
          </header>
          <Input className="max-w-sm" placeholder={t('dermat_departments.allowance.search', 'Search name, email or role')} value={search} onChange={(event) => setSearch(event.target.value)} aria-label={t('dermat_departments.allowance.search', 'Search name, email or role')} />
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="sticky left-0 z-10 bg-muted px-3 py-2 text-left font-semibold">{t('dermat_departments.allowance.person', 'Person')}</th>
                  {DEPARTMENTS.map((dept) => (
                    <th key={dept.key} className="px-2 py-2 text-left font-semibold">
                      {dept.label}
                    </th>
                  ))}
                  {FLAGS.map((flag) => (
                    <th key={flag.key} className="px-2 py-2 text-left font-semibold">
                      {flag.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((person) => {
                  const features = effective(person)
                  const fixed = locked(features, superAdmin(person))
                  return (
                    <tr key={person.id} className={cn('border-t', draft[person.id] && 'bg-status-warning-bg/40')}>
                      <td className="sticky left-0 z-10 bg-card px-3 py-2">
                        <span className="block font-medium">{person.name ?? person.email}</span>
                        <span className="block text-xs text-muted-foreground">
                          {person.roles.map((role) => roleLabel(role)).join(', ') || '—'}
                          {personal[person.id] ? ` · ${t('dermat_departments.allowance.own', 'own access')}` : ''}
                        </span>
                      </td>
                      {DEPARTMENTS.map((dept) => {
                        const level = levelOf(features, dept)
                        return (
                          <td key={dept.key} className="px-2 py-1.5">
                            {fixed ? (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Lock className="h-3 w-3" aria-hidden="true" />
                                {t('dermat_departments.allowance.everything', 'All')}
                              </span>
                            ) : (
                              <Select value={level} onValueChange={(value) => change(person, withLevel(features, dept, value as Level))}>
                                <SelectTrigger className={cn('h-8 w-24 text-xs', (level === 'work' || level === 'lead') && 'font-semibold text-status-success-text', level === 'view' && 'text-status-info-text')} aria-label={`${person.name ?? person.email}: ${dept.label}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">{t('dermat_departments.allowance.none', 'None')}</SelectItem>
                                  {dept.see ? <SelectItem value="view">{t('dermat_departments.allowance.view', 'View')}</SelectItem> : null}
                                  <SelectItem value="work">{t('dermat_departments.allowance.work', 'Work')}</SelectItem>
                                  {dept.see ? <SelectItem value="lead">{t('dermat_departments.allowance.lead', 'Lead')}</SelectItem> : null}
                                </SelectContent>
                              </Select>
                            )}
                          </td>
                        )
                      })}
                      {FLAGS.map((flag) => {
                        const on = hasFeature(features, false, flag.feature)
                        return (
                          <td key={flag.key} className="px-2 py-1.5">
                            {fixed ? (
                              <span className="text-xs text-muted-foreground">{t('dermat_departments.allowance.yes', 'Yes')}</span>
                            ) : (
                              <Select value={on ? 'yes' : 'no'} onValueChange={(value) => change(person, withFlag(features, flag.feature, value === 'yes'))}>
                                <SelectTrigger className="h-8 w-20 text-xs" aria-label={`${person.name ?? person.email}: ${flag.label}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="no">{t('dermat_departments.allowance.no', 'No')}</SelectItem>
                                  <SelectItem value="yes">{t('dermat_departments.allowance.yes', 'Yes')}</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        <AccessLogPanel key={logVersion} />
      </PageBody>
    </Page>
  )
}

export default AllowancePage

type LogEntry = { id: string; userName: string | null; changedByName: string | null; added: string[]; removed: string[]; at: string }

function featureWord(feature: string): string {
  const dept = DEPARTMENTS.find((entry) => entry.work === feature || entry.see === feature)
  if (dept) return `${dept.label} ${dept.see === feature ? 'view' : 'work'}`
  const flag = FLAGS.find((entry) => entry.feature === feature)
  if (flag) return flag.label
  if (feature === PRODUCTION_LEGACY.work) return 'Production work'
  if (feature === PRODUCTION_LEGACY.see) return 'Production view'
  return feature
}

function AccessLogPanel() {
  const t = useT()
  const [items, setItems] = React.useState<LogEntry[] | null>(null)
  React.useEffect(() => {
    apiCall<{ items?: LogEntry[] }>('/api/dermat_departments/access-log', undefined, { fallback: { items: [] } }).then((call) => setItems(call.result?.items ?? []))
  }, [])
  if (!items) return null
  return (
    <section className="mt-6 space-y-2 rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold">{t('dermat_departments.allowance.log', 'Recent access changes')}</h2>
      {items.length ? (
        <ul className="divide-y text-sm">
          {items.slice(0, 30).map((item) => (
            <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
              <span>
                <span className="font-medium">{item.userName ?? '—'}</span>
                {item.added.length ? <span className="ml-2 text-status-success-text">+ {item.added.map(featureWord).join(', ')}</span> : null}
                {item.removed.length ? <span className="ml-2 text-status-error-text">− {item.removed.map(featureWord).join(', ')}</span> : null}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('dermat_departments.allowance.logBy', '{who} · {when}', { who: item.changedByName ?? '—', when: new Date(item.at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t('dermat_departments.allowance.logEmpty', 'No changes recorded yet.')}</p>
      )}
    </section>
  )
}
