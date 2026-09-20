'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Card, CardContent, CardHeader, CardTitle } from '@open-mercato/ui/primitives/card'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@open-mercato/ui/primitives/select'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { LoadingMessage, ErrorMessage, RecordNotFoundState } from '@open-mercato/ui/backend/detail'
import { WASTAGE_ACTIONS } from '../../../data/validators'

type ProductionBatchData = {
  id: string
  batch_number: string
  order_id: string | null
  product_name: string
  planned_quantity: string | number
  planned_unit: string
  status: string
  created_by: string | null
  organization_id: string
  tenant_id: string
  created_at: string
  updated_at: string
}

type BatchStageData = {
  id: string
  production_batch_id: string
  stage_type: 'bulk' | 'semi_finished' | 'finished'
  sequence_number: number
  is_skipped: boolean
  machine_used: string | null
  operator_name: string | null
  shift: string | null
  planned_output_qty: string | number | null
  actual_output_qty: string | number | null
  wastage_qty: string | number | null
  wastage_action: string
  status: string
  started_at: string | null
  completed_at: string | null
  signed_off_by: string | null
  updated_at: string
}

const STAGE_LABELS: Record<string, string> = {
  bulk: 'Bulk',
  semi_finished: 'Semi-Finished',
  finished: 'Finished Goods',
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  in_progress: 'default',
  done: 'secondary',
  qc_pending: 'outline',
  qc_passed: 'secondary',
  qc_failed: 'destructive',
}

