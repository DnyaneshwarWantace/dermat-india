import { randomBytes } from 'node:crypto'
import type { EntityManager } from '@mikro-orm/postgresql'
import { resolveNotificationService } from '@open-mercato/core/modules/notifications/lib/notificationService'
import { createLogger } from '@open-mercato/shared/lib/logger'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { setRecordCustomFields } from '@open-mercato/core/modules/entities/lib/helpers'
import { addressCreateSchema, companyCreateSchema, contactCreateSchema } from '@open-mercato/core/modules/customers/data/validators'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { ensureCustomerNumber } from '../../dermat_customers/lib/customerNumber'
import { CustomerRegistration } from '../data/entities'
import { stateFromGstin } from './gstStates'
import { loadCustomers, type OrderContext } from '../../dermat_orders/lib/server'
import { AccountsError } from './service'
import { normalizePhone, registrationProblems, visibleRegistrationFields, type RegistrationOptions } from './registrationFields'
import { CompanyProfile } from '../data/entities'

const logger = createLogger('dermat_accounts')
const MIN_FILL_MS = 4000

export function registrationView(row: CustomerRegistration, customerName: string | null = null) {
  return {
    id: row.id,
    path: `/register/${row.token}`,
    customerId: row.customerId ?? null,
    customerName,
    status: row.status,
    answers: row.answers ?? {},
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    ip: row.ip ?? null,
    decidedByName: row.decidedByName ?? null,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    note: row.note ?? null,
    createdByName: row.createdByName ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function createRegistration(ctx: OrderContext, customerId: string | null, byName: string | null) {
  if (customerId && !(await loadCustomers(ctx, [customerId])).get(customerId)) throw new AccountsError('Customer not found', 404)
  const row = ctx.em.create(CustomerRegistration, {
    organizationId: ctx.organizationId,
    tenantId: ctx.tenantId,
    token: randomBytes(18).toString('base64url'),
    customerId,
    createdByName: byName,
  })
  ctx.em.persist(row)
  await ctx.em.flush()
  return row
}

export async function listRegistrations(ctx: OrderContext, status?: CustomerRegistration['status']) {
  const rows = await ctx.em.find(CustomerRegistration, { tenantId: ctx.tenantId, organizationId: ctx.organizationId, ...(status ? { status } : {}) }, { orderBy: { createdAt: 'desc' }, limit: 200 })
  const customers = await loadCustomers(ctx, rows.map((row) => row.customerId).filter((id): id is string => Boolean(id)))
  return rows.map((row) => registrationView(row, row.customerId ? customers.get(row.customerId)?.name ?? null : null))
}

export async function findRegistration(ctx: OrderContext, id: string) {
  const row = await ctx.em.findOne(CustomerRegistration, { id, tenantId: ctx.tenantId, organizationId: ctx.organizationId })
  if (!row) throw new AccountsError('Registration not found', 404)
  return row
}

function extraFields(answers: Record<string, string>): Record<string, string | null> {
  const instructions = [answers.dispatch_instruction_1, answers.dispatch_instruction_2].filter(Boolean).join('\n')
  return {
    pan_no: answers.pan_no || null,
    vat_no: answers.vat_no || null,
    transporter: answers.transporter || null,
    insurance_policy_no: answers.insurance_policy_no || null,
    dispatch_instructions: instructions || null,
  }
}

async function setUpCustomer(ctx: OrderContext, req: Request, answers: Record<string, string>, target: string): Promise<string> {
  const scope = { tenantId: ctx.tenantId, organizationId: ctx.organizationId }
  const organizationScope = await resolveOrganizationScopeForRequest({ container: ctx.container, auth: ctx.auth, request: req })
  const commandCtx: CommandRuntimeContext = {
    container: ctx.container,
    auth: ctx.auth,
    organizationScope,
    selectedOrganizationId: ctx.organizationId,
    organizationIds: organizationScope?.filterIds ?? [ctx.organizationId],
    request: req,
  }
  const commandBus = ctx.container.resolve('commandBus') as CommandBus
  let customerId = target
  if (target === 'new') {
    const input = companyCreateSchema.parse({ ...scope, displayName: answers.customer_name, primaryEmail: answers.purchase_email || undefined, primaryPhone: answers.purchase_phone || undefined })
    const customFields = {
      customer_type_category: 'business',
      legal_trade_name: answers.bill_to || answers.customer_name,
      gst_registration_type: answers.gst_no ? 'registered' : !answers.country || answers.country.toLowerCase() === 'india' ? 'unregistered' : 'overseas',
      gstin: answers.gst_no || null,
      payment_terms: 'due_on_delivery',
      default_currency: 'INR',
      ...extraFields(answers),
    }
    const { result } = await commandBus.execute<Record<string, unknown>, { entityId?: string; id?: string }>('customers.companies.create', { input: { ...input, customFields }, ctx: commandCtx })
    const created = result?.entityId ?? result?.id
    if (!created) throw new AccountsError('The customer could not be created', 500)
    customerId = created
  } else {
    if (!(await loadCustomers(ctx, [target])).get(target)) throw new AccountsError('Customer not found', 404)
    const [profile] = await ctx.em.getConnection().execute<Array<{ id: string }>>('select id from customer_companies where entity_id = ? and tenant_id = ? and organization_id = ? limit 1', [target, ctx.tenantId, ctx.organizationId])
    if (profile) {
      const values: Record<string, string> = {}
      for (const [key, value] of Object.entries(extraFields(answers))) if (value) values[key] = value
      if (answers.gst_no) values.gstin = answers.gst_no
      await setRecordCustomFields(ctx.em, { entityId: 'customers:customer_company_profile', recordId: profile.id, ...scope, values })
    }
  }
  const region = stateFromGstin(answers.gst_no)?.name
  const country = answers.country || 'India'
  const address = (purpose: string, name: string, line: string, isPrimary: boolean) =>
    commandBus.execute('customers.addresses.create', { input: addressCreateSchema.parse({ ...scope, entityId: customerId, purpose, name, addressLine1: line.slice(0, 300), region, country, isPrimary }), ctx: commandCtx })
  if (answers.billing_address) await address('billing', answers.bill_to || 'Billing', answers.billing_address, target === 'new')
  if (answers.ship_to && answers.ship_to !== answers.billing_address) await address('shipping', 'Shipping', answers.ship_to, false)
  if (answers.correspondence_address && answers.correspondence_address !== answers.billing_address) await address('correspondence', 'Correspondence', answers.correspondence_address, false)
  const contact = (name: string, phone?: string, email?: string) =>
    commandBus.execute('customers.contacts.create', { input: contactCreateSchema.parse({ ...scope, entityId: customerId, name, phone: phone || undefined, email: email || undefined }), ctx: commandCtx })
  if (answers.purchase_name || answers.purchase_phone || answers.purchase_email) await contact(answers.purchase_name || answers.purchase_email || answers.purchase_phone || 'Purchase', answers.purchase_phone, answers.purchase_email)
  if (answers.partner_name || answers.partner_phone || answers.partner_email) await contact(answers.partner_name || answers.partner_email || answers.partner_phone || 'Partner', answers.partner_phone, answers.partner_email)
  await ensureCustomerNumber(ctx.em, scope, customerId)
  return customerId
}

export async function decideRegistration(ctx: OrderContext, req: Request, row: CustomerRegistration, input: { decision: 'approve' | 'reject'; target?: string | null; note?: string | null }, byName: string | null) {
  if (row.status !== 'submitted') throw new AccountsError(row.status === 'open' ? 'The customer has not filled the form yet' : 'Already decided', 409)
  if (input.decision === 'reject' && !input.note?.trim()) throw new AccountsError('Write why it is rejected', 400)
  if (input.decision === 'approve') row.customerId = await setUpCustomer(ctx, req, row.answers ?? {}, input.target || row.customerId || 'new')
  row.status = input.decision === 'approve' ? 'approved' : 'rejected'
  row.note = input.note?.trim() || null
  row.decidedByName = byName
  row.decidedAt = new Date()
  await ctx.em.flush()
}

export async function registrationByToken(em: EntityManager, token: string) {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) throw new AccountsError('This link is not valid', 404)
  const row = await em.findOne(CustomerRegistration, { token })
  if (!row) throw new AccountsError('This link is not valid', 404)
  return row
}

export async function registrationOptions(em: EntityManager, scope: { tenantId: string; organizationId: string }): Promise<RegistrationOptions> {
  const profile = await em.findOne(CompanyProfile, { tenantId: scope.tenantId, organizationId: scope.organizationId })
  return { askCountry: Boolean(profile?.formOptions?.askCountry) }
}

export async function publicRegistration(em: EntityManager, row: CustomerRegistration) {
  const scope = { em, tenantId: row.tenantId, organizationId: row.organizationId } as unknown as OrderContext
  const customer = row.customerId ? (await loadCustomers(scope, [row.customerId])).get(row.customerId) : null
  return { status: row.status === 'open' ? 'open' : 'submitted', customerName: customer?.name ?? null, submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null, options: await registrationOptions(em, row) }
}

export async function submitRegistration(em: EntityManager, container: unknown, row: CustomerRegistration, input: { answers: Record<string, string>; website?: string; startedAt: number }, ip: string | null) {
  if (row.status !== 'open') throw new AccountsError('This form is already filled. Thank you!', 409)
  if (input.website?.trim() || Date.now() - input.startedAt < MIN_FILL_MS) throw new AccountsError('Please fill the form again', 400)
  const answers: Record<string, string> = {}
  for (const field of visibleRegistrationFields(await registrationOptions(em, row))) {
    const value = input.answers[field.key]?.trim()
    if (value) answers[field.key] = value.slice(0, field.kind === 'address' ? 600 : 200)
  }
  if (answers.gst_no) answers.gst_no = answers.gst_no.toUpperCase()
  if (answers.pan_no) answers.pan_no = answers.pan_no.toUpperCase()
  for (const key of ['purchase_phone', 'partner_phone']) if (answers[key]) answers[key] = normalizePhone(answers[key], answers.country) as string
  const problems = registrationProblems(answers)
  if (problems.length) throw new AccountsError(problems.join('. '), 400)
  row.answers = answers
  row.status = 'submitted'
  row.submittedAt = new Date()
  row.ip = ip
  await em.flush()
  try {
    await resolveNotificationService(container as { resolve: (name: string) => unknown }).createForFeature(
      {
        type: 'dermat_accounts.registration.submitted',
        requiredFeature: 'dermat_accounts.view',
        title: `${answers.customer_name} filled the registration form`,
        body: [answers.purchase_name, answers.purchase_phone, answers.gst_no ?? answers.pan_no ?? answers.vat_no].filter(Boolean).join(' · '),
        severity: 'info',
        sourceModule: 'dermat_accounts',
        sourceEntityType: 'dermat_accounts:registration',
        sourceEntityId: row.id,
        linkHref: '/backend/accounts/registrations',
        groupKey: `dermat_accounts:registration:${row.id}`,
      },
      { tenantId: row.tenantId, organizationId: row.organizationId },
    )
  } catch (error) {
    logger.error('Failed to send the registration notification', { err: error })
  }
}
