'use client'

import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { ListEmptyState } from '@open-mercato/ui/backend/filters/ListEmptyState'
import type { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Badge } from '@open-mercato/ui/primitives/badge'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall, withScopedApiRequestHeaders } from '@open-mercato/ui/backend/utils/apiCall'
import { buildOptimisticLockHeader } from '@open-mercato/ui/backend/utils/optimisticLock'
import { surfaceRecordConflict } from '@open-mercato/ui/backend/conflicts'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import type { FilterDef, FilterValues } from '@open-mercato/ui/backend/FilterBar'
import { QC_REFERENCE_TYPES, QC_TEST_TYPES, QC_RESULTS } from '../../data/validators'

type QcTestRow = {
  id: string
  reference_type: string
  reference_id: string | null
  test_type: string
  result: string
  tested_by: string | null
  tested_at: string | null
  remarks: string | null
  organization_id: string
  tenant_id: string
  created_at: string
  updated_at: string
}

type ResponsePayload = {
  items: QcTestRow[]
  total: number
  page: number
  totalPages: number
}

const RESULT_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  pass: 'secondary',
  fail: 'destructive',
}

type EditableField = 'testedBy' | 'remarks'

const FIELD_TO_COLUMN: Record<EditableField, keyof QcTestRow> = {
  testedBy: 'tested_by',
  remarks: 'remarks',
}

function InlineCell({
  row,
  field,
  onCommit,
}: {
  row: QcTestRow
  field: EditableField
  onCommit: (row: QcTestRow, field: EditableField, value: string) => Promise<void>
}) {
  const columnKey = FIELD_TO_COLUMN[field]
  const initial = row[columnKey]
  const [value, setValue] = React.useState(initial == null ? '' : String(initial))
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    setValue(initial == null ? '' : String(initial))
  }, [initial])

  const commit = React.useCallback(async () => {
    const original = initial == null ? '' : String(initial)
    if (value === original) return
    setSaving(true)
    try {
      await onCommit(row, field, value)
    } finally {
      setSaving(false)
    }
  }, [field, initial, onCommit, row, value])

  return (
    <Input
      value={value}
      disabled={saving}
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          ;(event.target as HTMLInputElement).blur()
        }
        if (event.key === 'Escape') {
          setValue(initial == null ? '' : String(initial))
          ;(event.target as HTMLInputElement).blur()
        }
      }}
      className="h-8 border-transparent bg-transparent px-2 hover:border-input focus:border-input"
    />
  )
}

