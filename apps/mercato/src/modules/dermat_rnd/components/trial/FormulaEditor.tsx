"use client"

import * as React from 'react'
import { Plus } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { Button } from '@open-mercato/ui/primitives/button'
import { MaterialPicker } from '../../../dermat_boms/components/MaterialPicker'
import { numberText } from '../labels'
import type { FormulaLine } from '../types'
import { FormulaRow } from './FormulaRow'
import { blankLine, lineQuantity, totalsOf } from './formula'

type FormulaEditorProps = {
  lines: FormulaLine[]
  batchSize: number | null
  unit: string
  editable: boolean
  onChange: (lines: FormulaLine[]) => void
}

function FormulaTotals({ lines }: { lines: FormulaLine[] }) {
  const t = useT()
  const totals = totalsOf(lines)
  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-4 border-t px-3 py-2 text-sm tabular-nums', totals.complete ? 'bg-status-success-bg text-status-success-text' : 'bg-status-warning-bg text-status-warning-text')}>
      {totals.balanceCount ? <span>{t('dermat_rnd.formula.balanceIs', 'Balance {value}%', { value: numberText(totals.balance, 4) })}</span> : null}
      <span className="font-semibold">{t('dermat_rnd.formula.total', 'Total {value}%', { value: numberText(totals.total, 4) })}</span>
      {!totals.complete ? <span>{totals.balanceCount > 1 ? t('dermat_rnd.formula.oneBalance', 'Only one balance line') : t('dermat_rnd.formula.must100', 'Must be 100%')}</span> : null}
    </div>
  )
}

function ReadOnlyRows({ lines, batchSize, unit }: { lines: FormulaLine[]; batchSize: number | null; unit: string }) {
  const t = useT()
  const { balance } = totalsOf(lines)
  return (
    <>
      {lines.map((line) => (
        <tr key={line.id} className="border-t">
          <td className="px-3 py-1.5 text-muted-foreground">{line.phase ?? '—'}</td>
          <td className="px-3 py-1.5">
            {line.code ? <span className="mr-2 font-mono text-xs text-muted-foreground">{line.code}</span> : null}
            {line.name}
            {!line.productId ? <span className="ml-2 text-xs text-status-warning-text">{t('dermat_rnd.formula.notLinked', 'not in RM list')}</span> : null}
          </td>
          <td className="px-3 py-1.5 text-muted-foreground">{line.function ?? '—'}</td>
          <td className="px-3 py-1.5 text-right tabular-nums">
            {numberText(line.isBalance ? balance : line.percent, 4)}
            {line.isBalance ? <span className="ml-1 text-xs text-muted-foreground">{t('dermat_rnd.formula.qsShort', 'q.s.')}</span> : null}
          </td>
          <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{numberText(lineQuantity(line, balance, batchSize))} {unit}</td>
        </tr>
      ))}
    </>
  )
}

export function FormulaEditor({ lines, batchSize, unit, editable, onChange }: FormulaEditorProps) {
  const t = useT()
  const { balance } = totalsOf(lines)
  const update = (id: string, next: FormulaLine) => onChange(lines.map((line) => (line.id === id ? next : line)))
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">{t('dermat_rnd.formula.phase', 'Phase')}</th>
              <th className="px-3 py-2 text-left font-semibold">{t('dermat_rnd.formula.material', 'Material')}</th>
              <th className="px-3 py-2 text-left font-semibold">{t('dermat_rnd.formula.function', 'Function')}</th>
              <th className="px-3 py-2 text-right font-semibold">{t('dermat_rnd.formula.percent', '% w/w')}</th>
              {editable ? <th className="px-3 py-2 text-center font-semibold">{t('dermat_rnd.formula.qsShort', 'q.s.')}</th> : null}
              <th className="px-3 py-2 text-right font-semibold">{t('dermat_rnd.formula.qty', 'For this batch')}</th>
              {editable ? <th className="w-10" /> : null}
            </tr>
          </thead>
          <tbody>
            {editable
              ? lines.map((line) => (
                  <FormulaRow key={line.id} line={line} balance={balance} quantity={lineQuantity(line, balance, batchSize)} unit={unit} onChange={(next) => update(line.id, next)} onRemove={() => onChange(lines.filter((entry) => entry.id !== line.id))} />
                ))
              : <ReadOnlyRows lines={lines} batchSize={batchSize} unit={unit} />}
            {!lines.length ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">{t('dermat_rnd.formula.empty', 'No formula lines yet.')}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <FormulaTotals lines={lines} />
      {editable ? (
        <div className="flex flex-wrap gap-2 border-t px-3 py-2">
          <MaterialPicker kinds={['raw_material', 'bulk']} excludeIds={lines.map((line) => line.productId).filter((id): id is string => Boolean(id))} label={t('dermat_rnd.formula.addMaterial', 'Add material')} onSelect={(option) => onChange([...lines, blankLine({ productId: option.id, code: option.code, name: option.title, phase: lines[lines.length - 1]?.phase ?? null })])} />
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...lines, blankLine({ phase: lines[lines.length - 1]?.phase ?? null })])}>
            <Plus className="mr-1.5 size-4" aria-hidden="true" />
            {t('dermat_rnd.formula.addFree', 'Add ingredient not in the list')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
