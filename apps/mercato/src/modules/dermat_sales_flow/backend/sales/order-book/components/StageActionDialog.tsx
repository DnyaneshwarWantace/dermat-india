'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@open-mercato/ui/primitives/dialog'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
import { Checkbox } from '@open-mercato/ui/primitives/checkbox'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useCurrentUser } from '@open-mercato/ui/backend/utils/useCurrentUser'
import { CheckCircle2, Wallet, ShieldCheck, Clock, ArrowRight } from 'lucide-react'

/**
 * Kanban stage-gate mechanism (spec §5.2): "Dragging an order between columns must never be a
 * blind status update. It should open the required stage action, validate mandatory data,
 * complete the stage transaction, then move the order."
 */
export type StageGateMode = 'advance' | 'verify' | 'sample_sent' | 'generic' | 'revert'

export type StageGateSubmitPayload = {
  actorName?: string
  advanceConfirmed?: boolean
  advanceReceivedAmount?: number | null
  advanceReceivedAt?: string | null
  advancePaymentRef?: string | null
  verifyNote?: string | null
  sampleSentNote?: string | null
  revertReason?: string
}

export type StageActionDialogProps = {
  open: boolean
  mode: StageGateMode
  orderNumber?: string | null
  targetStageLabel?: string | null
  advanceAlreadyReceived?: boolean
  defaultAdvanceAmount?: number | null
  totalAmount?: number | null
  advancePercent?: number | null
  advanceRequired?: boolean
  loading?: boolean
  onCancel: () => void
  onConfirm: (payload: StageGateSubmitPayload) => void | Promise<void>
}

