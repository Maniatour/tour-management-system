-- 게스트 거주 확인 폼 제출을 관리자 알림 모달이 구독할 수 있게 합니다.
do $$
begin
  alter publication supabase_realtime add table public.resident_check_submissions;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.resident_check_tokens;
exception
  when duplicate_object then null;
end $$;
