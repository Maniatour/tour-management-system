-- Update status column comments to include new status values
-- Migration: 20250131000001_update_ticket_booking_status_comments

-- ticket_bookings 테이블의 status 컬럼 주석 업데이트
COMMENT ON COLUMN ticket_bookings.status IS '상태: pending(대기), confirmed(확정), cancelled(취소), completed(완료), cancellation_requested(전체 취소 요청), guest_change_requested(인원 변경 요청), time_change_requested(시간 변경 요청), payment_requested(결제 요청)';

-- tour_hotel_bookings 테이블의 status 컬럼 주석 업데이트
COMMENT ON COLUMN tour_hotel_bookings.status IS '상태: pending(대기), confirmed(확정), cancelled(취소), completed(완료), cancellation_requested(전체 취소 요청), guest_change_requested(인원 변경 요청), time_change_requested(시간 변경 요청), payment_requested(결제 요청)';

