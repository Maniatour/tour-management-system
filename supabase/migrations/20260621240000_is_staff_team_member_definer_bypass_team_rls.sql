-- team 테이블 RLS 가 is_staff() / is_team_member() 를 쓰는데,
-- 두 함수 본문이 다시 public.team 을 조회하면 RLS 가 재진입하며 무한 재귀 → PostgREST 500.
-- team 읽기는 SECURITY DEFINER + row_security=off + plpgsql(인라인 방지) 로만 수행한다.
--
-- Depends: current_email(), session_email_from_auth_users() 등 기존 헬퍼

begin;

create or replace function public.is_staff(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  em text := lower(nullif(trim(coalesce(p_email, '')), ''));
begin
  if em is null or length(em) = 0 then
    return false;
  end if;
  if em in ('info@maniatour.com', 'wooyong.shim09@gmail.com') then
    return true;
  end if;
  return exists (
    select 1
    from public.team t
    where lower(t.email) = em
      and coalesce(t.is_active, true) = true
  );
end;
$$;

comment on function public.is_staff(text) is
  '활성 team 멤버 또는 화이트리스트 (DEFINER, team RLS 재귀 방지).';

create or replace function public.is_staff()
returns boolean
language plpgsql
stable
set search_path = public
as $$
begin
  return public.is_staff(public.current_email());
end;
$$;

create or replace function public.is_team_member(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  em text := lower(nullif(trim(coalesce(p_email, '')), ''));
begin
  if em is null or length(em) = 0 then
    return false;
  end if;
  return exists (
    select 1
    from public.team t
    where lower(t.email) = em
      and coalesce(t.is_active, true) = true
  );
end;
$$;

create or replace function public.is_admin_user(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  em text := lower(nullif(trim(coalesce(p_email, '')), ''));
begin
  if em is null or length(em) = 0 then
    return false;
  end if;
  return exists (
    select 1
    from public.team
    where lower(email) = em
      and coalesce(is_active, true) = true
      and lower(trim(coalesce(position::text, ''))) in (
        'super',
        'office manager',
        'admin',
        'manager',
        '매니저',
        'office_manager'
      )
  );
end;
$$;

commit;
