-- 이슈 테이블 간소화: 유형, 담당자, 마감일 컬럼 제거
ALTER TABLE public.issues DROP COLUMN IF EXISTS issue_type;
ALTER TABLE public.issues DROP COLUMN IF EXISTS assigned_to;
ALTER TABLE public.issues DROP COLUMN IF EXISTS due_date;
