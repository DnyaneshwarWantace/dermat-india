"use client"

import * as React from 'react'
import { Trash2 } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { IconButton } from '@open-mercato/ui/primitives/icon-button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@open-mercato/ui/primitives/select'
import { FormDialog } from '../../../dermat_rnd/components/shared/FormDialog'
import { Field } from '../../../dermat_rnd/components/shared/Field'
import { useListOptions } from '../../../dermat_lists/components/useListOptions'
import { MaterialPicker, formatQty } from '../MaterialPicker'
import type { PackagingCodeView, PackagingPart } from '../types'
import { DEFAULT_PRINTED, PACKAGING_KIND_LABEL } from './labels'

export type PackagingDraft = {
  code: string
  name: string
  kind: PackagingCodeView['kind']
  size: string
  specs: string
  notes: string
  components: PackagingPart[]
  printedItems: string[]
}

export function draftFrom(code: PackagingCodeView | null): PackagingDraft {
  if (!code) return { code: '', name: '', kind: 'tube', size: '', specs: '', notes: '', components: [], printedItems: DEFAULT_PRINTED.tube }
  return {
    code: code.code,
    name: code.name,
    kind: code.kind,
    size: code.size ?? '',
    specs: code.specs ?? '',
    notes: code.notes ?? '',
    components: code.components,
    printedItems: code.printedItems,
  }
}

type PackagingCodeDialogProps = {
  open: boolean
  editing: PackagingCodeView | null
  busy: boolean
  canDelete: boolean
  onClose: () => void
  onSave: (draft: PackagingDraft) => void
  onDelete: () => void
}

const KINDS: PackagingCodeView['kind'][] = ['tube', 'jar', 'bottle', 'other']

