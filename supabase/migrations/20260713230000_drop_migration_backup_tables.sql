-- Drop one-time migration backup / diagnostic tables (no app usage).
-- Clears Security Advisor Info "RLS Enabled No Policy" and reduces schema clutter.
-- Safe: tables are migration artifacts only; production data lives in primary tables.

begin;

drop table if exists public.dynamic_pricing_backup cascade;
drop table if exists public.products_backup_20260626_pickup_sending_merge cascade;
drop table if exists public.products_choices_backup cascade;
drop table if exists public.reservations_backup_before_product_migration cascade;
drop table if exists public.reservations_choices_backup cascade;
drop table if exists public.product_id_mapping_suggestions cascade;

commit;
