-- 20260621130000 이전: current_email() 전체를 SECURITY DEFINER 로 두면
-- 일부 환경에서 auth.jwt() 가 비어 JWT 경로·auth.uid() 폴백이 동시에 망가질 수 있다.
-- JWT 파싱은 INVOKER 에서, auth.users(email) 조회만 별도 DEFINER 헬퍼로 분리한다.

begin;

create or replace function public.try_uuid_from_text(p text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
begin
  if p is null or btrim(p) = '' then
    return null;
  end if;
  if not (btrim(p) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
    return null;
  end if;
  return btrim(p)::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create or replace function public.email_from_auth_users_by_id(p_uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(nullif(trim(coalesce(u.email::text, '')), ''))
  from auth.users u
  where p_uid is not null
    and u.id = p_uid
  limit 1;
$$;

comment on function public.email_from_auth_users_by_id(uuid) is
  'auth.users.email 조회 (RLS 호출 측 JWT와 무관하게 DEFINER 로 읽음).';

create or replace function public.current_email()
returns text
language sql
stable
set search_path = public
as $$
  select lower(nullif(trim(coalesce(
    nullif(trim(coalesce(auth.jwt() ->> 'email', '')), ''),
    nullif(trim(coalesce(auth.jwt() -> 'user_metadata' ->> 'email', '')), ''),
    nullif(trim(coalesce(
      public.email_from_auth_users_by_id(
        coalesce(
          auth.uid(),
          public.try_uuid_from_text(auth.jwt() ->> 'sub'),
          public.try_uuid_from_text(current_setting('request.jwt.claim.sub', true))
        )
      ),
      ''
    )), ''),
    nullif(trim(coalesce(current_setting('request.jwt.claim.email', true), '')), ''),
    nullif(trim(coalesce(
      (coalesce(
        nullif(trim(coalesce(current_setting('request.jwt.claims', true), '')), ''),
        '{}'
      ))::jsonb ->> 'email',
      ''
    )), ''),
    ''
  )), ''));
$$;

comment on function public.current_email() is
  'JWT·user_metadata·email_from_auth_users_by_id(uid|sub)·claim 순 (INVOKER, JWT 컨텍스트 유지).';

commit;
