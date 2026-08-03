-- Google Business Profile reviews — Phase 2 sync metadata

begin;

alter table public.google_business_connections
  add column if not exists last_synced_at timestamptz,
  add column if not exists last_import_review_count integer,
  add column if not exists last_import_new_count integer;

comment on column public.google_business_connections.last_synced_at is
  'Timestamp of the last successful review import batch.';
comment on column public.google_business_connections.last_import_review_count is
  'Total reviews reported by Google at last import page.';
comment on column public.google_business_connections.last_import_new_count is
  'New reviews inserted in the last full import run.';

commit;
