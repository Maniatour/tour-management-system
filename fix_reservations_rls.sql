-- Fix reservations RLS by adding INSERT/UPDATE/DELETE policies
-- This will allow staff to insert reservations for data sync

-- Add INSERT policy for reservations - staff can insert
CREATE POLICY "reservations_insert_staff" ON public.reservations
  FOR INSERT
  WITH CHECK (
    public.is_staff(public.current_email())
  );

-- Add UPDATE policy for reservations - staff can update
CREATE POLICY "reservations_update_staff" ON public.reservations
  FOR UPDATE
  USING (
    public.is_staff(public.current_email())
  )
  WITH CHECK (
    public.is_staff(public.current_email())
  );

-- Add DELETE policy for reservations - staff can delete
CREATE POLICY "reservations_delete_staff" ON public.reservations
  FOR DELETE
  USING (
    public.is_staff(public.current_email())
  );
