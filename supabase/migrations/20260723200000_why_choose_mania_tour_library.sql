-- Why choose Mania Tour — reusable library + product links

begin;

create table if not exists public.why_choose_library (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  title text not null default '',
  title_en text,
  description text not null default '',
  description_en text,
  icon_key text,
  content_i18n jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_why_choose_library_active_name
  on public.why_choose_library (is_active, name);

comment on table public.why_choose_library is
  'Reusable "Why choose Mania Tour" bullet items shared across products';
comment on column public.why_choose_library.name is
  'Admin label for search/reuse';
comment on column public.why_choose_library.content_i18n is
  'Per-locale text: { title: { locale: text }, description: { locale: text } }';
comment on column public.why_choose_library.icon_key is
  'Lucide icon key (users, bus, guide, sunrise, camera, no-shopping, etc.)';

create table if not exists public.product_why_choose_links (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  library_id uuid not null references public.why_choose_library(id) on delete cascade,
  order_index integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, library_id)
);

create index if not exists idx_product_why_choose_links_product
  on public.product_why_choose_links (product_id, order_index);

comment on table public.product_why_choose_links is
  'Which reusable why-choose items are attached to a product, and in what order';

-- Seed default library items (idempotent)
insert into public.why_choose_library (
  id, name, title, title_en, description, description_en, icon_key, content_i18n
) values
  (
    'a1000001-0000-4000-8000-000000000001',
    '소규모 운영',
    '소규모 운영',
    'Small group experience',
    '',
    '',
    'users',
    '{"title":{"ko":"소규모 운영","en":"Small group experience"}}'::jsonb
  ),
  (
    'a1000001-0000-4000-8000-000000000002',
    '편안한 차량',
    '긴 이동도 편안한 차량',
    'Comfortable vehicles for long drives',
    '',
    '',
    'bus',
    '{"title":{"ko":"긴 이동도 편안한 차량","en":"Comfortable vehicles for long drives"}}'::jsonb
  ),
  (
    'a1000001-0000-4000-8000-000000000003',
    '전문 가이드',
    '전문 가이드',
    'Professional local guides',
    '',
    '',
    'guide',
    '{"title":{"ko":"전문 가이드","en":"Professional local guides"}}'::jsonb
  ),
  (
    'a1000001-0000-4000-8000-000000000004',
    '일출 시간 계산',
    '최적의 일출 시간 계산',
    'Optimal sunrise timing',
    '',
    '',
    'sunrise',
    '{"title":{"ko":"최적의 일출 시간 계산","en":"Optimal sunrise timing"}}'::jsonb
  ),
  (
    'a1000001-0000-4000-8000-000000000005',
    '사진 포인트',
    '검증된 사진 포인트',
    'Verified photo spots',
    '',
    '',
    'camera',
    '{"title":{"ko":"검증된 사진 포인트","en":"Verified photo spots"}}'::jsonb
  ),
  (
    'a1000001-0000-4000-8000-000000000006',
    '쇼핑 없음',
    '불필요한 쇼핑 없음',
    'No unnecessary shopping stops',
    '',
    '',
    'no-shopping',
    '{"title":{"ko":"불필요한 쇼핑 없음","en":"No unnecessary shopping stops"}}'::jsonb
  )
on conflict (id) do update set
  name = excluded.name,
  title = excluded.title,
  title_en = excluded.title_en,
  icon_key = excluded.icon_key,
  content_i18n = excluded.content_i18n,
  updated_at = now();

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'update_why_choose_library_updated_at') then
    create trigger update_why_choose_library_updated_at
      before update on public.why_choose_library
      for each row execute function public.update_updated_at_column();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'update_product_why_choose_links_updated_at') then
    create trigger update_product_why_choose_links_updated_at
      before update on public.product_why_choose_links
      for each row execute function public.update_updated_at_column();
  end if;
end $$;

alter table public.why_choose_library enable row level security;
alter table public.product_why_choose_links enable row level security;

revoke all on table public.why_choose_library from anon;
revoke all on table public.product_why_choose_links from anon;

grant select on table public.why_choose_library to anon;
grant select on table public.product_why_choose_links to anon;

grant select, insert, update, delete on table public.why_choose_library to authenticated;
grant select, insert, update, delete on table public.product_why_choose_links to authenticated;

drop policy if exists "why_choose_library_select_anon" on public.why_choose_library;
create policy "why_choose_library_select_anon"
  on public.why_choose_library for select to anon
  using (
    coalesce(is_active, true)
    and exists (
      select 1
      from public.product_why_choose_links l
      join public.products p on p.id = l.product_id
      where l.library_id = why_choose_library.id
        and coalesce(l.is_active, true)
    )
  );

drop policy if exists "why_choose_library_select_team" on public.why_choose_library;
create policy "why_choose_library_select_team"
  on public.why_choose_library for select to authenticated
  using (
    public.is_staff(public.current_email())
    or public.is_team_member(public.current_email())
  );

drop policy if exists "why_choose_library_insert_staff" on public.why_choose_library;
create policy "why_choose_library_insert_staff"
  on public.why_choose_library for insert to authenticated
  with check (public.is_staff(public.current_email()));

drop policy if exists "why_choose_library_update_staff" on public.why_choose_library;
create policy "why_choose_library_update_staff"
  on public.why_choose_library for update to authenticated
  using (public.is_staff(public.current_email()))
  with check (public.is_staff(public.current_email()));

drop policy if exists "why_choose_library_delete_staff" on public.why_choose_library;
create policy "why_choose_library_delete_staff"
  on public.why_choose_library for delete to authenticated
  using (public.is_staff(public.current_email()));

drop policy if exists "product_why_choose_links_select_anon" on public.product_why_choose_links;
create policy "product_why_choose_links_select_anon"
  on public.product_why_choose_links for select to anon
  using (
    coalesce(is_active, true)
    and exists (select 1 from public.products p where p.id = product_why_choose_links.product_id)
  );

drop policy if exists "product_why_choose_links_select_team" on public.product_why_choose_links;
create policy "product_why_choose_links_select_team"
  on public.product_why_choose_links for select to authenticated
  using (
    public.is_staff(public.current_email())
    or public.is_team_member(public.current_email())
  );

drop policy if exists "product_why_choose_links_insert_staff" on public.product_why_choose_links;
create policy "product_why_choose_links_insert_staff"
  on public.product_why_choose_links for insert to authenticated
  with check (public.is_staff(public.current_email()));

drop policy if exists "product_why_choose_links_update_staff" on public.product_why_choose_links;
create policy "product_why_choose_links_update_staff"
  on public.product_why_choose_links for update to authenticated
  using (public.is_staff(public.current_email()))
  with check (public.is_staff(public.current_email()));

drop policy if exists "product_why_choose_links_delete_staff" on public.product_why_choose_links;
create policy "product_why_choose_links_delete_staff"
  on public.product_why_choose_links for delete to authenticated
  using (public.is_staff(public.current_email()));

commit;
