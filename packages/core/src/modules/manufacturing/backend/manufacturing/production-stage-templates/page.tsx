"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy'
import type { SortingState } from '@tanstack/react-table'
import { Page, PageBody, PageHeader } from '@wantace/ui/backend/Page'
import { DataTable } from '@wantace/ui/backend/DataTable'
import { RowActions } from '@wantace/ui/backend/RowActions'
import { Button } from '@wantace/ui/primitives/button'
import { StatusBadge } from '@wantace/ui/primitives/status-badge'
import { apiCallOrThrow } from '@wantace/ui/backend/utils/apiCall'
import { useGuardedMutation } from '@wantace/ui/backend/injection/useGuardedMutation'
import { flash } from '@wantace/ui/backend/FlashMessages'
import { useT } from '@wantace/shared/lib/i18n/context'
import { useConfirmDialog } from '@wantace/ui/backend/confirm-dialog'
import { Plus } from 'lucide-react'

type StageTemplateRow = {
  id: string; name: string; code: string; sequence_number: number;
  is_active: boolean; estimated_setup_minutes: string; estimated_run_minutes: string;
  requires_quality_check: boolean; created_at: string
}
type PagedResponse<T> = { items: T[]; total: number; totalPages: number }

export default function StageTemplatesListPage() {
  const t = useT()
  const router = useRouter()
  const { confirm } = useConfirmDialog()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'sequenceNumber', desc: false }])
  const queryKey = React.useMemo(() => ['mfg-stage-templates', page, search, sorting], [page, search, sorting])

  const fetchData = React.useCallback(async () => {
    const sortField = sorting[0]?.id || 'sequenceNumber'
    const sortDir = sorting[0]?.desc ? 'desc' : 'asc'
    const params = new URLSearchParams({ page: String(page), pageSize: '25', sortField, sortDir, ...(search ? { search } : {}) })
    return await apiCallOrThrow(`/api/manufacturing/production-stage-templates?${params}`) as PagedResponse<StageTemplateRow>
  }, [page, search, sorting])

  const { runMutation: deleteItem } = useGuardedMutation({
    mutationFn: async (id: string) => { await apiCallOrThrow(`/api/manufacturing/production-stage-templates`, { method: 'DELETE', body: JSON.stringify({ id }) }) },
  })

  const columns = React.useMemo<ColumnDef<StageTemplateRow>[]>(() => [
    {
      id: 'sequenceNumber', header: '#', accessorKey: 'sequence_number',
      cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.sequence_number}</span>,
    },
    {
      id: 'name', header: t('manufacturing.stageTemplates.fields.name', 'Stage Name'), accessorKey: 'name',
      cell: ({ row }) => (
        <Link href={`/backend/manufacturing/production-stage-templates/${row.original.id}`} className="font-medium text-primary hover:underline">
          {row.original.name}
        </Link>
      ),
    },
    { id: 'code', header: t('manufacturing.stageTemplates.fields.code', 'Code'), accessorKey: 'code' },
    {
      id: 'isActive', header: t('manufacturing.stageTemplates.fields.active', 'Active'), accessorKey: 'is_active',
      cell: ({ row }) => (
        <StatusBadge variant={row.original.is_active ? 'success' : 'neutral'}>
          {row.original.is_active ? t('common.yes', 'Yes') : t('common.no', 'No')}
        </StatusBadge>
      ),
    },
    {
      id: 'setupTime', header: t('manufacturing.stageTemplates.fields.setupTime', 'Setup (min)'),
      accessorKey: 'estimated_setup_minutes',
      cell: ({ row }) => <span className="tabular-nums">{row.original.estimated_setup_minutes}</span>,
    },
    {
      id: 'runTime', header: t('manufacturing.stageTemplates.fields.runTime', 'Run (min)'),
      accessorKey: 'estimated_run_minutes',
      cell: ({ row }) => <span className="tabular-nums">{row.original.estimated_run_minutes}</span>,
    },
    {
      id: 'qcRequired', header: t('manufacturing.stageTemplates.fields.qc', 'QC'),
      accessorKey: 'requires_quality_check',
      cell: ({ row }) => row.original.requires_quality_check ? '✓' : '—',
    },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <RowActions id={`mfg.stage-templates.${row.original.id}`} items={[
          { label: t('common.edit', 'Edit'), onClick: () => router.push(`/backend/manufacturing/production-stage-templates/${row.original.id}`) },
          {
            label: t('common.delete', 'Delete'), variant: 'destructive' as const,
            onClick: async () => {
              if (await confirm({ title: t('manufacturing.stageTemplates.deleteConfirm', 'Delete this stage template?') })) {
                await deleteItem(row.original.id)
                flash.success(t('common.deleted', 'Deleted'))
              }
            },
          },
        ]} />
      ),
    },
  ], [t, router, confirm, deleteItem])

  return (
    <Page>
      <PageHeader title={t('manufacturing.stageTemplates.title', 'Production Stage Templates')}
        description={t('manufacturing.stageTemplates.description', 'Configure the production pipeline stages for your organization. These stages are automatically applied to new production orders.')}
      >
        <Link href="/backend/manufacturing/production-stage-templates/create">
          <Button size="sm"><Plus className="mr-1 h-4 w-4" />{t('manufacturing.stageTemplates.create', 'New Template')}</Button>
        </Link>
      </PageHeader>
      <PageBody>
        <DataTable
          tableId="mfg.stage-templates.list"
          columns={columns} queryKey={queryKey} queryFn={fetchData}
          page={page} onPageChange={setPage}
          search={search} onSearchChange={setSearch}
          sorting={sorting} onSortingChange={setSorting}
          onRowClick={(row) => router.push(`/backend/manufacturing/production-stage-templates/${row.id}`)}
        />
      </PageBody>
    </Page>
  )
}
