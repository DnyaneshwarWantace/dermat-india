import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'
import { OptionalProps } from '@mikro-orm/core'

export type BomComponentKind = 'raw_material' | 'packaging_material'

@Entity({ tableName: 'dermat_boms' })
@Index({ name: 'dermat_boms_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Unique({
  name: 'dermat_boms_org_tenant_name_uq',
  properties: ['organizationId', 'tenantId', 'bomName'],
})
export class Bom {
  [OptionalProps]?:
    | 'version'
    | 'isActive'
    | 'createdAt'
    | 'updatedAt'
    | 'deletedAt'
    | 'catalogProductId'
    | 'batchQuantity'
    | 'metadata'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'bom_name', type: 'text' })
  bomName!: string

  // Nullable FK-by-id to catalog_product. A product can have MULTIPLE Bom rows —
  // this is how "multi-level BOM" actually works per the client (a product like
  // "S-Ross" has a separate Cream BOM and a separate Gel BOM, both linked here).
  @Property({ name: 'catalog_product_id', type: 'uuid', nullable: true })
  catalogProductId?: string | null

  // The batch quantity the Qty/Unit column scales from, matching Procuzy's
  // BOM ("Quantity: 100 KGS" on the document header).
  @Property({ name: 'batch_quantity', type: 'numeric', precision: 14, scale: 3, default: '1' })
  batchQuantity: string = '1'

  @Property({ type: 'int', default: 1 })
  version: number = 1

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  // Header-spec fields (internal code, BOM type, version label, base UOM,
  // status, effective-from date) that don't warrant their own columns yet —
  // kept as a single JSON blob rather than five more nullable columns.
  @Property({ type: 'json', nullable: true })
  metadata?: Record<string, unknown> | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'dermat_bom_lines' })
@Index({ name: 'dermat_bom_lines_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'dermat_bom_lines_bom_idx', properties: ['bomId'] })
export class BomLine {
  [OptionalProps]?:
    | 'sequenceNumber'
    | 'createdAt'
    | 'updatedAt'
    | 'deletedAt'
    | 'rawMaterialId'
    | 'packagingMaterialId'
    | 'unit'
    | 'componentCode'
    | 'wastagePercent'
    | 'rmPercent'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'bom_id', type: 'uuid' })
  bomId!: string

  @Property({ name: 'component_kind', type: 'text' })
  componentKind!: BomComponentKind

  // Exactly one of these two is set, matching componentKind.
  @Property({ name: 'raw_material_id', type: 'uuid', nullable: true })
  rawMaterialId?: string | null

  @Property({ name: 'packaging_material_id', type: 'uuid', nullable: true })
  packagingMaterialId?: string | null

  // Denormalized snapshot of the picked component's own code (Procuzy "Product Code").
  @Property({ name: 'component_code', type: 'text', nullable: true })
  componentCode?: string | null

  // Procuzy "Qty/Unit" — how much of this component is needed per 1 unit of finished product.
  @Property({ name: 'qty_per_unit', type: 'numeric', precision: 14, scale: 4 })
  qtyPerUnit!: string

  // Procuzy "Qty" — qtyPerUnit x the BOM's batchQuantity.
  @Property({ name: 'quantity', type: 'numeric', precision: 14, scale: 4 })
  quantity!: string

  // Procuzy "Wastage %" — raw material lines only; packaging lines keep this at 0.
  @Property({ name: 'wastage_percent', type: 'numeric', precision: 6, scale: 3, default: '0' })
  wastagePercent: string = '0'

  // Procuzy "Total Qty" — quantity x (1 + wastagePercent / 100).
  @Property({ name: 'total_qty', type: 'numeric', precision: 14, scale: 4 })
  totalQty!: string

  // Procuzy "UOM".
  @Property({ type: 'text', default: 'kg' })
  unit: string = 'kg'

  // Procuzy "RM %" — informational only, not used for any conversion math.
  @Property({ name: 'rm_percent', type: 'numeric', precision: 8, scale: 4, nullable: true })
  rmPercent?: string | null

  @Property({ name: 'sequence_number', type: 'int', default: 0 })
  sequenceNumber: number = 0

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}
