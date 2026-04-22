-- 표준 카테고리: COGS(매출원가) 그룹 + 도시락·고객 제공 식사 하위

begin;

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
    'CAT024',
    'COGS (Cost of Goods Sold)',
    'COGS (매출원가)',
    'IRS Schedule C Line 4: 판매·투어에 직접 대응하는 원가(고객 제공 식음료 등)',
    true,
    18,
    null,
    'Line 4',
    100,
    true
  ),
  (
    'CAT024-001',
    'Bento / meals (customer-provided)',
    '도시락 / 식사 (고객 제공)',
    '투어·예약 고객에게 제공하는 도시락·식사 비용(원가)',
    true,
    1,
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
