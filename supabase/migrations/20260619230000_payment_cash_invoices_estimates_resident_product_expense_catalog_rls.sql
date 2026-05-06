-- Step 12 (RLS hardening): payment_methods, cash_transactions, invoices, estimates,
--   resident_inquiry_email_templates, product_options,
--   expense_standard_categories, expense_category_mappings, expense_normalization_mappings
-- Depends: public.is_staff(), public.is_team_member, public.current_email() (509180160 등).

begin;

-- ---------- payment_methods ----------
alter table public.payment_methods enable row level security;

drop policy if exists "payment_methods_select_all" on public.payment_methods;
drop policy if exists "payment_methods_insert_staff" on public.payment_methods;
drop policy if exists "payment_methods_update_staff" on public.payment_methods;
drop policy if exists "payment_methods_delete_staff" on public.payment_methods;

revoke all on table public.payment_methods from anon;
grant select, insert, update, delete on table public.payment_methods to authenticated;

create policy "payment_methods_select_team"
  on public.payment_methods for select to authenticated
  using (public.is_team_member(public.current_email()));

create policy "payment_methods_insert_staff"
  on public.payment_methods for insert to authenticated
  with check (public.is_staff());

create policy "payment_methods_update_staff"
  on public.payment_methods for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "payment_methods_delete_staff"
  on public.payment_methods for delete to authenticated
  using (public.is_staff());

-- ---------- cash_transactions ----------
alter table public.cash_transactions enable row level security;

drop policy if exists "cash_transactions_select_all" on public.cash_transactions;
drop policy if exists "cash_transactions_insert_staff" on public.cash_transactions;
drop policy if exists "cash_transactions_update_staff" on public.cash_transactions;
drop policy if exists "cash_transactions_delete_staff" on public.cash_transactions;

revoke all on table public.cash_transactions from anon;
grant select, insert, update, delete on table public.cash_transactions to authenticated;

create policy "cash_transactions_select_staff"
  on public.cash_transactions for select to authenticated
  using (public.is_staff());

create policy "cash_transactions_insert_staff"
  on public.cash_transactions for insert to authenticated
  with check (public.is_staff());

create policy "cash_transactions_update_staff"
  on public.cash_transactions for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "cash_transactions_delete_staff"
  on public.cash_transactions for delete to authenticated
  using (public.is_staff());

-- ---------- invoices ----------
alter table public.invoices enable row level security;

drop policy if exists "Allow all access to invoices" on public.invoices;

revoke all on table public.invoices from anon;
grant select, insert, update, delete on table public.invoices to authenticated;

create policy "invoices_select_staff"
  on public.invoices for select to authenticated
  using (public.is_staff());

create policy "invoices_insert_staff"
  on public.invoices for insert to authenticated
  with check (public.is_staff());

create policy "invoices_update_staff"
  on public.invoices for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "invoices_delete_staff"
  on public.invoices for delete to authenticated
  using (public.is_staff());

-- ---------- estimates ----------
alter table public.estimates enable row level security;

drop policy if exists "Allow all access to estimates" on public.estimates;

revoke all on table public.estimates from anon;
grant select, insert, update, delete on table public.estimates to authenticated;

create policy "estimates_select_staff"
  on public.estimates for select to authenticated
  using (public.is_staff());

create policy "estimates_insert_staff"
  on public.estimates for insert to authenticated
  with check (public.is_staff());

create policy "estimates_update_staff"
  on public.estimates for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "estimates_delete_staff"
  on public.estimates for delete to authenticated
  using (public.is_staff());

-- ---------- resident_inquiry_email_templates ----------
alter table public.resident_inquiry_email_templates enable row level security;

drop policy if exists "Allow all access to resident_inquiry_email_templates"
  on public.resident_inquiry_email_templates;

revoke all on table public.resident_inquiry_email_templates from anon;
grant select, insert, update, delete on table public.resident_inquiry_email_templates to authenticated;

create policy "resident_inquiry_email_templates_select_staff"
  on public.resident_inquiry_email_templates for select to authenticated
  using (public.is_staff());

