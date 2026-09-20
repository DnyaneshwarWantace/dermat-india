'use client'

import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { ListEmptyState } from '@open-mercato/ui/backend/filters/ListEmptyState'
import type { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Checkbox } from '@open-mercato/ui/primitives/checkbox'
import { Plus } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall, withScopedApiRequestHeaders } from '@open-mercato/ui/backend/utils/apiCall'
import { buildOptimisticLockHeader } from '@open-mercato/ui/backend/utils/optimisticLock'
import { surfaceRecordConflict } from '@open-mercato/ui/backend/conflicts'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useOrganizationScopeVersion, useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'

type QcPolicyRow = {
  id: string
  applies_to: string
  chemical_required: boolean
  micro_required: boolean
  organization_id: string
  tenant_id: string
  created_at: string
  updated_at: string
}

type ResponsePayload = {
  items: QcPolicyRow[]
  total: number
  page: number
  totalPages: number
}

function InlineTextCell({
  value,
  onCommit,
}: {
  value: string
  onCommit: (value: string) => Promise<void>
}) {
  const [text, setText] = React.useState(value)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    setText(value)
  }, [value])

  const commit = React.useCallback(async () => {
    if (text === value) return
    setSaving(true)
    try {
      await onCommit(text)
    } finally {
      setSaving(false)
    }
  }, [onCommit, text, value])

  return (
    <Input
      value={text}
      disabled={saving}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          ;(event.target as HTMLInputElement).blur()
        }
        if (event.key === 'Escape') {
          setText(value)
          ;(event.target as HTMLInputElement).blur()
        }
      }}
      className="h-8 border-transparent bg-transparent px-2 hover:border-input focus:border-input"
    />
  )
}

