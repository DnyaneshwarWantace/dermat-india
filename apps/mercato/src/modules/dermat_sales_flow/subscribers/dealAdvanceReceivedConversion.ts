import type { EntityManager } from '@mikro-orm/postgresql'
import type { AwilixContainer } from 'awilix'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { findEntityIdsBySearchTokens } from '@open-mercato/shared/lib/search/tokenLookup'
import { tryResolve } from '../lib/tryResolve'

// System-actor placeholder id, matching the convention used elsewhere in this repo for
// trusted server-side command invocations that have no real authenticated user (e.g.
// `packages/core/src/modules/warranty_claims/subscribers/return-shipment-tracking.ts`).
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000'

export const metadata = {
  event: 'customers.deal.updated',
  persistent: true,
  id: 'dermat_sales_flow:deal-advance-received-conversion',
}

// Dermat India's Lead Pipeline and its terminal "Advance Received" stage, plus the
// Customer/Order Pipeline's entry stage. These ids are specific to this tenant's seeded
// pipelines (set up via the pipelines/pipeline-stages API), not a generic framework concept,
// which is why this lookup lives in an app-level module rather than inside `customers` itself.
const LEAD_PIPELINE_ID = 'ce3469a5-d420-4dea-850b-c6a17a31b457'
const ADVANCE_RECEIVED_STAGE_ID = '5301ea23-3476-4a78-a205-fdfc267e2965'
const ORDER_PIPELINE_ID = '1793978c-6b4d-4b6b-a0bd-7f4639bf1423'
const ORDER_PIPELINE_ENTRY_STAGE_ID = '0fc6a203-a8d3-4bee-b3ae-b559bb1dff49'

type DealUpdatedPayload = {
  id?: string
  organizationId?: string
  tenantId?: string
}

type SubscriberContext = {
  resolve: <T = unknown>(name: string) => T
}

type DealSnapshot = {
  id: string
  title: string
  pipelineId: string | null
  pipelineStageId: string | null
  organizationId: string
  tenantId: string
  updatedAt: Date
}

function buildSystemCommandContext(
  resolve: SubscriberContext['resolve'],
  tenantId: string,
  organizationId: string,
): CommandRuntimeContext {
  return {
    container: { resolve } as unknown as AwilixContainer,
    auth: { sub: SYSTEM_USER_ID, tenantId, orgId: organizationId },
    organizationScope: null,
    selectedOrganizationId: organizationId,
    organizationIds: [organizationId],
    systemActor: true,
  }
}

/**
 * Reacts to a deal moving into the Lead Pipeline's "Advance Received" stage: this is the
 * business event Dermat India treats as "the lead is now a real, paying customer." It:
 *   1. Links the deal to an existing Company (matched by phone/email) if one exists, or
 *      creates a bare new Company from the deal's title if the deal has no linked
 *      company/person yet.
 *   2. Moves the deal out of the Lead Pipeline into the Customer/Order Pipeline's entry
 *      stage, so repeat business for the same customer never re-enters the Lead Pipeline.
 *
 * This module never imports `customers`' entities directly (cross-module ORM relations are
 * banned in this repo) — company/person lookups use the same raw-SQL-against-the-owning-
 * module's-table idiom the `customers` module itself uses for its junction tables, and every
 * write goes through the `customers` module's own commands via the command bus.
 */
