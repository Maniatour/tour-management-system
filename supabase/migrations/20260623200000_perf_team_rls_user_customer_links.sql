-- RLS 헬퍼 is_staff / is_team_member / is_admin_user 가
--   lower(team.email) = <세션 이메일>
-- 형태로 team 을 조회한다. btree(email) 만으로는 lower(email) 조건에 잘 안 탄다.
-- 대시보드에서 본 auth.users / 세션 부하는 대부분 PK 조회이고,
-- CPU 스파이크는 team EXISTS + RLS 반복에 기인하는 경우가 많다.
--
-- 프로필 리다이렉트: user_id eq + matched_at desc + limit 1 → (user_id, matched_at) 복합.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_team_lower_email_active
  ON public.team (lower((email)::text))
  WHERE coalesce(is_active, true) = true;

CREATE INDEX IF NOT EXISTS idx_user_customer_links_user_matched_at_desc
  ON public.user_customer_links (user_id, matched_at DESC NULLS LAST);

COMMIT;
