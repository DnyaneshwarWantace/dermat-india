"use client"

import * as React from 'react'
import { Input } from '@open-mercato/ui/primitives/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@open-mercato/ui/primitives/select'
import { useAddressTypes } from './detail/hooks/useAddressTypes'

type Translator = (key: string, fallback?: string, params?: Record<string, string | number>) => string

const INDIA_COUNTRY_CODE = 'IN'

export type AddressEditorDraft = {
  name: string
  purpose: string
  addressLine1: string
  addressLine2: string
  city: string
  region: string
  postalCode: string
  country: string
  isPrimary: boolean
}

export type AddressEditorField =
  | 'name'
  | 'purpose'
  | 'addressLine1'
  | 'addressLine2'
  | 'city'
  | 'region'
  | 'postalCode'
  | 'isPrimary'

type AddressEditorProps = {
  value: AddressEditorDraft
  onChange: (next: AddressEditorDraft) => void
  t: Translator
  disabled?: boolean
  errors?: Partial<Record<AddressEditorField, string>>
  hidePrimaryToggle?: boolean
}

export function AddressEditor({
  value,
  onChange,
  t,
  disabled = false,
  errors = {},
  hidePrimaryToggle = false,
}: AddressEditorProps) {
  const { options: addressTypes, loading: addressTypesLoading, error: addressTypeError } = useAddressTypes(t)

  const current: AddressEditorDraft = {
    name: value.name ?? '',
    purpose: value.purpose ?? '',
    addressLine1: value.addressLine1 ?? '',
    addressLine2: value.addressLine2 ?? '',
    city: value.city ?? '',
    region: value.region ?? '',
    postalCode: value.postalCode ?? '',
    country: INDIA_COUNTRY_CODE,
    isPrimary: value.isPrimary ?? false,
  }

  const update = React.useCallback(
    (key: keyof AddressEditorDraft, nextValue: string | boolean) => {
      onChange({ ...current, [key]: nextValue })
    },
    [current, onChange],
  )

  const inputClass = (field: AddressEditorField) =>
    [
      'w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
      errors[field] ? 'border-status-error-border focus:ring-status-error-border' : 'border-input bg-background',
    ].join(' ')

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          className={inputClass('name')}
          placeholder={t('customers.people.detail.addresses.fields.label', 'Label')}
          value={current.name}
          onChange={(evt) => update('name', evt.target.value)}
          disabled={disabled}
          aria-invalid={errors.name ? 'true' : undefined}
        />
        <Select
          value={current.purpose || undefined}
          onValueChange={(next) => update('purpose', next ?? '')}
          disabled={disabled}
        >
          <SelectTrigger
            className={errors.purpose ? 'border-destructive' : undefined}
            aria-invalid={errors.purpose ? 'true' : undefined}
          >
            <SelectValue
              placeholder={
                addressTypesLoading
                  ? t('customers.people.detail.addresses.types.loading', 'Loading…')
                  : t('customers.people.detail.addresses.types.placeholder', 'Address type')
              }
            />
          </SelectTrigger>
          <SelectContent>
            {addressTypes.map((entry) => (
              <SelectItem key={entry.value} value={entry.value}>
                {entry.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {errors.purpose ? <p className="text-xs text-destructive">{errors.purpose}</p> : null}
      {addressTypeError ? <p className="text-xs text-destructive">{addressTypeError}</p> : null}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input
          className={inputClass('addressLine1')}
          placeholder={t('customers.people.detail.addresses.fields.line1', 'Address line 1')}
          value={current.addressLine1}
          onChange={(evt) => update('addressLine1', evt.target.value)}
          disabled={disabled}
          aria-invalid={errors.addressLine1 ? 'true' : undefined}
        />
        {errors.addressLine1 ? <p className="text-xs text-destructive sm:col-span-2">{errors.addressLine1}</p> : null}
        <Input
          className={inputClass('addressLine2')}
          placeholder={t('customers.people.detail.addresses.fields.line2', 'Address line 2')}
          value={current.addressLine2}
          onChange={(evt) => update('addressLine2', evt.target.value)}
          disabled={disabled}
          aria-invalid={errors.addressLine2 ? 'true' : undefined}
        />
        {errors.addressLine2 ? <p className="text-xs text-destructive sm:col-span-2">{errors.addressLine2}</p> : null}
        <Input
          className={inputClass('city')}
          placeholder={t('customers.people.detail.addresses.fields.city', 'City')}
          value={current.city}
          onChange={(evt) => update('city', evt.target.value)}
          disabled={disabled}
          aria-invalid={errors.city ? 'true' : undefined}
        />
        {errors.city ? <p className="text-xs text-destructive">{errors.city}</p> : null}
        <Input
          className={inputClass('region')}
          placeholder={t('customers.people.detail.addresses.fields.region', 'State')}
          value={current.region}
          onChange={(evt) => update('region', evt.target.value)}
          disabled={disabled}
          aria-invalid={errors.region ? 'true' : undefined}
        />
        {errors.region ? <p className="text-xs text-destructive">{errors.region}</p> : null}
        <Input
          className={inputClass('postalCode')}
          placeholder={t('customers.people.detail.addresses.fields.postalCode', 'PIN code')}
          value={current.postalCode}
          onChange={(evt) => update('postalCode', evt.target.value)}
          disabled={disabled}
          aria-invalid={errors.postalCode ? 'true' : undefined}
        />
        {errors.postalCode ? <p className="text-xs text-destructive">{errors.postalCode}</p> : null}
      </div>
      {!hidePrimaryToggle ? (
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={current.isPrimary}
            onChange={(evt) => update('isPrimary', evt.target.checked)}
            disabled={disabled}
            aria-invalid={errors.isPrimary ? 'true' : undefined}
          />
          <span>{t('customers.people.detail.addresses.fields.primary', 'Set as primary')}</span>
        </label>
      ) : null}
      {errors.isPrimary ? <p className="text-xs text-destructive">{errors.isPrimary}</p> : null}
    </div>
  )
}
