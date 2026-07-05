-- expense_vendors: OCR·영수증 변형 이름 → 정규 결제처명 매핑
alter table public.expense_vendors
  add column if not exists match_aliases text[] not null default '{}';

comment on column public.expense_vendors.match_aliases is
  'OCR·영수증에 자주 나오는 변형·별칭. 자동 입력 시 canonical name(name)으로 매핑';

-- 투어 현장에서 자주 나오는 결제처·별칭
insert into public.expense_vendors (name, usage_type, match_aliases)
values
  (
    'Lake Powell Travel Plaza',
    'reusable',
    array['lake powell travel', 'lake powell travel p', 'lake powell travel plaza', 'lake powell']
  ),
  (
    'Horseshoe Bend',
    'reusable',
    array['horseshoe bend', 'horseshoe bend parking', 'horseshoe bend trailhead']
  )
on conflict (name) do update set
  match_aliases = excluded.match_aliases,
  usage_type = case
    when expense_vendors.usage_type = 'reusable' then expense_vendors.usage_type
    else excluded.usage_type
  end;

update public.expense_vendors
set match_aliases = array[
  'antelope canyon tours',
  'lower antelope',
  'upper antelope',
  'antelope x',
  'ken''s tours',
  'navajo tours'
]
where name = 'Antelope Canyon';

update public.expense_vendors
set match_aliases = array[
  'grand canyon south rim',
  'south rim',
  'mather point',
  'grand canyon national park'
]
where name = 'Grand Canyon';

update public.expense_vendors
set match_aliases = array['shell', 'chevron', 'exxon', 'mobil', 'arco', 'bp', '76', 'circle k', 'speedway']
where name = 'Shell Station';

update public.expense_vendors
set match_aliases = array['parking fee', 'parkmobile', 'spothero']
where name = 'Parking Lot';
