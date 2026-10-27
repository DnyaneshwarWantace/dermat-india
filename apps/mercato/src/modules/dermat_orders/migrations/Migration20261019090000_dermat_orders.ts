import { Migration } from '@mikro-orm/migrations';

export class Migration20261019090000_dermat_orders extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`alter table "dermat_stage_settings" add column if not exists "card_settings" jsonb null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "dermat_stage_settings" drop column if exists "card_settings";`);
  }

}