create policy "resident_inquiry_email_templates_insert_staff"
  on public.resident_inquiry_email_templates for insert to authenticated
  with check (public.is_staff());

create policy "resident_inquiry_email_templates_update_staff"
  on public.resident_inquiry_email_templates for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "resident_inquiry_email_templates_delete_staff"
  on public.resident_inquiry_email_templates for delete to authenticated
  using (public.is_staff());

-- ---------- product_options (병합 테이블; 공개 예약 UI용 anon 읽기 유지) ----------
alter table public.product_options enable row level security;

drop policy if exists "Allow public access to product_options" on public.product_options;

revoke all on table public.product_options from anon;
grant select on table public.product_options to anon;
grant select, insert, update, delete on table public.product_options to authenticated;

create policy "product_options_anon_select"
  on public.product_options for select to anon
  using (true);

create policy "product_options_select_team"
  on public.product_options for select to authenticated
  using (public.is_team_member(public.current_email()));

create policy "product_options_insert_staff"
  on public.product_options for insert to authenticated
  with check (public.is_staff());

create policy "product_options_update_staff"
  on public.product_options for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "product_options_delete_staff"
  on public.product_options for delete to authenticated
  using (public.is_staff());

-- ---------- expense_standard_categories ----------
alter table public.expense_standard_categories enable row level security;

drop policy if exists "Authenticated users can read standard categories" on public.expense_standard_categories;
drop policy if exists "Authenticated users can manage standard categories" on public.expense_standard_categories;

revoke all on table public.expense_standard_categories from anon;
grant select, insert, update, delete on table public.expense_standard_categories to authenticated;

create policy "expense_standard_categories_select_staff"
  on public.expense_standard_categories for select to authenticated
  using (public.is_staff());

create policy "expense_standard_categories_insert_staff"
  on public.expense_standard_categories for insert to authenticated
  with check (public.is_staff());

create policy "expense_standard_categories_update_staff"
  on public.expense_standard_categories for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "expense_standard_categories_delete_staff"
  on public.expense_standard_categories for delete to authenticated
  using (public.is_staff());

-- ---------- expense_category_mappings ----------
alter table public.expense_category_mappings enable row level security;

drop policy if exists "Authenticated users can read category mappings" on public.expense_category_mappings;
drop policy if exists "Authenticated users can insert category mappings" on public.expense_category_mappings;
drop policy if exists "Authenticated users can update category mappings" on public.expense_category_mappings;

revoke all on table public.expense_category_mappings from anon;
grant select, insert, update, delete on table public.expense_category_mappings to authenticated;

create policy "expense_category_mappings_select_staff"
  on public.expense_category_mappings for select to authenticated
  using (public.is_staff());

create policy "expense_category_mappings_insert_staff"
  on public.expense_category_mappings for insert to authenticated
  with check (public.is_staff());

create policy "expense_category_mappings_update_staff"
  on public.expense_category_mappings for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "expense_category_mappings_delete_staff"
  on public.expense_category_mappings for delete to authenticated
  using (public.is_staff());

-- ---------- expense_normalization_mappings ----------
alter table public.expense_normalization_mappings enable row level security;

drop policy if exists "Authenticated users can read normalization mappings" on public.expense_normalization_mappings;
drop policy if exists "Authenticated users can insert normalization mappings" on public.expense_normalization_mappings;
drop policy if exists "Authenticated users can update normalization mappings" on public.expense_normalization_mappings;
drop policy if exists "Authenticated users can delete normalization mappings" on public.expense_normalization_mappings;

revoke all on table public.expense_normalization_mappings from anon;
grant select, insert, update, delete on table public.expense_normalization_mappings to authenticated;

create policy "expense_normalization_mappings_select_staff"
  on public.expense_normalization_mappings for select to authenticated
  using (public.is_staff());

create policy "expense_normalization_mappings_insert_staff"
  on public.expense_normalization_mappings for insert to authenticated
  with check (public.is_staff());

create policy "expense_normalization_mappings_update_staff"
  on public.expense_normalization_mappings for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "expense_normalization_mappings_delete_staff"
  on public.expense_normalization_mappings for delete to authenticated
  using (public.is_staff());

commit;
