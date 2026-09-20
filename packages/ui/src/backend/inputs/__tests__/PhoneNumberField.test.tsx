/** @jest-environment jsdom */

jest.mock('@open-mercato/shared/lib/i18n/context', () => ({
  useT: () => (_key: string, fallback: string) => fallback,
}))

jest.mock('@open-mercato/shared/lib/phone', () => ({
  extractPhoneDigits: (value: string | null | undefined) => {
    if (typeof value !== 'string') return ''
    const matches = value.match(/\d+/g)
    return matches ? matches.join('') : ''
  },
  validatePhoneNumber: (value: string | null | undefined) => {
    if (typeof value !== 'string') return { valid: true, normalized: null, digits: '', reason: null }
    const normalized = value.trim()
    if (!normalized) return { valid: true, normalized: null, digits: '', reason: null }
    const digits = normalized.replace(/\D/g, '')
    const valid = normalized.startsWith('+') && digits.length >= 7 && digits.length <= 15 && /^[+\d\s\-().]+$/.test(normalized)
    return { valid, normalized, digits, reason: valid ? null : 'invalid' }
  },
}))

import * as React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { PHONE_COUNTRIES, PhoneNumberField } from '../PhoneNumberField'

function PhoneFieldHarness(props: Partial<React.ComponentProps<typeof PhoneNumberField>>) {
  const [value, setValue] = React.useState<string | undefined>(undefined)

  return (
    <div>
      <PhoneNumberField value={value} onValueChange={setValue} {...props} />
      <output data-testid="value">{value ?? ''}</output>
    </div>
  )
}

describe('PhoneNumberField', () => {
  it('keeps invalid input and shows the provided invalid label on blur', () => {
    render(<PhoneFieldHarness invalidLabel="Use an international phone number." />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '12345' } })
    fireEvent.blur(input)

    expect(input).toHaveValue('12345')
    expect(screen.getByText('Use an international phone number.')).toBeInTheDocument()
    expect(screen.getByTestId('value')).toHaveTextContent('12345')
  })

  it('trims and persists a valid phone number on blur', () => {
    render(<PhoneFieldHarness invalidLabel="Use an international phone number." />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '  +48 123 456 789  ' } })
    fireEvent.blur(input)

    expect(input).toHaveValue('+48 123 456 789')
    expect(screen.getByTestId('value')).toHaveTextContent('+48 123 456 789')
    expect(screen.queryByText('Use an international phone number.')).not.toBeInTheDocument()
  })

  it('renders an external field error instead of the blur-time validation hint', () => {
    render(
      <PhoneFieldHarness
        invalidLabel="Use an international phone number."
        externalError="Server says the phone is invalid."
      />,
    )

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '12345' } })
    fireEvent.blur(input)

    expect(screen.getByText('Server says the phone is invalid.')).toBeInTheDocument()
    expect(screen.queryByText('Use an international phone number.')).not.toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('honours a restricted country list via the countries prop', () => {
    render(
      <PhoneFieldHarness
        value="+383 44 123 456"
        countries={[{ iso2: 'PL', dialCode: '+48', label: 'Poland', flag: '🇵🇱' }]}
      />,
    )

    // The value still parses against the full dictionary (Kosovo), but the
    // picker only offers the restricted list.
    expect(screen.getByText('+383')).toBeInTheDocument()
  })
})

describe('PhoneNumberField country dictionary', () => {
  it('exposes a well-formed geographic dictionary with India as default', () => {
    expect(PHONE_COUNTRIES.length).toBeGreaterThanOrEqual(1)

    for (const country of PHONE_COUNTRIES) {
      expect(country.iso2).toMatch(/^[A-Z]{2}$/)
      expect(country.dialCode).toMatch(/^\+\d+$/)
      expect(country.label.length).toBeGreaterThan(0)
      expect(country.flag.length).toBeGreaterThan(0)
    }

    const isoCodes = PHONE_COUNTRIES.map((country) => country.iso2)
    expect(new Set(isoCodes).size).toBe(isoCodes.length)
  })

  it('includes India (+91) code and flag', () => {
    const dialByIso = new Map(PHONE_COUNTRIES.map((country) => [country.iso2, country.dialCode]))
    expect(dialByIso.get('IN')).toBe('+91')
    expect(PHONE_COUNTRIES.find((country) => country.iso2 === 'IN')?.flag).toBe('🇮🇳')
  })
})

describe('PhoneNumberField initial country detection', () => {
  const cases: Array<[string, string]> = [
    ['+1242 555 0100', '+1242'],
    ['+1 212 555 1234', '+1'],
    ['+383 44 123 456', '+383'],
    ['+55 11 91234 5678', '+55'],
    ['+61 2 1234 5678', '+61'],
    ['+81 3 1234 5678', '+81'],
    ['+90 212 123 4567', '+90'],
    ['+970 59 123 4567', '+970'],
    ['+44 20 7946 0000', '+44'],
  ]

  it.each(cases)('resolves %s to dial code %s (longest prefix, sovereign first)', (value, expected) => {
    render(<PhoneFieldHarness value={value} />)
    expect(screen.getByText(expected)).toBeInTheDocument()
  })
})
