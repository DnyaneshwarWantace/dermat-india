"use client"

import * as React from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Clock, EyeOff, History, ListChecks, Lock, MinusCircle, Package } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { OWNER_NAMES, stageDef, stepOwners } from '../../lib/stages'
import { StageWorkArea, type StageActionRequest } from '../StageSheet'
import { useStageAction } from '../useStageAction'
import { useStageSettings } from '../useStageSettings'
import { subStages, type SubStage } from '../subStages'
import { formatDateTime, formatQty } from '../format'
import type { Order, Stage } from '../types'
import { StageHistoryPanel } from './StageHistoryPanel'
import { StagePanel } from './StagePanel'

function since(items: SubStage[], index: number, stage: Stage): string | null {
  for (let position = index - 1; position >= 0; position -= 1) if (items[position].at) return items[position].at
  return stage.openedAt
}

export function StepPage({ orderId, stageKey, stepKey }: { orderId: string; stageKey: string; stepKey: string }) {
  const t = useT()
  useStageSettings()
  const [order, setOrder] = React.useState<Order | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [people, setPeople] = React.useState<Array<{ id: string; name: string }>>([])
  const runner = useStageAction(`dermat-step-page-${orderId}-${stageKey}-${stepKey}`)

  const load = React.useCallback(async () => {
    const call = await apiCall<Order>(`/api/dermat_orders/orders?id=${encodeURIComponent(orderId)}`)
    if (!call.ok || !call.result) return setError(t('dermat_orders.errors.load', 'Could not load the order.'))
    setOrder(call.result)
  }, [orderId, t])

  React.useEffect(() => {
    void load()
    apiCall<{ items?: Array<{ id: string; name: string }> }>('/api/dermat_orders/people', undefined, { fallback: { items: [] } }).then((call) => setPeople(call.result?.items ?? []))
  }, [load])

  const onAction = async (target: Stage, request: StageActionRequest): Promise<boolean> => {
    if (!order) return false
    const result = await runner.run(order, target, request)
    if (result.order) {
      setOrder(result.order)
      return true
    }
    if (result.conflict) await load()
    return false
  }

  const def = stageDef(stageKey)
  const step = def?.steps.find((entry) => entry.key === stepKey)
  if (!def || !step) return <Page><PageBody><ErrorMessage label={t('dermat_orders.stepPage.unknown', 'Unknown step.')} /></PageBody></Page>
  if (error) return <Page><PageBody><ErrorMessage label={error} /></PageBody></Page>
  const stage = order?.stages.find((entry) => entry.key === stageKey) ?? null
  if (!order || !stage) return <Page><PageBody><LoadingMessage label={t('dermat_orders.loading', 'Loading order…')} /></PageBody></Page>

  const items = subStages(order, stage)
  const index = items.findIndex((item) => item.key === stepKey)
  const item = items[index]
  const level = stage.locked ? 'none' : (stage.cardAccess?.[stepKey] ?? 'read')
  const owners = stepOwners(def.key, step).map((feature) => OWNER_NAMES[feature] ?? feature).join(' / ')
  const person = (stage.data?.__people as Record<string, { name: string | null }> | undefined)?.[stepKey]?.name ?? stage.responsibleName ?? null
  const history = order.events.filter((event) => event.stageKey === stageKey && event.stepKey === stepKey)
  const status = item?.status ?? 'pending'
  const waitingFrom = status === 'current' ? since(items, index, stage) : null

  return (
    <Page>
      <PageBody>
        <div className="mx-auto flex max-w-6xl flex-col gap-4 pb-16">
          <header className="flex flex-col gap-2 border-b pb-3">
            <Link href={`/backend/orders/${order.id}/stages/${stageKey}`} className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              {t('dermat_orders.stepPage.back', '{order} · {stage}', { order: order.orderNo, stage: stage.label })}
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">{step.label}</h1>
              {status === 'done' ? (
                <StatusBadge variant="success">{t('dermat_orders.stepPage.done', 'Done')}</StatusBadge>
              ) : status === 'current' ? (
                <StatusBadge variant="warning">{stage.status === 'on_hold' ? t('dermat_orders.stepPage.onHold', 'On hold') : t('dermat_orders.stepPage.now', 'Now')}</StatusBadge>
              ) : status === 'na' || item?.optional ? (
                <StatusBadge variant="neutral">{t('dermat_orders.stepPage.na', 'Not needed')}</StatusBadge>
              ) : (
                <StatusBadge variant="neutral">{t('dermat_orders.stepPage.later', 'Waiting for earlier steps')}</StatusBadge>
              )}
            </div>
            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <div className="flex gap-1.5"><dt className="text-muted-foreground">{t('dermat_orders.stepPage.who', 'Done by')}</dt><dd className="font-medium">{owners}</dd></div>
              {person ? <div className="flex gap-1.5"><dt className="text-muted-foreground">{t('dermat_orders.stepPage.person', 'Person')}</dt><dd className="font-medium">{person}</dd></div> : null}
              {item?.at && status === 'done' ? <div className="flex gap-1.5"><dt className="text-muted-foreground">{t('dermat_orders.stepPage.finished', 'Finished')}</dt><dd className="font-medium">{[item.by, formatDateTime(item.at)].filter(Boolean).join(' · ')}</dd></div> : null}
              {waitingFrom ? <div className="flex gap-1.5"><dt className="text-muted-foreground">{t('dermat_orders.stepPage.waiting', 'Waiting since')}</dt><dd className="font-medium">{formatDateTime(waitingFrom)}</dd></div> : null}
            </dl>
          </header>

          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
            <div className="flex flex-col gap-4 lg:col-span-8">
              <StagePanel title={t('dermat_orders.stepPage.work', 'This step')} icon={<ListChecks className="size-4 text-muted-foreground" aria-hidden="true" />}>
                {level === 'none' ? (
                  <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                    {t('dermat_orders.stepPage.private', 'Only {owners} see what was filled in this step. You can see where it is.', { owners })}
                  </p>
                ) : (
                  <StageWorkArea order={order} stage={stage} people={people} canWork busy={runner.busy} shortCount={null} onAction={onAction} variant="page" onlyStep={stepKey} />
                )}
              </StagePanel>
              <StagePanel title={t('dermat_orders.stepPage.history', 'What happened in this step')} icon={<History className="size-4 text-muted-foreground" aria-hidden="true" />}>
                {history.length ? <StageHistoryPanel events={history} /> : <p className="p-4 text-sm text-muted-foreground">{t('dermat_orders.stepPage.noHistory', 'Nothing recorded on this step yet.')}</p>}
              </StagePanel>
            </div>

            <div className="flex flex-col gap-4 lg:col-span-4">
              <StagePanel title={t('dermat_orders.stepPage.steps', 'Steps of {stage}', { stage: stage.label })} icon={<ListChecks className="size-4 text-muted-foreground" aria-hidden="true" />} bodyClassName="p-2">
                <ol className="flex flex-col gap-0.5">
                  {items.map((entry, position) => {
                    const isStep = entry.kind === 'step'
                    const icon = entry.status === 'done' ? <Check className="h-3.5 w-3.5 text-status-success-icon" aria-hidden="true" /> : entry.status === 'current' ? <Clock className="h-3.5 w-3.5 text-status-warning-icon" aria-hidden="true" /> : entry.status === 'na' ? <MinusCircle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /> : <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    const body = (
                      <span className={cn('flex items-center gap-2 rounded-md px-2 py-1.5 text-sm', entry.key === stepKey ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-muted')}>
                        <span className="w-4 text-xs tabular-nums text-muted-foreground">{position + 1}</span>
                        {icon}
                        <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                        {entry.status === 'done' && entry.at ? <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(entry.at)}</span> : null}
                      </span>
                    )
                    return <li key={entry.key}>{isStep ? <Link href={`/backend/orders/${order.id}/stages/${stageKey}/steps/${entry.key}`}>{body}</Link> : body}</li>
                  })}
                </ol>
              </StagePanel>
              <StagePanel title={t('dermat_orders.stepPage.order', 'Order')} icon={<Package className="size-4 text-muted-foreground" aria-hidden="true" />} bodyClassName="p-4">
                <dl className="space-y-1.5 text-sm">
                  <div><dt className="text-xs text-muted-foreground">{t('dermat_orders.stepPage.orderNo', 'Order')}</dt><dd><Link href={`/backend/orders/${order.id}`} className="font-mono font-semibold text-primary hover:underline">{order.orderNo}</Link></dd></div>
                  {order.customer?.name ? <div><dt className="text-xs text-muted-foreground">{t('dermat_orders.stepPage.customer', 'Customer')}</dt><dd>{order.customer.name}</dd></div> : null}
                  <div>
                    <dt className="text-xs text-muted-foreground">{t('dermat_orders.stepPage.products', 'Products')}</dt>
                    {order.lines.map((line) => (
                      <dd key={line.id}>
                        {line.brandName ?? line.product?.title ?? '—'} · {formatQty(line.quantity, 0)} pcs{line.batchNo ? ` · batch ${line.batchNo}` : ''}
                      </dd>
                    ))}
                  </div>
                </dl>
              </StagePanel>
            </div>
          </div>
        </div>
      </PageBody>
    </Page>
  )
}

export default StepPage
