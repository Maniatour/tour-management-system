/** 예약 목록·운영 큐: mapRawToReservation 에 필요한 컬럼만 + 채널명 embed.
 * `customers(...)` embed는 remote에 reservations→customers FK가 없어 PGRST200 — 사용 금지.
 * 고객명은 loadCustomersByIds(namesOnly)로 별도 조회.
 * `choices` JSON은 payload가 커서 제외 — 카드는 `/choices/batch` prefetch·coalesce로 채움.
 */
export const RESERVATION_LIST_SELECT = [
  'id',
  'customer_id',
  'product_id',
  'tour_date',
  'tour_time',
  'event_note',
  'pickup_hotel',
  'pickup_time',
  'adults',
  'child',
  'infant',
  'total_people',
  'channel_id',
  'variant_key',
  'channel_rn',
  'added_by',
  'created_at',
  'tour_id',
  'status',
  'updated_at',
  'amount_audited',
  'amount_audited_at',
  'amount_audited_by',
  'selected_options',
  'selected_option_prices',
  'customer_communication_channel',
].join(',') + ',channels(name)'

/** 통계·등록/취소 차트 전용 — embed·JSON 없이 전송량 최소화 */
export const RESERVATION_STATS_SELECT = [
  'id',
  'adults',
  'child',
  'infant',
  'total_people',
  'created_at',
  'updated_at',
  'status',
].join(',')