export default async function handle(payload: DealUpdatedPayload, ctx: SubscriberContext): Promise<void> {
  const dealId = payload.id
  const organizationId = payload.organizationId
  const tenantId = payload.tenantId
  if (!dealId || !organizationId || !tenantId) return

  const em = ctx.resolve<EntityManager>('em').fork()

  const dealRows = await em.getConnection().execute<Array<{
    id: string
    title: string
    pipeline_id: string | null
    pipeline_stage_id: string | null
    organization_id: string
    tenant_id: string
    updated_at: Date
  }>>(
    `select id, title, pipeline_id, pipeline_stage_id, organization_id, tenant_id, updated_at
     from customer_deals
     where id = ? and organization_id = ? and tenant_id = ? and deleted_at is null`,
    [dealId, organizationId, tenantId],
  )
  const dealRow = dealRows[0]
  if (!dealRow) return

  const deal: DealSnapshot = {
    id: dealRow.id,
    title: dealRow.title,
    pipelineId: dealRow.pipeline_id,
    pipelineStageId: dealRow.pipeline_stage_id,
    organizationId: dealRow.organization_id,
    tenantId: dealRow.tenant_id,
    updatedAt: dealRow.updated_at,
  }

  // Only act on deals sitting in the Lead Pipeline's "Advance Received" stage. A deal
  // already in the Customer/Order Pipeline (or any other stage) is left alone.
  if (deal.pipelineId !== LEAD_PIPELINE_ID || deal.pipelineStageId !== ADVANCE_RECEIVED_STAGE_ID) return

  const commandBus = tryResolve<CommandBus>((name) => ctx.resolve(name), 'commandBus')
  if (!commandBus) return

  const linkRows = await em.getConnection().execute<Array<{ company_entity_id: string }>>(
    `select company_entity_id from customer_deal_companies where deal_id = ?`,
    [deal.id],
  )
  const hasLinkedCompany = linkRows.length > 0

  const personLinkRows = await em.getConnection().execute<Array<{ person_entity_id: string }>>(
    `select person_entity_id from customer_deal_people where deal_id = ?`,
    [deal.id],
  )
  const hasLinkedPerson = personLinkRows.length > 0

  if (!hasLinkedCompany && !hasLinkedPerson) {
    // Bare lead: nothing to match against, so try a name match on the deal title first
    // (covers the case where the same prospect re-enters as a second bare lead), then fall
    // back to creating a brand-new Company using the deal title as its display name.
    const db = em.getKysely?.() as Parameters<typeof findEntityIdsBySearchTokens>[0]['db'] | undefined
    let matchedCompanyEntityId: string | null = null

    if (db) {
      const nameMatch = await findEntityIdsBySearchTokens({
        db,
        entityType: 'customers.customer_entity',
        query: deal.title,
        fields: ['display_name'],
        scope: { tenantId: deal.tenantId, organizationId: deal.organizationId },
      })
      if (nameMatch.matched && nameMatch.ids.length === 1) {
        matchedCompanyEntityId = nameMatch.ids[0] ?? null
      }
    }

    let companyEntityId = matchedCompanyEntityId
    if (!companyEntityId) {
      const created = await commandBus.execute<
        { organizationId: string; tenantId: string; displayName: string },
        { entityId: string; companyId: string }
      >(
        'customers.companies.create',
        {
          input: {
            organizationId: deal.organizationId,
            tenantId: deal.tenantId,
            displayName: deal.title,
          },
          ctx: buildSystemCommandContext(ctx.resolve, deal.tenantId, deal.organizationId),
        },
      )
      companyEntityId = created.result?.entityId ?? null
    }

    if (companyEntityId) {
      await commandBus.execute<{ id: string; companyIds: string[] }, { dealId: string }>(
        'customers.deals.update',
        {
          input: { id: deal.id, companyIds: [companyEntityId] },
          ctx: buildSystemCommandContext(ctx.resolve, deal.tenantId, deal.organizationId),
        },
      )
    }
  }

  await commandBus.execute<{ id: string; pipelineId: string; pipelineStageId: string }, { dealId: string }>(
    'customers.deals.update',
    {
      input: {
        id: deal.id,
        pipelineId: ORDER_PIPELINE_ID,
        pipelineStageId: ORDER_PIPELINE_ENTRY_STAGE_ID,
      },
      ctx: buildSystemCommandContext(ctx.resolve, deal.tenantId, deal.organizationId),
    },
  )
}
