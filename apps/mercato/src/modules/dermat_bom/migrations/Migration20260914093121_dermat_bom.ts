import { Migration } from '@mikro-orm/migrations';

export class Migration20260914093121_dermat_bom extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`alter table "dermat_bom_formulation_lines" add "raw_material_id" uuid null, add "supplier" text null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "dermat_bom_formulation_lines" drop column "raw_material_id", drop column "supplier";`);
  }

}
