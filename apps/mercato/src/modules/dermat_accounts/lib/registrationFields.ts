import { isValidPhoneNumber } from '@open-mercato/shared/lib/phone'
import { GSTIN_PATTERN } from './gstStates'

export type RegistrationOptions = { askCountry: boolean }

export type RegistrationField = { key: string; label: string; kind?: 'text' | 'email' | 'tel' | 'address'; required?: boolean; group: string; onlyWhen?: keyof RegistrationOptions }

export const REGISTRATION_GROUPS = [
  'Customer name',
  'Country',
  'Address (correspondence)',
  'Contact person / Phone no. / Mail ID: Purchase',
  'Contact person / Phone no. / Mail ID: Partners (if any)',
  'Billing address',
  'PAN / VAT no. · GST no.',
  'Bill to',
  'Ship to',
  'Transporter name (delivery type)',
  'Undertaking / Insurance policy no.',
  'Any special instruction for dispatch',
] as const

export const REGISTRATION_FIELDS: RegistrationField[] = [
  { key: 'customer_name', label: 'Customer name', required: true, group: 'Customer name' },
  { key: 'country', label: 'Country', group: 'Country', onlyWhen: 'askCountry' },
  { key: 'correspondence_address', label: 'Address (correspondence)', kind: 'address', group: 'Address (correspondence)' },
  { key: 'purchase_name', label: 'Contact person', group: 'Contact person / Phone no. / Mail ID: Purchase' },
  { key: 'purchase_phone', label: 'Phone no.', kind: 'tel', group: 'Contact person / Phone no. / Mail ID: Purchase' },
  { key: 'purchase_email', label: 'Mail ID', kind: 'email', group: 'Contact person / Phone no. / Mail ID: Purchase' },
  { key: 'partner_name', label: 'Contact person', group: 'Contact person / Phone no. / Mail ID: Partners (if any)' },
  { key: 'partner_phone', label: 'Phone no.', kind: 'tel', group: 'Contact person / Phone no. / Mail ID: Partners (if any)' },
  { key: 'partner_email', label: 'Mail ID', kind: 'email', group: 'Contact person / Phone no. / Mail ID: Partners (if any)' },
  { key: 'billing_address', label: 'Billing address', kind: 'address', group: 'Billing address' },
  { key: 'pan_no', label: 'PAN / VAT no.', group: 'PAN / VAT no. · GST no.' },
  { key: 'gst_no', label: 'GST no.', group: 'PAN / VAT no. · GST no.' },
  { key: 'bill_to', label: 'Bill to', group: 'Bill to' },
  { key: 'ship_to', label: 'Ship to', group: 'Ship to' },
  { key: 'transporter', label: 'Transporter name (delivery type)', group: 'Transporter name (delivery type)' },
  { key: 'insurance_policy_no', label: 'Undertaking / Insurance policy no.', group: 'Undertaking / Insurance policy no.' },
  { key: 'dispatch_instruction_1', label: '1', group: 'Any special instruction for dispatch' },
  { key: 'dispatch_instruction_2', label: '2', group: 'Any special instruction for dispatch' },
]

export function visibleRegistrationFields(options: RegistrationOptions): RegistrationField[] {
  return REGISTRATION_FIELDS.filter((field) => !field.onlyWhen || options[field.onlyWhen])
}

const COUNTRY_CODES: Record<string, string> = { india: '91', nepal: '977', bangladesh: '880', 'sri lanka': '94', bhutan: '975', uae: '971', 'united arab emirates': '971' }

export function normalizePhone(value: string | undefined, country?: string): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed || trimmed.startsWith('+')) return trimmed
  const code = COUNTRY_CODES[(country?.trim() || 'India').toLowerCase()]
  if (!code) return trimmed
  const digits = trimmed.replace(/[^0-9]/g, '').replace(/^0+/, '')
  return digits.startsWith(code) && digits.length > 10 ? `+${digits}` : `+${code} ${digits}`
}

export function registrationProblems(answers: Record<string, string>): string[] {
  const problems: string[] = []
  for (const field of REGISTRATION_FIELDS) if (field.required && !answers[field.key]?.trim()) problems.push(`${field.label} is needed`)
  const gst = answers.gst_no?.trim().toUpperCase()
  if (gst && !GSTIN_PATTERN.test(gst)) problems.push('GST no. should look like 27AAACT1234A1Z5')
  for (const key of ['purchase_email', 'partner_email']) if (answers[key]?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers[key].trim())) problems.push(`Mail ID ${answers[key].trim()} is not a valid email`)
  for (const key of ['purchase_phone', 'partner_phone']) {
    const phone = normalizePhone(answers[key], answers.country)
    if (phone && !isValidPhoneNumber(phone)) problems.push(`Phone no. ${answers[key].trim()} is not a valid mobile number`)
  }
  return problems
}
