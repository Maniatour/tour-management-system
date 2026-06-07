-- 차량 연료(휘발유/디젤) · 정비 차급 + 카탈로그 적용 대상
begin;

alter table public.vehicles
  add column if not exists fuel_type text not null default 'diesel';

alter table public.vehicles
  drop constraint if exists vehicles_fuel_type_check;

alter table public.vehicles
  add constraint vehicles_fuel_type_check
  check (fuel_type in ('gasoline', 'diesel'));

alter table public.vehicles
  add column if not exists maintenance_vehicle_class text not null default 'diesel_van';

alter table public.vehicles
  drop constraint if exists vehicles_maintenance_vehicle_class_check;

alter table public.vehicles
  add constraint vehicles_maintenance_vehicle_class_check
  check (maintenance_vehicle_class in ('minivan', 'minibus', 'diesel_van', 'motorcoach'));

comment on column public.vehicles.fuel_type is '연료: gasoline(휘발유), diesel(디젤)';
comment on column public.vehicles.maintenance_vehicle_class is '정비 차급: minivan, minibus, diesel_van(Sprinter 등), motorcoach(SC2 등)';

alter table public.vehicle_maintenance_catalog
  add column if not exists applicable_fuel_types text[];

alter table public.vehicle_maintenance_catalog
  add column if not exists applicable_vehicle_classes text[];

comment on column public.vehicle_maintenance_catalog.applicable_fuel_types is '적용 연료 (null·빈 배열=전체). 예: {diesel}';
comment on column public.vehicle_maintenance_catalog.applicable_vehicle_classes is '적용 차급 (null·빈 배열=전체). 예: {motorcoach}';

-- 디젤 전용 (배기·SCR·DPF 등)
update public.vehicle_maintenance_catalog
set applicable_fuel_types = array['diesel']::text[]
where code in (
  'dpf_service',
  'dpf_regeneration_check',
  'def_injector',
  'diesel_particulate_clean',
  'def_fluid_service',
  'diesel_water_separator',
  'glow_plug',
  'turbocharger_service',
  'diesel_high_pressure_pump',
  'doc_catalyst',
  'adblue_tank_cleaning'
);

-- 대형 코치(SC2) 전용 — 에어 브레이크
update public.vehicle_maintenance_catalog
set applicable_vehicle_classes = array['motorcoach']::text[]
where category_group = 'air_brakes'
   or code in (
  'coach_hvac_roof_unit',
  'air_suspension_bellows',
  'air_leveling_valve',
  'tag_axle_service',
  'king_pin',
  'drag_link',
  'engine_retarder',
  'passenger_entry_door',
  'wheelchair_lift',
  'emergency_exit_hardware',
  'passenger_seat_inspection',
  'exterior_lighting_dot',
  'destination_sign',
  'dot_annual_inspection'
);

-- Sprinter 디젤 밴 전용
update public.vehicle_maintenance_catalog
set applicable_vehicle_classes = array['diesel_van']::text[]
where code in (
  'rear_drum_brake',
  'rear_leaf_spring_bushing',
  'sliding_door_sprinter',
  'roof_ac_unit',
  'auxiliary_heater',
  'auxiliary_battery'
);

-- 회사 차량: 2018 Kia Sedona → 휘발유 미니밴
update public.vehicles
set
  fuel_type = 'gasoline',
  maintenance_vehicle_class = 'minivan',
  maintenance_duty_preset = coalesce(nullif(maintenance_duty_preset, ''), 'tour_highway_severe')
where coalesce(vehicle_category, 'company') = 'company'
  and (
    lower(coalesce(vehicle_type, '')) like '%sedona%'
    or (year = 2018 and lower(coalesce(vehicle_type, '')) like '%kia%')
  );

-- 회사 차량: 2019 Ford Transit → 휘발유 미니버스
update public.vehicles
set
  fuel_type = 'gasoline',
  maintenance_vehicle_class = 'minibus',
  maintenance_duty_preset = coalesce(nullif(maintenance_duty_preset, ''), 'tour_highway_severe')
where coalesce(vehicle_category, 'company') = 'company'
  and (
    lower(coalesce(vehicle_type, '')) like '%transit%'
    or (year = 2019 and lower(coalesce(vehicle_type, '')) like '%ford%')
  );

-- 나머지 회사 차량: 디젤 (Sprinter·SC2 등)
update public.vehicles
set fuel_type = 'diesel'
where coalesce(vehicle_category, 'company') = 'company'
  and fuel_type is distinct from 'gasoline';

-- Freightliner SC2 등 대형 코치
update public.vehicles
set maintenance_vehicle_class = 'motorcoach'
where coalesce(vehicle_category, 'company') = 'company'
  and fuel_type = 'diesel'
  and (
    lower(coalesce(vehicle_type, '')) like '%freightliner%'
    or lower(coalesce(vehicle_type, '')) like '%sc2%'
    or lower(coalesce(vehicle_type, '')) like '%motorcoach%'
    or lower(coalesce(vehicle_type, '')) like '%coach%'
  );

-- 디젤 밴(Sprinter 등) — 코치가 아닌 회사 차량
update public.vehicles
set maintenance_vehicle_class = 'diesel_van'
where coalesce(vehicle_category, 'company') = 'company'
  and fuel_type = 'diesel'
  and maintenance_vehicle_class not in ('motorcoach');

-- 휘발유 차량 권장 오일 주기 (투어 프리셋 기준 7,500 mi)
update public.vehicles
set engine_oil_change_cycle = 7500
where fuel_type = 'gasoline'
  and coalesce(engine_oil_change_cycle, 10000) >= 10000;

commit;
