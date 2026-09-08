-- 예약 가져오기 신규 메일 INSERT를 관리자 알림 모달이 구독할 수 있게 합니다.
do $$
begin
  alter publication supabase_realtime add table public.reservation_imports;
exception
  when duplicate_object then null;
end $$;
