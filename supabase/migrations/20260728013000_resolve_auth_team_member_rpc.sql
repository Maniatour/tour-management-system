-- AuthContext 역할 확인: JWT 세션 이메일 기준 team 1회 조회 (DEFINER, RLS 우회)
-- 클라이언트가 이메일을 넘기지 않아도 되며, get_team_member_info 폴백과 함께 사용한다.

begin;

create or replace function public.resolve_auth_team_member()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_email text;
  v_row record;
begin
  v_email := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  if v_email = '' then
    return jsonb_build_object('found', false);
  end if;

  select
    t.email,
    t.name_ko,
    t.name_en,
    t.position::text as position,
    coalesce(t.is_active, true) as is_active
  into v_row
  from public.team t
  where lower(trim(coalesce(t.email, ''))) = v_email
    and coalesce(t.is_active, true) = true
  limit 1;

  if not found then
    return jsonb_build_object('found', false, 'email', v_email);
  end if;

  return jsonb_build_object(
    'found', true,
    'email', v_row.email,
    'name_ko', v_row.name_ko,
    'name_en', v_row.name_en,
    'position', v_row.position,
    'is_active', v_row.is_active
  );
end;
$$;

comment on function public.resolve_auth_team_member() is
  '현재 JWT 세션 이메일로 team 역할 행 1회 조회 (AuthContext 부트스트랩용).';

grant execute on function public.resolve_auth_team_member() to authenticated;

commit;
