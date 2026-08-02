-- 가이드 스케줄 부여 SMS 템플릿 카테고리 추가
begin;

alter table public.admin_sms_templates
  drop constraint if exists admin_sms_templates_template_key_check;

alter table public.admin_sms_templates
  add constraint admin_sms_templates_template_key_check
  check (template_key in ('pickup_notification', 'guide_schedule_confirm', 'guide_schedule_assignment'));

comment on table public.admin_sms_templates is
  '관리자 SMS 템플릿. pickup_notification / guide_schedule_confirm / guide_schedule_assignment. locale: ko, en, ja, zh 등.';

insert into public.admin_sms_category_settings (category_key, label_ko, label_en, icon_key, sort_order)
values ('guide_schedule_assignment', '가이드 스케줄 부여', 'Guide schedule assignment', 'user-check', 25)
on conflict (category_key) do nothing;

commit;
