-- OTA 리뷰: 동일 예약번호(RN#) 중복 등록 방지
create unique index if not exists idx_google_reviews_ota_reservation_rn_unique
  on public.google_reviews (
    operator_id,
    review_source,
    upper(btrim(raw_payload->>'reservationNumber'))
  )
  where review_source <> 'google'
    and btrim(coalesce(raw_payload->>'reservationNumber', '')) <> '';

comment on index public.idx_google_reviews_ota_reservation_rn_unique is
  'Prevents duplicate OTA review imports for the same booking reference (RN#) per operator and source.';
