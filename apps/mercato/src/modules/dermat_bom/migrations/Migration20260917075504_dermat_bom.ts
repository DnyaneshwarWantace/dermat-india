import { Migration } from '@mikro-orm/migrations';

export class Migration20260917075504_dermat_bom extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`alter table "dermat_bom_lines" add "pack_size" numeric(14,4) null, add "free_quantity" numeric(14,4) not null default '0', add "component_code" text null, add "mrp" numeric(14,4) null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "dermat_bom_lines" drop column "pack_size", drop column "free_quantity", drop column "component_code", drop column "mrp";`);
  }

}
