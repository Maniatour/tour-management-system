-- pg_stat_statements 상위 부하 완화
--
-- 1) tours + reservation_ids && $1 (PostgREST overlaps):
--    RLS USING 에서 행과 무관한 STABLE 함수가 후보 행마다 재평가되는 것을 막기 위해
--    (select …) 스칼라 서브쿼리로 InitPlan 유도 (한 문장당 1회).
-- 2) weather_data: ORDER BY updated_at DESC LIMIT … (최신 행 조회)용 인덱스.

begin;

-- ---------- tours SELECT RLS ----------
drop policy if exists "tours_select_authenticated" on public.tours;

create policy "tours_select_authenticated"
  on public.tours for select to authenticated
  using (
    (select public.tours_write_position_ok())
    or exists (
      select 1
      from unnest((select public.tours_actor_emails())) as actor(email)
      where actor.email = any (public.tours_normalize_email_list(coalesce(tour_guide_id, '')))
         or actor.email = any (public.tours_normalize_email_list(coalesce(assistant_id, '')))
    )
  );

comment on policy "tours_select_authenticated" on public.tours is
  '직책 허용·가이드/어시 배정: actor/position 판별은 (select …)로 문장 단위 1회 평가 유도.';

-- ---------- weather_data ----------
create index if not exists idx_weather_data_updated_at_desc
  on public.weather_data (updated_at desc);

comment on index public.idx_weather_data_updated_at_desc is
  '최신 캐시 행 조회(ORDER BY updated_at DESC LIMIT) 가속';

commit;
