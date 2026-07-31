-- 다중 스태프 아웃리치 메시지 템플릿 (취소 안내, pending 대체 투어, 거주자 문의 등)
begin;

create table if not exists public.staff_outreach_message_templates (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('cancellation_follow_up', 'pending_alt_tour', 'resident_inquiry')),
  locale text not null check (locale in ('ko', 'en')),
  channel text not null check (channel in ('email', 'sms')),
  variant text not null default 'default',
  name text not null,
  subject_template text,
  body_template text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint staff_outreach_message_templates_unique_name
    unique (scope, locale, channel, variant, name)
);

create index if not exists staff_outreach_message_templates_lookup_idx
  on public.staff_outreach_message_templates (scope, locale, channel, variant, sort_order, name);

comment on table public.staff_outreach_message_templates is
  '스태프 이메일·문자 미리보기/복사용 다중 템플릿. scope+locale+channel+variant 그룹별 여러 개.';

alter table public.staff_outreach_message_templates enable row level security;

revoke all on table public.staff_outreach_message_templates from anon;
grant select, insert, update, delete on table public.staff_outreach_message_templates to authenticated;

drop policy if exists "staff_outreach_message_templates_select_staff"
  on public.staff_outreach_message_templates;
drop policy if exists "staff_outreach_message_templates_insert_staff"
  on public.staff_outreach_message_templates;
drop policy if exists "staff_outreach_message_templates_update_staff"
  on public.staff_outreach_message_templates;
drop policy if exists "staff_outreach_message_templates_delete_staff"
  on public.staff_outreach_message_templates;

create policy "staff_outreach_message_templates_select_staff"
  on public.staff_outreach_message_templates for select to authenticated
  using (public.rls_is_staff_session_ok());

create policy "staff_outreach_message_templates_insert_staff"
  on public.staff_outreach_message_templates for insert to authenticated
  with check (public.rls_is_staff_session_ok());

create policy "staff_outreach_message_templates_update_staff"
  on public.staff_outreach_message_templates for update to authenticated
  using (public.rls_is_staff_session_ok())
  with check (public.rls_is_staff_session_ok());

create policy "staff_outreach_message_templates_delete_staff"
  on public.staff_outreach_message_templates for delete to authenticated
  using (public.rls_is_staff_session_ok());

-- 기존 단일 템플릿 테이블 데이터 이전 (소스 테이블이 있을 때만)
do $$
begin
  if to_regclass('public.cancellation_follow_up_message_templates') is not null then
    insert into public.staff_outreach_message_templates (
      scope, locale, channel, variant, name, subject_template, body_template, sort_order, updated_at, updated_by
    )
    select
      'cancellation_follow_up',
      locale,
      channel,
      message_kind,
      case when locale = 'ko' then '기본' else 'Default' end,
      subject_template,
      body_template,
      0,
      coalesce(updated_at, now()),
      updated_by
    from public.cancellation_follow_up_message_templates
    on conflict (scope, locale, channel, variant, name) do nothing;
  end if;

  if to_regclass('public.resident_inquiry_email_templates') is not null then
    insert into public.staff_outreach_message_templates (
      scope, locale, channel, variant, name, subject_template, body_template, sort_order, updated_at, updated_by
    )
    select
      'resident_inquiry',
      locale,
      'email',
      tour_kind,
      case when locale = 'ko' then '기본' else 'Default' end,
      subject_template,
      html_template,
      0,
      coalesce(updated_at, now()),
      updated_by
    from public.resident_inquiry_email_templates
    on conflict (scope, locale, channel, variant, name) do nothing;
  end if;
end $$;

commit;
