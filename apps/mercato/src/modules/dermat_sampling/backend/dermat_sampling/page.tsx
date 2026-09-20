'use client'

import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { ListEmptyState } from '@open-mercato/ui/backend/filters/ListEmptyState'
import type { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { Badge } from '@open-mercato/ui/primitives/badge'
import Link from 'next/link'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall, withScopedApiRequestHeaders } from '@open-mercato/ui/backend/utils/apiCall'
import { buildOptimisticLockHeader } from '@open-mercato/ui/backend/utils/optimisticLock'
import { surfaceRecordConflict } from '@open-mercato/ui/backend/conflicts'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import type { FilterDef, FilterValues } from '@open-mercato/ui/backend/FilterBar'
import { SAMPLE_STATUSES } from '../../data/validators'

type SampleRow = {
  id: string
  order_id: string
  product_name: string | null
  status: string
  requested_by: string | null
  requested_at: string | null
  sent_at: string | null
  customer_decision_at: string | null
  rejection_reason: string | null
  notes: string | null
  organization_id: string
  tenant_id: string
  created_at: string
  updated_at: string
}

type ResponsePayload = {
  items: SampleRow[]
  total: number
  page: number
  totalPages: number
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  requested: 'outline',
  in_preparation: 'secondary',
  sent: 'secondary',
  approved: 'default',
  rejected: 'destructive',
}

const NEXT_STATUS: Record<string, string | null> = {
  requested: 'in_preparation',
  in_preparation: 'sent',
  sent: null,
  approved: null,
  rejected: null,
}

