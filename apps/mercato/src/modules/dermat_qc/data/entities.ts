import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'
import { OptionalProps } from '@mikro-orm/core'

export type QcReferenceType = 'batch_stage' | 'grn'
export type QcTestType = 'chemical' | 'micro'
export type QcResult = 'pending' | 'pass' | 'fail'

@Entity({ tableName: 'dermat_qc_tests' })
@Index({ name: 'dermat_qc_tests_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'dermat_qc_tests_reference_idx', properties: ['referenceType', 'referenceId'] })
export class QcTest {
  [OptionalProps]?:
    | 'result'
    | 'createdAt'
    | 'updatedAt'
    | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'reference_type', type: 'text' })
  referenceType!: QcReferenceType

  @Property({ name: 'reference_id', type: 'text', nullable: true })
  referenceId?: string | null

  @Property({ name: 'test_type', type: 'text' })
  testType!: QcTestType

  @Property({ type: 'text' })
  result: QcResult = 'pending'

  @Property({ name: 'tested_by', type: 'text', nullable: true })
  testedBy?: string | null

  @Property({ name: 'tested_at', type: Date, nullable: true })
  testedAt?: Date | null

  @Property({ type: 'text', nullable: true })
  remarks?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'dermat_qc_policies' })
@Index({ name: 'dermat_qc_policies_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Unique({ name: 'dermat_qc_policies_org_tenant_applies_to_uq', properties: ['organizationId', 'tenantId', 'appliesTo'] })
export class QcPolicy {
  [OptionalProps]?:
    | 'chemicalRequired'
    | 'microRequired'
    | 'createdAt'
    | 'updatedAt'
    | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'applies_to', type: 'text' })
  appliesTo!: string

  @Property({ name: 'chemical_required', type: 'boolean', default: true })
  chemicalRequired: boolean = true

  @Property({ name: 'micro_required', type: 'boolean', default: true })
  microRequired: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}
