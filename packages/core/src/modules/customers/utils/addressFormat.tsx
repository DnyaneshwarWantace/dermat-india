import * as React from 'react'
import type { CustomerAddressFormat } from '../data/entities'

export type AddressFormatStrategy = CustomerAddressFormat

export type AddressValue = {
  addressLine1: string | null | undefined
  addressLine2?: string | null
  companyName?: string | null
  buildingNumber?: string | null
  flatNumber?: string | null
  city?: string | null
  region?: string | null
  postalCode?: string | null
  country?: string | null
  latitude?: number | null
  longitude?: number | null
}

export type AddressJsonShape = {
  format: AddressFormatStrategy
  addressLine1: string | null
  addressLine2: string | null
  postalCode: string | null
  city: string | null
  region: string | null
  country: string | null
}

function normalize(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

export function formatAddressJson(address: AddressValue, format: AddressFormatStrategy): AddressJsonShape {
  return {
    format,
    addressLine1: normalize(address.addressLine1),
    addressLine2: normalize(address.addressLine2),
    postalCode: normalize(address.postalCode),
    city: normalize(address.city),
    region: normalize(address.region),
    country: normalize(address.country),
  }
}

export function formatAddressLines(address: AddressValue, format: AddressFormatStrategy): string[] {
  const json = formatAddressJson(address, format)
  const lines: string[] = []

  if (format === 'street_first') {
    if (json.addressLine1) lines.push(json.addressLine1)
    const supplemental = normalize(address.addressLine2)
    if (supplemental) lines.push(supplemental)
    const postalCity = [json.postalCode, json.city].filter(Boolean).join(' ')
    if (postalCity.length) lines.push(postalCity)
    if (json.region) lines.push(json.region)
    if (json.country) lines.push(json.country)
  } else {
    if (json.addressLine1) lines.push(json.addressLine1)
    if (json.addressLine2) lines.push(json.addressLine2)
    const postalCity = [json.postalCode, json.city].filter(Boolean).join(' ')
    if (postalCity.length) lines.push(postalCity)
    if (json.region) lines.push(json.region)
    if (json.country) lines.push(json.country)
  }

  return lines
}

export function formatAddressString(address: AddressValue, format: AddressFormatStrategy, separator = ', '): string {
  return formatAddressLines(address, format).filter(Boolean).join(separator)
}

type AddressViewProps = {
  address: AddressValue
  format: AddressFormatStrategy
  className?: string
  lineClassName?: string
}

export function AddressView({ address, format, className, lineClassName }: AddressViewProps): React.ReactElement | null {
  const lines = formatAddressLines(address, format)
  if (!lines.length) return null
  return (
    <div className={className}>
      {lines.map((line, index) => (
        <div key={`${index}-${line}`} className={lineClassName}>
          {line}
        </div>
      ))}
    </div>
  )
}
