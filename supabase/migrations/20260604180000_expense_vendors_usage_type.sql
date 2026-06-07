-- expense_vendors: 재사용 / 1회 구분 (지출 추가 선택지에는 재사용만 표시)
begin;

alter table public.expense_vendors
  add column if not exists usage_type text not null default 'reusable';

alter table public.expense_vendors
  drop constraint if exists expense_vendors_usage_type_check;

alter table public.expense_vendors
  add constraint expense_vendors_usage_type_check
  check (usage_type in ('reusable', 'one_time'));

comment on column public.expense_vendors.usage_type is
  'reusable: 지출 추가 선택지에 표시, one_time: 1회성(선택지 미표시)';

commit;
