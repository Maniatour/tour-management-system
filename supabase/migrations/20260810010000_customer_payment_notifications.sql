-- Staff popup notifications when a customer completes Stripe web checkout payment.

begin;

create table if not exists public.customer_payment_notifications (
  id uuid primary key default gen_random_uuid(),
  reservation_id text not null references public.reservations(id) on delete cascade,
  payment_record_id text,
  payment_intent_id text not null,
  recipient_email text not null,
  amount numeric(12, 2) not null default 0,
  currency text not null default 'usd',
  customer_name text,
  customer_email text,
  customer_phone text,
  product_name text,
  tour_date date,
  adults integer,
  child integer,
  infant integer,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (payment_intent_id, reservation_id, recipient_email)
);

create index if not exists idx_customer_payment_notifications_recipient
  on public.customer_payment_notifications (lower(recipient_email), read_at, created_at desc);

create index if not exists idx_customer_payment_notifications_reservation
  on public.customer_payment_notifications (reservation_id, created_at desc);

alter table public.customer_payment_notifications enable row level security;

drop policy if exists "customer_payment_notifications_select_recipient"
  on public.customer_payment_notifications;
create policy "customer_payment_notifications_select_recipient"
  on public.customer_payment_notifications
  for select
  to authenticated
  using (
    public.is_staff(public.current_email())
    and lower(recipient_email) = public.current_email()
  );

drop policy if exists "customer_payment_notifications_update_recipient"
  on public.customer_payment_notifications;
create policy "customer_payment_notifications_update_recipient"
  on public.customer_payment_notifications
  for update
  to authenticated
  using (
    public.is_staff(public.current_email())
    and lower(recipient_email) = public.current_email()
  )
  with check (
    public.is_staff(public.current_email())
    and lower(recipient_email) = public.current_email()
  );

-- Inserts are performed by service role (webhook / confirm-payment). No staff INSERT policy.

do $$
begin
  alter publication supabase_realtime add table public.customer_payment_notifications;
exception
  when duplicate_object then null;
end $$;

commit;
