-- 가이드/작성자: 본인 리포트를 투어 다음날까지 삭제 허용
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tour_reports'
      AND policyname = 'Users can delete own report until next day'
  ) THEN
    CREATE POLICY "Users can delete own report until next day"
      ON public.tour_reports
      FOR DELETE
      USING (
        user_email = auth.jwt() ->> 'email'
        AND EXISTS (
          SELECT 1
          FROM public.tours t
          WHERE t.id = tour_reports.tour_id
            AND now() < ((t.tour_date::timestamp) + interval '2 days')
        )
      );
  END IF;
END
$$;

