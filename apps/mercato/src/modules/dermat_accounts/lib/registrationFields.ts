import { isValidPhoneNumber } from '@open-mercato/shared/lib/phone'
import { GSTIN_PATTERN } from './gstStates'

export type RegistrationField = { key: string; label: string; kind?: 'text' | 'email' | 'tel' | 'address'; required?: boolean; group: string }

export const REGISTRATION_GROUPS = ['Company', 'Purchase contact', 'Partner contact', 'Billing and shipping', 'Tax', 'Dispatch'] as const

export const REGISTRATION_FIELDS: RegistrationField[] = [
  { key: 'customer_name', label: 'Customer name', required: true, group: 'Company' },
  { key: 'country', label: 'Country', group: 'Company' },
  { key: 'correspondence_address', label: 'Correspondence address', kind: 'address', required: true, group: 'Company' },
  { key: 'purchase_name', label: 'Purchase contact name', required: true, group: 'Purchase contact' },
  { key: 'purchase_phone', label: 'Purchase contact phone', kind: 'tel', required: true, group: 'Purchase contact' },
  { key: 'purchase_email', label: 'Purchase contact email', kind: 'email', group: 'Purchase contact' },
  { key: 'partner_name', label: 'Partner name', group: 'Partner contact' },
  { key: 'partner_phone', label: 'Partner phone', kind: 'tel', group: 'Partner contact' },
  { key: 'partner_email', label: 'Partner email', kind: 'email', group: 'Partner contact' },
  { key: 'billing_address', label: 'Billing address', kind: 'address', required: true, group: 'Billing and shipping' },
  { key: 'bill_to', label: 'Bill to (name on the invoice)', group: 'Billing and shipping' },
  { key: 'ship_to', label: 'Ship to (name and delivery address)', kind: 'address', group: 'Billing and shipping' },
  { key: 'gst_no', label: 'GST no.', group: 'Tax' },
  { key: 'pan_no', label: 'PAN no.', group: 'Tax' },
  { key: 'vat_no', label: 'VAT no. (outside India)', group: 'Tax' },
  { key: 'transporter', label: 'Transporter name / delivery type', group: 'Dispatch' },
  { key: 'insurance_policy_no', label: 'Undertaking / insurance policy no.', group: 'Dispatch' },
  { key: 'dispatch_instruction_1', label: 'Special dispatch instruction 1', kind: 'address', group: 'Dispatch' },
  { key: 'dispatch_instruction_2', label: 'Special dispatch instruction 2', kind: 'address', group: 'Dispatch' },
]

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
  const india = !answers.country?.trim() || answers.country.trim().toLowerCase() === 'india'
  if (india && !gst && !answers.pan_no?.trim()) problems.push('Give the GST no. or the PAN no.')
  if (!india && !gst && !answers.pan_no?.trim() && !answers.vat_no?.trim()) problems.push('Give the PAN or VAT no.')
  for (const key of ['purchase_email', 'partner_email']) if (answers[key]?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers[key].trim())) problems.push(`${REGISTRATION_FIELDS.find((field) => field.key === key)?.label} is not a valid email`)
  for (const key of ['purchase_phone', 'partner_phone']) {
    const phone = normalizePhone(answers[key], answers.country)
    if (phone && !isValidPhoneNumber(phone)) problems.push(`${REGISTRATION_FIELDS.find((field) => field.key === key)?.label}: add the country code, e.g. +91 98200 00000`)
  }
  return problems
}
