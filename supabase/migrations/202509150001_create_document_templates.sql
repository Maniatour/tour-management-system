-- Document templates for reservations
create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null, -- e.g., reservation_confirmation, pickup_notification, reservation_receipt
  language text not null default 'ko',
  name text not null,
  subject text,
  content text not null, -- HTML with placeholders like {{reservation.id}}
  format text not null default 'html',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_document_templates_key_lang
  on public.document_templates (template_key, language);

-- Seed default templates (KO)
insert into public.document_templates (template_key, language, name, subject, content) values
('reservation_confirmation', 'ko', '예약 확인서', '[예약 확인서] {{reservation.id}}',
  '<h1>예약 확인서</h1>\n<p><strong>예약번호:</strong> {{reservation.id}}</p>\n<p><strong>고객명:</strong> {{customer.name}}</p>\n<p><strong>이메일:</strong> {{customer.email}}</p>\n<p><strong>상품:</strong> {{product.name}}</p>\n<p><strong>투어일시:</strong> {{reservation.tour_date}} {{reservation.tour_time}}</p>\n<p><strong>픽업:</strong> {{pickup.display}} ({{reservation.pickup_time}})</p>'),
('pickup_notification', 'ko', '픽업 안내', '[픽업 안내] {{reservation.id}}',
  '<h1>픽업 안내</h1>\n<p><strong>예약번호:</strong> {{reservation.id}}</p>\n<p><strong>투어일:</strong> {{reservation.tour_date}}</p>\n<p><strong>픽업 호텔:</strong> {{pickup.display}}</p>\n<p><strong>픽업 시간:</strong> {{reservation.pickup_time}}</p>'),
('reservation_receipt', 'ko', '예약 영수증', '[예약 영수증] {{reservation.id}}',
  '<h1>예약 영수증</h1>\n<p><strong>예약번호:</strong> {{reservation.id}}</p>\n<p><strong>고객명:</strong> {{customer.name}}</p>\n<p><strong>상품:</strong> {{product.name}}</p>\n<p><strong>인원:</strong> 성인 {{reservation.adults}} / 아동 {{reservation.child}} / 유아 {{reservation.infant}}</p>\n<p><strong>총액:</strong> {{pricing.total_locale}}</p>')
on conflict (template_key, language) do nothing;


