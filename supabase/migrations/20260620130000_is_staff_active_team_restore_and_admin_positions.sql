-- Fix ticket_bookings / booking_history RLS 403 for Office Manager when public.is_staff()
-- was narrowed to a position allow-list (e.g. only 202509160001 applied) while team.position
-- uses app-localized values like '매니저' or 'office_manager'.
--
-- Canonical behavior matches 202509170055 / 202509180300: any active public.team row ⇒ staff,
-- plus whitelist emails. Safe to run repeatedly.

begin;

create or replace function public.is_staff(p_email text)
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(
    exists(
      select 1
      from public.team t
      where lower(t.email) = lower(p_email)
        and coalesce(t.is_active, true) = true
    )
    or lower(coalesce(p_email, '')) in (
      'info@maniatour.com',
      'wooyong.shim09@gmail.com'
    ),
    false
  );
$$;

comment on function public.is_staff(text) is
  '활성 team 멤버 또는 화이트리스트 이메일이면 true (ticket_bookings 등 RLS와 정렬).';

create or replace function public.is_staff()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.is_staff(public.current_email());
$$;

create or replace function public.is_admin_user(p_email text)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.team
    where lower(email) = lower(p_email)
      and is_active = true
      and lower(trim(coalesce(position::text, ''))) in (
        'super',
        'office manager',
        'admin',
        'manager',
        '매니저',
        'office_manager'
      )
  );
$$;

commit;
