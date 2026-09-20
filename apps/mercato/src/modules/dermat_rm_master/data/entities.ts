import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'
import { OptionalProps } from '@mikro-orm/core'

@Entity({ tableName: 'dermat_rm_master' })
@Index({ name: 'dermat_rm_master_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Unique({ name: 'dermat_rm_master_org_tenant_code_uq', properties: ['organizationId', 'tenantId', 'code'] })
export class RawMaterial {
  [OptionalProps]?:
    | 'stock'
    | 'isActive'
    | 'createdAt'
    | 'updatedAt'
    | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ type: 'text' })
  name!: string

  @Property({ name: 'inci_name', type: 'text', nullable: true })
  inciName?: string | null

  @Property({ type: 'text' })
  code!: string

  @Property({ type: 'numeric', precision: 14, scale: 3, default: 0 })
  stock: string = '0'

  @Property({ type: 'text' })
  unit!: string

  @Property({ name: 'make_brand_name', type: 'text', nullable: true })
  makeBrandName?: string | null

  @Property({ type: 'text', nullable: true })
  supplier?: string | null

  @Property({ type: 'text', nullable: true })
  benefit?: string | null

  @Property({ name: 'alternate_rm', type: 'text', nullable: true })
  alternateRm?: string | null

  @Property({ name: 'physical_state', type: 'text', nullable: true })
  physicalState?: string | null

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}
