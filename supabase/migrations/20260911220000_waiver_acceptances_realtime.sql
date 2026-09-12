-- 고객 면책 서명을 관리자 알림 모달·예약 카드가 구독할 수 있게 합니다.
do $$
begin
  alter publication supabase_realtime add table public.waiver_acceptances;
exception
  when duplicate_object then null;
end $$;
