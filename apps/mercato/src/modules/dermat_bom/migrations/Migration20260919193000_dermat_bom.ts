import { Migration } from '@mikro-orm/migrations';

export class Migration20260919193000_dermat_bom extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`drop table if exists "dermat_bom_formulation_lines" cascade;`);
    this.addSql(`drop table if exists "dermat_bom_order_calculations" cascade;`);
    this.addSql(`drop table if exists "dermat_bom_formulations" cascade;`);

    this.addSql(`alter table "dermat_boms" drop column "depth", drop column "descendant_ids";`);
    this.addSql(`alter table "dermat_boms" add "batch_quantity" numeric(14,3) not null default '1';`);

    this.addSql(`alter table "dermat_bom_lines" drop column "formulation_id", drop column "sub_bom_id", drop column "pack_size", drop column "free_quantity", drop column "mrp";`);
    this.addSql(`alter table "dermat_bom_lines" add "raw_material_id" uuid null, add "qty_per_unit" numeric(14,4) not null default '0', add "wastage_percent" numeric(6,3) not null default '0', add "total_qty" numeric(14,4) not null default '0', add "rm_percent" numeric(8,4) null;`);
    this.addSql(`alter table "dermat_bom_lines" alter column "unit" set default 'kg';`);
    this.addSql(`alter table "dermat_bom_lines" alter column "qty_per_unit" drop default;`);
    this.addSql(`alter table "dermat_bom_lines" alter column "total_qty" drop default;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "dermat_bom_lines" drop column "raw_material_id", drop column "qty_per_unit", drop column "wastage_percent", drop column "total_qty", drop column "rm_percent";`);
    this.addSql(`alter table "dermat_bom_lines" add "formulation_id" uuid null, add "sub_bom_id" uuid null, add "pack_size" numeric(14,4) null, add "free_quantity" numeric(14,4) not null default '0', add "mrp" numeric(14,4) null;`);
    this.addSql(`alter table "dermat_bom_lines" alter column "unit" set default 'unit';`);

    this.addSql(`alter table "dermat_boms" drop column "batch_quantity";`);
    this.addSql(`alter table "dermat_boms" add "depth" int not null default 0, add "descendant_ids" jsonb not null default '[]';`);
  }

}
