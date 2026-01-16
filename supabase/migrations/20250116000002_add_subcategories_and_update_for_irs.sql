-- 서브카테고리 기능 추가 및 IRS Schedule C에 맞게 카테고리 업데이트

-- 표준 카테고리 테이블에 parent_id 추가 (서브카테고리 지원)
ALTER TABLE expense_standard_categories 
ADD COLUMN IF NOT EXISTS parent_id TEXT REFERENCES expense_standard_categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS irs_schedule_c_line TEXT, -- IRS Schedule C 라인 번호
ADD COLUMN IF NOT EXISTS deduction_limit_percent INTEGER DEFAULT 100; -- 공제 한도 (예: 식비는 50%)

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_expense_standard_categories_parent ON expense_standard_categories(parent_id);

-- 카테고리 매핑 테이블에 sub_category_id 추가
ALTER TABLE expense_category_mappings
ADD COLUMN IF NOT EXISTS sub_category_id TEXT REFERENCES expense_standard_categories(id) ON DELETE SET NULL;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_expense_category_mappings_sub ON expense_category_mappings(sub_category_id);

-- 기존 카테고리들을 IRS Schedule C에 맞게 업데이트 및 재구성
-- 메인 카테고리 (IRS Schedule C 기준)
UPDATE expense_standard_categories SET 
  name = 'Car and Truck Expenses',
  name_ko = '차량비',
  description = 'IRS Schedule C Line 9: 차량 운영비 (연료, 수리, 보험, 감가상각 등)',
  irs_schedule_c_line = 'Line 9',
  deduction_limit_percent = 100
WHERE id = 'CAT001';

UPDATE expense_standard_categories SET 
  name = 'Travel',
  name_ko = '여행비',
  description = 'IRS Schedule C Line 24a: 사업상 여행비 (항공료, 숙박, 주차, 통행료 등)',
  irs_schedule_c_line = 'Line 24a',
  deduction_limit_percent = 100
WHERE id = 'CAT003';

UPDATE expense_standard_categories SET 
  name = 'Meals',
  name_ko = '식비',
  description = 'IRS Schedule C Line 24b: 사업상 식비 (50% 공제)',
  irs_schedule_c_line = 'Line 24b',
  deduction_limit_percent = 50
WHERE id = 'CAT002';

UPDATE expense_standard_categories SET 
  name = 'Other Expenses',
  name_ko = '기타 경비',
  description = 'IRS Schedule C: 기타 일반적이고 필요한 사업 경비',
  irs_schedule_c_line = 'Line 27',
  deduction_limit_percent = 100
WHERE id = 'CAT012';

-- 새로운 IRS Schedule C 카테고리 추가
INSERT INTO expense_standard_categories (id, name, name_ko, description, tax_deductible, display_order, irs_schedule_c_line, deduction_limit_percent) VALUES
  ('CAT013', 'Contract Labor', '용역비', 'IRS Schedule C Line 11: 독립 계약자 비용 (가이드, 어시스턴트 등)', true, 7, 'Line 11', 100),
  ('CAT014', 'Depreciation', '감가상각', 'IRS Schedule C Line 13: 자산 감가상각', true, 12, 'Line 13', 100),
  ('CAT015', 'Insurance', '보험료', 'IRS Schedule C Line 15: 사업 보험료', true, 9, 'Line 15', 100),
  ('CAT016', 'Interest', '이자', 'IRS Schedule C Line 16a: 사업 관련 이자', true, 13, 'Line 16a', 100),
  ('CAT017', 'Legal and Professional Services', '법률/전문 서비스', 'IRS Schedule C Line 17: 변호사, 회계사 등 전문 서비스', true, 14, 'Line 17', 100),
  ('CAT018', 'Office Expense', '사무용품', 'IRS Schedule C Line 18: 사무용품 및 소모품', true, 8, 'Line 18', 100),
  ('CAT019', 'Rent or Lease', '임대료', 'IRS Schedule C Line 20a: 사무실, 장비 임대료', true, 10, 'Line 20a', 100),
  ('CAT020', 'Repairs and Maintenance', '수리/유지보수', 'IRS Schedule C Line 21: 수리 및 유지보수', true, 11, 'Line 21', 100),
  ('CAT021', 'Supplies', '소모품', 'IRS Schedule C Line 22: 사업용 소모품', true, 15, 'Line 22', 100),
  ('CAT022', 'Taxes and Licenses', '세금 및 라이센스', 'IRS Schedule C Line 23: 사업 세금 및 라이센스', true, 16, 'Line 23', 100),
  ('CAT023', 'Utilities', '공과금', 'IRS Schedule C Line 25: 전기, 가스, 수도, 인터넷 등', true, 6, 'Line 25', 100)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  name_ko = EXCLUDED.name_ko,
  description = EXCLUDED.description,
  irs_schedule_c_line = EXCLUDED.irs_schedule_c_line,
  deduction_limit_percent = EXCLUDED.deduction_limit_percent;

