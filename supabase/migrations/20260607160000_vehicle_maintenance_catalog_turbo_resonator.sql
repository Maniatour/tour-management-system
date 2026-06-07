-- Turbo Resonator 교체 (Sprinter 디젤 터보 배기 공명기)
begin;

insert into public.vehicle_maintenance_catalog
  (code, label_ko, label_en, category_group, default_mileage_interval, default_month_interval, interval_kind, sort_order, notes_ko, notes_en, applicable_fuel_types)
values
  (
    'turbo_resonator_replacement',
    'Turbo Resonator 교체',
    'Turbo resonator replacement',
    'engine',
    80000,
    60,
    'mileage',
    872,
    'Sprinter 2500 디젤 — 터보·배기 공명기(크랙·누설 시)',
    'Sprinter 2500 diesel — turbo exhaust resonator (crack/leak)',
    array['diesel']::text[]
  )
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
  applicable_fuel_types = excluded.applicable_fuel_types,
  updated_at = now();

commit;
