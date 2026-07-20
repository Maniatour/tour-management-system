-- Reusable FAQ library + product links
-- Reusable detail content (운영 안내 / 정책) library + product links
-- Migrates existing product_faqs into the library while preserving product attachments.

begin;

-- products.id is TEXT (not uuid). Drop wrongly typed link tables from a failed prior run.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'product_faq_links'
      and column_name = 'product_id'
      and udt_name = 'uuid'
  ) then
    drop table public.product_faq_links cascade;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'product_detail_content_links'
      and column_name = 'product_id'
      and udt_name = 'uuid'
  ) then
    drop table public.product_detail_content_links cascade;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- FAQ library
-- ---------------------------------------------------------------------------
create table if not exists public.faq_library (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  question text not null default '',
  answer text not null default '',
  question_en text,
  answer_en text,
  content_i18n jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_faq_library_active_name
  on public.faq_library (is_active, name);

comment on table public.faq_library is
  'Reusable FAQ items shared across products';
comment on column public.faq_library.name is
  'Admin label for search/reuse (defaults to question)';
comment on column public.faq_library.content_i18n is
  'Per-locale FAQ text: { question: { locale: text }, answer: { locale: text } }';

create table if not exists public.product_faq_links (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  faq_id uuid not null references public.faq_library(id) on delete cascade,
  order_index integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, faq_id)
);

create index if not exists idx_product_faq_links_product
  on public.product_faq_links (product_id, order_index);

comment on table public.product_faq_links is
  'Which reusable FAQs are attached to a product, and in what order';

-- Migrate legacy product_faqs → faq_library + links (1:1, safe; admin can merge later)
do $$
declare
  r record;
  new_id uuid;
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'product_faqs'
  )
  and not exists (select 1 from public.product_faq_links limit 1)
  -- Avoid duplicating library rows when re-running after a partial failure
  and not exists (select 1 from public.faq_library limit 1)
  then
    for r in
      select *
      from public.product_faqs
      order by product_id, coalesce(order_index, 0), created_at nulls last
    loop
      insert into public.faq_library (
        name, question, answer, question_en, answer_en, content_i18n, is_active, created_at, updated_at
      ) values (
        left(coalesce(nullif(trim(r.question), ''), 'FAQ'), 120),
        coalesce(r.question, ''),
        coalesce(r.answer, ''),
        r.question_en,
        r.answer_en,
        coalesce(r.content_i18n, '{}'::jsonb),
        coalesce(r.is_active, true),
        coalesce(r.created_at, now()),
        coalesce(r.updated_at, now())
      )
      returning id into new_id;

      insert into public.product_faq_links (product_id, faq_id, order_index, is_active)
      values (
        r.product_id,
        new_id,
        coalesce(r.order_index, 0),
        coalesce(r.is_active, true)
      )
      on conflict (product_id, faq_id) do nothing;
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Detail content library (운영 안내 / 정책)
-- ---------------------------------------------------------------------------
create table if not exists public.detail_content_library (
  id uuid primary key default gen_random_uuid(),
  kind text not null
    check (kind in (
      'pickup_drop_info',
      'luggage_info',
      'tour_operation_info',
      'preparation_info',
      'small_group_info',
      'companion_recruitment_info',
      'notice_info',
      'important_notes',
      'cancellation_policy',
      'private_tour_info',
      'chat_announcement'
    )),
  name text not null default '',
  body text not null default '',
  body_en text,
  content_i18n jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_detail_content_library_kind_active
  on public.detail_content_library (kind, is_active, name);

comment on table public.detail_content_library is
  'Reusable product detail snippets: 운영 안내 + 정책 fields';
comment on column public.detail_content_library.kind is
  'Maps to product_details_multilingual field key';
comment on column public.detail_content_library.content_i18n is
  'Per-locale body: { body: { locale: text } }';

create table if not exists public.product_detail_content_links (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  kind text not null
    check (kind in (
      'pickup_drop_info',
      'luggage_info',
      'tour_operation_info',
      'preparation_info',
      'small_group_info',
      'companion_recruitment_info',
      'notice_info',
      'important_notes',
      'cancellation_policy',
      'private_tour_info',
      'chat_announcement'
    )),
  library_id uuid not null references public.detail_content_library(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, kind)
);

create index if not exists idx_product_detail_content_links_product
  on public.product_detail_content_links (product_id);

comment on table public.product_detail_content_links is
  'Product assigns one reusable snippet per detail kind (overrides inline text when set)';

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'update_faq_library_updated_at') then
    create trigger update_faq_library_updated_at
      before update on public.faq_library
      for each row execute function public.update_updated_at_column();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'update_product_faq_links_updated_at') then
    create trigger update_product_faq_links_updated_at
      before update on public.product_faq_links
      for each row execute function public.update_updated_at_column();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'update_detail_content_library_updated_at') then
    create trigger update_detail_content_library_updated_at
      before update on public.detail_content_library
      for each row execute function public.update_updated_at_column();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'update_product_detail_content_links_updated_at') then
    create trigger update_product_detail_content_links_updated_at
      before update on public.product_detail_content_links
      for each row execute function public.update_updated_at_column();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.faq_library enable row level security;
alter table public.product_faq_links enable row level security;
alter table public.detail_content_library enable row level security;
alter table public.product_detail_content_links enable row level security;

revoke all on table public.faq_library from anon;
revoke all on table public.product_faq_links from anon;
revoke all on table public.detail_content_library from anon;
revoke all on table public.product_detail_content_links from anon;

grant select on table public.faq_library to anon;
grant select on table public.product_faq_links to anon;
grant select on table public.detail_content_library to anon;
grant select on table public.product_detail_content_links to anon;

