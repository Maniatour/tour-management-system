-- Sprinter 2500 · Freightliner SC2 차종 맞춤 정비 항목 추가
begin;

insert into public.vehicle_maintenance_catalog
  (code, label_ko, label_en, category_group, default_mileage_interval, default_month_interval, interval_kind, sort_order, notes_ko, notes_en)
values
  -- 공통 보강
  ('def_fluid_service', 'DEF(요소수) 보충·품질 점검', 'DEF fluid top-off & quality check', 'fluids_filters', 15000, 6, 'both', 115, 'Sprinter 2500 디젤', 'Mercedes Sprinter 2500 diesel'),
  ('diesel_water_separator', '디젤 워터 세퍼레이터', 'Diesel water separator', 'fluids_filters', 20000, 12, 'mileage', 118, 'Sprinter 2500', 'Sprinter 2500'),
  ('transmission_filter', '변속기 필터', 'Transmission filter', 'fluids_filters', 40000, 36, 'mileage', 125, 'Sprinter 722.9 자동변속기', 'Sprinter 722.9 AT'),

  -- HVAC (투어 밴·코치 공통)
  ('ac_refrigerant_service', 'A/C 냉매 충전·누설 점검', 'A/C refrigerant & leak check', 'hvac', 30000, 24, 'both', 130, '승객 실내 냉방', 'Passenger cabin cooling'),
  ('ac_compressor', 'A/C 컴프레서', 'A/C compressor', 'hvac', 80000, 72, 'mileage', 140, null, null),
  ('blower_motor', '블로어 모터', 'Blower motor', 'hvac', 70000, 60, 'mileage', 150, null, null),
  ('heater_core', '히터 코어', 'Heater core', 'hvac', 100000, 84, 'mileage', 160, null, null),
  ('roof_ac_unit', '루프/후면 에어컨 유닛', 'Roof/rear A/C unit', 'hvac', 40000, 36, 'both', 170, 'Sprinter 투어 밴 후면 A/C', 'Sprinter tour van rear A/C'),
  ('auxiliary_heater', '보조 히터 (Espar/Webasto)', 'Auxiliary block heater', 'hvac', 50000, 48, 'both', 180, 'Sprinter 한랭지 투어', 'Sprinter cold-climate tours'),
  ('coach_hvac_roof_unit', '코치 루프 HVAC 유닛', 'Coach roof HVAC unit', 'hvac', 30000, 24, 'both', 190, 'Freightliner SC2 코치', 'Freightliner SC2 coach'),

  -- 브레이크 보강 (Sprinter 유압)
  ('brake_hoses_lines', '브레이크 호스·라인', 'Brake hoses & lines', 'brakes', 50000, 48, 'mileage', 435, 'Sprinter 2500', 'Sprinter 2500'),
  ('brake_master_cylinder', '브레이크 마스터 실린더', 'Brake master cylinder', 'brakes', 80000, 72, 'mileage', 440, null, null),
  ('abs_wheel_speed_sensor', 'ABS 휠 속도 센서', 'ABS wheel speed sensor', 'brakes', 60000, 60, 'mileage', 445, null, null),
  ('rear_drum_brake', '후륜 드럼 브레이크', 'Rear drum brake service', 'brakes', 30000, 24, 'mileage', 450, 'Sprinter 2500 후륜 드럼', 'Sprinter 2500 rear drum'),

  -- 에어 브레이크 (Freightliner SC2 코치)
  ('air_brake_chamber', '에어 브레이크 챔버', 'Air brake chamber', 'air_brakes', 100000, 24, 'both', 460, 'Freightliner SC2', 'Freightliner SC2'),
  ('air_brake_slack_adjuster', '슬랙 어저스터', 'Slack adjuster', 'air_brakes', 80000, 24, 'both', 465, 'Freightliner SC2', 'Freightliner SC2'),
  ('air_dryer_cartridge', '에어 드라이어 카트리지', 'Air dryer cartridge', 'air_brakes', 25000, 12, 'both', 470, 'Freightliner SC2', 'Freightliner SC2'),
  ('air_compressor', '에어 컴프레서', 'Air compressor', 'air_brakes', 150000, 36, 'both', 475, 'Freightliner SC2', 'Freightliner SC2'),
  ('air_tank_drain', '에어 탱크 배수·수분 제거', 'Air tank drain & moisture purge', 'air_brakes', 5000, 1, 'both', 480, 'Freightliner SC2 월 1회 권장', 'Freightliner SC2 monthly'),
  ('air_brake_lining_inspection', '에어 브레이크 라이닝 점검', 'Air brake lining inspection', 'air_brakes', 25000, 6, 'inspection', 485, 'Freightliner SC2 DOT', 'Freightliner SC2 DOT'),
  ('brake_drums_air', '에어 브레이크 드럼', 'Air brake drums', 'air_brakes', 100000, 48, 'mileage', 490, 'Freightliner SC2', 'Freightliner SC2'),
  ('parking_brake_chamber', '스프링 브레이크 챔버', 'Spring/parking brake chamber', 'air_brakes', 100000, 24, 'both', 495, 'Freightliner SC2', 'Freightliner SC2'),

  -- 서스펜션 보강
  ('air_suspension_bellows', '에어 서스펜션 밸로우', 'Air suspension bellows', 'suspension', 150000, 60, 'both', 575, 'Freightliner SC2', 'Freightliner SC2'),
  ('air_leveling_valve', '에어 레벨링 밸브', 'Air leveling valve', 'suspension', 100000, 48, 'both', 580, 'Freightliner SC2', 'Freightliner SC2'),
  ('tag_axle_service', '태그 액슬 서비스', 'Tag axle service', 'suspension', 80000, 48, 'mileage', 585, 'Freightliner SC2 3축', 'Freightliner SC2 tri-axle'),
  ('king_pin', '킹핀', 'King pin', 'suspension', 150000, 60, 'both', 590, 'Freightliner SC2 스티어 액슬', 'Freightliner SC2 steer axle'),
  ('drag_link', '드래그 링크', 'Drag link', 'suspension', 100000, 48, 'mileage', 595, 'Freightliner SC2', 'Freightliner SC2'),
  ('rear_leaf_spring_bushing', '리어 리프 스프링 부싱', 'Rear leaf spring bushing', 'suspension', 60000, 48, 'mileage', 598, 'Sprinter 2500', 'Sprinter 2500'),

  -- 엔진·디젤 (Sprinter)
  ('glow_plug', '글로우 플러그', 'Glow plugs', 'engine', 100000, 84, 'mileage', 865, 'Sprinter 2500 디젤', 'Sprinter 2500 diesel'),
  ('turbocharger_service', '터보차저 서비스', 'Turbocharger service', 'engine', 60000, 48, 'mileage', 870, 'Sprinter 2500 디젤', 'Sprinter 2500 diesel'),
  ('diesel_high_pressure_pump', '디젤 고압 연료 펌프', 'Diesel high-pressure fuel pump', 'engine', 120000, 96, 'mileage', 875, 'Sprinter 2500', 'Sprinter 2500'),
  ('doc_catalyst', 'DOC (디젤 산화 촉매)', 'Diesel oxidation catalyst (DOC)', 'emissions', 100000, 72, 'mileage', 965, 'Sprinter 2500', 'Sprinter 2500'),
  ('adblue_tank_cleaning', 'AdBlue 탱크 세척', 'AdBlue tank cleaning', 'emissions', 80000, 60, 'mileage', 970, 'Sprinter 2500', 'Sprinter 2500'),

  -- 전기
  ('headlight_assembly', '헤드라이트', 'Headlight assembly', 'electrical', 50000, 48, 'mileage', 1025, null, null),
  ('tail_lamp_assembly', '테일·브레이크 램프', 'Tail & brake lamps', 'electrical', 50000, 48, 'mileage', 1030, null, null),
  ('auxiliary_battery', '보조 배터리', 'Auxiliary battery', 'electrical', 50000, 36, 'both', 1035, 'Sprinter 2500 듀얼 배터리', 'Sprinter 2500 dual battery'),
  ('alternator_drive_belt', '알터네이터 드라이브 벨트', 'Alternator drive belt', 'electrical', 60000, 60, 'mileage', 1040, null, null),

  -- 타이어
  ('tpms_sensor', 'TPMS 센서', 'TPMS sensor', 'tires', 60000, 48, 'mileage', 625, null, null),
  ('tread_depth_inspection', '트레드 깊이 측정', 'Tread depth inspection', 'tires', 6000, 3, 'inspection', 630, 'DOT·투어 전', 'Pre-tour / DOT'),

  -- 코치 차체 (Freightliner SC2)
  ('passenger_entry_door', '승객 도어 개폐 장치', 'Passenger entry door mechanism', 'coach_body', 40000, 12, 'both', 700, 'Freightliner SC2', 'Freightliner SC2'),
  ('sliding_door_sprinter', '슬라이딩 도어 (Sprinter)', 'Sliding door mechanism', 'coach_body', 30000, 24, 'both', 710, 'Sprinter 2500 투어 밴', 'Sprinter 2500 tour van'),
  ('wheelchair_lift', '휠체어 리프트', 'Wheelchair lift', 'coach_body', 12000, 6, 'both', 720, 'ADA·Freightliner SC2', 'ADA / Freightliner SC2'),
  ('emergency_exit_hardware', '비상구 하드웨어', 'Emergency exit hardware', 'coach_body', 12000, 6, 'inspection', 730, 'Freightliner SC2 DOT', 'Freightliner SC2 DOT'),
  ('passenger_seat_inspection', '승객 시트·안전벨트 점검', 'Passenger seat & seatbelt check', 'coach_body', 12000, 6, 'inspection', 740, 'Freightliner SC2', 'Freightliner SC2'),
  ('exterior_lighting_dot', '외부 조명 (DOT)', 'Exterior lighting (DOT)', 'coach_body', 12000, 6, 'inspection', 750, 'Freightliner SC2', 'Freightliner SC2'),
  ('destination_sign', '행선 표시기', 'Destination sign', 'coach_body', 25000, 12, 'both', 760, 'Freightliner SC2', 'Freightliner SC2'),

  -- 안전·법규
  ('fire_extinguisher_inspection', '소화기 점검', 'Fire extinguisher inspection', 'safety_compliance', null, 12, 'months', 800, 'Freightliner SC2 DOT 필수', 'Freightliner SC2 DOT required'),
  ('emergency_triangle_kit', '비상 삼각대·안전키트', 'Emergency triangle & safety kit', 'safety_compliance', null, 12, 'months', 810, null, null),
  ('first_aid_kit', '응급키트', 'First aid kit', 'safety_compliance', null, 12, 'months', 820, null, null),
  ('dot_annual_inspection', 'DOT 연간 차량 검사', 'DOT annual vehicle inspection', 'safety_compliance', null, 12, 'months', 830, 'Freightliner SC2', 'Freightliner SC2'),
  ('brake_lining_thickness', '브레이크 라이닝 두께', 'Brake lining thickness', 'safety_compliance', 25000, 6, 'inspection', 840, 'Sprinter·SC2', 'Sprinter & SC2'),
  ('steering_play_inspection', '스티어링 유격 점검', 'Steering play inspection', 'safety_compliance', 12000, 6, 'inspection', 850, null, null),
  ('suspension_play_inspection', '서스펜션 유격 점검', 'Suspension play inspection', 'safety_compliance', 12000, 6, 'inspection', 860, null, null),
  ('fluid_leak_inspection', '누유·누액 점검', 'Fluid leak inspection', 'safety_compliance', 6000, 3, 'inspection', 870, '투어 전', 'Pre-tour'),

  -- 배기 (가솔린·보조)
  ('o2_sensor', 'O2 센서', 'O2 sensor', 'exhaust', 80000, 72, 'mileage', 900, null, null),
  ('muffler_exhaust_pipe', '머플러·배기 파이프', 'Muffler & exhaust pipe', 'exhaust', 100000, 84, 'mileage', 910, null, null),

  -- 드라이브트레인
  ('engine_retarder', '엔진 리타더', 'Engine retarder / Jake brake', 'drivetrain', 80000, 48, 'mileage', 745, 'Freightliner SC2', 'Freightliner SC2')
on conflict (code) do update set
  label_ko = excluded.label_ko,
  label_en = excluded.label_en,
  category_group = excluded.category_group,
  default_mileage_interval = excluded.default_mileage_interval,
  default_month_interval = excluded.default_month_interval,
  interval_kind = excluded.interval_kind,
  sort_order = excluded.sort_order,
  notes_ko = excluded.notes_ko,
  notes_en = excluded.notes_en,
  updated_at = now();

commit;
