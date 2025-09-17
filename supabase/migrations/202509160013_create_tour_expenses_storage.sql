-- Create storage bucket for tour expenses receipts
-- Migration: 202509160013_create_tour_expenses_storage

begin;

-- Create storage bucket for tour expenses
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tour-expenses',
  'tour-expenses',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

-- Create storage policies
CREATE POLICY "tour_expenses_select_policy" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'tour-expenses');

CREATE POLICY "tour_expenses_insert_policy" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'tour-expenses' AND
    public.is_staff(public.current_email())
  );

CREATE POLICY "tour_expenses_update_policy" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'tour-expenses' AND
    public.is_staff(public.current_email())
  )
  WITH CHECK (
    bucket_id = 'tour-expenses' AND
    public.is_staff(public.current_email())
  );

CREATE POLICY "tour_expenses_delete_policy" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'tour-expenses' AND
    public.is_staff(public.current_email())
  );

commit;
