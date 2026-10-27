'use client'

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@open-mercato/ui/primitives/sheet'
import { LoadingMessage } from '@open-mercato/ui/backend/detail'
import { StageSheet, type StageActionRequest } from './StageSheet'
import { useStageAction } from './useStageAction'
import { useStageSettings } from './useStageSettings'
import type { Order, Stage } from './types'

type TaskSheetProps = { orderId: string | null; stageKey: string | null; onClose: () => void; onChanged: () => void }

export function TaskSheet({ orderId, stageKey, onClose, onChanged }: TaskSheetProps) {
  const t = useT()
  useStageSettings()
  const [order, setOrder] = React.useState<Order | null>(null)
  const [people, setPeople] = React.useState<Array<{ id: string; name: string }>>([])
  const runner = useStageAction(`dermat-task-${orderId ?? 'none'}-${stageKey ?? 'none'}`)

  const load = React.useCallback(async () => {
    if (!orderId) return
    const call = await apiCall<Order>(`/api/dermat_orders/orders?id=${encodeURIComponent(orderId)}`)
    setOrder(call.ok && call.result ? call.result : null)
  }, [orderId])

  React.useEffect(() => {
    setOrder(null)
    void load()
  }, [load])

  React.useEffect(() => {
    apiCall<{ items?: Array<{ id: string; name: string }> }>('/api/dermat_orders/people', undefined, { fallback: { items: [] } }).then((call) => setPeople(call.result?.items ?? []))
  }, [])

  if (!orderId || !stageKey) return null
  const stage = order?.stages.find((entry) => entry.key === stageKey) ?? null

  const onAction = async (target: Stage, request: StageActionRequest): Promise<boolean> => {
    if (!order) return false
    const result = await runner.run(order, target, request)
    if (result.order) {
      setOrder(result.order)
      onChanged()
      return true
    }
    if (result.conflict) await load()
    return false
  }

  if (!order || !stage) {
    return (
      <Sheet open modal={false} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{t('dermat_orders.tasks.loading', 'Opening the task…')}</SheetTitle>
          </SheetHeader>
          <LoadingMessage label={t('dermat_orders.loading', 'Loading order…')} />
        </SheetContent>
      </Sheet>
    )
  }
  return <StageSheet order={order} stage={stage} people={people} canWork busy={runner.busy} shortCount={null} onClose={onClose} onAction={onAction} />
}

export default TaskSheet
