-- 차량별 정비 주기 프리셋 (일반 / 투어 하이웨이 심한 조건 / 시내 혼합)
begin;

alter table public.vehicles
  add column if not exists maintenance_duty_preset text not null default 'standard';

alter table public.vehicles
  drop constraint if exists vehicles_maintenance_duty_preset_check;

alter table public.vehicles
  add constraint vehicles_maintenance_duty_preset_check
  check (maintenance_duty_preset in ('standard', 'tour_highway_severe', 'city_mixed'));

comment on column public.vehicles.maintenance_duty_preset is
  '정비 마일리지 주기 프리셋: standard(카탈로그 기본), tour_highway_severe(장거리 하이웨이 투어), city_mixed(시내·혼합)';

-- 회사 차량은 투어 하이웨이 심한 조건을 기본 적용 (이미 수동 설정된 값은 유지하지 않음 — 신규 컬럼만)
update public.vehicles
set maintenance_duty_preset = 'tour_highway_severe'
where coalesce(vehicle_category, 'company') = 'company';

commit;
