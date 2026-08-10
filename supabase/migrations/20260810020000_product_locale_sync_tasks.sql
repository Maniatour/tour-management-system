-- Track KO/EN source content changes that still need other-locale updates.

create table if not exists public.product_locale_sync_tasks (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  field_key text not null,
  source_locale text not null check (source_locale in ('ko', 'en')),
  source_updated_at timestamptz not null default now(),
  source_updated_by text null,
  pending_locales text[] not null default '{}',
  resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint product_locale_sync_tasks_product_field_source_unique
    unique (product_id, field_key, source_locale)
);

comment on table public.product_locale_sync_tasks is
  'KO/EN 상품 콘텐츠 수정 후 다른 언어 반영이 필요한 영역 추적';

create index if not exists idx_product_locale_sync_tasks_open
  on public.product_locale_sync_tasks (product_id, source_updated_at desc)
  where resolved_at is null;

create index if not exists idx_product_locale_sync_tasks_pending_gin
  on public.product_locale_sync_tasks using gin (pending_locales);

alter table public.product_locale_sync_tasks enable row level security;

revoke all on table public.product_locale_sync_tasks from anon;
grant select, insert, update, delete on table public.product_locale_sync_tasks to authenticated;

drop policy if exists "product_locale_sync_tasks_select_staff"
  on public.product_locale_sync_tasks;
drop policy if exists "product_locale_sync_tasks_insert_staff"
  on public.product_locale_sync_tasks;
drop policy if exists "product_locale_sync_tasks_update_staff"
  on public.product_locale_sync_tasks;
drop policy if exists "product_locale_sync_tasks_delete_staff"
  on public.product_locale_sync_tasks;

create policy "product_locale_sync_tasks_select_staff"
  on public.product_locale_sync_tasks for select to authenticated
  using (public.is_staff());

create policy "product_locale_sync_tasks_insert_staff"
  on public.product_locale_sync_tasks for insert to authenticated
  with check (public.is_staff());

create policy "product_locale_sync_tasks_update_staff"
  on public.product_locale_sync_tasks for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "product_locale_sync_tasks_delete_staff"
  on public.product_locale_sync_tasks for delete to authenticated
  using (public.is_staff());
