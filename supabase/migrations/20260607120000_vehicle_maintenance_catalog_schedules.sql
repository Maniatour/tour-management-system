-- 차량 정비 항목 카탈로그 + 차량별 정기점검 스케줄
begin;

create table if not exists public.vehicle_maintenance_catalog (
  code text primary key,
  label_ko text not null,
  label_en text,
  category_group text not null,
  default_mileage_interval integer,
  default_month_interval integer,
  interval_kind text not null default 'mileage'
    check (interval_kind in ('mileage', 'months', 'both', 'inspection')),
  legacy_subcategory text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  notes_ko text,
  notes_en text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.vehicle_maintenance_catalog is '차량 정비·점검 항목 마스터 카탈로그';
comment on column public.vehicle_maintenance_catalog.legacy_subcategory is '구 vehicle_maintenance.subcategory 키와 호환 (예: oil_change)';

create table if not exists public.vehicle_maintenance_schedules (
  id uuid primary key default gen_random_uuid(),
  vehicle_id text not null references public.vehicles(id) on delete cascade,
  catalog_code text not null references public.vehicle_maintenance_catalog(code) on delete cascade,
  is_enabled boolean not null default true,
  custom_mileage_interval integer,
  custom_month_interval integer,
  last_service_date date,
  last_service_mileage integer,
  next_due_mileage integer,
  next_due_date date,
  notes text,
  last_maintenance_id text references public.vehicle_maintenance(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vehicle_id, catalog_code)
);

create index if not exists idx_vm_schedules_vehicle on public.vehicle_maintenance_schedules(vehicle_id);
create index if not exists idx_vm_schedules_catalog on public.vehicle_maintenance_schedules(catalog_code);
create index if not exists idx_vm_catalog_group on public.vehicle_maintenance_catalog(category_group, sort_order);

-- 카탈로그 시드 (전문 정비·점검 항목)
insert into public.vehicle_maintenance_catalog
  (code, label_ko, label_en, category_group, default_mileage_interval, default_month_interval, interval_kind, legacy_subcategory, sort_order, notes_ko)
values
  -- 유체·필터
  ('engine_oil', '엔진 오일 교환', 'Engine oil change', 'fluids_filters', 8000, 6, 'both', 'oil_change', 10, '엔진오일·오일필터 교환'),
  ('oil_filter', '오일 필터', 'Oil filter', 'fluids_filters', 8000, 6, 'mileage', null, 20, null),
  ('air_filter', '에어 필터', 'Air filter', 'fluids_filters', 15000, 12, 'mileage', 'filter', 30, null),
  ('cabin_filter', '캐빈 필터', 'Cabin air filter', 'fluids_filters', 15000, 12, 'mileage', null, 40, null),
  ('fuel_filter', '연료 필터', 'Fuel filter', 'fluids_filters', 30000, 24, 'mileage', null, 50, null),
  ('transmission_fluid', '변속기 오일', 'Transmission fluid', 'fluids_filters', 60000, 48, 'both', null, 60, null),
  ('differential_fluid', '디퍼렌셜 오일', 'Differential fluid', 'fluids_filters', 60000, 48, 'both', null, 70, null),
  ('transfer_case_fluid', '트랜스퍼 케이스 오일', 'Transfer case fluid', 'fluids_filters', 60000, 48, 'both', null, 80, null),
  ('power_steering_fluid', '파워스티어링 오일', 'Power steering fluid', 'fluids_filters', 50000, 36, 'mileage', null, 90, null),
  ('brake_fluid_flush', '브레이크 오일 플러시', 'Brake fluid flush', 'fluids_filters', 30000, 24, 'both', null, 100, null),
  ('coolant_flush', '냉각수 전체 플러시', 'Coolant full flush', 'fluids_filters', 60000, 48, 'both', null, 110, '라디에이터·히터코어 포함 전체 교환'),

  -- 냉각 시스템
  ('thermostat', '써모스탯', 'Thermostat', 'cooling', 60000, 60, 'mileage', null, 200, null),
  ('water_pump', '워터펌프', 'Water pump', 'cooling', 90000, 72, 'mileage', null, 210, null),
  ('radiator', '라디에이터', 'Radiator', 'cooling', 100000, 84, 'mileage', null, 220, null),
  ('coolant_hoses', '냉각수 호스 세트', 'Coolant hose set', 'cooling', 60000, 60, 'mileage', null, 230, null),
  ('radiator_cap', '라디에이터 캡', 'Radiator cap', 'cooling', 50000, 48, 'mileage', null, 240, null),

  -- 벨트·풀리
  ('serpentine_belt_set', '서펜타인 벨트 세트', 'Serpentine belt set', 'belts', 60000, 60, 'mileage', 'belt', 300, null),
  ('belt_tensioner', '벨트 텐셔너', 'Belt tensioner', 'belts', 60000, 60, 'mileage', null, 310, null),
  ('idler_pulley', '아이들러 풀리', 'Idler pulley', 'belts', 60000, 60, 'mileage', null, 320, null),
  ('timing_belt_kit', '타이밍 벨트 키트', 'Timing belt kit', 'belts', 90000, 84, 'mileage', null, 330, '간섭 엔진 해당'),

  -- 브레이크
  ('brake_pad', '브레이크 패드', 'Brake pads', 'brakes', 25000, 24, 'mileage', 'brake_pad', 400, null),
  ('brake_rotors', '브레이크 로터', 'Brake rotors', 'brakes', 50000, 48, 'mileage', null, 410, null),
  ('brake_caliper', '브레이크 캘리퍼', 'Brake caliper', 'brakes', 80000, 72, 'mileage', null, 420, null),
  ('parking_brake', '주차 브레이크', 'Parking brake', 'brakes', 40000, 36, 'mileage', null, 430, null),

  -- 서스펜션·스티어링
  ('front_strut', '프론트 스트럿', 'Front strut', 'suspension', 70000, 72, 'mileage', null, 500, null),
  ('rear_shock', '리어 쇼크', 'Rear shock absorber', 'suspension', 70000, 72, 'mileage', null, 510, null),
  ('sway_bar_link', '스웨이바 링크', 'Sway bar link', 'suspension', 50000, 48, 'mileage', null, 520, null),
  ('ball_joint', '볼조인트', 'Ball joint', 'suspension', 80000, 72, 'mileage', null, 530, null),
  ('tie_rod_end', '타이로드 엔드', 'Tie rod end', 'suspension', 60000, 60, 'mileage', null, 540, null),
  ('control_arm_bushing', '컨트롤암 부싱', 'Control arm bushing', 'suspension', 80000, 72, 'mileage', null, 550, null),
  ('wheel_bearing', '휠 베어링', 'Wheel bearing', 'suspension', 90000, 84, 'mileage', null, 560, null),
  ('alignment', '휠 얼라인먼트', 'Wheel alignment', 'suspension', 10000, 12, 'mileage', 'alignment', 570, null),

  -- 타이어
  ('tire_rotation', '타이어 로테이션', 'Tire rotation', 'tires', 6000, 6, 'mileage', 'tire_rotation', 600, null),
  ('tire_replacement', '타이어 교체', 'Tire replacement', 'tires', 40000, 48, 'mileage', null, 610, null),
  ('tire_balance', '타이어 밸런스', 'Tire balance', 'tires', 12000, 12, 'mileage', null, 620, null),

  -- 드라이브트레인
  ('u_joint', 'U-Joint', 'U-Joint', 'drivetrain', 60000, 60, 'mileage', null, 700, null),
  ('center_support_bearing', '센터 서포트 베어링', 'Center support bearing', 'drivetrain', 80000, 72, 'mileage', null, 710, null),
  ('driveshaft', '드라이브샤프트', 'Driveshaft', 'drivetrain', 120000, 96, 'mileage', null, 720, null),
  ('cv_axle', 'CV 액슬', 'CV axle', 'drivetrain', 80000, 72, 'mileage', null, 730, null),
  ('differential_service', '디퍼렌셜 서비스', 'Differential service', 'drivetrain', 60000, 48, 'mileage', null, 740, null),

  -- 엔진·연료
  ('spark_plug', '스파크 플러그', 'Spark plugs', 'engine', 30000, 36, 'mileage', 'spark_plug', 800, null),
  ('ignition_coil', '점화 코일', 'Ignition coil', 'engine', 80000, 72, 'mileage', null, 810, null),
  ('injector_balance', '인젝터 밸런스', 'Injector balance', 'engine', 60000, 48, 'inspection', null, 820, '연료 분사 균형·누설 점검'),
  ('compression_test', '압축압력 측정', 'Compression test', 'engine', 50000, 48, 'inspection', null, 830, null),
  ('turbo_play_check', '터보 유격 점검', 'Turbo play check', 'engine', 30000, 24, 'inspection', null, 840, '축·웨이스트게이트 유격'),
  ('pcv_valve', 'PCV 밸브', 'PCV valve', 'engine', 50000, 48, 'mileage', null, 850, null),
  ('fuel_injector_service', '연료 인젝터 서비스', 'Fuel injector service', 'engine', 30000, 24, 'mileage', null, 860, null),

  -- 배기·디젤·SCR
  ('dpf_service', 'DPF 서비스', 'DPF service', 'emissions', 100000, 60, 'both', null, 900, null),
  ('dpf_regeneration_check', 'DPF 재생 점검', 'DPF regeneration check', 'emissions', 15000, 12, 'inspection', null, 910, null),
  ('scr_system', 'SCR 시스템', 'SCR system', 'emissions', 100000, 72, 'both', null, 920, null),
  ('def_injector', 'DEF 인젝터', 'DEF injector', 'emissions', 80000, 60, 'mileage', null, 930, null),
  ('nox_sensor', 'NOx 센서', 'NOx sensor', 'emissions', 100000, 72, 'mileage', null, 940, null),
  ('egr_valve', 'EGR 밸브', 'EGR valve', 'emissions', 80000, 60, 'mileage', null, 950, null),
  ('diesel_particulate_clean', 'DPF 클리닝', 'DPF cleaning', 'emissions', 80000, 48, 'mileage', null, 960, null),

  -- 전기
  ('battery', '배터리', 'Battery', 'electrical', 50000, 48, 'both', 'battery', 1000, null),
  ('alternator', '알터네이터', 'Alternator', 'electrical', 100000, 84, 'mileage', null, 1010, null),
  ('starter', '스타터', 'Starter motor', 'electrical', 120000, 96, 'mileage', null, 1020, null),

  -- 외장·기타
  ('windshield_wiper', '와이퍼 블레이드', 'Wiper blades', 'exterior', 12000, 12, 'both', 'windshield_wiper', 1100, null),
  ('car_wash_detail', '세차·디테일링', 'Car wash & detail', 'exterior', 3000, 1, 'months', 'car_wash', 1110, null),

  -- 점검
  ('multi_point_inspection', '멀티포인트 점검', 'Multi-point inspection', 'inspection', 6000, 6, 'both', null, 1200, null),
  ('pre_trip_inspection', '출발 전 점검', 'Pre-trip inspection', 'inspection', 3000, 1, 'inspection', null, 1210, '투어 전 필수 점검'),
  ('dot_inspection', 'DOT 차량 점검', 'DOT inspection', 'inspection', null, 12, 'months', null, 1220, '법정 점검')
on conflict (code) do update set
  label_ko = excluded.label_ko,
  label_en = excluded.label_en,
  category_group = excluded.category_group,
  default_mileage_interval = excluded.default_mileage_interval,
  default_month_interval = excluded.default_month_interval,
  interval_kind = excluded.interval_kind,
  legacy_subcategory = excluded.legacy_subcategory,
  sort_order = excluded.sort_order,
  notes_ko = excluded.notes_ko,
  updated_at = now();

alter table public.vehicle_maintenance_catalog enable row level security;
alter table public.vehicle_maintenance_schedules enable row level security;

revoke all on table public.vehicle_maintenance_catalog from anon;
revoke all on table public.vehicle_maintenance_schedules from anon;
grant select, insert, update, delete on table public.vehicle_maintenance_catalog to authenticated;
grant select, insert, update, delete on table public.vehicle_maintenance_schedules to authenticated;

drop policy if exists "vehicle_maintenance_catalog_select" on public.vehicle_maintenance_catalog;
create policy "vehicle_maintenance_catalog_select" on public.vehicle_maintenance_catalog
  for select to authenticated using (true);

drop policy if exists "vehicle_maintenance_catalog_staff_write" on public.vehicle_maintenance_catalog;
create policy "vehicle_maintenance_catalog_staff_write" on public.vehicle_maintenance_catalog
  for all to authenticated
  using (public.rls_is_staff_session_ok())
  with check (public.rls_is_staff_session_ok());

drop policy if exists "vehicle_maintenance_schedules_select" on public.vehicle_maintenance_schedules;
create policy "vehicle_maintenance_schedules_select" on public.vehicle_maintenance_schedules
  for select to authenticated using (true);

drop policy if exists "vehicle_maintenance_schedules_staff_write" on public.vehicle_maintenance_schedules;
create policy "vehicle_maintenance_schedules_staff_write" on public.vehicle_maintenance_schedules
  for all to authenticated
  using (public.rls_is_staff_session_ok())
  with check (public.rls_is_staff_session_ok());

commit;