export function StageActionDialog({
  open,
  mode,
  orderNumber,
  targetStageLabel,
  advanceAlreadyReceived,
  defaultAdvanceAmount,
  totalAmount,
  advancePercent = 40,
  advanceRequired = true,
  loading,
  onCancel,
  onConfirm,
}: StageActionDialogProps) {
  const t = useT()
  const currentUser = useCurrentUser()

  const [advanceConfirmed, setAdvanceConfirmed] = React.useState(false)
  const [advanceAmount, setAdvanceAmount] = React.useState('')
  const [advanceDate, setAdvanceDate] = React.useState('')
  const [paymentRef, setPaymentRef] = React.useState('')
  const [actorName, setActorName] = React.useState('')
  const [verifyNote, setVerifyNote] = React.useState('')
  const [sampleSentNote, setSampleSentNote] = React.useState('')
  const [revertReason, setRevertReason] = React.useState('')

  React.useEffect(() => {
    if (!open) return
    setAdvanceConfirmed(Boolean(advanceAlreadyReceived) || (mode === 'verify' && !advanceAlreadyReceived))
    setAdvanceAmount(defaultAdvanceAmount != null && defaultAdvanceAmount > 0 ? String(Math.round(defaultAdvanceAmount)) : '')
    setAdvanceDate(new Date().toISOString().slice(0, 10))
    setPaymentRef('')
    setActorName(currentUser.email || 'admin@dermatindia.com')
    setVerifyNote('')
    setSampleSentNote('')
    setRevertReason('')
  }, [open, advanceAlreadyReceived, defaultAdvanceAmount, currentUser.email, mode])

  const canSubmit = React.useMemo(() => {
    // Checking the box alone used to be enough to submit, even with the amount left blank —
    // that saved no advance_received_amount, so the next stage's Verify dialog found nothing
    // recorded and asked the exact same advance-payment question again. Require a real amount.
    if (mode === 'advance') return advanceAlreadyReceived || (advanceConfirmed && Number(advanceAmount) > 0)
    if (mode === 'verify') {
      const actorOk = actorName.trim().length > 0
      const advanceOk = advanceAlreadyReceived || !advanceRequired || (advanceConfirmed && Number(advanceAmount) >= 0)
      return actorOk && advanceOk
    }
    if (mode === 'sample_sent') return sampleSentNote.trim().length > 0
    if (mode === 'revert') return revertReason.trim().length > 0
    return true
  }, [mode, advanceAlreadyReceived, advanceConfirmed, advanceAmount, advanceRequired, actorName, sampleSentNote, revertReason])

  const handleConfirm = React.useCallback(() => {
    if (!canSubmit || loading) return
    const payload: StageGateSubmitPayload = {}
    if (mode === 'advance') {
      payload.advanceConfirmed = advanceConfirmed
      payload.advanceReceivedAmount = advanceAmount ? Number(advanceAmount) : null
      payload.advanceReceivedAt = advanceDate || null
      payload.advancePaymentRef = paymentRef || null
    }
    if (mode === 'verify') {
      payload.actorName = actorName.trim()
      payload.verifyNote = verifyNote || null
      if (advanceConfirmed) {
        payload.advanceConfirmed = true
        payload.advanceReceivedAmount = advanceAmount ? Number(advanceAmount) : null
        payload.advanceReceivedAt = advanceDate || null
        payload.advancePaymentRef = paymentRef || null
      }
    }
    if (mode === 'sample_sent') {
      payload.sampleSentNote = sampleSentNote.trim()
    }
    if (mode === 'revert') {
      payload.revertReason = revertReason.trim()
    }
    void onConfirm(payload)
  }, [canSubmit, loading, mode, advanceConfirmed, advanceAmount, advanceDate, paymentRef, actorName, verifyNote, sampleSentNote, revertReason, onConfirm])

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        handleConfirm()
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    },
    [handleConfirm, onCancel],
  )

  const title =
    mode === 'advance'
      ? t('dermat_sales_flow.stageGate.advance.title', 'Confirm Advance Payment')
      : mode === 'verify'
        ? t('dermat_sales_flow.stageGate.verify.title', 'Verify & Confirm Order')
        : mode === 'sample_sent'
          ? t('dermat_sales_flow.stageGate.sampleSent.title', 'Confirm Sample Sent')
          : mode === 'revert'
            ? t('dermat_sales_flow.stageGate.revert.title', 'Move Order Back a Stage')
            : t('dermat_sales_flow.stageGate.generic.title', 'Move Order Stage')

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel() }}>
      <DialogContent onKeyDown={handleKeyDown} className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {mode === 'verify' ? (
              <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            ) : mode === 'advance' ? (
              <Wallet className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            ) : (
              <Clock className="h-5 w-5 text-primary" />
            )}
            <DialogTitle className="text-base">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            {orderNumber
              ? t('dermat_sales_flow.stageGate.description', `Order ${orderNumber}${targetStageLabel ? ` → ${targetStageLabel}` : ''}`, { orderNumber, targetStage: targetStageLabel ?? '' })
              : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {mode === 'advance' && (
            <>
              {advanceAlreadyReceived ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 p-3 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Advance payment has already been recorded for this order.</span>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50/40 dark:bg-amber-950/20 p-3.5 space-y-3">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="stage-gate-advance-confirmed"
                      checked={advanceConfirmed}
                      onCheckedChange={(checked) => setAdvanceConfirmed(checked === true)}
                    />
                    <Label htmlFor="stage-gate-advance-confirmed" className="text-xs font-medium leading-snug cursor-pointer">
                      {t('dermat_sales_flow.stageGate.advance.confirmLabel', 'I confirm the advance payment has been received for this order.')}
                    </Label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="stage-gate-advance-amount" className="text-xs">{t('dermat_sales_flow.stageGate.advance.amount', 'Advance received (₹)')}</Label>
                      <Input
                        id="stage-gate-advance-amount"
                        type="number"
                        min="0"
                        value={advanceAmount}
                        onChange={(e) => setAdvanceAmount(e.target.value)}
                        disabled={!advanceConfirmed}
                        className="h-8 text-xs bg-background"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="stage-gate-advance-date" className="text-xs">{t('dermat_sales_flow.stageGate.advance.date', 'Received on')}</Label>
                      <Input
                        id="stage-gate-advance-date"
                        type="date"
                        value={advanceDate}
                        onChange={(e) => setAdvanceDate(e.target.value)}
                        disabled={!advanceConfirmed}
                        className="h-8 text-xs bg-background"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="stage-gate-advance-ref" className="text-xs">{t('dermat_sales_flow.stageGate.advance.ref', 'Payment reference / UTR')}</Label>
                    <Input
                      id="stage-gate-advance-ref"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      disabled={!advanceConfirmed}
                      placeholder="e.g. UPI / NEFT / IMPS Ref"
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {mode === 'verify' && (
            <div className="space-y-3.5">
              {/* ADVANCE PAYMENT VERIFICATION SECTION */}
              {advanceAlreadyReceived ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 p-3 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    Advance payment is recorded and confirmed. Ready to verify order.
                  </span>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 dark:bg-amber-950/20 p-3.5 space-y-3">
                  <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-amber-600" />
                      <span className="font-semibold text-xs text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                        Advance Payment Status
                      </span>
                    </div>
                    {defaultAdvanceAmount ? (
                      <span className="font-mono text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-100/60 dark:bg-amber-900/40 px-2 py-0.5 rounded">
                        Expected: ₹{Number(defaultAdvanceAmount).toLocaleString('en-IN')} ({advancePercent}%)
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="stage-gate-verify-advance-confirmed"
                      checked={advanceConfirmed}
                      onCheckedChange={(checked) => setAdvanceConfirmed(checked === true)}
                    />
                    <Label htmlFor="stage-gate-verify-advance-confirmed" className="text-xs font-medium leading-snug cursor-pointer">
                      I confirm advance payment has been received for this order
                    </Label>
                  </div>

                  {advanceConfirmed ? (
                    <div className="space-y-3 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="stage-gate-verify-advance-amount" className="text-[11px] font-medium">
                              Advance Money (₹) *
                            </Label>
                            {totalAmount && Number(advanceAmount) > 0 ? (
                              <span className="text-[10px] font-semibold text-primary">
                                {Math.round((Number(advanceAmount) / totalAmount) * 100)}%
                              </span>
                            ) : null}
                          </div>
                          <Input
                            id="stage-gate-verify-advance-amount"
                            type="number"
                            min="0"
                            value={advanceAmount}
                            onChange={(e) => setAdvanceAmount(e.target.value)}
                            className="h-8 text-xs bg-background font-mono font-medium"
                            placeholder="e.g. 50000"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="stage-gate-verify-advance-date" className="text-[11px] font-medium">
                            Received On
                          </Label>
                          <Input
                            id="stage-gate-verify-advance-date"
                            type="date"
                            value={advanceDate}
                            onChange={(e) => setAdvanceDate(e.target.value)}
                            className="h-8 text-xs bg-background"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="stage-gate-verify-advance-ref" className="text-[11px] font-medium">
                            Payment Ref / UTR #
                          </Label>
                          <Input
                            id="stage-gate-verify-advance-ref"
                            value={paymentRef}
                            onChange={(e) => setPaymentRef(e.target.value)}
                            placeholder="e.g. UTR / NEFT / Cheque"
                            className="h-8 text-xs bg-background"
                          />
                        </div>
                      </div>

                      {/* Quick fill preset amounts */}
                      {totalAmount && totalAmount > 0 ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-muted-foreground font-medium">Quick Amount:</span>
                          {[
                            { label: '25%', pct: 0.25 },
                            { label: '40%', pct: 0.40 },
                            { label: '50%', pct: 0.50 },
                            { label: '100% (Full)', pct: 1.0 },
                          ].map((preset) => {
                            const val = Math.round(totalAmount * preset.pct)
                            return (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => setAdvanceAmount(String(val))}
                                className="text-[10px] px-2 py-0.5 rounded bg-background hover:bg-muted border border-border text-foreground font-medium transition-colors"
                              >
                                {preset.label} (₹{val.toLocaleString('en-IN')})
                              </button>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 italic">
                      Check above once advance payment is received from the client.
                    </p>
                  )}
                </div>
              )}

              {/* VERIFIER DETAILS */}
              <div className="space-y-3 pt-1">
                <div className="space-y-1">
                  <Label htmlFor="stage-gate-actor" className="text-xs font-medium">
                    {t('dermat_sales_flow.stageGate.verify.actor', 'Verified by *')}
                  </Label>
                  <Input
                    id="stage-gate-actor"
                    value={actorName}
                    onChange={(e) => setActorName(e.target.value)}
                    className="h-8 text-xs"
                    placeholder="Verifier Name or Email"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t('dermat_sales_flow.stageGate.verify.actorHint', 'Recorded with timestamp as the official order verification actor.')}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="stage-gate-verify-note" className="text-xs font-medium">
                    {t('dermat_sales_flow.stageGate.verify.note', 'Verification Note (optional)')}
                  </Label>
                  <Textarea
                    id="stage-gate-verify-note"
                    value={verifyNote}
                    onChange={(e) => setVerifyNote(e.target.value)}
                    rows={2}
                    className="text-xs"
                    placeholder="e.g. Client PO approved & advance payment verified against bank statement."
                  />
                </div>
              </div>
            </div>
          )}

          {mode === 'sample_sent' && (
            <div className="space-y-1">
              <Label htmlFor="stage-gate-sample-note">{t('dermat_sales_flow.stageGate.sampleSent.note', 'Confirm sample sent to client')}</Label>
              <Textarea
                id="stage-gate-sample-note"
                value={sampleSentNote}
                onChange={(e) => setSampleSentNote(e.target.value)}
                rows={3}
                autoFocus
                placeholder={t('dermat_sales_flow.stageGate.sampleSent.placeholder', 'e.g. Sample V1 sent via courier on 12 Sep, tracking #1234')}
              />
            </div>
          )}

          {mode === 'generic' && (
            <p className="text-sm text-muted-foreground">
              {t('dermat_sales_flow.stageGate.generic.body', 'This will move the order to the next stage.')}
            </p>
          )}

          {mode === 'revert' && (
            <div className="space-y-1">
              <Label htmlFor="stage-gate-revert-reason">
                {t('dermat_sales_flow.stageGate.revert.reason', 'Reason for reverting')}
              </Label>
              <Textarea
                id="stage-gate-revert-reason"
                value={revertReason}
                onChange={(e) => setRevertReason(e.target.value)}
                rows={3}
                autoFocus
                placeholder={t('dermat_sales_flow.stageGate.revert.placeholder', 'e.g. Client requested a formulation change, sending back to R&D')}
              />
              <p className="text-xs text-muted-foreground">
                {t('dermat_sales_flow.stageGate.revert.hint', 'This is recorded on the order activity log with the current user and timestamp.')}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!canSubmit || loading}>
            {loading ? t('common.saving', 'Saving...') : t('dermat_sales_flow.stageGate.confirm', 'Confirm & move')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
