-- 거주 안내 이메일: locale + tour_kind(당일 / 멀티데이)별 템플릿
begin;

alter table resident_inquiry_email_templates
  add column if not exists tour_kind text not null default 'day_tour';

update resident_inquiry_email_templates
set tour_kind = 'day_tour'
where tour_kind is null or btrim(tour_kind) = '';

alter table resident_inquiry_email_templates
  drop constraint if exists resident_inquiry_email_templates_pkey;

alter table resident_inquiry_email_templates
  alter column tour_kind drop default;

alter table resident_inquiry_email_templates
  drop constraint if exists resident_inquiry_email_templates_tour_kind_check;

alter table resident_inquiry_email_templates
  add constraint resident_inquiry_email_templates_tour_kind_check
  check (tour_kind in ('day_tour', 'multi_day'));

-- 멀티데이 전용 행은 비워 둠 → 앱에서 내장 멀티데이 기본값 사용. 기존 커스텀은 day_tour에만 유지.
alter table resident_inquiry_email_templates
  add constraint resident_inquiry_email_templates_pkey primary key (locale, tour_kind);

commit;
