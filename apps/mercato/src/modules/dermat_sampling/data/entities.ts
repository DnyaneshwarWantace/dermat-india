import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'
import { OptionalProps } from '@mikro-orm/core'

export type SampleStatus = 'requested' | 'in_preparation' | 'sent' | 'approved' | 'rejected'

// Coarse R&D case stage shown on the Order Kanban's "R&D / Sample" column and on the Order
// detail page's embedded R&D panel. Deliberately a *separate* field from `status` (which
// tracks the physical sample's own approval lifecycle): `rndStage` is the case-level view
// ("is R&D still working this order") that both the Order page and the dedicated R&D module
// page read/write against the same underlying record — see spec §6 case status vocabulary,
// narrowed for this task to Pending/In Progress/Completed.
export type SampleRndStage = 'pending' | 'in_progress' | 'completed'

@Entity({ tableName: 'dermat_samples' })
@Index({ name: 'dermat_samples_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'dermat_samples_order_idx', properties: ['orderId'] })
export class Sample {
  [OptionalProps]?:
    | 'status'
    | 'rndStage'
    | 'createdAt'
    | 'updatedAt'
    | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  // FK-id only, no ORM relation across modules — order lives in packages/core/sales
  @Property({ name: 'order_id', type: 'text' })
  orderId!: string

  // Denormalized label so the record still reads standalone if the order/product changes later
  @Property({ name: 'product_name', type: 'text', nullable: true })
  productName?: string | null

  @Property({ type: 'text' })
  status: SampleStatus = 'requested'

  @Property({ name: 'rnd_stage', type: 'text' })
  rndStage: SampleRndStage = 'pending'

  // Order-verify actor/note that triggered automatic case creation (spec correction: order
  // confirm/verify must auto-create the R&D case, no manual re-entry by the R&D team).
  @Property({ name: 'source_order_verified_by', type: 'text', nullable: true })
  sourceOrderVerifiedBy?: string | null

  @Property({ name: 'requested_by', type: 'text', nullable: true })
  requestedBy?: string | null

  @Property({ name: 'requested_at', type: Date, nullable: true })
  requestedAt?: Date | null

  @Property({ name: 'sent_at', type: Date, nullable: true })
  sentAt?: Date | null

  @Property({ name: 'customer_decision_at', type: Date, nullable: true })
  customerDecisionAt?: Date | null

  @Property({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason?: string | null

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}
