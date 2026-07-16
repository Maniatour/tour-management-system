-- Multi-locale text content for pickup hotel cards (description + directions).
-- Legacy *_ko / *_en columns remain for compatibility and are kept in sync by the app.

ALTER TABLE pickup_hotels
  ADD COLUMN IF NOT EXISTS content_i18n JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN pickup_hotels.content_i18n IS
  'Localized text: { description, from_inside_hotel, from_outside_hotel, to_representative_hotel } → { en, ko, ja, zh-CN, zh-TW, es, fr, de }';

-- Backfill from existing Korean / English columns
UPDATE pickup_hotels
SET content_i18n = jsonb_strip_nulls(
  jsonb_build_object(
    'description', jsonb_strip_nulls(jsonb_build_object(
      'ko', NULLIF(trim(description_ko), ''),
      'en', NULLIF(trim(description_en), '')
    )),
    'from_inside_hotel', jsonb_strip_nulls(jsonb_build_object(
      'ko', NULLIF(trim(from_inside_hotel_ko), ''),
      'en', NULLIF(trim(from_inside_hotel_en), '')
    )),
    'from_outside_hotel', jsonb_strip_nulls(jsonb_build_object(
      'ko', NULLIF(trim(from_outside_hotel_ko), ''),
      'en', NULLIF(trim(from_outside_hotel_en), '')
    )),
    'to_representative_hotel', jsonb_strip_nulls(jsonb_build_object(
      'ko', NULLIF(trim(to_representative_hotel_ko), ''),
      'en', NULLIF(trim(to_representative_hotel_en), '')
    ))
  )
)
WHERE content_i18n = '{}'::jsonb
   OR content_i18n IS NULL;
