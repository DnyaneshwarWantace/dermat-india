"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Building2 } from 'lucide-react'
import { Button } from '@open-mercato/ui/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@open-mercato/ui/primitives/dialog'
import { ComboboxInput } from '@open-mercato/ui/backend/inputs/ComboboxInput'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import {
  apiCallOrThrow,
  readApiResultOrThrow,
  withScopedApiRequestHeaders,
} from '@open-mercato/ui/backend/utils/apiCall'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { buildOptimisticLockHeader } from '@open-mercato/ui/backend/utils/optimisticLock'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { translateWithFallback } from '@open-mercato/shared/lib/i18n/translate'

interface HostInjectionContext {
  dealId?: string
  recordId?: string
  data?: {
    deal?: { id?: string; updatedAt?: string | null }
    linkedCompanyIds?: string[]
    customFields?: Record<string, unknown>
  }
}

interface DealConvertToOrderButtonProps {
  context?: HostInjectionContext
  data?: HostInjectionContext['data']
}

const CONVERT_TO_ORDER_CONTEXT_ID = 'customers-deal-detail:convert-to-order'

type CompanySearchRecord = {
  id?: string | null
  display_name?: string | null
  displayName?: string | null
  domain?: string | null
  website_url?: string | null
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export default function DealConvertToOrderButtonWidget({ context, data }: DealConvertToOrderButtonProps) {
  const t = useT()
  const router = useRouter()
  const resolvedData = data ?? context?.data
  const dealId =
    readString(context?.dealId) ??
    readString(context?.recordId) ??
    readString(resolvedData?.deal?.id) ??
    null
  const dealUpdatedAt =
    typeof resolvedData?.deal?.updatedAt === 'string' && resolvedData.deal.updatedAt.length > 0
      ? resolvedData.deal.updatedAt
      : null

  const { runMutation, retryLastMutation } = useGuardedMutation<{
    formId: string
    resourceKind: string
    retryLastMutation: () => Promise<boolean>
  }>({
    contextId: CONVERT_TO_ORDER_CONTEXT_ID,
    blockedMessage: translateWithFallback(t, 'ui.forms.flash.saveBlocked', 'Save blocked by validation'),
  })

  const [isBusy, setIsBusy] = React.useState(false)
  const [isCheckingLink, setIsCheckingLink] = React.useState(false)
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [companyId, setCompanyId] = React.useState('')

  const existingOrderId = readString(resolvedData?.customFields?.sales_order_id)
  const hasLinkedCompany =
    Array.isArray(resolvedData?.linkedCompanyIds) &&
    resolvedData.linkedCompanyIds.some((value) => typeof value === 'string' && value.length > 0)

  const checkHasLinkedCompany = React.useCallback(
    async (currentDealId: string): Promise<boolean> => {
      try {
        const call = await apiCallOrThrow<{ items?: Array<{ id?: unknown }> }>(
          `/api/customers/deals/${encodeURIComponent(currentDealId)}/companies?page=1&pageSize=1`,
        )
        return Array.isArray(call.result?.items) && call.result.items.length > 0
      } catch {
        // The convert command performs the definitive guard server-side; default to a
        // direct convert attempt so a stale payload can never REPLACE existing links.
        return true
      }
    },
    [],
  )

  const loadCompanies = React.useCallback(async (query = '') => {
    const params = new URLSearchParams({
      page: '1',
      pageSize: '8',
      sortField: 'display_name',
      sortDir: 'asc',
    })
    if (query.trim().length > 0) {
      params.set('search', query.trim())
    }
    const payload = await readApiResultOrThrow<{ items?: CompanySearchRecord[] }>(
      `/api/customers/companies?${params.toString()}`,
    )
    const items = Array.isArray(payload.items) ? payload.items : []
    return items.flatMap((record) => {
      const id = readString(record.id)
      const label = readString(record.display_name) ?? readString(record.displayName) ?? null
      if (!id || !label) return []
      const domain = readString(record.domain) ?? readString(record.website_url) ?? undefined
      return [{ value: id, label, description: domain }]
    })
  }, [])

  // Single guarded mutation: optionally link the picked company (REPLACE semantics — the
  // deal has no linked companies at this point), then create the sales order. Both writes
  // ride one `runMutation` so global mutation guards + `retryLastMutation` cover the flow.
  const performConvert = React.useCallback(
    async (companyToLink: string | null) => {
      if (!dealId) return
      setIsBusy(true)
      try {
        const operation = () => {
          const linkCompany =
            companyToLink !== null
              ? () =>
                  withScopedApiRequestHeaders(
                    buildOptimisticLockHeader(dealUpdatedAt ?? undefined),
                    () => updateCrud('customers/deals', { id: dealId, companyIds: [companyToLink] }),
                  )
              : null
          const convert = () =>
            apiCallOrThrow<{ orderId: string }>(
              '/api/dermat_sales_flow/deals/convert-to-order',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dealId }),
              },
              {
                errorMessage: translateWithFallback(
                  t,
                  'dermat_sales_flow.dealConvert.error',
                  'Failed to convert deal to order.',
                ),
              },
            )
          return linkCompany ? linkCompany().then(convert) : convert()
        }
        const call = await runMutation({
          operation,
          context: {
            formId: CONVERT_TO_ORDER_CONTEXT_ID,
            resourceKind: 'sales.sales_order',
            retryLastMutation,
          },
        })
        if (call.result?.orderId) {
          flash(
            translateWithFallback(t, 'dermat_sales_flow.dealConvert.success', 'Sales order created.'),
            'success',
          )
          router.push(`/backend/sales/order-book/${call.result.orderId}`)
        }
      } finally {
        setIsBusy(false)
      }
    },
    [dealId, dealUpdatedAt, retryLastMutation, router, runMutation, t],
  )

  const handleConvert = React.useCallback(async () => {
    if (!dealId) return
    if (hasLinkedCompany) {
      await performConvert(null)
      return
    }
    setIsCheckingLink(true)
    try {
      const stillLinked = await checkHasLinkedCompany(dealId)
      if (stillLinked) {
        await performConvert(null)
        return
      }
      setCompanyId('')
      setPickerOpen(true)
    } finally {
      setIsCheckingLink(false)
    }
  }, [checkHasLinkedCompany, dealId, hasLinkedCompany, performConvert])

  const handlePickerConfirm = React.useCallback(() => {
    if (!companyId) return
    setPickerOpen(false)
    void performConvert(companyId)
  }, [companyId, performConvert])

  if (!dealId) return null

  if (existingOrderId) {
    return (
      <Button
        type="button"
        variant="default"
        size="lg"
        className="text-base"
        onClick={() => router.push(`/backend/sales/order-book/${existingOrderId}`)}
        data-deal-view-order-trigger=""
      >
        {translateWithFallback(t, 'dermat_sales_flow.dealConvert.viewOrder', 'View order')}
      </Button>
    )
  }

  return (
    <>
      <Button
        type="button"
        variant="default"
        size="lg"
        className="text-base"
        onClick={handleConvert}
        disabled={isBusy || isCheckingLink}
        data-deal-convert-to-order-trigger=""
      >
        {isBusy || isCheckingLink
          ? translateWithFallback(t, 'dermat_sales_flow.dealConvert.converting', 'Converting…')
          : translateWithFallback(t, 'dermat_sales_flow.dealConvert.label', 'Convert to order')}
      </Button>

      <Dialog open={pickerOpen} onOpenChange={(open) => !isBusy && setPickerOpen(open)}>
        <DialogContent
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && companyId) {
              event.preventDefault()
              handlePickerConfirm()
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-base">
              {translateWithFallback(
                t,
                'dermat_sales_flow.dealConvert.companyRequiredTitle',
                'Link a company to convert to order',
              )}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {translateWithFallback(
                t,
                'dermat_sales_flow.dealConvert.companyRequiredDescription',
                'A sales order needs a company as its customer. Pick the company for this deal to continue.',
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Building2 className="size-4 text-muted-foreground" aria-hidden="true" />
            <ComboboxInput
              value={companyId}
              onChange={setCompanyId}
              loadSuggestions={loadCompanies}
              allowCustomValues={false}
              autoFocus
              placeholder={translateWithFallback(
                t,
                'dermat_sales_flow.dealConvert.companyPickerPlaceholder',
                'Search companies…',
              )}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPickerOpen(false)}
              disabled={isBusy}
            >
              {translateWithFallback(t, 'ui.forms.cancel', 'Cancel')}
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handlePickerConfirm}
              disabled={!companyId || isBusy}
            >
              {isBusy
                ? translateWithFallback(t, 'dermat_sales_flow.dealConvert.converting', 'Converting…')
                : translateWithFallback(t, 'dermat_sales_flow.dealConvert.linkAndConvert', 'Link & convert')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}