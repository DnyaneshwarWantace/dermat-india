import type { EntityManager } from '@mikro-orm/postgresql'
import type { ResponseEnricher, EnricherContext } from '@open-mercato/shared/lib/crud/response-enricher'
import { CustomerDeal, CustomerPipelineStage, CustomerDictionaryEntry } from '@open-mercato/core/modules/customers/data/entities'

type SalesOrderRecord = Record<string, unknown> & { id: string; cf_source_deal_id?: string | null }

type DealStageEnrichment = {
  _dermat_sales_flow: {
    dealStage: { id: string; label: string; color: string | null } | null
  }
}

function forkEnricherEntityManager(context: EnricherContext): EntityManager {
  return (context.em as EntityManager).fork()
}

/**
 * Reads across `customers.deal`/`customers.customer_pipeline_stages` to surface the
 * originating Deal's current pipeline stage on the Sales Order row it produced —
 * cross-module read, so `cacheableOnListHit` stays at the fail-closed default.
 */
const orderDealStageEnricher: ResponseEnricher<SalesOrderRecord, DealStageEnrichment> = {
  id: 'dermat_sales_flow.order-deal-stage',
  targetEntity: 'sales:sales_order',
  priority: 10,
  timeout: 2000,
  cacheableOnListHit: false,
  fallback: { _dermat_sales_flow: { dealStage: null } },

  async enrichOne(record, context) {
    const [enriched] = await orderDealStageEnricher.enrichMany!([record], context)
    return enriched
  },

  async enrichMany(records, context) {
    const em = forkEnricherEntityManager(context)
    const dealIds = Array.from(
      new Set(
        records
          .map((record) => record.cf_source_deal_id)
          .filter((value): value is string => typeof value === 'string' && value.length > 0),
      ),
    )
    if (dealIds.length === 0) {
      return records.map((record) => ({ ...record, _dermat_sales_flow: { dealStage: null } }))
    }

    const deals = await em.find(CustomerDeal, {
      id: { $in: dealIds },
      organizationId: context.organizationId,
      tenantId: context.tenantId,
      deletedAt: null,
    })
    const pipelineStageIdByDealId = new Map<string, string>()
    for (const deal of deals) {
      if (deal.pipelineStageId) pipelineStageIdByDealId.set(deal.id, deal.pipelineStageId)
    }

    const stageIds = Array.from(new Set(Array.from(pipelineStageIdByDealId.values())))
    const stages = stageIds.length
      ? await em.find(CustomerPipelineStage, {
          id: { $in: stageIds },
          tenantId: context.tenantId,
          organizationId: context.organizationId,
        })
      : []
    const stageById = new Map<string, CustomerPipelineStage>()
    for (const stage of stages) stageById.set(stage.id, stage)

    const stageLabels = stages.map((stage) => stage.label.trim().toLowerCase())
    const dictEntries = stageLabels.length
      ? await em.find(CustomerDictionaryEntry, {
          tenantId: context.tenantId,
          organizationId: context.organizationId,
          kind: 'pipeline_stage',
          normalizedValue: { $in: stageLabels },
        })
      : []
    const dictByNormalized = new Map<string, CustomerDictionaryEntry>()
    for (const entry of dictEntries) dictByNormalized.set(entry.normalizedValue, entry)

    return records.map((record) => {
      const dealId = record.cf_source_deal_id
      const stageId = typeof dealId === 'string' ? pipelineStageIdByDealId.get(dealId) : undefined
      const stage = stageId ? stageById.get(stageId) : undefined
      const dealStage = stage
        ? {
            id: stage.id,
            label: stage.label,
            color: dictByNormalized.get(stage.label.trim().toLowerCase())?.color ?? null,
          }
        : null
      return { ...record, _dermat_sales_flow: { dealStage } }
    })
  },
}

export const enrichers: ResponseEnricher[] = [orderDealStageEnricher]