export default function DermatSamplingPage() {
  const t = useT()
  const [rows, setRows] = React.useState<SampleRow[]>([])
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [filters, setFilters] = React.useState<FilterValues>({})
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)
  const scopeVersion = useOrganizationScopeVersion()
  const mutationContextId = 'dermat-sampling-list:mutation'
  const { runMutation, retryLastMutation } = useGuardedMutation<{
    formId: string
    resourceKind: string
    resourceId: string
    retryLastMutation: () => Promise<boolean>
  }>({
    contextId: mutationContextId,
    blockedMessage: t('ui.forms.flash.saveBlocked', 'Save blocked by validation'),
  })

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('pageSize', '50')
        if (filters.status) params.set('status', String(filters.status))

        const fallback: ResponsePayload = { items: [], total: 0, page, totalPages: 1 }
        const call = await apiCall<ResponsePayload>(
          `/api/dermat_sampling/samples?${params.toString()}`,
          undefined,
          { fallback }
        )

        if (!call.ok) {
          flash(t('dermat_sampling.list.error.load', 'Failed to load samples'), 'error')
          return
        }

        const payload = call.result ?? fallback
        if (!cancelled) {
          setRows(Array.isArray(payload.items) ? payload.items : [])
          setTotal(payload.total || 0)
          setTotalPages(payload.totalPages || 1)
        }
      } catch (error) {
        if (!cancelled) {
          flash(t('dermat_sampling.list.error.load', 'Failed to load samples'), 'error')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [page, filters, reloadToken, scopeVersion, t])

  const handleUpdateStatus = React.useCallback(
    async (row: SampleRow, status: string) => {
      try {
        await runMutation({
          operation: async () => {
            const call = await withScopedApiRequestHeaders(
              buildOptimisticLockHeader(row.updated_at),
              () => apiCall(`/api/dermat_sampling/samples`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: row.id, status }),
              }),
            )
            if (!call.ok) {
              throw Object.assign(new Error('[internal] dermat_sampling.update_status failed'), {
                status: call.status,
                ...((call.result as Record<string, unknown> | null) ?? {}),
              })
            }
            return call
          },
          context: {
            formId: mutationContextId,
            resourceKind: 'dermat_sampling.sample',
            resourceId: row.id,
            retryLastMutation,
          },
          mutationPayload: { id: row.id, status },
        })

        flash(t('dermat_sampling.flash.updated', 'Sample updated'), 'success')
        setReloadToken((tokenValue) => tokenValue + 1)
      } catch (error) {
        if (surfaceRecordConflict(error, t, { onRefresh: () => setReloadToken((tokenValue) => tokenValue + 1) })) return
        flash(t('dermat_sampling.flash.updateError', 'Failed to update sample'), 'error')
      }
    },
    [mutationContextId, retryLastMutation, runMutation, t]
  )

  const columns = React.useMemo<ColumnDef<SampleRow>[]>(
    () => [
      {
        accessorKey: 'order_id',
        header: t('dermat_sampling.list.columns.order', 'Order'),
        cell: ({ row }) => (
          <Link
            href={`/backend/sales/order-book/${row.original.order_id}`}
            className="underline underline-offset-2 hover:text-primary"
          >
            {row.original.order_id.slice(0, 8)}
          </Link>
        ),
      },
      {
        accessorKey: 'product_name',
        header: t('dermat_sampling.list.columns.product', 'Product'),
        cell: ({ getValue }) => String(getValue() ?? '—'),
      },
      {
        accessorKey: 'status',
        header: t('dermat_sampling.list.columns.status', 'Status'),
        cell: ({ getValue }) => {
          const value = String(getValue() ?? '')
          return <Badge variant={STATUS_VARIANT[value] ?? 'outline'}>{value.replace(/_/g, ' ')}</Badge>
        },
      },
      {
        accessorKey: 'requested_by',
        header: t('dermat_sampling.list.columns.requestedBy', 'Requested by'),
        cell: ({ getValue }) => String(getValue() ?? '—'),
      },
      {
        accessorKey: 'requested_at',
        header: t('dermat_sampling.list.columns.requestedAt', 'Requested at'),
        cell: ({ getValue }) => {
          const value = getValue()
          return value ? new Date(String(value)).toLocaleString() : '—'
        },
      },
      {
        accessorKey: 'customer_decision_at',
        header: t('dermat_sampling.list.columns.decisionAt', 'Decision at'),
        cell: ({ getValue }) => {
          const value = getValue()
          return value ? new Date(String(value)).toLocaleString() : '—'
        },
      },
    ],
    [t]
  )

  const filterDefs = React.useMemo<FilterDef[]>(
    () => [
      {
        id: 'status',
        label: t('dermat_sampling.list.filters.status', 'Status'),
        type: 'select',
        options: [
          { label: t('dermat_sampling.list.filters.all', 'All'), value: '' },
          ...SAMPLE_STATUSES.map((status) => ({ label: status.replace(/_/g, ' '), value: status })),
        ],
      },
    ],
    [t]
  )

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('dermat_sampling.list.title', 'R&D Samples')}
          columns={columns}
          data={rows}
          filters={filterDefs}
          filterValues={filters}
          onFiltersApply={(values) => {
            setFilters(values)
            setPage(1)
          }}
          onFiltersClear={() => {
            setFilters({})
            setPage(1)
          }}
          rowActions={(row) => {
            const nextStatus = NEXT_STATUS[row.status]
            const items = []
            if (nextStatus) {
              items.push({
                id: 'advance',
                label:
                  nextStatus === 'in_preparation'
                    ? t('dermat_sampling.list.actions.markInPreparation', 'Mark In Preparation')
                    : t('dermat_sampling.list.actions.markSent', 'Mark Sent'),
                onSelect: () => handleUpdateStatus(row, nextStatus),
              })
            }
            if (row.status === 'sent') {
              items.push(
                {
                  id: 'approve',
                  label: t('dermat_sampling.list.actions.approve', 'Mark Approved'),
                  onSelect: () => handleUpdateStatus(row, 'approved'),
                },
                {
                  id: 'reject',
                  label: t('dermat_sampling.list.actions.reject', 'Mark Rejected'),
                  destructive: true,
                  onSelect: () => handleUpdateStatus(row, 'rejected'),
                },
              )
            }
            return <RowActions items={items} />
          }}
          emptyState={(
            <ListEmptyState
              entityName={t('dermat_sampling.list.title', 'R&D Samples')}
            />
          )}
          pagination={{ page, pageSize: 50, total, totalPages, onPageChange: setPage }}
          isLoading={isLoading}
        />
      </PageBody>
    </Page>
  )
}
