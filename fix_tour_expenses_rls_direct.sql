-- Fix RLS policies for tour_expenses table to allow data sync
-- Run this directly in Supabase SQL Editor

begin;

-- 기존 정책 삭제
DROP POLICY IF EXISTS "tour_expenses_select_all" ON public.tour_expenses;
DROP POLICY IF EXISTS "tour_expenses_insert_staff" ON public.tour_expenses;
DROP POLICY IF EXISTS "tour_expenses_update_staff" ON public.tour_expenses;
DROP POLICY IF EXISTS "tour_expenses_delete_staff" ON public.tour_expenses;

-- 새로운 정책 생성 (데이터 동기화 허용)
CREATE POLICY "tour_expenses_select_all" ON public.tour_expenses
    FOR SELECT
    USING (true);

CREATE POLICY "tour_expenses_insert_all" ON public.tour_expenses
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "tour_expenses_update_all" ON public.tour_expenses
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "tour_expenses_delete_all" ON public.tour_expenses
    FOR DELETE
    USING (true);

commit;

