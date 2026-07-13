-- Security Advisor P1: rls_policy_always_true (~28 warnings)
-- Replaces USING(true)/WITH CHECK(true) write policies with session-aware staff/team/admin checks.
-- Depends: rls_is_staff_session_ok, rls_team_member_session_ok, rls_admin_session_ok (20260621260000+).

begin;

-- =============================================================================
-- Chat / tour announcements (staff team tools)
-- =============================================================================
drop policy if exists "chat_announcement_templates_all_authenticated" on public.chat_announcement_templates;
drop policy if exists "Allow all operations on chat_announcement_templates for authenticated users"
  on public.chat_announcement_templates;
drop policy if exists "chat_announcement_templates_team_all" on public.chat_announcement_templates;

create policy "chat_announcement_templates_team_all"
  on public.chat_announcement_templates for all to authenticated
  using (public.rls_team_member_session_ok())
  with check (public.rls_team_member_session_ok());

drop policy if exists "chat_room_announcements_all_authenticated" on public.chat_room_announcements;
drop policy if exists "chat_room_announcements_team_all" on public.chat_room_announcements;

create policy "chat_room_announcements_team_all"
  on public.chat_room_announcements for all to authenticated
  using (public.rls_team_member_session_ok())
  with check (public.rls_team_member_session_ok());

drop policy if exists "tour_announcements_all_authenticated" on public.tour_announcements;
drop policy if exists "tour_announcements_team_all" on public.tour_announcements;

create policy "tour_announcements_team_all"
  on public.tour_announcements for all to authenticated
  using (public.rls_team_member_session_ok())
  with check (public.rls_team_member_session_ok());

-- =============================================================================
-- Consultation workflow tables (internal staff)
-- =============================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'consultation_categories',
    'consultation_logs',
    'consultation_stats',
    'consultation_templates',
    'consultation_workflow_executions',
    'consultation_workflow_step_executions',
    'consultation_workflow_steps',
    'consultation_workflows'
  ]
  loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format('alter table public.%I enable row level security', t);
      execute format(
        'drop policy if exists %I on public.%I',
        t || '_team_access',
        t
      );
      execute format(
        'create policy %I on public.%I for all to authenticated using (public.rls_is_staff_session_ok()) with check (public.rls_is_staff_session_ok())',
        t || '_staff_all',
        t
      );
    end if;
  end loop;
end$$;

-- =============================================================================
-- date_notes — staff write; team read (replace legacy authenticated ALL true)
-- =============================================================================
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'date_notes'
  ) then
    alter table public.date_notes enable row level security;

    drop policy if exists "Allow authenticated users to insert date notes" on public.date_notes;
    drop policy if exists "Allow authenticated users to update date notes" on public.date_notes;
    drop policy if exists "Allow authenticated users to delete date notes" on public.date_notes;
    drop policy if exists "date_notes_insert_staff" on public.date_notes;
    drop policy if exists "date_notes_update_staff" on public.date_notes;
    drop policy if exists "date_notes_delete_staff" on public.date_notes;
    drop policy if exists "date_notes_select_staff" on public.date_notes;
    drop policy if exists "date_notes_select_team" on public.date_notes;

    create policy "date_notes_select_team"
      on public.date_notes for select to authenticated
      using (public.rls_team_member_session_ok());

    create policy "date_notes_insert_staff"
      on public.date_notes for insert to authenticated
      with check (public.rls_is_staff_session_ok());

    create policy "date_notes_update_staff"
      on public.date_notes for update to authenticated
      using (public.rls_is_staff_session_ok())
      with check (public.rls_is_staff_session_ok());

    create policy "date_notes_delete_staff"
      on public.date_notes for delete to authenticated
      using (public.rls_is_staff_session_ok());
  end if;
end$$;

-- =============================================================================
-- product_categories / product_sub_categories
-- =============================================================================
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'product_categories'
  ) then
    alter table public.product_categories enable row level security;
    drop policy if exists "Allow all operations on product_categories for authenticated us"
      on public.product_categories;
    drop policy if exists "product_categories_staff_all" on public.product_categories;

    create policy "product_categories_staff_all"
      on public.product_categories for all to authenticated
      using (public.rls_is_staff_session_ok())
      with check (public.rls_is_staff_session_ok());
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'product_sub_categories'
  ) then
    alter table public.product_sub_categories enable row level security;
    drop policy if exists "Allow all operations on product_sub_categories for authenticate"
      on public.product_sub_categories;
    drop policy if exists "product_sub_categories_staff_all" on public.product_sub_categories;

    create policy "product_sub_categories_staff_all"
      on public.product_sub_categories for all to authenticated
      using (public.rls_is_staff_session_ok())
      with check (public.rls_is_staff_session_ok());
  end if;
end$$;

