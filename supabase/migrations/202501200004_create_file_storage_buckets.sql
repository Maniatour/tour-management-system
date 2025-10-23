-- 파일 저장용 Storage 버킷 생성
-- Supabase Storage에서 실행할 SQL

-- 1. 차량 정비 파일용 버킷 (기존)
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES ('maintenance-files', 'maintenance-files', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

-- 2. 회사 지출 파일용 버킷
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('company-expense-files', 'company-expense-files', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

-- 3. 예약 지출 파일용 버킷
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('reservation-expense-files', 'reservation-expense-files', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

-- 4. 입장권 부킹 파일용 버킷
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ticket-booking-files', 'ticket-booking-files', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

-- 5. 투어 호텔 부킹 파일용 버킷
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('hotel-booking-files', 'hotel-booking-files', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

-- 데이터베이스 테이블에 파일 URL 필드 추가
-- 6. 입장권 부킹 테이블에 파일 URL 필드 추가
ALTER TABLE ticket_bookings 
ADD COLUMN IF NOT EXISTS uploaded_file_urls TEXT[];

-- 7. 투어 호텔 부킹 테이블에 파일 URL 필드 추가
ALTER TABLE tour_hotel_bookings 
ADD COLUMN IF NOT EXISTS uploaded_file_urls TEXT[];

-- 기존 테이블들은 이미 파일 필드가 있음:
-- company_expenses: photo_url (TEXT), attachments (TEXT[])
-- reservation_expenses: image_url (TEXT), file_path (TEXT)

-- Storage 버킷 정책 설정 (RLS 정책 사용)
-- Supabase Storage는 RLS(Row Level Security) 정책을 사용합니다.

-- 8. 차량 정비 파일 버킷 정책 (공개 읽기, 인증된 사용자 업로드)
CREATE POLICY "maintenance-files-public-read" ON storage.objects
FOR SELECT USING (bucket_id = 'maintenance-files');

CREATE POLICY "maintenance-files-authenticated-upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'maintenance-files' AND auth.role() = 'authenticated');

CREATE POLICY "maintenance-files-authenticated-update" ON storage.objects
FOR UPDATE USING (bucket_id = 'maintenance-files' AND auth.role() = 'authenticated');

CREATE POLICY "maintenance-files-authenticated-delete" ON storage.objects
FOR DELETE USING (bucket_id = 'maintenance-files' AND auth.role() = 'authenticated');

-- 9. 회사 지출 파일 버킷 정책
CREATE POLICY "company-expense-files-public-read" ON storage.objects
FOR SELECT USING (bucket_id = 'company-expense-files');

CREATE POLICY "company-expense-files-authenticated-upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'company-expense-files' AND auth.role() = 'authenticated');

CREATE POLICY "company-expense-files-authenticated-update" ON storage.objects
FOR UPDATE USING (bucket_id = 'company-expense-files' AND auth.role() = 'authenticated');

CREATE POLICY "company-expense-files-authenticated-delete" ON storage.objects
FOR DELETE USING (bucket_id = 'company-expense-files' AND auth.role() = 'authenticated');

-- 10. 예약 지출 파일 버킷 정책
CREATE POLICY "reservation-expense-files-public-read" ON storage.objects
FOR SELECT USING (bucket_id = 'reservation-expense-files');

CREATE POLICY "reservation-expense-files-authenticated-upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'reservation-expense-files' AND auth.role() = 'authenticated');

CREATE POLICY "reservation-expense-files-authenticated-update" ON storage.objects
FOR UPDATE USING (bucket_id = 'reservation-expense-files' AND auth.role() = 'authenticated');

CREATE POLICY "reservation-expense-files-authenticated-delete" ON storage.objects
FOR DELETE USING (bucket_id = 'reservation-expense-files' AND auth.role() = 'authenticated');

-- 11. 입장권 부킹 파일 버킷 정책
CREATE POLICY "ticket-booking-files-public-read" ON storage.objects
FOR SELECT USING (bucket_id = 'ticket-booking-files');

CREATE POLICY "ticket-booking-files-authenticated-upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'ticket-booking-files' AND auth.role() = 'authenticated');

CREATE POLICY "ticket-booking-files-authenticated-update" ON storage.objects
FOR UPDATE USING (bucket_id = 'ticket-booking-files' AND auth.role() = 'authenticated');

CREATE POLICY "ticket-booking-files-authenticated-delete" ON storage.objects
FOR DELETE USING (bucket_id = 'ticket-booking-files' AND auth.role() = 'authenticated');

-- 12. 투어 호텔 부킹 파일 버킷 정책
CREATE POLICY "hotel-booking-files-public-read" ON storage.objects
FOR SELECT USING (bucket_id = 'hotel-booking-files');

CREATE POLICY "hotel-booking-files-authenticated-upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'hotel-booking-files' AND auth.role() = 'authenticated');

CREATE POLICY "hotel-booking-files-authenticated-update" ON storage.objects
FOR UPDATE USING (bucket_id = 'hotel-booking-files' AND auth.role() = 'authenticated');

CREATE POLICY "hotel-booking-files-authenticated-delete" ON storage.objects
FOR DELETE USING (bucket_id = 'hotel-booking-files' AND auth.role() = 'authenticated');
