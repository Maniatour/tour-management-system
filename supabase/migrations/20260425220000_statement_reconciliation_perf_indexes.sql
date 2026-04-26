-- 명세 대조 화면에서 대량 조회 시 쓰는 조건/정렬 조합 인덱스
-- IF NOT EXISTS 로 배포 환경별 중복 생성 실패를 피함

CREATE INDEX IF NOT EXISTS idx_statement_lines_import_id_posted_date_id
  ON public.statement_lines(statement_import_id, posted_date, id);

CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_line_source
  ON public.reconciliation_matches(statement_line_id, source_table, source_id);
