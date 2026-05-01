-- 자주 쓰는 WHERE/정렬 패턴용 보조 인덱스 (리포트·채팅 미읽음·예약 화면 부하 완화)

-- 투어 채팅: 활성 방 대상 고객 미읽음 건수 COUNT (room_id IN + sender_type + is_read)
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_customer_unread
  ON public.chat_messages (room_id)
  WHERE sender_type = 'customer' AND is_read = false;

-- 입장권: 기간 + 상태 필터 (종합/지출 리포트 등)
CREATE INDEX IF NOT EXISTS idx_ticket_bookings_submit_on_status
  ON public.ticket_bookings (submit_on, status);

-- 호텔 부킹·정산: submit_on 범위 스캔
CREATE INDEX IF NOT EXISTS idx_tour_hotel_bookings_submit_on
  ON public.tour_hotel_bookings (submit_on);

-- 결제 기록·지출 테이블: submit_on 범위
CREATE INDEX IF NOT EXISTS idx_payment_records_submit_on
  ON public.payment_records (submit_on);

CREATE INDEX IF NOT EXISTS idx_company_expenses_submit_on
  ON public.company_expenses (submit_on);

CREATE INDEX IF NOT EXISTS idx_reservation_expenses_submit_on
  ON public.reservation_expenses (submit_on);

CREATE INDEX IF NOT EXISTS idx_tour_expenses_submit_on
  ON public.tour_expenses (submit_on);

-- PnL 리포트: exclude_from_pnl = false 인 행만 대량 조회되는 경우 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_company_expenses_submit_on_pnl_included
  ON public.company_expenses (submit_on)
  WHERE exclude_from_pnl = false;

CREATE INDEX IF NOT EXISTS idx_reservation_expenses_submit_on_pnl_included
  ON public.reservation_expenses (submit_on)
  WHERE exclude_from_pnl = false;

CREATE INDEX IF NOT EXISTS idx_tour_expenses_submit_on_pnl_included
  ON public.tour_expenses (submit_on)
  WHERE exclude_from_pnl = false;

-- 예약 목록에서 투어 존재 여부 조회: product_id + tour_date IN 조합
CREATE INDEX IF NOT EXISTS idx_tours_product_id_tour_date
  ON public.tours (product_id, tour_date);
