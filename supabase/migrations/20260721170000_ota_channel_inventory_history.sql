-- OTA 채널 재고·마감 설정 변경 이력

begin;

create table if not exists public.ota_channel_inventory_history (
  id uuid primary key default gen_random_uuid(),
  operator_id text not null default 'M00001',
  product_id text not null references public.products(id) on delete cascade,
  channel_id text not null references public.channels(id) on delete cascade,
  variant_key text not null default 'default',
  inventory_date date not null,
  sale_status text
    check (sale_status is null or sale_status in ('on_sale', 'low', 'sold_out', 'not_for_sale')),
  antelope_x_seats integer,
  antelope_l_seats integer,
  vehicle_seats integer,
  notes text,
  updated_by_email text,
  updated_by_name text,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_ota_channel_inventory_history_lookup
  on public.ota_channel_inventory_history (
    product_id,
    channel_id,
    variant_key,
    inventory_date,
    recorded_at desc
  );

comment on table public.ota_channel_inventory_history is
  'OTA 채널별 일자 재고·판매상태 변경 이력 (마감 설정 추적)';

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

drop trigger if exists trg_ota_channel_inventory_history on public.ota_channel_inventory;
create trigger trg_ota_channel_inventory_history
  after insert or update on public.ota_channel_inventory
  for each row
  execute function public.log_ota_channel_inventory_history();

alter table public.ota_channel_inventory_history enable row level security;

drop policy if exists ota_channel_inventory_history_staff_select on public.ota_channel_inventory_history;
create policy ota_channel_inventory_history_staff_select
  on public.ota_channel_inventory_history for select
  to authenticated
  using (public.is_staff());

drop policy if exists ota_channel_inventory_history_staff_insert on public.ota_channel_inventory_history;
create policy ota_channel_inventory_history_staff_insert
  on public.ota_channel_inventory_history for insert
  to authenticated
  with check (public.is_staff());

commit;
