-- Allow customer-submitted website reviews in google_reviews.review_source

begin;

alter table public.google_reviews
  drop constraint if exists google_reviews_review_source_check;

alter table public.google_reviews
  add constraint google_reviews_review_source_check
  check (
    review_source in (
      'google',
      'getyourguide',
      'viator',
      'tripadvisor',
      'klook',
      'kkday',
      'tripcom',
      'other',
      'website'
    )
  );

comment on column public.google_reviews.review_source is
  'Review channel: google (GBP API), OTA sources, other, or website (customer-submitted).';

commit;
