-- Chat bans table to block specific customers from a room
create table if not exists public.chat_bans (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  customer_name text,
  client_id text,
  reason text,
  banned_until timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_bans_room_id on public.chat_bans(room_id);
create index if not exists idx_chat_bans_client_id on public.chat_bans(client_id);
create index if not exists idx_chat_bans_customer_name on public.chat_bans(customer_name);

