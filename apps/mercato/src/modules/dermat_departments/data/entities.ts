import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'
import { OptionalProps } from '@mikro-orm/core'

export type DepartmentType =
  | 'sales'
  | 'procurement'
  | 'production'
  | 'quality_control'
  | 'quality_assurance'
  | 'finance'
  | 'research'
  | 'admin'

@Entity({ tableName: 'dermat_departments' })
@Index({ name: 'dermat_departments_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Unique({ name: 'dermat_departments_org_tenant_name_uq', properties: ['organizationId', 'tenantId', 'name'] })
export class Department {
  [OptionalProps]?: 'isActive' | 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ type: 'text' })
  name!: string

  @Property({ type: 'text' })
  type!: DepartmentType

  @Property({ name: 'contact_email', type: 'text', nullable: true })
  contactEmail?: string | null

  @Property({ name: 'contact_phone', type: 'text', nullable: true })
  contactPhone?: string | null

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}
