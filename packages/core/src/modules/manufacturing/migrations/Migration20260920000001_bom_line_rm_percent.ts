import { Migration } from '@mikro-orm/migrations'

export class Migration20260920000001_bom_line_rm_percent extends Migration {
  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE "manufacturing_bom_lines" ADD COLUMN IF NOT EXISTS "rm_percent" numeric(6,3) NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`ALTER TABLE "manufacturing_bom_lines" DROP COLUMN IF EXISTS "rm_percent";`)
  }
}
