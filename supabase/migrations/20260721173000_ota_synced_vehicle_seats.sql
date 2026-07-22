-- OTA 사이트에 수동 반영한 차량 잔여 좌석 (버튼 클릭으로 기록)

begin;

alter table public.ota_channel_inventory
  add column if not exists ota_synced_vehicle_seats integer;

comment on column public.ota_channel_inventory.ota_synced_vehicle_seats is
  '운영팀이 OTA 사이트에 수동 반영한 차량 잔여 좌석 (내부 잔여와 달라지면 버튼 재표시)';

alter table public.ota_channel_inventory_history
  add column if not exists ota_synced_vehicle_seats integer;

create or replace function public.log_ota_channel_inventory_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.ota_channel_inventory_history (
      operator_id,
      product_id,
      channel_id,
      variant_key,
      inventory_date,
      sale_status,
      antelope_x_seats,
      antelope_l_seats,
      vehicle_seats,
      ota_synced_vehicle_seats,
      notes,
      updated_by_email,
      updated_by_name,
      recorded_at
    ) values (
      new.operator_id,
      new.product_id,
      new.channel_id,
      coalesce(new.variant_key, 'default'),
      new.inventory_date,
      new.sale_status,
      new.antelope_x_seats,
      new.antelope_l_seats,
      new.vehicle_seats,
      new.ota_synced_vehicle_seats,
      new.notes,
      new.updated_by_email,
      new.updated_by_name,
      coalesce(new.updated_at, now())
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if (
      old.sale_status is distinct from new.sale_status
      or old.antelope_x_seats is distinct from new.antelope_x_seats
      or old.antelope_l_seats is distinct from new.antelope_l_seats
      or old.vehicle_seats is distinct from new.vehicle_seats
      or old.ota_synced_vehicle_seats is distinct from new.ota_synced_vehicle_seats
      or old.notes is distinct from new.notes
      or old.updated_by_email is distinct from new.updated_by_email
      or old.updated_by_name is distinct from new.updated_by_name
    ) then
      insert into public.ota_channel_inventory_history (
        operator_id,
        product_id,
        channel_id,
        variant_key,
        inventory_date,
        sale_status,
        antelope_x_seats,
        antelope_l_seats,
        vehicle_seats,
        ota_synced_vehicle_seats,
        notes,
        updated_by_email,
        updated_by_name,
        recorded_at
      ) values (
        new.operator_id,
        new.product_id,
        new.channel_id,
        coalesce(new.variant_key, 'default'),
        new.inventory_date,
        new.sale_status,
        new.antelope_x_seats,
        new.antelope_l_seats,
        new.vehicle_seats,
        new.ota_synced_vehicle_seats,
        new.notes,
        new.updated_by_email,
        new.updated_by_name,
        coalesce(new.updated_at, now())
      );
    end if;
    return new;
  end if;

  return new;
end;
$$;

commit;
