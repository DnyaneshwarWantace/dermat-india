"use client"

import * as React from 'react'
import Link from 'next/link'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { KIND_CONFIG } from '../../../dermat_products/lib/kindConfig'
import type { ProductKind } from '../../../dermat_products/lib/kinds'
import { MaterialPicker, formatQty } from '../MaterialPicker'
import type { ComponentOption } from '../types'

export type BomDetailsProduct = { id: string; title: string; kind: string | null; code: string | null }

type BomDetailsCardProps = {
  editable: boolean
  productLocked: boolean
  name: string
  product: BomDetailsProduct | null
  batchSize: string
  batchUnit: string
  yieldPercent: string
  readyToProduce: number | null
  madeBy: string | null
  approvedBy: string | null
  onName: (value: string) => void
  onBatchSize: (value: string) => void
  onYield: (value: string) => void
  onPickProduct: (option: ComponentOption) => void
}

function Item({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="grid min-w-0 grid-cols-1 items-center gap-1 sm:grid-cols-5 sm:gap-3">
      <Label htmlFor={htmlFor} className="text-sm font-normal text-muted-foreground sm:col-span-2">
        {label}
      </Label>
      <div className="min-w-0 text-sm sm:col-span-3">{children}</div>
    </div>
  )
}

export function BomDetailsCard(props: BomDetailsCardProps) {
  const t = useT()
  const { editable, productLocked, product } = props
  const kindLabel = product?.kind ? KIND_CONFIG[product.kind as ProductKind]?.singular ?? product.kind : null
  const output = Number(props.batchSize) * (Number(props.yieldPercent) || 0) / 100

  return (
    <section aria-label={t('dermat_boms.details.title', 'BOM details')} className="rounded-lg border border-status-info-border bg-status-info-bg">
      <div className="grid grid-cols-1 gap-x-10 gap-y-3 p-5 lg:grid-cols-2">
        <Item label={t('dermat_boms.details.name', 'BOM Name')} htmlFor="bom-name">
          {editable ? (
            <Input
              id="bom-name"
              className="bg-background"
              value={props.name}
              placeholder={t('dermat_boms.details.namePlaceholder', 'e.g. Vitamin C serum 30 ml')}
              onChange={(event) => props.onName(event.target.value)}
            />
          ) : (
            <span className="font-medium">{props.name || '—'}</span>
          )}
        </Item>

        <Item label={t('dermat_boms.details.product', 'Finished Good')}>
          {editable && !productLocked ? (
            <MaterialPicker
              variant="field"
              kinds={['bulk', 'rnd', 'finished_goods']}
              onSelect={props.onPickProduct}
              label={product ? `${product.code ? `${product.code} · ` : ''}${product.title}` : t('dermat_boms.details.pickProduct', 'Search product by name or code')}
            />
          ) : product ? (
            <Link href={`/backend/products/${product.id}`} className="block truncate font-medium text-primary hover:underline">
              {product.code ? <span className="mr-1 font-mono text-xs">{product.code}</span> : null}
              {product.title}
            </Link>
          ) : (
            '—'
          )}
          {kindLabel ? <span className="mt-1 inline-flex rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{kindLabel}</span> : null}
        </Item>

        <Item label={t('dermat_boms.details.quantity', 'Quantity ({unit})', { unit: props.batchUnit })} htmlFor="bom-quantity">
          {editable ? (
            <Input
              id="bom-quantity"
              type="number"
              min={0}
              step="any"
              className="bg-background font-mono"
              value={props.batchSize}
              onChange={(event) => props.onBatchSize(event.target.value)}
            />
          ) : (
            <span className="font-mono">
              {formatQty(Number(props.batchSize))} {props.batchUnit}
            </span>
          )}
        </Item>

        <Item label={t('dermat_boms.details.yield', 'Default Yield %')} htmlFor="bom-yield">
          {editable ? (
            <Input
              id="bom-yield"
              type="number"
              min={0}
              max={100}
              step="any"
              className="bg-background font-mono"
              value={props.yieldPercent}
              onChange={(event) => props.onYield(event.target.value)}
            />
          ) : (
            <span className="font-mono">{formatQty(Number(props.yieldPercent), 2)} %</span>
          )}
        </Item>

        <Item label={t('dermat_boms.details.output', 'Expected Output')}>
          <span className="font-mono">
            {Number.isFinite(output) ? formatQty(output) : '—'} {props.batchUnit}
          </span>
        </Item>

        <Item label={t('dermat_boms.details.ready', 'Ready to Produce')}>
          {props.readyToProduce == null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span className={props.readyToProduce >= Number(props.batchSize) ? 'font-mono text-status-success-text' : 'font-mono text-status-error-text'}>
              {formatQty(props.readyToProduce)} {props.batchUnit}
            </span>
          )}
        </Item>

        <Item label={t('dermat_boms.details.madeBy', 'Made By')}>{props.madeBy ?? '—'}</Item>
        <Item label={t('dermat_boms.details.approvedBy', 'Issued By')}>{props.approvedBy ?? '—'}</Item>
      </div>
    </section>
  )
}

export default BomDetailsCard
