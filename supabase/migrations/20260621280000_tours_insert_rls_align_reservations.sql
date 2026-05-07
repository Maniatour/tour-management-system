-- tours INSERT 42501: reservations_insert_accessible 과 동일한 세션·관리자 분기 보강
-- - is_team_member(session_email_from_auth_users): JWT email 경로가 비어도 auth.users 이메일로 팀 매칭
-- - is_admin_user* : Office Manager 등 관리 포지션 (is_staff 와 다른 집합일 수 있음)
--
-- Depends: public.is_staff*, public.is_team_member*, public.session_email_from_auth_users,
--   public.is_admin_user, public.is_admin_user_for_session (20260621160000 등)

begin;

drop policy if exists "tours_insert_team_or_staff" on public.tours;

create policy "tours_insert_team_or_staff"
  on public.tours for insert to authenticated
  with check (
    public.is_staff()
    or public.is_staff_for_session()
    or public.is_team_member(public.current_email())
    or public.is_team_member_for_session()
    or public.is_team_member(public.session_email_from_auth_users())
    or public.is_admin_user(public.current_email())
    or public.is_admin_user_for_session()
  );

comment on policy "tours_insert_team_or_staff" on public.tours is
  '스태프·팀·auth.users 세션 이메일·관리 포지션 중 하나면 투어 행 INSERT 허용 (예약 INSERT 정책과 정렬).';

commit;