function StageCard({
  stage,
  onSaved,
}: {
  stage: BatchStageData
  onSaved: () => void
}) {
  const t = useT()
  const [machineUsed, setMachineUsed] = React.useState(stage.machine_used ?? '')
  const [operatorName, setOperatorName] = React.useState(stage.operator_name ?? '')
  const [shift, setShift] = React.useState(stage.shift ?? '')
  const [plannedOutputQty, setPlannedOutputQty] = React.useState(
    stage.planned_output_qty == null ? '' : String(stage.planned_output_qty)
  )
  const [actualOutputQty, setActualOutputQty] = React.useState(
    stage.actual_output_qty == null ? '' : String(stage.actual_output_qty)
  )
  const [wastageQty, setWastageQty] = React.useState(
    stage.wastage_qty == null ? '' : String(stage.wastage_qty)
  )
  const [wastageAction, setWastageAction] = React.useState(stage.wastage_action)
  const [signedOffBy, setSignedOffBy] = React.useState(stage.signed_off_by ?? '')
  const [saving, setSaving] = React.useState(false)
  const [signingOff, setSigningOff] = React.useState(false)

  const isEditable = stage.status !== 'done' && !stage.is_skipped
  const canSignOff = (stage.status === 'pending' || stage.status === 'in_progress') && !stage.is_skipped

  const handleSaveDetails = React.useCallback(async () => {
    setSaving(true)
    try {
      await updateCrud('dermat_production/batch-stages', {
        id: stage.id,
        machineUsed: machineUsed || null,
        operatorName: operatorName || null,
        shift: shift || null,
        plannedOutputQty: plannedOutputQty === '' ? null : Number(plannedOutputQty),
        actualOutputQty: actualOutputQty === '' ? null : Number(actualOutputQty),
        wastageQty: wastageQty === '' ? null : Number(wastageQty),
        wastageAction,
        status: stage.status === 'pending' ? 'in_progress' : undefined,
      })
      flash(t('dermat_production.detail.flash.stageUpdated', 'Stage updated'), 'success')
      onSaved()
    } catch (error) {
      flash(t('dermat_production.detail.flash.stageUpdateError', 'Failed to update stage'), 'error')
    } finally {
      setSaving(false)
    }
  }, [
    actualOutputQty,
    machineUsed,
    onSaved,
    operatorName,
    plannedOutputQty,
    shift,
    stage.id,
    stage.status,
    t,
    wastageAction,
    wastageQty,
  ])

  const handleSignOff = React.useCallback(async () => {
    const name = signedOffBy.trim()
    if (!name) {
      flash(t('dermat_production.detail.flash.signOffNameRequired', 'Enter the name of the person signing off'), 'error')
      return
    }
    setSigningOff(true)
    try {
      const call = await apiCall('/api/dermat_production/batch-stages/sign-off', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: stage.id, signedOffBy: name }),
      })
      if (!call.ok) {
        throw new Error('[internal] sign-off failed')
      }
      flash(t('dermat_production.detail.flash.signedOff', 'Stage signed off'), 'success')
      onSaved()
    } catch (error) {
      flash(t('dermat_production.detail.flash.signOffError', 'Failed to sign off stage'), 'error')
    } finally {
      setSigningOff(false)
    }
  }, [onSaved, signedOffBy, stage.id, t])

  return (
    <Card className={stage.is_skipped ? 'opacity-60' : undefined}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {t('dermat_production.detail.stage.sequence', 'Stage {n}: {name}', {
              n: stage.sequence_number,
              name: STAGE_LABELS[stage.stage_type] ?? stage.stage_type,
            })}
          </CardTitle>
          <div className="flex items-center gap-2">
            {stage.is_skipped ? (
              <Badge variant="outline">{t('dermat_production.detail.stage.skipped', 'Skipped')}</Badge>
            ) : (
              <Badge variant={STATUS_VARIANT[stage.status] ?? 'outline'}>
                {stage.status.replace(/_/g, ' ')}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {stage.is_skipped ? (
          <p className="text-sm text-muted-foreground">
            {t('dermat_production.detail.stage.skippedHelp', 'This stage was skipped for this batch.')}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`machine-${stage.id}`}>{t('dermat_production.detail.stage.machine', 'Machine used')}</Label>
                <Input
                  id={`machine-${stage.id}`}
                  value={machineUsed}
                  disabled={!isEditable}
                  onChange={(event) => setMachineUsed(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`operator-${stage.id}`}>{t('dermat_production.detail.stage.operator', 'Operator')}</Label>
                <Input
                  id={`operator-${stage.id}`}
                  value={operatorName}
                  disabled={!isEditable}
                  onChange={(event) => setOperatorName(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`shift-${stage.id}`}>{t('dermat_production.detail.stage.shift', 'Shift')}</Label>
                <Input
                  id={`shift-${stage.id}`}
                  placeholder={t('dermat_production.detail.stage.shiftPlaceholder', 'Day / Night')}
                  value={shift}
                  disabled={!isEditable}
                  onChange={(event) => setShift(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`planned-${stage.id}`}>{t('dermat_production.detail.stage.plannedOutput', 'Planned output qty')}</Label>
                <Input
                  id={`planned-${stage.id}`}
                  type="number"
                  value={plannedOutputQty}
                  disabled={!isEditable}
                  onChange={(event) => setPlannedOutputQty(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`actual-${stage.id}`}>{t('dermat_production.detail.stage.actualOutput', 'Actual output qty')}</Label>
                <Input
                  id={`actual-${stage.id}`}
                  type="number"
                  value={actualOutputQty}
                  disabled={!isEditable}
                  onChange={(event) => setActualOutputQty(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`wastage-${stage.id}`}>{t('dermat_production.detail.stage.wastageQty', 'Wastage qty')}</Label>
                <Input
                  id={`wastage-${stage.id}`}
                  type="number"
                  placeholder={t('dermat_production.detail.stage.wastageAuto', 'Auto: planned − actual')}
                  value={wastageQty}
                  disabled={!isEditable}
                  onChange={(event) => setWastageQty(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5 sm:max-w-xs">
              <Label htmlFor={`wastage-action-${stage.id}`}>
                {t('dermat_production.detail.stage.wastageAction', 'Leftover material — wasted or returned to stock?')}
              </Label>
              <Select
                value={wastageAction}
                disabled={!isEditable}
                onValueChange={(value) => setWastageAction(value)}
              >
                <SelectTrigger id={`wastage-action-${stage.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WASTAGE_ACTIONS.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t pt-4">
              <Button type="button" variant="outline" disabled={!isEditable || saving} onClick={handleSaveDetails}>
                {saving
                  ? t('dermat_production.detail.stage.saving', 'Saving...')
                  : t('dermat_production.detail.stage.save', 'Save stage details')}
              </Button>

              {canSignOff && (
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <Input
                    className="max-w-xs"
                    placeholder={t('dermat_production.detail.stage.signOffNamePlaceholder', 'Your name')}
                    value={signedOffBy}
                    onChange={(event) => setSignedOffBy(event.target.value)}
                  />
                  <Button type="button" disabled={signingOff} onClick={handleSignOff}>
                    {signingOff
                      ? t('dermat_production.detail.stage.signingOff', 'Signing off...')
                      : t('dermat_production.detail.stage.signOff', 'Sign Off Stage')}
                  </Button>
                </div>
              )}

              {stage.status === 'done' && (
                <p className="text-sm text-muted-foreground">
                  {t('dermat_production.detail.stage.signedOffBy', 'Signed off by {name}', { name: stage.signed_off_by ?? '—' })}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function ProductionBatchDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id

  const [batch, setBatch] = React.useState<ProductionBatchData | null>(null)
  const [stages, setStages] = React.useState<BatchStageData[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isNotFound, setIsNotFound] = React.useState(false)
  const [reloadToken, setReloadToken] = React.useState(0)

  React.useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const batchCall = await apiCall<{ items: ProductionBatchData[] }>(`/api/dermat_production/batches?id=${id}`)
        if (!batchCall.ok) {
          if (!cancelled) setError(t('dermat_production.detail.errors.load', 'Failed to load batch'))
          return
        }
        const foundBatch = batchCall.result?.items?.[0]
        if (!foundBatch) {
          if (!cancelled) setIsNotFound(true)
          return
        }

        const stagesCall = await apiCall<{ items: BatchStageData[] }>(
          `/api/dermat_production/batch-stages?productionBatchId=${id}&pageSize=10&sortField=sequenceNumber&sortDir=asc`
        )

        if (!cancelled) {
          setBatch(foundBatch)
          setStages(stagesCall.ok ? stagesCall.result?.items ?? [] : [])
        }
      } catch (err) {
        if (!cancelled) setError(t('dermat_production.detail.errors.load', 'Failed to load batch'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id, reloadToken, t])

  const sortedStages = React.useMemo(
    () => [...stages].sort((a, b) => a.sequence_number - b.sequence_number),
    [stages]
  )

  if (loading) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('dermat_production.detail.loading', 'Loading...')} />
        </PageBody>
      </Page>
    )
  }

  if (isNotFound) {
    return (
      <Page>
        <PageBody>
          <RecordNotFoundState
            label={t('dermat_production.detail.errors.notFound', 'Production batch not found.')}
            backHref="/backend/dermat_production"
            backLabel={t('dermat_production.detail.backToList', 'Back to batches')}
          />
        </PageBody>
      </Page>
    )
  }

  if (error || !batch) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={error ?? t('dermat_production.detail.errors.notFound', 'Production batch not found.')} />
        </PageBody>
      </Page>
    )
  }

  return (
    <Page>
      <PageBody>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">{batch.batch_number}</h1>
              <p className="text-sm text-muted-foreground">
                {batch.product_name} · {batch.planned_quantity} {batch.planned_unit}
                {batch.order_id ? ` · ${t('dermat_production.detail.orderRef', 'Order: {ref}', { ref: batch.order_id })}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[batch.status] ?? 'outline'}>{batch.status.replace(/_/g, ' ')}</Badge>
              <Button type="button" variant="outline" onClick={() => router.push('/backend/dermat_production')}>
                {t('dermat_production.detail.backToList', 'Back to batches')}
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {sortedStages.map((stage) => (
              <StageCard
                key={stage.id}
                stage={stage}
                onSaved={() => setReloadToken((tokenValue) => tokenValue + 1)}
              />
            ))}
          </div>
        </div>
      </PageBody>
    </Page>
  )
}
