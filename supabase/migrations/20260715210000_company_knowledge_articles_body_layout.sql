-- 운영 허브 문서: 구조화 / 일반(원문) 본문 레이아웃
-- 기존 행은 모두 structured 로 유지 (DEFAULT)

ALTER TABLE public.company_knowledge_articles
  ADD COLUMN IF NOT EXISTS body_layout text NOT NULL DEFAULT 'structured';

ALTER TABLE public.company_knowledge_articles
  DROP CONSTRAINT IF EXISTS company_knowledge_articles_body_layout_check;

ALTER TABLE public.company_knowledge_articles
  ADD CONSTRAINT company_knowledge_articles_body_layout_check
  CHECK (body_layout IN ('structured', 'plain'));

COMMENT ON COLUMN public.company_knowledge_articles.body_layout IS
  'structured = 섹션 구조 보기 기본, plain = 원문 보기 기본';
