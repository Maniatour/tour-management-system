/**
 * 구글 시트 동기화 시 행의 ID 컬럼이 DB primary key와 같아야 하는 테이블.
 * id가 비어 있으면 UUID를 새로 만들면 동기화를 반복할 때마다 중복 행이 쌓인다.
 */
export const SYNC_TABLES_REQUIRE_SHEET_ROW_ID = new Set<string>([
  'reservation_expenses',
  'company_expenses',
  'tour_expenses',
])
