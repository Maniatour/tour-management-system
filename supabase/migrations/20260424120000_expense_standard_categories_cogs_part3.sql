-- COGS (Part III): 투어 실행에 직접 들어가는 원가 항목 확장 (CAT024 하위)

begin;

update public.expense_standard_categories
set
  description = 'IRS Schedule C Line 4 (COGS): 투어 실행에 직접 들어가는 원가 — 호텔·입장료·도시락·헬기·서브투어·투어용 렌탈·유류·가이드 외주 등',
  name = 'COGS (Part III — tour direct cost)',
  name_ko = 'COGS (매출원가 · 투어 직접비)',
  updated_at = now()
where id = 'CAT024';

insert into public.expense_standard_categories (
  id,
  name,
  name_ko,
  description,
  tax_deductible,
  display_order,
  parent_id,
  irs_schedule_c_line,
  deduction_limit_percent,
  is_active
) values
  (
    'CAT024-002',
    'Tour hotel / lodging (customer itinerary)',
    '호텔 비용 (투어 일정, 1박2일 등)',
    '투어 고객 일정에 포함된 숙박·호텔 원가(매출원가)',
    true,
    2,
    'CAT024',
    'Line 4',
    100,
    true
  ),
  (
    'CAT024-003',
    'Antelope Canyon admission (tour COGS)',
    '앤텔로프 캐년 입장료',
    '투어에 포함된 앤텔로프 캐년 입장·예약 비용(원가)',
    true,
    3,
    'CAT024',
    'Line 4',
    100,
    true
  ),
  (
    'CAT024-004',
    'Grand Canyon National Park admission (tour COGS)',
    '그랜드 캐년 국립공원 입장료',
    '투어에 포함된 그랜드 캐년 NP 입장·허가 비용(원가)',
    true,
    4,
    'CAT024',
    'Line 4',
    100,
    true
  ),
  (
    'CAT024-005',
    'Helicopter tour wholesale / COGS',
    '헬기 투어 원가',
    '고객에게 판매하는 헬기 투어의 매입·원가',
    true,
    5,
    'CAT024',
    'Line 4',
    100,
    true
  ),
  (
    'CAT024-006',
    'External vendor / sub-tour (COGS)',
    '외부 업체 비용 (서브 투어)',
    '메인 투어에 끼워 판매·실행하는 외부 서브투어·벤더 정산 원가',
    true,
    6,
    'CAT024',
    'Line 4',
    100,
    true
  ),
  (
    'CAT024-007',
    'Vehicle rental (dedicated to tour execution)',
    '차량 렌탈 (투어용)',
    '해당 투어 실행에만 쓰는 렌탈 차량 비용(원가)',
    true,
    7,
    'CAT024',
    'Line 4',
    100,
    true
  ),
  (
    'CAT024-008',
    'Fuel — tour execution vehicles (COGS)',
    '유류비 (투어 차량)',
    '투어 실행 차량에 투입된 연료비(원가). 회사 일반 차량 연료와 구분',
    true,
    8,
    'CAT024',
    'Line 4',
    100,
    true
  ),
  (
    'CAT024-009',
    'Guide / staff outsourcing (tour COGS)',
    '가이드 외주 비용 (투어 원가)',
    '해당 투어에 배정된 가이드·스태프 외주·일당 등 투어 직접 인건비(원가)',
    true,
    9,
    'CAT024',
    'Line 4',
    100,
    true
  )
on conflict (id) do update set
  name = excluded.name,
  name_ko = excluded.name_ko,
  description = excluded.description,
  tax_deductible = excluded.tax_deductible,
  display_order = excluded.display_order,
  parent_id = excluded.parent_id,
  irs_schedule_c_line = excluded.irs_schedule_c_line,
  deduction_limit_percent = excluded.deduction_limit_percent,
  is_active = excluded.is_active,
  updated_at = now();

commit;
