-- Step 11 (RLS hardening): ticket_bookings, tour_hotel_bookings, booking_history,
--   ticket_booking_* child tables, ticket_invoice_attachments,
--   expense_categories, expense_vendors, guide_cost_notes, reservation_reviews,
--   office_meal_log, company_expense_paid_for_labels, company_expense_vehicle_maintenance_links,
--   message_translations
-- Depends: public.tour_expense_row_accessible_as_assignee, public.current_email(),
--   public.is_staff(), public.is_team_member (509180160).

begin;

-- ---------- Helpers: 부킹 행 접근 (가이드/어시 = 투어 배정, 미연결 티켓은 제출자 본인) ----------
create or replace function public.ticket_booking_row_accessible(p_booking_id text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select p_booking_id is not null
  and exists (
    select 1
    from public.ticket_bookings tb
    where tb.id = p_booking_id
      and (
        public.is_staff()
        or (
          tb.tour_id is not null
          and public.tour_expense_row_accessible_as_assignee(tb.tour_id)
        )
        or (
          tb.tour_id is null
          and lower(trim(coalesce(tb.submitted_by, ''))) = lower(trim(coalesce(public.current_email(), '')))
        )
      )
  );
$$;

comment on function public.ticket_booking_row_accessible(text) is
  'RLS: 티켓 부킹 행 — 스태프, 해당 투어 배정 가이드/어시, 또는 tour_id 없음+submitted_by=JWT';

create or replace function public.tour_hotel_booking_row_accessible(p_booking_id text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select p_booking_id is not null
  and exists (
    select 1
    from public.tour_hotel_bookings hb
    where hb.id = p_booking_id
      and (
        public.is_staff()
        or (
          hb.tour_id is not null
          and public.tour_expense_row_accessible_as_assignee(hb.tour_id)
        )
      )
  );
$$;

comment on function public.tour_hotel_booking_row_accessible(text) is
  'RLS: 호텔 부킹 행 — 스태프 또는 투어 연결 시 해당 투어 배정 가이드/어시 (tour_id 없으면 스태프만)';

-- ---------- ticket_bookings ----------
alter table public.ticket_bookings enable row level security;

drop policy if exists "Enable all access for ticket_bookings" on public.ticket_bookings;

revoke all on table public.ticket_bookings from anon;
grant select, insert, update, delete on table public.ticket_bookings to authenticated;

create policy "ticket_bookings_select_accessible"
  on public.ticket_bookings for select to authenticated
  using (public.ticket_booking_row_accessible(id));

create policy "ticket_bookings_insert_accessible"
  on public.ticket_bookings for insert to authenticated
  with check (
    public.is_staff()
    or (
      tour_id is not null
      and public.tour_expense_row_accessible_as_assignee(tour_id)
    )
    or (
      tour_id is null
      and lower(trim(coalesce(submitted_by, ''))) = lower(trim(coalesce(public.current_email(), '')))
    )
  );

create policy "ticket_bookings_update_accessible"
  on public.ticket_bookings for update to authenticated
  using (public.ticket_booking_row_accessible(id))
  with check (
    public.is_staff()
    or (
      tour_id is not null
      and public.tour_expense_row_accessible_as_assignee(tour_id)
    )
    or (
      tour_id is null
      and lower(trim(coalesce(submitted_by, ''))) = lower(trim(coalesce(public.current_email(), '')))
    )
  );

create policy "ticket_bookings_delete_accessible"
  on public.ticket_bookings for delete to authenticated
  using (public.ticket_booking_row_accessible(id));

-- ---------- tour_hotel_bookings ----------
alter table public.tour_hotel_bookings enable row level security;

drop policy if exists "Enable all access for tour_hotel_bookings" on public.tour_hotel_bookings;

revoke all on table public.tour_hotel_bookings from anon;
grant select, insert, update, delete on table public.tour_hotel_bookings to authenticated;

create policy "tour_hotel_bookings_select_accessible"
  on public.tour_hotel_bookings for select to authenticated
  using (public.tour_hotel_booking_row_accessible(id));

create policy "tour_hotel_bookings_insert_accessible"
  on public.tour_hotel_bookings for insert to authenticated
  with check (
    public.is_staff()
    or (
      tour_id is not null
      and public.tour_expense_row_accessible_as_assignee(tour_id)
    )
  );

create policy "tour_hotel_bookings_update_accessible"
  on public.tour_hotel_bookings for update to authenticated
  using (public.tour_hotel_booking_row_accessible(id))
  with check (
    public.is_staff()
    or (
      tour_id is not null
      and public.tour_expense_row_accessible_as_assignee(tour_id)
    )
  );

create policy "tour_hotel_bookings_delete_accessible"
  on public.tour_hotel_bookings for delete to authenticated
  using (public.tour_hotel_booking_row_accessible(id));

-- ---------- booking_history (트리거 INSERT 포함) ----------
alter table public.booking_history enable row level security;

drop policy if exists "Enable all access for booking_history" on public.booking_history;

revoke all on table public.booking_history from anon;
grant select, insert, update, delete on table public.booking_history to authenticated;

create policy "booking_history_select_accessible"
  on public.booking_history for select to authenticated
  using (
    public.is_staff()
    or (
      booking_type = 'ticket'
      and public.ticket_booking_row_accessible(booking_id)
    )
    or (
      booking_type = 'hotel'
      and public.tour_hotel_booking_row_accessible(booking_id)
    )
  );

create policy "booking_history_insert_accessible"
  on public.booking_history for insert to authenticated
  with check (
    public.is_staff()
    or (
      booking_type = 'ticket'
      and public.ticket_booking_row_accessible(booking_id)
    )
    or (
      booking_type = 'hotel'
      and public.tour_hotel_booking_row_accessible(booking_id)
    )
  );

create policy "booking_history_update_staff"
  on public.booking_history for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "booking_history_delete_staff"
  on public.booking_history for delete to authenticated
  using (public.is_staff());

-- ---------- ticket_booking_status_logs ----------
alter table public.ticket_booking_status_logs enable row level security;

drop policy if exists "Enable all access for ticket_booking_status_logs" on public.ticket_booking_status_logs;

revoke all on table public.ticket_booking_status_logs from anon;
grant select, insert, update, delete on table public.ticket_booking_status_logs to authenticated;

create policy "ticket_booking_status_logs_select_accessible"
  on public.ticket_booking_status_logs for select to authenticated
  using (public.ticket_booking_row_accessible(ticket_booking_id));

create policy "ticket_booking_status_logs_insert_accessible"
  on public.ticket_booking_status_logs for insert to authenticated
  with check (public.ticket_booking_row_accessible(ticket_booking_id));

create policy "ticket_booking_status_logs_update_accessible"
  on public.ticket_booking_status_logs for update to authenticated
  using (public.ticket_booking_row_accessible(ticket_booking_id))
  with check (public.ticket_booking_row_accessible(ticket_booking_id));

create policy "ticket_booking_status_logs_delete_staff"
  on public.ticket_booking_status_logs for delete to authenticated
  using (public.is_staff());

-- ---------- ticket_booking_changes ----------
alter table public.ticket_booking_changes enable row level security;

drop policy if exists "Enable all access for ticket_booking_changes" on public.ticket_booking_changes;

revoke all on table public.ticket_booking_changes from anon;
grant select, insert, update, delete on table public.ticket_booking_changes to authenticated;

create policy "ticket_booking_changes_select_accessible"
  on public.ticket_booking_changes for select to authenticated
  using (public.ticket_booking_row_accessible(ticket_booking_id));

create policy "ticket_booking_changes_insert_accessible"
  on public.ticket_booking_changes for insert to authenticated
  with check (public.ticket_booking_row_accessible(ticket_booking_id));

create policy "ticket_booking_changes_update_accessible"
  on public.ticket_booking_changes for update to authenticated
  using (public.ticket_booking_row_accessible(ticket_booking_id))
  with check (public.ticket_booking_row_accessible(ticket_booking_id));

create policy "ticket_booking_changes_delete_staff"
  on public.ticket_booking_changes for delete to authenticated
  using (public.is_staff());

-- ---------- ticket_booking_payments ----------
alter table public.ticket_booking_payments enable row level security;

drop policy if exists "Enable all access for ticket_booking_payments" on public.ticket_booking_payments;

revoke all on table public.ticket_booking_payments from anon;
grant select, insert, update, delete on table public.ticket_booking_payments to authenticated;

create policy "ticket_booking_payments_select_accessible"
  on public.ticket_booking_payments for select to authenticated
  using (public.ticket_booking_row_accessible(ticket_booking_id));

create policy "ticket_booking_payments_insert_accessible"
  on public.ticket_booking_payments for insert to authenticated
  with check (public.ticket_booking_row_accessible(ticket_booking_id));

create policy "ticket_booking_payments_update_accessible"
  on public.ticket_booking_payments for update to authenticated
  using (public.ticket_booking_row_accessible(ticket_booking_id))
  with check (public.ticket_booking_row_accessible(ticket_booking_id));

create policy "ticket_booking_payments_delete_staff"
  on public.ticket_booking_payments for delete to authenticated
  using (public.is_staff());

-- ---------- ticket_booking_refunds ----------
alter table public.ticket_booking_refunds enable row level security;

drop policy if exists "Enable all access for ticket_booking_refunds" on public.ticket_booking_refunds;

revoke all on table public.ticket_booking_refunds from anon;
grant select, insert, update, delete on table public.ticket_booking_refunds to authenticated;

create policy "ticket_booking_refunds_select_accessible"
  on public.ticket_booking_refunds for select to authenticated
  using (public.ticket_booking_row_accessible(ticket_booking_id));

create policy "ticket_booking_refunds_insert_accessible"
  on public.ticket_booking_refunds for insert to authenticated
  with check (public.ticket_booking_row_accessible(ticket_booking_id));

create policy "ticket_booking_refunds_update_accessible"
  on public.ticket_booking_refunds for update to authenticated
  using (public.ticket_booking_row_accessible(ticket_booking_id))
  with check (public.ticket_booking_row_accessible(ticket_booking_id));

create policy "ticket_booking_refunds_delete_staff"
  on public.ticket_booking_refunds for delete to authenticated
  using (public.is_staff());

-- ---------- ticket_booking_refund_lines ----------
alter table public.ticket_booking_refund_lines enable row level security;

drop policy if exists "Enable all access for ticket_booking_refund_lines" on public.ticket_booking_refund_lines;

revoke all on table public.ticket_booking_refund_lines from anon;
grant select, insert, update, delete on table public.ticket_booking_refund_lines to authenticated;

create policy "ticket_booking_refund_lines_select_accessible"
  on public.ticket_booking_refund_lines for select to authenticated
  using (public.ticket_booking_row_accessible(anchor_booking_id));

create policy "ticket_booking_refund_lines_insert_accessible"
  on public.ticket_booking_refund_lines for insert to authenticated
  with check (public.ticket_booking_row_accessible(anchor_booking_id));

create policy "ticket_booking_refund_lines_update_accessible"
  on public.ticket_booking_refund_lines for update to authenticated
  using (public.ticket_booking_row_accessible(anchor_booking_id))
  with check (public.ticket_booking_row_accessible(anchor_booking_id));

create policy "ticket_booking_refund_lines_delete_staff"
  on public.ticket_booking_refund_lines for delete to authenticated
  using (public.is_staff());

-- ---------- ticket_invoice_attachments ----------
alter table public.ticket_invoice_attachments enable row level security;

drop policy if exists "ticket_invoice_attachments_authenticated_all" on public.ticket_invoice_attachments;

revoke all on table public.ticket_invoice_attachments from anon;
grant select, insert, update, delete on table public.ticket_invoice_attachments to authenticated;

create policy "ticket_invoice_attachments_select_staff"
  on public.ticket_invoice_attachments for select to authenticated
  using (public.is_staff());

create policy "ticket_invoice_attachments_insert_staff"
  on public.ticket_invoice_attachments for insert to authenticated
  with check (public.is_staff());

create policy "ticket_invoice_attachments_update_staff"
  on public.ticket_invoice_attachments for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "ticket_invoice_attachments_delete_staff"
  on public.ticket_invoice_attachments for delete to authenticated
  using (public.is_staff());

-- ---------- expense_categories ----------
alter table public.expense_categories enable row level security;

drop policy if exists "expense_categories_select_all" on public.expense_categories;
drop policy if exists "expense_categories_insert_staff" on public.expense_categories;

revoke all on table public.expense_categories from anon;
grant select, insert, update, delete on table public.expense_categories to authenticated;

create policy "expense_categories_select_team"
  on public.expense_categories for select to authenticated
  using (public.is_team_member(public.current_email()));

create policy "expense_categories_insert_team"
  on public.expense_categories for insert to authenticated
  with check (public.is_team_member(public.current_email()));

create policy "expense_categories_update_staff"
  on public.expense_categories for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "expense_categories_delete_staff"
  on public.expense_categories for delete to authenticated
  using (public.is_staff());

-- ---------- expense_vendors ----------
alter table public.expense_vendors enable row level security;

drop policy if exists "expense_vendors_select_all" on public.expense_vendors;
drop policy if exists "expense_vendors_insert_staff" on public.expense_vendors;

revoke all on table public.expense_vendors from anon;
grant select, insert, update, delete on table public.expense_vendors to authenticated;

create policy "expense_vendors_select_team"
  on public.expense_vendors for select to authenticated
  using (public.is_team_member(public.current_email()));

create policy "expense_vendors_insert_team"
  on public.expense_vendors for insert to authenticated
  with check (public.is_team_member(public.current_email()));

create policy "expense_vendors_update_staff"
  on public.expense_vendors for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "expense_vendors_delete_staff"
  on public.expense_vendors for delete to authenticated
  using (public.is_staff());

-- ---------- guide_cost_notes (단일 전역 노트) ----------
alter table public.guide_cost_notes enable row level security;

drop policy if exists "guide_cost_notes_select_policy" on public.guide_cost_notes;
drop policy if exists "guide_cost_notes_insert_policy" on public.guide_cost_notes;
drop policy if exists "guide_cost_notes_update_policy" on public.guide_cost_notes;

revoke all on table public.guide_cost_notes from anon;
grant select, insert, update, delete on table public.guide_cost_notes to authenticated;

create policy "guide_cost_notes_select_staff"
  on public.guide_cost_notes for select to authenticated
  using (public.is_staff());

create policy "guide_cost_notes_insert_staff"
  on public.guide_cost_notes for insert to authenticated
  with check (public.is_staff());

create policy "guide_cost_notes_update_staff"
  on public.guide_cost_notes for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "guide_cost_notes_delete_staff"
  on public.guide_cost_notes for delete to authenticated
  using (public.is_staff());

-- ---------- reservation_reviews ----------
alter table public.reservation_reviews enable row level security;

drop policy if exists "Allow all access to reservation_reviews" on public.reservation_reviews;

revoke all on table public.reservation_reviews from anon;
grant select, insert, update, delete on table public.reservation_reviews to authenticated;

create policy "reservation_reviews_select_staff_or_assignee"
  on public.reservation_reviews for select to authenticated
  using (
    public.is_staff()
    or public.reservation_expense_row_accessible_as_assignee(reservation_id)
  );

create policy "reservation_reviews_insert_staff_or_assignee"
  on public.reservation_reviews for insert to authenticated
  with check (
    public.is_staff()
    or public.reservation_expense_row_accessible_as_assignee(reservation_id)
  );

create policy "reservation_reviews_update_staff_or_assignee"
  on public.reservation_reviews for update to authenticated
  using (
    public.is_staff()
    or public.reservation_expense_row_accessible_as_assignee(reservation_id)
  )
  with check (
    public.is_staff()
    or public.reservation_expense_row_accessible_as_assignee(reservation_id)
  );

create policy "reservation_reviews_delete_staff"
  on public.reservation_reviews for delete to authenticated
  using (public.is_staff());

-- ---------- office_meal_log ----------
alter table public.office_meal_log enable row level security;

drop policy if exists "office_meal_log_select_all" on public.office_meal_log;
drop policy if exists "office_meal_log_modify_staff" on public.office_meal_log;

revoke all on table public.office_meal_log from anon;
grant select, insert, update, delete on table public.office_meal_log to authenticated;

create policy "office_meal_log_select_own_or_staff"
  on public.office_meal_log for select to authenticated
  using (
    public.is_staff()
    or lower(trim(coalesce(employee_email, ''))) = lower(trim(coalesce(public.current_email(), '')))
  );

create policy "office_meal_log_insert_own_or_staff"
  on public.office_meal_log for insert to authenticated
  with check (
    public.is_staff()
    or lower(trim(coalesce(employee_email, ''))) = lower(trim(coalesce(public.current_email(), '')))
  );

create policy "office_meal_log_update_own_or_staff"
  on public.office_meal_log for update to authenticated
  using (
    public.is_staff()
    or lower(trim(coalesce(employee_email, ''))) = lower(trim(coalesce(public.current_email(), '')))
  )
  with check (
    public.is_staff()
    or lower(trim(coalesce(employee_email, ''))) = lower(trim(coalesce(public.current_email(), '')))
  );

create policy "office_meal_log_delete_own_or_staff"
  on public.office_meal_log for delete to authenticated
  using (
    public.is_staff()
    or lower(trim(coalesce(employee_email, ''))) = lower(trim(coalesce(public.current_email(), '')))
  );

-- ---------- company_expense_paid_for_labels ----------
alter table public.company_expense_paid_for_labels enable row level security;

drop policy if exists "company_expense_paid_for_labels_select" on public.company_expense_paid_for_labels;
drop policy if exists "company_expense_paid_for_labels_all_staff" on public.company_expense_paid_for_labels;

revoke all on table public.company_expense_paid_for_labels from anon;
grant select, insert, update, delete on table public.company_expense_paid_for_labels to authenticated;

create policy "company_expense_paid_for_labels_select_staff"
  on public.company_expense_paid_for_labels for select to authenticated
  using (public.is_staff());

create policy "company_expense_paid_for_labels_insert_staff"
  on public.company_expense_paid_for_labels for insert to authenticated
  with check (public.is_staff());

create policy "company_expense_paid_for_labels_update_staff"
  on public.company_expense_paid_for_labels for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "company_expense_paid_for_labels_delete_staff"
  on public.company_expense_paid_for_labels for delete to authenticated
  using (public.is_staff());

-- ---------- company_expense_vehicle_maintenance_links ----------
alter table public.company_expense_vehicle_maintenance_links enable row level security;

drop policy if exists "company_expense_vm_links_select" on public.company_expense_vehicle_maintenance_links;
drop policy if exists "company_expense_vm_links_all_staff" on public.company_expense_vehicle_maintenance_links;

revoke all on table public.company_expense_vehicle_maintenance_links from anon;
grant select, insert, update, delete on table public.company_expense_vehicle_maintenance_links to authenticated;

create policy "company_expense_vm_links_select_staff"
  on public.company_expense_vehicle_maintenance_links for select to authenticated
  using (public.is_staff());

create policy "company_expense_vm_links_insert_staff"
  on public.company_expense_vehicle_maintenance_links for insert to authenticated
  with check (public.is_staff());

create policy "company_expense_vm_links_update_staff"
  on public.company_expense_vehicle_maintenance_links for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "company_expense_vm_links_delete_staff"
  on public.company_expense_vehicle_maintenance_links for delete to authenticated
  using (public.is_staff());

-- ---------- message_translations (채팅 번역; UI 미사용 시 스태프만) ----------
alter table public.message_translations enable row level security;

drop policy if exists "Users can read message translations" on public.message_translations;
drop policy if exists "Users can create message translations" on public.message_translations;
drop policy if exists "Users can update message translations" on public.message_translations;

revoke all on table public.message_translations from anon;
grant select, insert, update, delete on table public.message_translations to authenticated;

create policy "message_translations_select_staff"
  on public.message_translations for select to authenticated
  using (public.is_staff());

create policy "message_translations_insert_staff"
  on public.message_translations for insert to authenticated
  with check (public.is_staff());

create policy "message_translations_update_staff"
  on public.message_translations for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "message_translations_delete_staff"
  on public.message_translations for delete to authenticated
  using (public.is_staff());

commit;
