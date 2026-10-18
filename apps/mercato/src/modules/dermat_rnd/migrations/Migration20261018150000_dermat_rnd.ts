import { Migration } from '@mikro-orm/migrations';

export class Migration20261018150000_dermat_rnd extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`alter table "dermat_rnd_requests" add column if not exists "urgency" text not null default 'normal';`);
    this.addSql(`alter table "dermat_rnd_trials" add column if not exists "product_code" text null, add column if not exists "sample_received_by" text null, add column if not exists "micro" jsonb null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "dermat_rnd_requests" drop column if exists "urgency";`);
    this.addSql(`alter table "dermat_rnd_trials" drop column if exists "product_code", drop column if exists "sample_received_by", drop column if exists "micro";`);
  }

}
