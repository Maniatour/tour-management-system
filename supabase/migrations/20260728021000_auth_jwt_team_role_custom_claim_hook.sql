-- JWT custom claims: team_role, team_position, team_name_ko (AuthContext 부트스트랩 RPC 생략용)
--
-- 배포 후 Supabase Dashboard → Authentication → Auth Hooks → Custom Access Token
-- 에서 `public.custom_access_token_hook` 을 활성화해야 클레임이 JWT에 포함됩니다.
-- 훅 미활성 시 기존 RPC 폴백이 그대로 동작합니다.

begin;

create or replace function public.map_team_position_to_user_role(p_position text)
returns text
language sql
immutable
as $$
  select case
    when nullif(lower(trim(coalesce(p_position, ''))), '') is null then 'customer'
    when lower(trim(p_position)) = 'super' then 'admin'
    when lower(trim(p_position)) in ('office manager', 'office_manager', 'manager', '매니저') then 'manager'
    when lower(trim(p_position)) = 'op' then 'admin'
    when lower(trim(p_position)) in ('tour guide', 'tourguide', 'guide', 'driver') then 'team_member'
    when lower(trim(p_position)) in (
      'office', 'office staff', 'office_staff',
      '사무', '사무실', '예약', '예약실',
      'reservation', 'cs', 'counter', 'desk', 'reception', 'admin'
    ) then 'admin'
    else 'admin'
  end;
$$;

comment on function public.map_team_position_to_user_role(text) is
  'team.position → AuthContext UserRole (roles.ts 와 동기화).';

create or replace function public.resolve_user_role_for_email(p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_email text;
  v_position text;
  v_name_ko text;
  v_role text;
begin
  v_email := lower(trim(coalesce(p_email, '')));
  if v_email = '' then
    return jsonb_build_object('role', 'customer', 'position', null, 'name_ko', null);
  end if;

  if v_email in ('info@maniatour.com', 'wooyong.shim09@gmail.com') then
    return jsonb_build_object('role', 'admin', 'position', null, 'name_ko', null);
  end if;

  select t.position::text, t.name_ko
  into v_position, v_name_ko
  from public.team t
  where lower(trim(coalesce(t.email, ''))) = v_email
    and coalesce(t.is_active, true) = true
  limit 1;

  if not found then
    return jsonb_build_object('role', 'customer', 'position', null, 'name_ko', null);
  end if;

  v_role := public.map_team_position_to_user_role(v_position);
  return jsonb_build_object(
    'role', v_role,
    'position', v_position,
    'name_ko', v_name_ko
  );
end;
$$;

comment on function public.resolve_user_role_for_email(text) is
  '이메일 기준 team 역할 해석 (JWT 훅·클라이언트 폴백용).';

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  claims jsonb;
  v_email text;
  resolved jsonb;
  v_role text;
  v_position text;
  v_name_ko text;
begin
  claims := coalesce(event->'claims', '{}'::jsonb);
  v_email := lower(trim(coalesce(claims->>'email', '')));

  if v_email = '' then
    return jsonb_build_object('claims', claims);
  end if;

  resolved := public.resolve_user_role_for_email(v_email);
  v_role := coalesce(resolved->>'role', 'customer');
  v_position := resolved->>'position';
  v_name_ko := resolved->>'name_ko';

  claims := jsonb_set(claims, '{team_role}', to_jsonb(v_role), true);

  if v_position is not null and v_position <> '' then
    claims := jsonb_set(claims, '{team_position}', to_jsonb(v_position), true);
  else
    claims := claims - 'team_position';
  end if;

  if v_name_ko is not null and v_name_ko <> '' then
    claims := jsonb_set(claims, '{team_name_ko}', to_jsonb(v_name_ko), true);
  else
    claims := claims - 'team_name_ko';
  end if;

  return jsonb_build_object('claims', claims);
end;
$$;

comment on function public.custom_access_token_hook(jsonb) is
  'Supabase Custom Access Token Hook — JWT에 team_role/team_position/team_name_ko 주입.';

grant usage on schema public to supabase_auth_admin;

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant execute on function public.resolve_user_role_for_email(text) to supabase_auth_admin;
grant execute on function public.map_team_position_to_user_role(text) to supabase_auth_admin;

revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

commit;
