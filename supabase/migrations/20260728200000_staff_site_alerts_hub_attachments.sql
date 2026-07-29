-- 사이트 알림에 운영 허브 문서 첨부
ALTER TABLE public.staff_site_alerts
  ADD COLUMN IF NOT EXISTS linked_hub_article_ids uuid[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.staff_site_alerts.linked_hub_article_ids IS
  '첨부된 운영 허브(company_knowledge_articles) 문서 ID 목록';