export function PackagingCodeDialog({ open, editing, busy, canDelete, onClose, onSave, onDelete }: PackagingCodeDialogProps) {
  const t = useT()
  const [draft, setDraft] = React.useState<PackagingDraft>(() => draftFrom(editing))
  const itemTypes = useListOptions('packing_item_types')

  React.useEffect(() => {
    if (open) setDraft(draftFrom(editing))
  }, [open, editing])

  const patch = (next: Partial<PackagingDraft>) => setDraft((current) => ({ ...current, ...next }))
  const togglePrinted = (item: string) =>
    patch({ printedItems: draft.printedItems.includes(item) ? draft.printedItems.filter((entry) => entry !== item) : [...draft.printedItems, item] })

  return (
    <FormDialog
      open={open}
      size="lg"
      title={editing ? t('dermat_boms.packaging.edit', 'Packaging code {code}', { code: editing.code }) : t('dermat_boms.packaging.new', 'New packaging code')}
      description={t('dermat_boms.packaging.dialogHint', 'A code is a set: the standard parts every product with this code uses (bottle, cap, dropper…), plus the printed items made for each product (tube, label, carton).')}
      submitLabel={busy ? t('dermat_boms.saving', 'Saving…') : t('dermat_boms.save', 'Save')}
      busy={busy}
      onClose={onClose}
      onSubmit={() => onSave(draft)}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
        <Field id="pc-code" label={t('dermat_boms.packaging.code', 'Code')} className="sm:col-span-2">
          <Input id="pc-code" value={draft.code} placeholder="CT 11" className="font-mono" onChange={(event) => patch({ code: event.target.value })} />
        </Field>
        <Field id="pc-name" label={t('dermat_boms.packaging.name', 'Name')} className="sm:col-span-4">
          <Input id="pc-name" value={draft.name} placeholder={t('dermat_boms.packaging.namePlaceholder', 'e.g. 50 g heavy bottom jar with cap')} onChange={(event) => patch({ name: event.target.value })} />
        </Field>
        <Field id="pc-kind" label={t('dermat_boms.packaging.kindLabel', 'Type')} className="sm:col-span-2">
          <Select value={draft.kind} onValueChange={(value) => patch({ kind: value as PackagingCodeView['kind'], printedItems: editing ? draft.printedItems : DEFAULT_PRINTED[value as PackagingCodeView['kind']] })}>
            <SelectTrigger id="pc-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KINDS.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {t(PACKAGING_KIND_LABEL[kind].key, PACKAGING_KIND_LABEL[kind].fallback)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="pc-size" label={t('dermat_boms.packaging.size', 'Size')} className="sm:col-span-2">
          <Input id="pc-size" value={draft.size} placeholder="50 g" onChange={(event) => patch({ size: event.target.value })} />
        </Field>
        <Field id="pc-specs" label={t('dermat_boms.packaging.specs', 'Standard specs')} className="sm:col-span-6" hint={t('dermat_boms.packaging.specsHint', 'Fixed for the code, e.g. Ø 19 mm × 85 mm, screw cap, frosted.')}>
          <Textarea id="pc-specs" rows={2} value={draft.specs} onChange={(event) => patch({ specs: event.target.value })} />
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{t('dermat_boms.packaging.parts', 'Standard parts in the set')}</h3>
        <p className="text-xs text-muted-foreground">{t('dermat_boms.packaging.partsHint', 'Stock items shared by every product with this code. Quantity is per finished piece.')}</p>
        {draft.components.length ? (
          <ul className="flex flex-col divide-y rounded-md border">
            {draft.components.map((part) => (
              <li key={part.productId} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-24 shrink-0 truncate font-mono text-xs text-muted-foreground">{part.code ?? '—'}</span>
                <span className="min-w-0 flex-1 truncate">{part.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{t('dermat_boms.packaging.onHand', '{qty} on hand', { qty: formatQty(part.onHand) })}</span>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  aria-label={t('dermat_boms.packaging.qty', 'Qty per piece')}
                  className="h-8 w-20 text-right font-mono"
                  value={String(part.qty)}
                  onChange={(event) => patch({ components: draft.components.map((entry) => (entry.productId === part.productId ? { ...entry, qty: Number(event.target.value) || 0 } : entry)) })}
                />
                <IconButton type="button" variant="ghost" size="sm" aria-label={t('dermat_boms.table.remove', 'Remove line')} onClick={() => patch({ components: draft.components.filter((entry) => entry.productId !== part.productId) })}>
                  <Trash2 className="size-4" aria-hidden="true" />
                </IconButton>
              </li>
            ))}
          </ul>
        ) : null}
        <div>
          <MaterialPicker
            kinds={['packing_material']}
            excludeIds={draft.components.map((part) => part.productId)}
            label={t('dermat_boms.packaging.addPart', 'Add part (bottle, cap, pump, dropper…)')}
            onSelect={(option) =>
              patch({ components: [...draft.components, { productId: option.id, qty: 1, name: option.title, code: option.code, kind: option.kind, unit: option.unit, onHand: option.onHand }] })
            }
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{t('dermat_boms.packaging.printed', 'Made for each product')}</h3>
        <p className="text-xs text-muted-foreground">{t('dermat_boms.packaging.printedHint', 'Printed items created per product, named "<item> - <product>". Tubes come printed; jars and bottles get a label; untick Carton if there is no box.')}</p>
        <div className="flex flex-wrap gap-2">
          {Array.from(new Set([...itemTypes, ...draft.printedItems])).map((item) => (
            <Button key={item} type="button" size="sm" variant={draft.printedItems.includes(item) ? 'default' : 'outline'} aria-pressed={draft.printedItems.includes(item)} onClick={() => togglePrinted(item)}>
              {item}
            </Button>
          ))}
        </div>
      </div>

      <Field id="pc-notes" label={t('dermat_boms.notes', 'Notes')}>
        <Textarea id="pc-notes" rows={2} value={draft.notes} onChange={(event) => patch({ notes: event.target.value })} />
      </Field>

      {editing && canDelete ? (
        <div>
          <Button type="button" variant="destructive-ghost" size="sm" disabled={busy} onClick={onDelete}>
            <Trash2 className="mr-1.5 size-4" aria-hidden="true" />
            {t('dermat_boms.packaging.delete', 'Delete this code')}
          </Button>
        </div>
      ) : null}
    </FormDialog>
  )
}

export default PackagingCodeDialog
