"use client"

import * as React from 'react'
import type { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy'
import { Plus } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall, withScopedApiRequestHeaders } from '@open-mercato/ui/backend/utils/apiCall'
import { buildOptimisticLockHeader } from '@open-mercato/ui/backend/utils/optimisticLock'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useGranted } from '../../../dermat_departments/components/useGranted'
import type { PackagingCodeView } from '../types'
import { PACKAGING_KIND_LABEL } from './labels'
import { PackagingCodeDialog, type PackagingDraft } from './PackagingCodeDialog'

type ListResponse = { items?: PackagingCodeView[]; total?: number; totalPages?: number }

const PAGE_SIZE = 50

export function PackagingCodesPage() {
  const t = useT()
  const granted = useGranted()
  const canManage = granted.ready && granted.has('dermat_boms.manage')
  const { runMutation } = useGuardedMutation({ contextId: 'dermat-packaging-codes' })
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [rows, setRows] = React.useState<PackagingCodeView[]>([])
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [isLoading, setIsLoading] = React.useState(true)
  const [reload, setReload] = React.useState(0)
  const [dialog, setDialog] = React.useState<{ open: boolean; editing: PackagingCodeView | null }>({ open: false, editing: null })
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (search.trim()) params.set('search', search.trim())
    apiCall<ListResponse>(`/api/dermat_boms/packaging-codes?${params.toString()}`, undefined, { fallback: { items: [] } }).then((call) => {
      if (cancelled) return
      if (!call.ok) flash(t('dermat_boms.packaging.loadError', 'Could not load packaging codes.'), 'error')
      setRows(call.result?.items ?? [])
      setTotal(call.result?.total ?? 0)
      setTotalPages(call.result?.totalPages ?? 1)
      setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [page, search, reload, t])

  const save = async (draft: PackagingDraft) => {
    const editing = dialog.editing
    const body = {
      ...(editing ? { id: editing.id } : {}),
      code: draft.code,
      name: draft.name,
      kind: draft.kind,
      size: draft.size || null,
      specs: draft.specs || null,
      notes: draft.notes || null,
      components: draft.components.filter((part) => part.qty > 0).map((part) => ({ productId: part.productId, qty: part.qty })),
      printedItems: draft.printedItems,
    }
    if (!body.code.trim() || !body.name.trim()) {
      flash(t('dermat_boms.packaging.required', 'Enter the code and the name.'), 'error')
      return
    }
    setBusy(true)
    try {
      const call = await runMutation({
        context: { packagingCodeId: editing?.id ?? null },
        mutationPayload: body,
        operation: () => {
          const request = () =>
            apiCall<{ id?: string; error?: string }>('/api/dermat_boms/packaging-codes', {
              method: editing ? 'PUT' : 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(body),
            })
          return editing ? withScopedApiRequestHeaders(buildOptimisticLockHeader(editing.updatedAt), request) : request()
        },
      })
      if (!call.ok) {
        flash(call.result?.error ?? t('dermat_boms.packaging.saveError', 'Could not save the packaging code.'), 'error')
        return
      }
      flash(t('dermat_boms.packaging.saved', 'Packaging code {code} saved', { code: body.code.toUpperCase() }), 'success')
      setDialog({ open: false, editing: null })
      setReload((value) => value + 1)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    const editing = dialog.editing
    if (!editing) return
    const confirmed = await confirm({ title: t('dermat_boms.packaging.confirmDelete', 'Delete packaging code {code}?', { code: editing.code }), variant: 'destructive' })
    if (!confirmed) return
    setBusy(true)
    try {
      const call = await runMutation({
        context: { packagingCodeId: editing.id, action: 'delete' },
        mutationPayload: { id: editing.id },
        operation: () =>
          withScopedApiRequestHeaders(buildOptimisticLockHeader(editing.updatedAt), () =>
            apiCall<{ error?: string }>(`/api/dermat_boms/packaging-codes?id=${encodeURIComponent(editing.id)}`, { method: 'DELETE' }),
          ),
      })
      if (!call.ok) {
        flash(call.result?.error ?? t('dermat_boms.packaging.deleteError', 'Could not delete the packaging code.'), 'error')
        return
      }
      flash(t('dermat_boms.packaging.deleted', 'Packaging code deleted'), 'success')
      setDialog({ open: false, editing: null })
      setReload((value) => value + 1)
    } finally {
      setBusy(false)
    }
  }

  const columns = React.useMemo<ColumnDef<PackagingCodeView>[]>(
    () => [
      { id: 'code', header: t('dermat_boms.packaging.code', 'Code'), cell: ({ row }) => <span className="font-mono font-semibold text-primary">{row.original.code}</span> },
      { id: 'name', header: t('dermat_boms.packaging.name', 'Name'), cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
      {
        id: 'kind',
        header: t('dermat_boms.packaging.kindLabel', 'Type'),
        cell: ({ row }) => (
          <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs">{t(PACKAGING_KIND_LABEL[row.original.kind].key, PACKAGING_KIND_LABEL[row.original.kind].fallback)}</span>
        ),
      },
      { id: 'size', header: t('dermat_boms.packaging.size', 'Size'), cell: ({ row }) => row.original.size ?? '—' },
      {
        id: 'parts',
        header: t('dermat_boms.packaging.parts', 'Standard parts in the set'),
        cell: ({ row }) =>
          row.original.components.length ? (
            <span className="text-xs">{row.original.components.map((part) => (part.qty === 1 ? part.name : `${part.qty} × ${part.name}`)).join(' + ')}</span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: 'printed',
        header: t('dermat_boms.packaging.printed', 'Made for each product'),
        cell: ({ row }) => <span className="text-xs">{row.original.printedItems.join(', ') || '—'}</span>,
      },
      { id: 'specs', header: t('dermat_boms.packaging.specs', 'Standard specs'), cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.specs ?? '—'}</span> },
    ],
    [t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('dermat_boms.packaging.title', 'Packaging codes')}
          columns={columns}
          data={rows}
          onRowClick={(row) => setDialog({ open: true, editing: row })}
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          searchPlaceholder={t('dermat_boms.packaging.search', 'Search code or name (e.g. CT 11, 50 g jar)')}
          actions={
            canManage ? (
              <Button type="button" onClick={() => setDialog({ open: true, editing: null })}>
                <Plus className="mr-2 size-4" aria-hidden="true" />
                {t('dermat_boms.packaging.new', 'New packaging code')}
              </Button>
            ) : undefined
          }
          pagination={{ page, pageSize: PAGE_SIZE, total, totalPages, onPageChange: setPage }}
          isLoading={isLoading}
        />
        <PackagingCodeDialog
          open={dialog.open}
          editing={dialog.editing}
          busy={busy}
          canDelete={canManage}
          onClose={() => setDialog({ open: false, editing: null })}
          onSave={(draft) => void save(draft)}
          onDelete={() => void remove()}
        />
        {ConfirmDialogElement}
      </PageBody>
    </Page>
  )
}

export default PackagingCodesPage
