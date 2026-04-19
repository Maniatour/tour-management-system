-- 동일 CSV 재업로드 방지: 본문 해시(금융 계정별 유일)
begin;

ALTER TABLE public.statement_imports
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

COMMENT ON COLUMN public.statement_imports.content_hash IS '정규화 CSV 본문 SHA-256(hex). 동일 계정·동일 파일 재가져오기 차단';

CREATE UNIQUE INDEX IF NOT EXISTS idx_statement_imports_account_content_hash
  ON public.statement_imports (financial_account_id, content_hash)
  WHERE content_hash IS NOT NULL AND length(btrim(content_hash)) > 0;

commit;
