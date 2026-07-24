-- Tour audience (추천 대상) reusable library + product links

begin;

create table if not exists public.tour_audience_library (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  title text not null default '',
  title_en text,
  audience_kind text not null
    check (audience_kind in ('recommended', 'not_recommended')),
  content_i18n jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tour_audience_library_kind_active
  on public.tour_audience_library (audience_kind, is_active, name);

comment on table public.tour_audience_library is
  'Reusable tour audience items: recommended for / not recommended for';
comment on column public.tour_audience_library.audience_kind is
  'recommended | not_recommended';
comment on column public.tour_audience_library.content_i18n is
  'Per-locale title: { title: { locale: text } }';

create table if not exists public.product_tour_audience_links (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  library_id uuid not null references public.tour_audience_library(id) on delete cascade,
  order_index integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, library_id)
);

create index if not exists idx_product_tour_audience_links_product
  on public.product_tour_audience_links (product_id, order_index);

comment on table public.product_tour_audience_links is
  'Which reusable audience items are attached to a product, and in what order';

insert into public.tour_audience_library (
  id, name, title, title_en, audience_kind, content_i18n
) values
  (
    'a1000001-0000-4000-8000-000000000001',
    '하루 일정',
    '시간이 하루밖에 없는 분',
    'Travelers with only one day',
    'recommended',
    '{"title":{"ko":"시간이 하루밖에 없는 분","en":"Travelers with only one day"}}'::jsonb
  ),
  (
    'a1000001-0000-4000-8000-000000000002',
    '사진 애호가',
    '사진 좋아하는 분',
    'Photography lovers',
    'recommended',
    '{"title":{"ko":"사진 좋아하는 분","en":"Photography lovers"}}'::jsonb
  ),
  (
    'a1000001-0000-4000-8000-000000000003',
    '렌터카 부담',
    '렌터카 운전이 부담스러운 분',
    'Those who prefer not to drive a rental car',
    'recommended',
    '{"title":{"ko":"렌터카 운전이 부담스러운 분","en":"Those who prefer not to drive a rental car"}}'::jsonb
  ),
  (
    'a1000001-0000-4000-8000-000000000004',
    '첫 그랜드캐년',
    '처음 그랜드캐년 가는 분',
    'First-time Grand Canyon visitors',
    'recommended',
    '{"title":{"ko":"처음 그랜드캐년 가는 분","en":"First-time Grand Canyon visitors"}}'::jsonb
  ),
  (
    'a1000001-0000-4000-8000-000000000005',
    '장시간 이동',
    '장시간 이동이 힘든 분',
    'Those who struggle with long travel times',
    'not_recommended',
    '{"title":{"ko":"장시간 이동이 힘든 분","en":"Those who struggle with long travel times"}}'::jsonb
  ),
  (
    'a1000001-0000-4000-8000-000000000006',
    '유모차',
    '유모차가 필요한 어린이',
    'Young children who need a stroller',
    'not_recommended',
    '{"title":{"ko":"유모차가 필요한 어린이","en":"Young children who need a stroller"}}'::jsonb
  ),
  (
    'a1000001-0000-4000-8000-000000000007',
    '계단 어려움',
    '협곡 계단이 어려우신 분',
    'Guests who cannot manage canyon stairs',
    'not_recommended',
    '{"title":{"ko":"협곡 계단이 어려우신 분","en":"Guests who cannot manage canyon stairs"}}'::jsonb
  )
on conflict (id) do update set
  name = excluded.name,
  title = excluded.title,
  title_en = excluded.title_en,
  audience_kind = excluded.audience_kind,
  content_i18n = excluded.content_i18n,
  updated_at = now();

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'update_tour_audience_library_updated_at') then
    create trigger update_tour_audience_library_updated_at
      before update on public.tour_audience_library
      for each row execute function public.update_updated_at_column();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'update_product_tour_audience_links_updated_at') then
    create trigger update_product_tour_audience_links_updated_at
      before update on public.product_tour_audience_links
      for each row execute function public.update_updated_at_column();
  end if;
end $$;

alter table public.tour_audience_library enable row level security;
alter table public.product_tour_audience_links enable row level security;

revoke all on table public.tour_audience_library from anon;
revoke all on table public.product_tour_audience_links from anon;

grant select on table public.tour_audience_library to anon;
grant select on table public.product_tour_audience_links to anon;

grant select, insert, update, delete on table public.tour_audience_library to authenticated;
grant select, insert, update, delete on table public.product_tour_audience_links to authenticated;

drop policy if exists "tour_audience_library_select_anon" on public.tour_audience_library;
create policy "tour_audience_library_select_anon"
  on public.tour_audience_library for select to anon
  using (
    coalesce(is_active, true)
    and exists (
      select 1
      from public.product_tour_audience_links l
      join public.products p on p.id = l.product_id
      where l.library_id = tour_audience_library.id
        and coalesce(l.is_active, true)
    )
  );

drop policy if exists "tour_audience_library_select_team" on public.tour_audience_library;
create policy "tour_audience_library_select_team"
  on public.tour_audience_library for select to authenticated
  using (
    public.is_staff(public.current_email())
    or public.is_team_member(public.current_email())
  );

drop policy if exists "tour_audience_library_insert_staff" on public.tour_audience_library;
create policy "tour_audience_library_insert_staff"
  on public.tour_audience_library for insert to authenticated
  with check (public.is_staff(public.current_email()));

drop policy if exists "tour_audience_library_update_staff" on public.tour_audience_library;
create policy "tour_audience_library_update_staff"
  on public.tour_audience_library for update to authenticated
  using (public.is_staff(public.current_email()))
  with check (public.is_staff(public.current_email()));

drop policy if exists "tour_audience_library_delete_staff" on public.tour_audience_library;
create policy "tour_audience_library_delete_staff"
  on public.tour_audience_library for delete to authenticated
  using (public.is_staff(public.current_email()));

drop policy if exists "product_tour_audience_links_select_anon" on public.product_tour_audience_links;
create policy "product_tour_audience_links_select_anon"
  on public.product_tour_audience_links for select to anon
  using (
    coalesce(is_active, true)
    and exists (select 1 from public.products p where p.id = product_tour_audience_links.product_id)
  );

drop policy if exists "product_tour_audience_links_select_team" on public.product_tour_audience_links;
create policy "product_tour_audience_links_select_team"
  on public.product_tour_audience_links for select to authenticated
  using (
    public.is_staff(public.current_email())
    or public.is_team_member(public.current_email())
  );

drop policy if exists "product_tour_audience_links_insert_staff" on public.product_tour_audience_links;
create policy "product_tour_audience_links_insert_staff"
  on public.product_tour_audience_links for insert to authenticated
  with check (public.is_staff(public.current_email()));

drop policy if exists "product_tour_audience_links_update_staff" on public.product_tour_audience_links;
create policy "product_tour_audience_links_update_staff"
  on public.product_tour_audience_links for update to authenticated
  using (public.is_staff(public.current_email()))
  with check (public.is_staff(public.current_email()));

drop policy if exists "product_tour_audience_links_delete_staff" on public.product_tour_audience_links;
create policy "product_tour_audience_links_delete_staff"
  on public.product_tour_audience_links for delete to authenticated
  using (public.is_staff(public.current_email()));

commit;
