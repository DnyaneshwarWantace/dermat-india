"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { SegmentedControl, SegmentedControlItem } from '@open-mercato/ui/primitives/segmented-control'
import { useGranted } from '../../dermat_departments/components/useGranted'
import { ActivityTab } from './request/ActivityTab'
import { RequestActionDialog, type RequestActionKind } from './request/RequestActionDialog'
import { RequestFormDialog } from './request/RequestFormDialog'
import { RequestHeader } from './request/RequestHeader'
import { RequestOverview } from './request/RequestOverview'
import { SamplesTab } from './request/SamplesTab'
import { formFromRequest, type RequestForm } from './request/requestForm'
import { StabilityTab } from './stability/StabilityTab'
import { TrialsTab } from './trial/TrialsTab'
import type { Trial } from './types'
import { useRdRequest, useRdSend } from './useRdApi'

type Tab = 'request' | 'trials' | 'stability' | 'samples' | 'activity'

export function RequestPage({ requestId, backHref = '/backend/rnd/requests' }: { requestId: string; backHref?: string }) {
  const t = useT()
  const granted = useGranted()
  const { request, trials, error, reload } = useRdRequest(requestId)
  const { send, busy } = useRdSend(`dermat-rnd-request-${requestId}`)
  const [tab, setTab] = React.useState<Tab>('request')
  const [trialId, setTrialId] = React.useState<string | null>(null)
  const [stabilityStart, setStabilityStart] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<RequestForm | null>(null)
  const [action, setAction] = React.useState<RequestActionKind | null>(null)
  const canManage = granted.has('dermat_rnd.manage')
  const canRequest = granted.has('dermat_rnd.request')

  const refresh = React.useCallback(
    async (select?: string) => {
      await reload()
      if (select) setTrialId(select)
    },
    [reload],
  )

  const openTrial = (id: string) => {
    setTrialId(id)
    setTab('trials')
  }

  const newTrial = async () => {
    if (!request) return
    const created = await send<Trial>('/api/dermat_rnd/trials', 'POST', { requestId: request.id }, { resourceKind: 'dermat_rnd.trial', success: t('dermat_rnd.trial.created', 'Trial made') })
    if (created) {
      await refresh(created.id)
      setTab('trials')
    }
  }

  const simpleAction = async (name: 'start' | 'reopen') => {
    if (!request) return
    const done = await send('/api/dermat_rnd/requests/action', 'POST', { id: request.id, action: name }, { version: request.updatedAt, success: t('dermat_rnd.updated', '{code} updated', { code: request.code }) })
    if (done) await refresh()
  }

  if (error) return <Page><PageBody><ErrorMessage label={error} /></PageBody></Page>
  if (!request || !trials) return <Page><PageBody><LoadingMessage label={t('dermat_rnd.loading', 'Loading…')} /></PageBody></Page>

  return (
    <Page>
      <PageBody>
        <div className="mx-auto flex max-w-7xl flex-col gap-4 pb-16">
          <RequestHeader
            request={request}
            canRequest={canRequest}
            canManage={canManage}
            busy={busy}
            backHref={backHref}
            onEdit={() => setForm(formFromRequest(request))}
            onStart={() => void simpleAction('start')}
            onNewTrial={() => void newTrial()}
            onAction={setAction}
            onReopen={() => void simpleAction('reopen')}
          />
          <SegmentedControl value={tab} onValueChange={(value) => setTab(value as Tab)} aria-label={t('dermat_rnd.sections', 'Request sections')}>
            <SegmentedControlItem value="request">{t('dermat_rnd.tab.request', 'Request')}</SegmentedControlItem>
            <SegmentedControlItem value="trials">{t('dermat_rnd.tab.trials', 'Trials ({count})', { count: trials.length })}</SegmentedControlItem>
            <SegmentedControlItem value="stability">{t('dermat_rnd.tab.stability', 'Stability & QC')}</SegmentedControlItem>
            <SegmentedControlItem value="samples">{t('dermat_rnd.tab.samples', 'Samples ({count})', { count: request.rounds.length })}</SegmentedControlItem>
            <SegmentedControlItem value="activity">{t('dermat_rnd.tab.activity', 'Activity')}</SegmentedControlItem>
          </SegmentedControl>
          {tab === 'request' ? <RequestOverview request={request} trials={trials} onOpenTrial={openTrial} /> : null}
          {tab === 'trials' ? (
            <TrialsTab
              request={request}
              trials={trials}
              selectedId={trialId}
              canManage={canManage}
              canMakeBom={granted.has('dermat_boms.manage')}
              busy={busy}
              onSelect={setTrialId}
              onNewTrial={() => void newTrial()}
              onChanged={refresh}
              onOpenStability={(id) => {
                setStabilityStart(id)
                setTab('stability')
              }}
            />
          ) : null}
          {tab === 'stability' ? <StabilityTab trials={trials} selectedId={trialId} canManage={canManage} startFor={stabilityStart} onSelect={setTrialId} onStartHandled={() => setStabilityStart(null)} onChanged={refresh} /> : null}
          {tab === 'samples' ? <SamplesTab rounds={request.rounds} onOpenTrial={openTrial} /> : null}
          {tab === 'activity' ? <ActivityTab request={request} trials={trials} /> : null}
        </div>
        <RequestFormDialog
          form={form}
          editing={request}
          onChange={setForm}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null)
            void refresh()
          }}
        />
        <RequestActionDialog
          request={request}
          action={action}
          trials={trials}
          onClose={() => setAction(null)}
          onDone={() => {
            setAction(null)
            void refresh()
          }}
        />
      </PageBody>
    </Page>
  )
}

export default RequestPage
