-- JWT 본문에 email claim 이 없거나 PostgREST 설정으로 request.jwt.claim.* 가 비는 경우
-- public.current_email() 이 '' 가 되어 ticket_bookings 등 INSERT RLS 가 모두 실패한다.
-- auth.users 에서 auth.uid() 로 이메일을 보강한다 (SECURITY DEFINER).

begin;

create or replace function public.current_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(nullif(trim(coalesce(
    nullif(trim(coalesce(auth.jwt() ->> 'email', '')), ''),
    nullif(trim(coalesce(auth.jwt() -> 'user_metadata' ->> 'email', '')), ''),
    nullif(trim(coalesce(
      (select u.email::text from auth.users u where u.id = auth.uid() limit 1),
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
  'JWT·user_metadata·auth.users(email by auth.uid())·request claim 순으로 이메일 (SECURITY DEFINER).';

commit;
