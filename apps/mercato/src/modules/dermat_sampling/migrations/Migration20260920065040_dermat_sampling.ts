import { Migration } from '@mikro-orm/migrations';

export class Migration20260920065040_dermat_sampling extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`alter table "dermat_samples" add "rnd_stage" text not null default 'pending', add "source_order_verified_by" text null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "dermat_samples" drop column "rnd_stage", drop column "source_order_verified_by";`);
  }

}
