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

  // References `auth`'s Role by id only — never a MikroORM cross-module relation
  // (see root AGENTS.md "no direct ORM relationships between modules"). Each
  // department owns exactly one backing Role whose `role_acls.features_json`
  // is the department's access set; assigning a user to the department assigns
  // this role via `user_roles`.
  @Property({ name: 'role_id', type: 'uuid', nullable: true })
  roleId?: string | null

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'dermat_whatsapp_numbers' })
@Unique({ name: 'dermat_whatsapp_numbers_user_uq', properties: ['tenantId', 'userId'] })
export class WhatsappNumber {
  [OptionalProps]?: 'enabled' | 'lastSentAt' | 'lastError' | 'sentCount' | 'createdAt' | 'updatedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'user_id', type: 'uuid' })
  userId!: string

  @Property({ type: 'text' })
  phone!: string

  @Property({ type: 'boolean', default: true })
  enabled: boolean = true

  @Property({ name: 'last_sent_at', type: Date, nullable: true })
  lastSentAt?: Date | null

  @Property({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string | null

  @Property({ name: 'sent_count', type: 'integer', default: 0 })
  sentCount: number = 0

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

@Entity({ tableName: 'dermat_access_log' })
export class AccessLogEntry {
  [OptionalProps]?: 'userName' | 'changedByName' | 'createdAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'user_id', type: 'uuid' })
  userId!: string

  @Property({ name: 'user_name', type: 'text', nullable: true })
  userName?: string | null

  @Property({ name: 'changed_by_name', type: 'text', nullable: true })
  changedByName?: string | null

  @Property({ type: 'json' })
  added!: string[]

  @Property({ type: 'json' })
  removed!: string[]

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()
}

@Entity({ tableName: 'dermat_push_subscriptions' })
@Unique({ name: 'dermat_push_subscriptions_endpoint_uq', properties: ['endpoint'] })
@Index({ name: 'dermat_push_subscriptions_user_idx', properties: ['tenantId', 'userId'] })
export class PushSubscriptionRecord {
  [OptionalProps]?: 'userAgent' | 'lastSentAt' | 'createdAt' | 'updatedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'user_id', type: 'uuid' })
  userId!: string

  @Property({ type: 'text' })
  endpoint!: string

  @Property({ type: 'text' })
  p256dh!: string

  @Property({ type: 'text' })
  auth!: string

  @Property({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string | null

  @Property({ name: 'last_sent_at', type: Date, nullable: true })
  lastSentAt?: Date | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
