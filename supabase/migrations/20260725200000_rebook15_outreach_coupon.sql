-- 취소 후 재예약 권유용 쿠폰 (앱: REBOOKING_OUTREACH_COUPON_CODE)

INSERT INTO coupons (
  coupon_code,
  discount_type,
  percentage_value,
  fixed_value,
  status,
  description,
  start_date,
  end_date,
  channel_id
)
VALUES (
  'REBOOK15',
  'percentage',
  15.00,
  NULL,
  'active',
  'Cancellation rebooking outreach — 15% off direct website bookings',
  CURRENT_DATE,
  '2026-09-30',
  'M00001'
)
ON CONFLICT (coupon_code) DO UPDATE SET
  discount_type = EXCLUDED.discount_type,
  percentage_value = EXCLUDED.percentage_value,
  fixed_value = EXCLUDED.fixed_value,
  status = EXCLUDED.status,
  description = EXCLUDED.description,
  end_date = EXCLUDED.end_date,
  channel_id = EXCLUDED.channel_id,
  updated_at = NOW();