-- 기존 카테고리들을 서브카테고리로 재구성하거나 업데이트
-- 예: Equipment & Supplies를 Supplies의 서브카테고리로
UPDATE expense_standard_categories SET 
  parent_id = 'CAT021',
  name = 'Tour Equipment',
  name_ko = '투어 장비',
  description = '투어 관련 장비 및 소모품',
  display_order = 1
WHERE id = 'CAT005';

UPDATE expense_standard_categories SET 
  parent_id = 'CAT013',
  name = 'Guide Fees',
  name_ko = '가이드비',
  description = '가이드 및 투어 리더 비용',
  display_order = 1
WHERE id = 'CAT006';

UPDATE expense_standard_categories SET 
  parent_id = 'CAT012',
  name = 'Marketing & Advertising',
  name_ko = '마케팅/광고비',
  description = '광고, 홍보, 마케팅 비용',
  display_order = 1
WHERE id = 'CAT007';

UPDATE expense_standard_categories SET 
  parent_id = 'CAT023',
  name = 'Office Utilities',
  name_ko = '사무실 공과금',
  description = '사무실 전기, 가스, 수도, 인터넷 등',
  display_order = 1
WHERE id = 'CAT008';

UPDATE expense_standard_categories SET 
  parent_id = 'CAT015',
  name = 'Business Insurance',
  name_ko = '사업 보험료',
  description = '사업 관련 보험료',
  display_order = 1
WHERE id = 'CAT009';

UPDATE expense_standard_categories SET 
  parent_id = 'CAT012',
  name = 'Fees & Commissions',
  name_ko = '수수료',
  description = '결제 수수료, 채널 수수료 등',
  display_order = 2
WHERE id = 'CAT010';

UPDATE expense_standard_categories SET 
  parent_id = 'CAT003',
  name = 'Tips & Gratuities',
  name_ko = '팁',
  description = '여행 중 팁 및 사례금',
  display_order = 1
WHERE id = 'CAT011';

UPDATE expense_standard_categories SET 
  parent_id = 'CAT003',
  name = 'Admission Fees',
  name_ko = '입장료',
  description = '관광지, 박물관, 공연 입장료',
  display_order = 2
WHERE id = 'CAT004';

-- 서브카테고리 예시 추가 (Travel 하위)
INSERT INTO expense_standard_categories (id, name, name_ko, description, tax_deductible, display_order, parent_id, irs_schedule_c_line, deduction_limit_percent) VALUES
  ('CAT003-001', 'Airfare', '항공료', '항공권 비용', true, 1, 'CAT003', 'Line 24a', 100),
  ('CAT003-002', 'Lodging', '숙박비', '호텔, 모텔 등 숙박 비용', true, 2, 'CAT003', 'Line 24a', 100),
  ('CAT003-003', 'Ground Transportation', '지상 교통', '택시, 셔틀, 렌터카 등', true, 3, 'CAT003', 'Line 24a', 100),
  ('CAT003-004', 'Parking & Tolls', '주차 및 통행료', '주차비, 통행료', true, 4, 'CAT003', 'Line 24a', 100),
  ('CAT001-001', 'Gas & Fuel', '연료비', '차량 연료', true, 1, 'CAT001', 'Line 9', 100),
  ('CAT001-002', 'Repairs & Maintenance', '수리 및 유지보수', '차량 수리 및 정비', true, 2, 'CAT001', 'Line 9', 100),
  ('CAT001-003', 'Vehicle Insurance', '차량 보험', '차량 보험료', true, 3, 'CAT001', 'Line 9', 100),
  ('CAT001-004', 'Vehicle Registration', '차량 등록', '차량 등록 및 면허', true, 4, 'CAT001', 'Line 9', 100),
  ('CAT002-001', 'Business Meals', '사업 식비', '사업 관련 식사 (50% 공제)', true, 1, 'CAT002', 'Line 24b', 50),
  ('CAT002-002', 'Client Entertainment Meals', '고객 접대 식사', '고객 접대 식사 (50% 공제)', true, 2, 'CAT002', 'Line 24b', 50),
  ('CAT002-003', 'Tour Customer Meals', '투어 고객 식사', '투어 중 고객에게 제공하는 식사 비용 (50% 공제)', true, 3, 'CAT002', 'Line 24b', 50),
  ('CAT021-001', 'Tour Customer Supplies', '투어 고객 소모품', '투어 고객에게 제공하는 소모품 (물, 간식, 기타 제공품 등)', true, 1, 'CAT021', 'Line 22', 100)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  name_ko = EXCLUDED.name_ko,
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  irs_schedule_c_line = EXCLUDED.irs_schedule_c_line,
  deduction_limit_percent = EXCLUDED.deduction_limit_percent;
