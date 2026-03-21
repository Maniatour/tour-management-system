-- tours 대량 삭제(동기화) 시 tour_office_tips 행이 CASCADE 로 지워지지 않게 함.
-- tour_id 는 논리적 참조만 유지: 동일 id 로 투어가 다시 들어오면 기존 팁 행이 그대로 매칭됨.
-- (DB 레벨 FK 없음 — 존재하지 않는 tour_id 가 남을 수 있음)

ALTER TABLE tour_office_tips
  DROP CONSTRAINT IF EXISTS tour_office_tips_tour_id_fkey;

COMMENT ON COLUMN tour_office_tips.tour_id IS '투어 ID (tours.id 와 논리적 매칭; 동기화 시 tours 삭제 후에도 팁 행 유지)';
