-- 고객 페이지 콘텐츠 편집용 기본 번역 시드 (홈 통계 수치, 상품 상세 프로모 코드)
-- translations 테이블에 없을 때만 삽입 — 관리자 고객 페이지 작업에서 오버라이드 가능

INSERT INTO public.translations (id, namespace, key_path, is_system)
VALUES
  (gen_random_uuid()::text, 'common', 'statsSatisfiedCustomersNumber', true),
  (gen_random_uuid()::text, 'common', 'statsSuccessfulToursNumber', true),
  (gen_random_uuid()::text, 'common', 'statsProfessionalGuidesNumber', true),
  (gen_random_uuid()::text, 'common', 'statsAverageRatingNumber', true),
  (gen_random_uuid()::text, 'productDetail', 'platformPromoCode', true),
  (gen_random_uuid()::text, 'productDetail', 'platformPromoDiscountPercent', true)
ON CONFLICT (namespace, key_path) DO NOTHING;

INSERT INTO public.translation_values (id, translation_id, locale, value)
SELECT gen_random_uuid()::text, t.id, v.locale, v.value
FROM public.translations t
JOIN (
  VALUES
    ('common', 'statsSatisfiedCustomersNumber', 'ko', '10,000+'),
    ('common', 'statsSatisfiedCustomersNumber', 'en', '10,000+'),
    ('common', 'statsSuccessfulToursNumber', 'ko', '500+'),
    ('common', 'statsSuccessfulToursNumber', 'en', '500+'),
    ('common', 'statsProfessionalGuidesNumber', 'ko', '50+'),
    ('common', 'statsProfessionalGuidesNumber', 'en', '50+'),
    ('common', 'statsAverageRatingNumber', 'ko', '4.8'),
    ('common', 'statsAverageRatingNumber', 'en', '4.8'),
    ('productDetail', 'platformPromoCode', 'ko', 'KOVEGAS10'),
    ('productDetail', 'platformPromoCode', 'en', 'KOVEGAS10'),
    ('productDetail', 'platformPromoDiscountPercent', 'ko', '10'),
    ('productDetail', 'platformPromoDiscountPercent', 'en', '10')
) AS v(ns, key_path, locale, value)
  ON t.namespace = v.ns AND t.key_path = v.key_path
ON CONFLICT (translation_id, locale) DO NOTHING;
