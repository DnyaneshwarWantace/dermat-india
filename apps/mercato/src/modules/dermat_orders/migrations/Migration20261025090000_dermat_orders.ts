import { Migration } from '@mikro-orm/migrations';

export class Migration20261025090000_dermat_orders extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`update dermat_order_stages s set data = jsonb_set(coalesce(s.data, '{}'::jsonb), '{__steps}', coalesce(s.data->'__steps', '{}'::jsonb) || jsonb_build_object('pm_asked', jsonb_build_object('done', true, 'at', to_char(r.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'by', r.requested_by_name))) from (select distinct on (order_id, stage_key) order_id, stage_key, created_at, requested_by_name from dermat_store_requests where deleted_at is null and status <> 'cancelled' order by order_id, stage_key, created_at) r where r.order_id = s.order_id and r.stage_key = s.stage_key and s.stage_key in ('filling', 'packing') and s.status in ('open', 'on_hold', 'done') and coalesce((s.data->'__steps'->'pm_asked'->>'done')::boolean, false) = false;`);
    this.addSql(`update dermat_order_stages s set data = jsonb_set(coalesce(s.data, '{}'::jsonb), '{__steps}', coalesce(s.data->'__steps', '{}'::jsonb) || jsonb_build_object('bom_made', jsonb_build_object('done', true, 'at', to_char(coalesce(s.completed_at, now()) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'by', coalesce(s.completed_by_name, 'R&D'))) || jsonb_build_object('bom_approved', jsonb_build_object('done', true, 'at', to_char(coalesce(s.completed_at, now()) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'by', coalesce(s.completed_by_name, 'R&D')))) where s.stage_key = 'formulation' and s.status in ('done', 'skipped');`);
    this.addSql(`update dermat_order_stages s set data = jsonb_set(coalesce(s.data, '{}'::jsonb), '{__steps}', coalesce(s.data->'__steps', '{}'::jsonb) || jsonb_build_object('bom_made', jsonb_build_object('done', true, 'at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'by', 'R&D (BOM page)'))) where s.stage_key = 'formulation' and s.status in ('open', 'on_hold') and not exists (select 1 from dermat_order_lines l where l.order_id = s.order_id and not exists (select 1 from dermat_bom_headers h where h.product_id = l.product_id and h.deleted_at is null and h.status <> 'superseded' and (h.order_id is null or h.order_id = s.order_id)));`);
  }

  override down(): void | Promise<void> {
  }

}