-- =============================================================================
-- guide_cost_history / product_guide_costs
-- =============================================================================
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'guide_cost_history'
  ) then
    alter table public.guide_cost_history enable row level security;
    drop policy if exists "guide_cost_history_insert_policy" on public.guide_cost_history;
    drop policy if exists "guide_cost_history_insert_staff" on public.guide_cost_history;

    create policy "guide_cost_history_insert_staff"
      on public.guide_cost_history for insert to authenticated
      with check (public.rls_is_staff_session_ok());
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'product_guide_costs'
  ) then
    alter table public.product_guide_costs enable row level security;
    drop policy if exists "product_guide_costs_insert_policy" on public.product_guide_costs;
    drop policy if exists "product_guide_costs_update_policy" on public.product_guide_costs;
    drop policy if exists "product_guide_costs_delete_policy" on public.product_guide_costs;
    drop policy if exists "product_guide_costs_insert_staff" on public.product_guide_costs;
    drop policy if exists "product_guide_costs_update_staff" on public.product_guide_costs;
    drop policy if exists "product_guide_costs_delete_staff" on public.product_guide_costs;

    create policy "product_guide_costs_insert_staff"
      on public.product_guide_costs for insert to authenticated
      with check (public.rls_is_staff_session_ok());

    create policy "product_guide_costs_update_staff"
      on public.product_guide_costs for update to authenticated
      using (public.rls_is_staff_session_ok())
      with check (public.rls_is_staff_session_ok());

    create policy "product_guide_costs_delete_staff"
      on public.product_guide_costs for delete to authenticated
      using (public.rls_is_staff_session_ok());
  end if;
end$$;

-- =============================================================================
-- push_subscriptions — customer chat push (room must exist; SELECT true is OK)
-- =============================================================================
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'push_subscriptions'
  ) then
    alter table public.push_subscriptions enable row level security;

    drop policy if exists "Users can create subscriptions" on public.push_subscriptions;
    drop policy if exists "Users can update their own subscriptions" on public.push_subscriptions;
    drop policy if exists "Users can delete their own subscriptions" on public.push_subscriptions;
    drop policy if exists "push_subscriptions_staff_all" on public.push_subscriptions;

    create policy "push_subscriptions_insert_room"
      on public.push_subscriptions for insert
      with check (
        room_id is not null
        and exists (
          select 1 from public.chat_rooms cr
          where cr.id = push_subscriptions.room_id
        )
      );

    create policy "push_subscriptions_update_room"
      on public.push_subscriptions for update
      using (
        room_id is not null
        and exists (
          select 1 from public.chat_rooms cr
          where cr.id = push_subscriptions.room_id
        )
      )
      with check (
        room_id is not null
        and exists (
          select 1 from public.chat_rooms cr
          where cr.id = push_subscriptions.room_id
        )
      );

    create policy "push_subscriptions_delete_room"
      on public.push_subscriptions for delete
      using (
        room_id is not null
        and exists (
          select 1 from public.chat_rooms cr
          where cr.id = push_subscriptions.room_id
        )
      );
  end if;
end$$;

-- =============================================================================
-- tags / translations (admin CMS)
-- =============================================================================
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'tags'
  ) then
    alter table public.tags enable row level security;
    drop policy if exists "Admins can manage tags" on public.tags;
    drop policy if exists "tags_admin_all" on public.tags;

    create policy "tags_admin_all"
      on public.tags for all to authenticated
      using (public.rls_admin_session_ok())
      with check (public.rls_admin_session_ok());
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'tag_translations'
  ) then
    alter table public.tag_translations enable row level security;
    drop policy if exists "Admins can manage tag_translations" on public.tag_translations;
    drop policy if exists "tag_translations_admin_all" on public.tag_translations;

    create policy "tag_translations_admin_all"
      on public.tag_translations for all to authenticated
      using (public.rls_admin_session_ok())
      with check (public.rls_admin_session_ok());
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'translations'
  ) then
    alter table public.translations enable row level security;
    drop policy if exists "Admins can manage translations" on public.translations;
    drop policy if exists "translations_admin_all" on public.translations;

    create policy "translations_admin_all"
      on public.translations for all to authenticated
      using (public.rls_admin_session_ok())
      with check (public.rls_admin_session_ok());
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'translation_values'
  ) then
    alter table public.translation_values enable row level security;
    drop policy if exists "Admins can manage translation_values" on public.translation_values;
    drop policy if exists "translation_values_admin_all" on public.translation_values;

    create policy "translation_values_admin_all"
      on public.translation_values for all to authenticated
      using (public.rls_admin_session_ok())
      with check (public.rls_admin_session_ok());
  end if;
end$$;

-- =============================================================================
-- tour_course_categories / tour_course_points
-- =============================================================================
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'tour_course_categories'
  ) then
    alter table public.tour_course_categories enable row level security;
    drop policy if exists "팀은 투어 코스 카테고리를 수정할 수 있음" on public.tour_course_categories;
    drop policy if exists "tour_course_categories_team_all" on public.tour_course_categories;

    create policy "tour_course_categories_team_all"
      on public.tour_course_categories for all to authenticated
      using (public.rls_team_member_session_ok())
      with check (public.rls_team_member_session_ok());
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'tour_course_points'
  ) then
    alter table public.tour_course_points enable row level security;
    drop policy if exists "팀은 투어 코스 포인트를 관리할 수 있음" on public.tour_course_points;
    drop policy if exists "tour_course_points_team_all" on public.tour_course_points;

    create policy "tour_course_points_team_all"
      on public.tour_course_points for all to authenticated
      using (public.rls_team_member_session_ok())
      with check (public.rls_team_member_session_ok());
  end if;
end$$;

commit;
