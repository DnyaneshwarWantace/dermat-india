import { Migration } from '@mikro-orm/migrations';

export class Migration20261026090000_dermat_accounts extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`alter table "dermat_company_profiles" add column if not exists "form_options" jsonb null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "dermat_company_profiles" drop column if exists "form_options";`);
  }

}
