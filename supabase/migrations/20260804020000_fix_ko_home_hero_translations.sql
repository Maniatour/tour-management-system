-- Fix Korean home hero / Mania Tour home copy accidentally stored as English.
-- Customer page editor prefills from ko.json; when that file still had English,
-- saving wrote English into translation_values for locale=ko and overrode the UI.

begin;

with hero_keys(key_path, ko_value) as (
  values
    ('homeManiaTourHeroTitle', '미국 서부를 탐험하세요'),
    (
      'homeManiaTourHeroSubtitle',
      '그랜드 캐년, 앤텔로프 캐년, 자이언 그리고 그 너머까지. 소그룹. 현지 전문가. 잊지 못할 추억.'
    ),
    ('homeManiaTourHeroCta', '투어 찾기'),
    ('homeHeroStatReviewsFull', '3,000+ 5성 리뷰'),
    ('homeHeroStatTravelersFull', '50,000+ 행복 여행자'),
    ('homeHeroStatSmallGroupFull', '프리미엄 소그룹 투어'),
    ('homeHeroStatSinceFull', '2016년 설립 · 10년 이상 경험'),
    ('homePopularToursTitle', '인기 투어'),
    ('homeViewAllTours', '투어 전체 보기'),
    ('homeDestinationsManiaTourTitle', '인기 목적지 둘러보기'),
    ('homeViewAllDestinations', '목적지 전체 보기'),
    ('homeWhyManiaTourTitle', '왜 Mania Tour와 함께할까요?'),
    ('maniatourFeatureSmallGroup', '소그룹'),
    ('maniatourFeatureSmallGroupDesc', '프리미엄 소그룹 투어'),
    ('maniatourFeatureGuides', '전문 가이드'),
    ('maniatourFeatureGuidesDesc', '다년 경험의 현지 전문가'),
    ('maniatourFeatureWellPlanned', '꼼꼼한 일정'),
    ('maniatourFeatureWellPlannedDesc', '픽업부터 드롭오프까지 세심하게 준비'),
    ('maniatourFeaturePhotos', '무료 사진'),
    ('maniatourFeaturePhotosDesc', '전문 투어 사진 추가 비용 없이 제공'),
    ('maniatourFeatureReviews', '5성 리뷰'),
    ('maniatourFeatureReviewsDesc', '검증된 5성 리뷰 3,000건 이상'),
    ('maniatourFeatureLocal', '현지 투어 회사'),
    ('maniatourFeatureLocalDesc', '라스베이거스 기반, 10년 이상 서부 전문성'),
    ('homeReviewsManiaTourTitle', '게스트 후기'),
    ('homeInstagramTitle', '우리의 여행을 팔로우하세요'),
    ('homeViewOnInstagram', 'Instagram에서 보기'),
    ('homeTravelStyleTitle', '나에게 맞는 여행 스타일'),
    ('travelStyleDayTour', '당일 투어'),
    ('travelStyleDayTourDesc', '짧은 일정에도 완벽한 선택'),
    ('travelStyleSunrise', '일출 투어'),
    ('travelStyleSunriseDesc', '이른 출발로 혼잡을 피하세요'),
    ('travelStyleMultiDay', '다일 투어'),
    ('travelStyleMultiDayDesc', '숙박과 함께 더 깊이 탐험'),
    ('travelStyleSmallGroup', '소그룹'),
    ('travelStyleSmallGroupDesc', '가까운 규모, 세심한 케어'),
    ('travelStyleHelicopter', '헬리콥터 투어'),
    ('travelStyleHelicopterDesc', '상징적인 풍경을 하늘에서'),
    ('travelStyleCustom', '프라이빗 맞춤 투어'),
    ('travelStyleCustomDesc', '나의 일정, 나의 페이스'),
    ('homeGuidesTitle', '여행 가이드 & 팁'),
    ('homeViewAllArticles', '아티클 전체 보기')
),
ensured_translations as (
  insert into public.translations (id, namespace, key_path, is_system)
  select gen_random_uuid()::text, 'common', hk.key_path, false
  from hero_keys hk
  where not exists (
    select 1
    from public.translations t
    where t.namespace = 'common'
      and t.key_path = hk.key_path
  )
  returning id, key_path
)
insert into public.translation_values (id, translation_id, locale, value)
select
  gen_random_uuid()::text,
  t.id,
  'ko',
  hk.ko_value
from hero_keys hk
join public.translations t
  on t.namespace = 'common'
 and t.key_path = hk.key_path
on conflict (translation_id, locale)
do update set
  value = excluded.value,
  updated_at = now()
where
  public.translation_values.value is distinct from excluded.value
  and (
    public.translation_values.value ~ '[A-Za-z]'
    and public.translation_values.value !~ '[가-힣]'
  );

commit;
