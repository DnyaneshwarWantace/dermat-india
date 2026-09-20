import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'
import { OptionalProps } from '@mikro-orm/core'

@Entity({ tableName: 'dermat_pm_master' })
@Index({ name: 'dermat_pm_master_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Unique({ name: 'dermat_pm_master_org_tenant_code_uq', properties: ['organizationId', 'tenantId', 'code'] })
export class PackagingMaterial {
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
  category?: string | null

  @Property({ type: 'text', nullable: true })
  dimensions?: string | null

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}