grant select, insert, update, delete on table public.faq_library to authenticated;
grant select, insert, update, delete on table public.product_faq_links to authenticated;
grant select, insert, update, delete on table public.detail_content_library to authenticated;
grant select, insert, update, delete on table public.product_detail_content_links to authenticated;

-- faq_library: public can read active items that are linked to a product
drop policy if exists "faq_library_select_anon" on public.faq_library;
create policy "faq_library_select_anon"
  on public.faq_library for select to anon
  using (
    coalesce(is_active, true)
    and exists (
      select 1
      from public.product_faq_links l
      join public.products p on p.id = l.product_id
      where l.faq_id = faq_library.id
        and coalesce(l.is_active, true)
    )
  );

drop policy if exists "faq_library_select_team" on public.faq_library;
create policy "faq_library_select_team"
  on public.faq_library for select to authenticated
  using (
    public.is_staff(public.current_email())
    or public.is_team_member(public.current_email())
  );

drop policy if exists "faq_library_insert_staff" on public.faq_library;
create policy "faq_library_insert_staff"
  on public.faq_library for insert to authenticated
  with check (public.is_staff(public.current_email()));

drop policy if exists "faq_library_update_staff" on public.faq_library;
create policy "faq_library_update_staff"
  on public.faq_library for update to authenticated
  using (public.is_staff(public.current_email()))
  with check (public.is_staff(public.current_email()));

drop policy if exists "faq_library_delete_staff" on public.faq_library;
create policy "faq_library_delete_staff"
  on public.faq_library for delete to authenticated
  using (public.is_staff(public.current_email()));

-- product_faq_links
drop policy if exists "product_faq_links_select_anon" on public.product_faq_links;
create policy "product_faq_links_select_anon"
  on public.product_faq_links for select to anon
  using (
    coalesce(is_active, true)
    and exists (select 1 from public.products p where p.id = product_faq_links.product_id)
  );

drop policy if exists "product_faq_links_select_team" on public.product_faq_links;
create policy "product_faq_links_select_team"
  on public.product_faq_links for select to authenticated
  using (
    public.is_staff(public.current_email())
    or public.is_team_member(public.current_email())
  );

drop policy if exists "product_faq_links_insert_staff" on public.product_faq_links;
create policy "product_faq_links_insert_staff"
  on public.product_faq_links for insert to authenticated
  with check (public.is_staff(public.current_email()));

drop policy if exists "product_faq_links_update_staff" on public.product_faq_links;
create policy "product_faq_links_update_staff"
  on public.product_faq_links for update to authenticated
  using (public.is_staff(public.current_email()))
  with check (public.is_staff(public.current_email()));

drop policy if exists "product_faq_links_delete_staff" on public.product_faq_links;
create policy "product_faq_links_delete_staff"
  on public.product_faq_links for delete to authenticated
  using (public.is_staff(public.current_email()));

-- detail_content_library
drop policy if exists "detail_content_library_select_anon" on public.detail_content_library;
create policy "detail_content_library_select_anon"
  on public.detail_content_library for select to anon
  using (
    coalesce(is_active, true)
    and exists (
      select 1
      from public.product_detail_content_links l
      join public.products p on p.id = l.product_id
      where l.library_id = detail_content_library.id
    )
  );

drop policy if exists "detail_content_library_select_team" on public.detail_content_library;
create policy "detail_content_library_select_team"
  on public.detail_content_library for select to authenticated
  using (
    public.is_staff(public.current_email())
    or public.is_team_member(public.current_email())
  );

drop policy if exists "detail_content_library_insert_staff" on public.detail_content_library;
create policy "detail_content_library_insert_staff"
  on public.detail_content_library for insert to authenticated
  with check (public.is_staff(public.current_email()));

drop policy if exists "detail_content_library_update_staff" on public.detail_content_library;
create policy "detail_content_library_update_staff"
  on public.detail_content_library for update to authenticated
  using (public.is_staff(public.current_email()))
  with check (public.is_staff(public.current_email()));

drop policy if exists "detail_content_library_delete_staff" on public.detail_content_library;
create policy "detail_content_library_delete_staff"
  on public.detail_content_library for delete to authenticated
  using (public.is_staff(public.current_email()));

-- product_detail_content_links
drop policy if exists "product_detail_content_links_select_anon" on public.product_detail_content_links;
create policy "product_detail_content_links_select_anon"
  on public.product_detail_content_links for select to anon
  using (
    exists (select 1 from public.products p where p.id = product_detail_content_links.product_id)
  );

drop policy if exists "product_detail_content_links_select_team" on public.product_detail_content_links;
create policy "product_detail_content_links_select_team"
  on public.product_detail_content_links for select to authenticated
  using (
    public.is_staff(public.current_email())
    or public.is_team_member(public.current_email())
  );

drop policy if exists "product_detail_content_links_insert_staff" on public.product_detail_content_links;
create policy "product_detail_content_links_insert_staff"
  on public.product_detail_content_links for insert to authenticated
  with check (public.is_staff(public.current_email()));

drop policy if exists "product_detail_content_links_update_staff" on public.product_detail_content_links;
create policy "product_detail_content_links_update_staff"
  on public.product_detail_content_links for update to authenticated
  using (public.is_staff(public.current_email()))
  with check (public.is_staff(public.current_email()));

drop policy if exists "product_detail_content_links_delete_staff" on public.product_detail_content_links;
create policy "product_detail_content_links_delete_staff"
  on public.product_detail_content_links for delete to authenticated
  using (public.is_staff(public.current_email()));

commit;
