-- 고객 노출 내용 편집기: 채널 그룹 레이아웃을 모든 사용자가 동일하게 보도록 shared_settings에 보관
-- 읽기: RLS로 로그인 여부와 무관하게 SELECT 가능한 기존 정책 활용
-- 쓰기: 기존과 동일하게 admin/super만 수정 가능

INSERT INTO public.shared_settings (setting_key, setting_value)
VALUES (
  'product_details_channel_group_layout',
  '{"version":1,"mode":"by_type","customGroups":[]}'::jsonb
)
ON CONFLICT (setting_key) DO NOTHING;
