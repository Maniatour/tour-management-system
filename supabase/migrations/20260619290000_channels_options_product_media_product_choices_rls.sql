-- Step 17 (RLS hardening): channels, options, product_media, product_choices, choice_options
-- Depends: public.is_staff(text), public.current_email(), public.is_team_member(text).

begin;

-- ---------- channels (기존 SELECT USING(true) 제거, 공개 채팅 favicon 등 최소 anon) ----------
alter table public.channels enable row level security;

drop policy if exists "channels_select_all" on public.channels;
drop policy if exists "channels_modify_staff_only" on public.channels;
drop policy if exists "channels_insert_staff" on public.channels;
drop policy if exists "channels_update_staff" on public.channels;
drop policy if exists "channels_delete_staff" on public.channels;
drop policy if exists "channels_select_anon_self" on public.channels;
drop policy if exists "channels_select_anon_catalog" on public.channels;
drop policy if exists "channels_select_team" on public.channels;

revoke all on table public.channels from anon;
grant select on table public.channels to anon;
grant select, insert, update, delete on table public.channels to authenticated;

-- 공개 메타데이터(파비콘·홈페이지 채널 M00001 등)와 self/website 예약 흐름용 최소 노출
create policy "channels_select_anon_catalog"
  on public.channels for select to anon
  using (
    lower(trim(coalesce(type::text, ''))) in ('self', 'website')
    or id in ('SELF', 'M00001', 'HOMEPAGE')
    or (favicon_url is not null and btrim(favicon_url) <> '')
  );

create policy "channels_select_team"
  on public.channels for select to authenticated
  using (public.is_team_member(public.current_email()));

create policy "channels_insert_staff"
  on public.channels for insert to authenticated
  with check (public.is_staff(public.current_email()));

create policy "channels_update_staff"
  on public.channels for update to authenticated
  using (public.is_staff(public.current_email()))
  with check (public.is_staff(public.current_email()));

create policy "channels_delete_staff"
  on public.channels for delete to authenticated
  using (public.is_staff(public.current_email()));

-- ---------- options (공개 예약: 비템플릿 옵션만 anon 읽기) ----------
alter table public.options enable row level security;

drop policy if exists "options_select_all" on public.options;
drop policy if exists "options_modify_staff_only" on public.options;
drop policy if exists "options_insert_staff" on public.options;
drop policy if exists "options_update_staff" on public.options;
drop policy if exists "options_delete_staff" on public.options;
drop policy if exists "options_select_anon_catalog" on public.options;
drop policy if exists "options_select_team" on public.options;

revoke all on table public.options from anon;
grant select on table public.options to anon;
grant select, insert, update, delete on table public.options to authenticated;

create policy "options_select_anon_catalog"
  on public.options for select to anon
  using (coalesce(is_choice_template, false) = false);

create policy "options_select_team"
  on public.options for select to authenticated
  using (public.is_team_member(public.current_email()));

create policy "options_insert_staff"
  on public.options for insert to authenticated
  with check (public.is_staff(public.current_email()));

create policy "options_update_staff"
  on public.options for update to authenticated
  using (public.is_staff(public.current_email()))
  with check (public.is_staff(public.current_email()));

create policy "options_delete_staff"
  on public.options for delete to authenticated
  using (public.is_staff(public.current_email()));

-- ---------- product_media ----------
alter table public.product_media enable row level security;

drop policy if exists "Anyone can view product media" on public.product_media;
drop policy if exists "Authenticated users can insert product media" on public.product_media;
drop policy if exists "Authenticated users can update product media" on public.product_media;
drop policy if exists "Authenticated users can delete product media" on public.product_media;
drop policy if exists "product_media_select_anon" on public.product_media;
drop policy if exists "product_media_select_team" on public.product_media;
drop policy if exists "product_media_insert_staff" on public.product_media;
drop policy if exists "product_media_update_staff" on public.product_media;
drop policy if exists "product_media_delete_staff" on public.product_media;

revoke all on table public.product_media from anon;
grant select on table public.product_media to anon;
grant select, insert, update, delete on table public.product_media to authenticated;

create policy "product_media_select_anon"
  on public.product_media for select to anon
  using (
    exists (
      select 1
      from public.products p
      where p.id = product_media.product_id
    )
    and coalesce(product_media.is_active, true)
  );

create policy "product_media_select_team"
  on public.product_media for select to authenticated
  using (public.is_team_member(public.current_email()));

create policy "product_media_insert_staff"
  on public.product_media for insert to authenticated
  with check (public.is_staff(public.current_email()));

create policy "product_media_update_staff"
  on public.product_media for update to authenticated
  using (public.is_staff(public.current_email()))
  with check (public.is_staff(public.current_email()));

create policy "product_media_delete_staff"
  on public.product_media for delete to authenticated
  using (public.is_staff(public.current_email()));

-- ---------- product_choices ----------
alter table public.product_choices enable row level security;

drop policy if exists "product_choices_select_anon" on public.product_choices;
drop policy if exists "product_choices_select_team" on public.product_choices;
drop policy if exists "product_choices_insert_staff" on public.product_choices;
drop policy if exists "product_choices_update_staff" on public.product_choices;
drop policy if exists "product_choices_delete_staff" on public.product_choices;

revoke all on table public.product_choices from anon;
grant select on table public.product_choices to anon;
grant select, insert, update, delete on table public.product_choices to authenticated;

create policy "product_choices_select_anon"
  on public.product_choices for select to anon
  using (
    product_id is not null
    and exists (select 1 from public.products p where p.id = product_choices.product_id)
    and coalesce(product_choices.is_active, true)
  );

create policy "product_choices_select_team"
  on public.product_choices for select to authenticated
  using (public.is_team_member(public.current_email()));

create policy "product_choices_insert_staff"
  on public.product_choices for insert to authenticated
  with check (public.is_staff(public.current_email()));

create policy "product_choices_update_staff"
  on public.product_choices for update to authenticated
  using (public.is_staff(public.current_email()))
  with check (public.is_staff(public.current_email()));

create policy "product_choices_delete_staff"
  on public.product_choices for delete to authenticated
  using (public.is_staff(public.current_email()));

-- ---------- choice_options ----------
alter table public.choice_options enable row level security;

drop policy if exists "choice_options_select_anon" on public.choice_options;
drop policy if exists "choice_options_select_team" on public.choice_options;
drop policy if exists "choice_options_insert_staff" on public.choice_options;
drop policy if exists "choice_options_update_staff" on public.choice_options;
drop policy if exists "choice_options_delete_staff" on public.choice_options;

revoke all on table public.choice_options from anon;
grant select on table public.choice_options to anon;
grant select, insert, update, delete on table public.choice_options to authenticated;

create policy "choice_options_select_anon"
  on public.choice_options for select to anon
  using (
    choice_id is not null
    and coalesce(choice_options.is_active, true)
    and exists (
      select 1
      from public.product_choices pc
      where pc.id = choice_options.choice_id
        and pc.product_id is not null
        and exists (select 1 from public.products p where p.id = pc.product_id)
        and coalesce(pc.is_active, true)
    )
  );

create policy "choice_options_select_team"
  on public.choice_options for select to authenticated
  using (public.is_team_member(public.current_email()));

create policy "choice_options_insert_staff"
  on public.choice_options for insert to authenticated
  with check (public.is_staff(public.current_email()));

create policy "choice_options_update_staff"
  on public.choice_options for update to authenticated
  using (public.is_staff(public.current_email()))
  with check (public.is_staff(public.current_email()));

create policy "choice_options_delete_staff"
  on public.choice_options for delete to authenticated
  using (public.is_staff(public.current_email()));

commit;
