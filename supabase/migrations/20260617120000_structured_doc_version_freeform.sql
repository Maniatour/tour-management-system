-- 자유 서식 본문을 게시 버전 행에 함께 보관 (초안 테이블 없이 버전 단위로 관리)
ALTER TABLE public.company_sop_versions
  ADD COLUMN IF NOT EXISTS freeform_markdown text NOT NULL DEFAULT '';

ALTER TABLE public.company_employee_contract_versions
  ADD COLUMN IF NOT EXISTS freeform_markdown text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.company_sop_versions.freeform_markdown IS '관리자 자유 서식(한 페이지) 탭 마크다운; 직원 게시·서명은 구조화 본문 기준';
COMMENT ON COLUMN public.company_employee_contract_versions.freeform_markdown IS '관리자 자유 서식(한 페이지) 탭 마크다운; 직원 게시·서명은 구조화 본문 기준';