export default function DermatQcPage() {
  const t = useT()
  const [rows, setRows] = React.useState<QcTestRow[]>([])
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [filters, setFilters] = React.useState<FilterValues>({})
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)
  const scopeVersion = useOrganizationScopeVersion()
  const mutationContextId = 'dermat-qc-tests-list:mutation'
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
        if (filters.referenceType) params.set('referenceType', String(filters.referenceType))
        if (filters.testType) params.set('testType', String(filters.testType))
        if (filters.result) params.set('result', String(filters.result))

        const fallback: ResponsePayload = { items: [], total: 0, page, totalPages: 1 }
        const call = await apiCall<ResponsePayload>(
          `/api/dermat_qc/qc-tests?${params.toString()}`,
          undefined,
          { fallback }
        )

        if (!call.ok) {
          flash(t('dermat_qc.list.error.load', 'Failed to load QC tests'), 'error')
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
          flash(t('dermat_qc.list.error.load', 'Failed to load QC tests'), 'error')
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

  const handleSetResult = React.useCallback(
    async (row: QcTestRow, result: 'pass' | 'fail') => {
      try {
        await runMutation({
          operation: async () => {
            const call = await withScopedApiRequestHeaders(
              buildOptimisticLockHeader(row.updated_at),
              () => apiCall(`/api/dermat_qc/qc-tests`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: row.id, result }),
              }),
            )
            if (!call.ok) {
              throw Object.assign(new Error('[internal] dermat_qc.update_result failed'), {
                status: call.status,
                ...((call.result as Record<string, unknown> | null) ?? {}),
              })
            }
            return call
          },
          context: {
            formId: mutationContextId,
            resourceKind: 'dermat_qc.qc_test',
            resourceId: row.id,
            retryLastMutation,
          },
          mutationPayload: { id: row.id, result },
        })

        flash(
          result === 'pass'
            ? t('dermat_qc.flash.passed', 'Test marked as pass')
            : t('dermat_qc.flash.failed', 'Test marked as fail'),
          'success'
        )
        setReloadToken((tokenValue) => tokenValue + 1)
      } catch (error) {
        if (surfaceRecordConflict(error, t, { onRefresh: () => setReloadToken((tokenValue) => tokenValue + 1) })) return
        flash(t('dermat_qc.flash.updateError', 'Failed to update test result'), 'error')
      }
    },
    [mutationContextId, retryLastMutation, runMutation, t]
  )

  const handleInlineCommit = React.useCallback(
    async (row: QcTestRow, field: EditableField, value: string) => {
      try {
        const payload: Record<string, unknown> = {
          id: row.id,
          result: row.result,
          [field]: value,
        }
        await runMutation({
          operation: async () => {
            const call = await withScopedApiRequestHeaders(
              buildOptimisticLockHeader(row.updated_at),
              () => apiCall(`/api/dermat_qc/qc-tests`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              }),
            )
            if (!call.ok) {
              throw Object.assign(new Error('[internal] dermat_qc.update failed'), {
                status: call.status,
                ...((call.result as Record<string, unknown> | null) ?? {}),
              })
            }
            return call
          },
          context: {
            formId: mutationContextId,
            resourceKind: 'dermat_qc.qc_test',
            resourceId: row.id,
            retryLastMutation,
          },
          mutationPayload: payload,
        })

        setReloadToken((tokenValue) => tokenValue + 1)
      } catch (error) {
        if (surfaceRecordConflict(error, t, { onRefresh: () => setReloadToken((tokenValue) => tokenValue + 1) })) return
        flash(t('dermat_qc.flash.updateError', 'Failed to update test'), 'error')
        setReloadToken((tokenValue) => tokenValue + 1)
      }
    },
    [mutationContextId, retryLastMutation, runMutation, t]
  )

  const columns = React.useMemo<ColumnDef<QcTestRow>[]>(
    () => [
      {
        accessorKey: 'reference_type',
        header: t('dermat_qc.list.columns.reference', 'Reference'),
        cell: ({ row }) => (
          <span>
            {row.original.reference_type}
            {row.original.reference_id ? ` · ${row.original.reference_id.slice(0, 8)}` : ''}
          </span>
        ),
      },
      {
        accessorKey: 'test_type',
        header: t('dermat_qc.list.columns.testType', 'Test type'),
        cell: ({ getValue }) => {
          const value = String(getValue() ?? '')
          return value === 'chemical'
            ? t('dermat_qc.list.testType.chemical', 'Chemical (B)')
            : t('dermat_qc.list.testType.micro', 'Micro (C)')
        },
      },
      {
        accessorKey: 'result',
        header: t('dermat_qc.list.columns.result', 'Result'),
        cell: ({ getValue }) => {
          const value = String(getValue() ?? '')
          return <Badge variant={RESULT_VARIANT[value] ?? 'outline'}>{value}</Badge>
        },
      },
      {
        accessorKey: 'tested_by',
        header: t('dermat_qc.list.columns.testedBy', 'Tested by'),
        cell: ({ row }) => (
          <InlineCell row={row.original} field="testedBy" onCommit={handleInlineCommit} />
        ),
      },
      {
        accessorKey: 'tested_at',
        header: t('dermat_qc.list.columns.testedAt', 'Tested at'),
        cell: ({ getValue }) => {
          const value = getValue()
          return value ? new Date(String(value)).toLocaleString() : '—'
        },
      },
      {
        accessorKey: 'remarks',
        header: t('dermat_qc.list.columns.remarks', 'Remarks'),
        cell: ({ row }) => (
          <InlineCell row={row.original} field="remarks" onCommit={handleInlineCommit} />
        ),
      },
    ],
    [t, handleInlineCommit]
  )

  const filterDefs = React.useMemo<FilterDef[]>(
    () => [
      {
        id: 'referenceType',
        label: t('dermat_qc.list.filters.referenceType', 'Reference type'),
        type: 'select',
        options: [
          { label: t('dermat_qc.list.filters.all', 'All'), value: '' },
          ...QC_REFERENCE_TYPES.map((type) => ({ label: type.replace(/_/g, ' '), value: type })),
        ],
      },
      {
        id: 'testType',
        label: t('dermat_qc.list.filters.testType', 'Test type'),
        type: 'select',
        options: [
          { label: t('dermat_qc.list.filters.all', 'All'), value: '' },
          ...QC_TEST_TYPES.map((type) => ({ label: type, value: type })),
        ],
      },
      {
        id: 'result',
        label: t('dermat_qc.list.filters.result', 'Result'),
        type: 'select',
        options: [
          { label: t('dermat_qc.list.filters.all', 'All'), value: '' },
          ...QC_RESULTS.map((result) => ({ label: result, value: result })),
        ],
      },
    ],
    [t]
  )

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('dermat_qc.list.title', 'QC Tests')}
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
          actions={
            <Button asChild variant="outline">
              <Link href="/backend/dermat_qc/policies">
                {t('dermat_qc.list.actions.policies', 'QC Policies')}
              </Link>
            </Button>
          }
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  id: 'pass',
                  label: t('dermat_qc.list.actions.pass', 'Mark Pass'),
                  onSelect: () => handleSetResult(row, 'pass'),
                },
                {
                  id: 'fail',
                  label: t('dermat_qc.list.actions.fail', 'Mark Fail'),
                  destructive: true,
                  onSelect: () => handleSetResult(row, 'fail'),
                },
              ]}
            />
          )}
          emptyState={(
            <ListEmptyState
              entityName={t('dermat_qc.list.title', 'QC Tests')}
            />
          )}
          pagination={{ page, pageSize: 50, total, totalPages, onPageChange: setPage }}
          isLoading={isLoading}
        />
      </PageBody>
    </Page>
  )
}
