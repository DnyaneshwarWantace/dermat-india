import type { EntityManager } from '@mikro-orm/postgresql'
import { PurchaseOrderNumberSequence } from '../data/entities'

// Indian financial year runs April - March. Sept 2026 -> FY 2026/27 -> "2627".
function resolveFinancialYear(date: Date): string {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const startYear = month >= 4 ? year : year - 1
  const endYear = startYear + 1
  return `${String(startYear).slice(-2)}${String(endYear).slice(-2)}`
}

export async function generatePoNumber(
  em: EntityManager,
  organizationId: string,
  tenantId: string,
  now: Date = new Date(),
): Promise<string> {
  const financialYear = resolveFinancialYear(now)
  const connection = em.getConnection()

  const rows = await connection.execute<Array<{ current_value: number }>>(
    `insert into dermat_purchase_order_sequences (id, organization_id, tenant_id, financial_year, current_value)
     values (gen_random_uuid(), ?, ?, ?, 1)
     on conflict (organization_id, tenant_id, financial_year)
     do update set current_value = dermat_purchase_order_sequences.current_value + 1
     returning current_value`,
    [organizationId, tenantId, financialYear],
  )
  const sequence = rows[0]?.current_value ?? 1
  const padded = String(sequence).padStart(4, '0')
  return `DER/PO/${financialYear}/${padded}`
}

export { PurchaseOrderNumberSequence }
