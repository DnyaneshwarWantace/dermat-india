"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { Button } from '@open-mercato/ui/primitives/button'
import { addDays, dayText, todayIst } from '../labels'
import type { Reading, Stability } from '../types'

type StabilityMatrixProps = { study: Stability; editable: boolean; onCell: (condition: string, day: number, reading: Reading | null) => void }

function ReadingCell({ reading, due, overdue }: { reading: Reading | null; due: string | null; overdue: boolean }) {
  const t = useT()
  if (reading) {
    const ph = Object.entries(reading.values).find(([key]) => key.toLowerCase() === 'ph')?.[1]
    return (
      <span className="flex flex-col items-start gap-0.5">
        <span className={cn('font-semibold', reading.result === 'pass' ? 'text-status-success-text' : 'text-status-error-text')}>{reading.result === 'pass' ? t('dermat_rnd.pass', 'Pass') : t('dermat_rnd.fail', 'Fail')}</span>
        <span className="text-muted-foreground">{[ph ? `pH ${ph}` : null, dayText(reading.date)].filter(Boolean).join(' · ')}</span>
      </span>
    )
  }
  return <span className={cn('text-muted-foreground', overdue && 'font-semibold text-status-warning-text')}>{due ? t('dermat_rnd.stability.due', 'Due {date}', { date: dayText(due) }) : '—'}</span>
}

export function StabilityMatrix({ study, editable, onCell }: StabilityMatrixProps) {
  const t = useT()
  const today = todayIst()
  const readingFor = (condition: string, day: number) => study.readings.find((entry) => entry.condition === condition && entry.day === day) ?? null
  return (
    <div className="overflow-x-auto rounded-lg border bg-card" data-drag-scroll>
      <table className="w-full text-xs">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">{t('dermat_rnd.stability.checkpoint', 'Checkpoint')}</th>
            {study.conditions.map((condition) => (
              <th key={condition} className="px-3 py-2 text-left font-semibold">
                {condition}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {study.checkpoints.map((day) => {
            const due = study.startDate ? addDays(study.startDate, day) : null
            return (
              <tr key={day} className="border-t">
                <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                  {day === 0 ? t('dermat_rnd.stability.initial', 'Initial (day 0)') : t('dermat_rnd.stability.day', 'Day {day}', { day })}
                </th>
                {study.conditions.map((condition) => {
                  const reading = readingFor(condition, day)
                  const overdue = !reading && Boolean(due && due < today)
                  return (
                    <td key={condition} className="p-1">
                      {editable ? (
                        <Button type="button" variant="ghost" className="h-auto w-full justify-start px-2 py-1.5 text-left text-xs font-normal" onClick={() => onCell(condition, day, reading)}>
                          <ReadingCell reading={reading} due={due} overdue={overdue} />
                        </Button>
                      ) : (
                        <span className="block px-2 py-1.5">
                          <ReadingCell reading={reading} due={due} overdue={overdue} />
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
