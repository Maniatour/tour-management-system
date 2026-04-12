-- Guides/assistants could not see reservations listed in tours.reservation_ids
-- when reservations.tour_id was null or pointed at another tour (sync drift).
-- Staff bypasses via reservations_select_staff_all; pickup schedule then showed fewer guests for guides.

begin;

drop policy if exists "reservations_select_assigned_via_tour" on public.reservations;

create policy "reservations_select_assigned_via_tour" on public.reservations
  for select
  using (
    exists (
      select 1
      from public.tours t
      where (
        t.id = reservations.tour_id
        or (
          t.reservation_ids is not null
          and cardinality(t.reservation_ids) > 0
          and reservations.id::text = any (t.reservation_ids)
        )
      )
      and (
        public.is_staff(public.current_email())
        or public.current_email() = any (public.normalize_email_list(t.tour_guide_id))
        or public.current_email() = any (public.normalize_email_list(t.assistant_id))
      )
    )
  );

commit;
