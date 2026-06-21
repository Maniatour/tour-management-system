-- AuthContext 역할 확인: team RLS·JWT 타이밍으로 SELECT 가 빈 경우 DEFINER RPC 로 position 포함 조회

begin;

create or replace function public.get_team_member_info(p_email text)
returns table(
  email text,
  name_ko text,
  name_en text,
  position text,
  is_active boolean
)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    t.email,
    t.name_ko,
    t.name_en,
    t.position::text,
    coalesce(t.is_active, true)
  from public.team t
  where lower(trim(coalesce(t.email, ''))) = lower(trim(coalesce(p_email, '')))
    and coalesce(t.is_active, true) = true
  limit 1;
$$;

comment on function public.get_team_member_info(text) is
  '역할 확인용 team 행 (DEFINER, position 포함, RLS·JWT 지연 우회).';

grant execute on function public.get_team_member_info(text) to authenticated;

commit;