export default function DermatQcPoliciesPage() {
  const t = useT()
  const { confirm: confirmDialog, ConfirmDialogElement } = useConfirmDialog()
  const { organizationId, tenantId } = useOrganizationScopeDetail()
  const [rows, setRows] = React.useState<QcPolicyRow[]>([])
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)
  const [creating, setCreating] = React.useState(false)
  const scopeVersion = useOrganizationScopeVersion()
  const mutationContextId = 'dermat-qc-policies-list:mutation'
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
        if (search) params.set('search', search)

        const fallback: ResponsePayload = { items: [], total: 0, page, totalPages: 1 }
        const call = await apiCall<ResponsePayload>(
          `/api/dermat_qc/qc-policies?${params.toString()}`,
          undefined,
          { fallback }
        )

        if (!call.ok) {
          flash(t('dermat_qc.policies.list.error.load', 'Failed to load QC policies'), 'error')
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
          flash(t('dermat_qc.policies.list.error.load', 'Failed to load QC policies'), 'error')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [page, search, reloadToken, scopeVersion, t])

  const handleInlineUpdate = React.useCallback(
    async (row: QcPolicyRow, payload: Record<string, unknown>) => {
      try {
        await runMutation({
          operation: async () => {
            const call = await withScopedApiRequestHeaders(
              buildOptimisticLockHeader(row.updated_at),
              () => apiCall(`/api/dermat_qc/qc-policies`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: row.id, ...payload }),
              }),
            )
            if (!call.ok) {
              throw Object.assign(new Error('[internal] dermat_qc.qc_policies.update failed'), {
                status: call.status,
                ...((call.result as Record<string, unknown> | null) ?? {}),
              })
            }
            return call
          },
          context: {
            formId: mutationContextId,
            resourceKind: 'dermat_qc.qc_policy',
            resourceId: row.id,
            retryLastMutation,
          },
          mutationPayload: { id: row.id, ...payload },
        })

        setReloadToken((tokenValue) => tokenValue + 1)
      } catch (error) {
        if (surfaceRecordConflict(error, t, { onRefresh: () => setReloadToken((tokenValue) => tokenValue + 1) })) return
        flash(t('dermat_qc.policies.flash.updateError', 'Failed to update QC policy'), 'error')
        setReloadToken((tokenValue) => tokenValue + 1)
      }
    },
    [mutationContextId, retryLastMutation, runMutation, t]
  )

  const handleDelete = React.useCallback(
    async (row: QcPolicyRow) => {
      const confirmed = await confirmDialog({
        title: t('dermat_qc.policies.list.confirmDelete', 'Delete policy for {name}?', { name: row.applies_to }),
        variant: 'destructive',
      })
      if (!confirmed) return

      try {
        await runMutation({
          operation: async () => {
            const call = await withScopedApiRequestHeaders(
              buildOptimisticLockHeader(row.updated_at),
              () => apiCall(`/api/dermat_qc/qc-policies`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: row.id, organizationId: row.organization_id, tenantId: row.tenant_id }),
              }),
            )
            if (!call.ok) {
              throw Object.assign(new Error('[internal] dermat_qc.qc_policies.delete failed'), {
                status: call.status,
                ...((call.result as Record<string, unknown> | null) ?? {}),
              })
            }
            return call
          },
          context: {
            formId: mutationContextId,
            resourceKind: 'dermat_qc.qc_policy',
            resourceId: row.id,
            retryLastMutation,
          },
          mutationPayload: { id: row.id },
        })

        flash(t('dermat_qc.policies.flash.deleted', 'QC policy deleted'), 'success')
        setReloadToken((tokenValue) => tokenValue + 1)
      } catch (error) {
        if (surfaceRecordConflict(error, t, { onRefresh: () => setReloadToken((tokenValue) => tokenValue + 1) })) return
        flash(t('dermat_qc.policies.flash.deleteError', 'Failed to delete QC policy'), 'error')
      }
    },
    [t, confirmDialog, mutationContextId, retryLastMutation, runMutation]
  )

  const handleAddPolicy = React.useCallback(async () => {
    setCreating(true)
    try {
      await createCrud('dermat_qc/qc-policies', {
        organizationId,
        tenantId,
        appliesTo: t('dermat_qc.policies.newRowDefault', 'New material or product'),
        chemicalRequired: true,
        microRequired: true,
      })
      flash(t('dermat_qc.policies.flash.created', 'QC policy created'), 'success')
      setReloadToken((tokenValue) => tokenValue + 1)
    } catch (error) {
      flash(t('dermat_qc.policies.flash.createError', 'Failed to create QC policy'), 'error')
    } finally {
      setCreating(false)
    }
  }, [organizationId, t, tenantId])

  const columns = React.useMemo<ColumnDef<QcPolicyRow>[]>(
    () => [
      {
        accessorKey: 'applies_to',
        header: t('dermat_qc.policies.list.columns.appliesTo', 'Material / Product'),
        cell: ({ row }) => (
          <InlineTextCell
            value={row.original.applies_to}
            onCommit={(value) => handleInlineUpdate(row.original, { appliesTo: value })}
          />
        ),
      },
      {
        accessorKey: 'chemical_required',
        header: t('dermat_qc.policies.list.columns.chemicalRequired', 'Chemical (B) required'),
        enableSorting: false,
        cell: ({ row }) => (
          <Checkbox
            checked={row.original.chemical_required}
            onCheckedChange={(checked) => handleInlineUpdate(row.original, { chemicalRequired: checked === true })}
          />
        ),
      },
      {
        accessorKey: 'micro_required',
        header: t('dermat_qc.policies.list.columns.microRequired', 'Micro (C) required'),
        enableSorting: false,
        cell: ({ row }) => (
          <Checkbox
            checked={row.original.micro_required}
            onCheckedChange={(checked) => handleInlineUpdate(row.original, { microRequired: checked === true })}
          />
        ),
      },
    ],
    [handleInlineUpdate, t]
  )

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('dermat_qc.policies.list.title', 'QC Policies')}
          columns={columns}
          data={rows}
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          searchPlaceholder={t('dermat_qc.policies.list.searchPlaceholder', 'Search materials or products')}
          actions={
            <Button type="button" disabled={creating} onClick={handleAddPolicy}>
              <Plus className="mr-2 h-4 w-4" />
              {t('dermat_qc.policies.list.actions.add', 'New policy')}
            </Button>
          }
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  id: 'delete',
                  label: t('common.delete', 'Delete'),
                  destructive: true,
                  onSelect: () => handleDelete(row),
                },
              ]}
            />
          )}
          emptyState={(
            <ListEmptyState
              entityName={t('dermat_qc.policies.list.title', 'QC Policies')}
            />
          )}
          pagination={{ page, pageSize: 50, total, totalPages, onPageChange: setPage }}
          isLoading={isLoading}
        />
      </PageBody>
      {ConfirmDialogElement}
    </Page>
  )
}
