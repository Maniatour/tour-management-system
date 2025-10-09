-- document_templates 테이블 수정
-- id 컬럼이 제대로 설정되지 않은 경우를 대비한 수정

-- 1. UUID 확장 활성화 (필요한 경우)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. 기존 테이블이 있다면 삭제 (주의: 데이터 손실)
DROP TABLE IF EXISTS public.document_templates CASCADE;

-- 3. 테이블 재생성 (올바른 스키마로)
CREATE TABLE public.document_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_key TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'ko',
  name TEXT NOT NULL,
  subject TEXT,
  content TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'html',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. 유니크 인덱스 생성
CREATE UNIQUE INDEX uq_document_templates_key_lang
  ON public.document_templates (template_key, language);

-- 5. RLS 비활성화
ALTER TABLE public.document_templates DISABLE ROW LEVEL SECURITY;

-- 6. 권한 부여
GRANT ALL ON public.document_templates TO authenticated;
GRANT ALL ON public.document_templates TO anon;
GRANT ALL ON public.document_templates TO service_role;

-- 7. 기본 템플릿 삽입 (ID 명시적 생성)
INSERT INTO public.document_templates (id, template_key, language, name, subject, content) VALUES
(uuid_generate_v4(), 'reservation_confirmation', 'ko', '예약 확인서', '[예약 확인서] {{reservation.id}}',
  '<h1>예약 확인서</h1>\n<p><strong>예약번호:</strong> {{reservation.id}}</p>\n<p><strong>고객명:</strong> {{customer.name}}</p>\n<p><strong>이메일:</strong> {{customer.email}}</p>\n<p><strong>상품:</strong> {{product.name}}</p>\n<p><strong>투어일시:</strong> {{reservation.tour_date}} {{reservation.tour_time}}</p>\n<p><strong>픽업:</strong> {{pickup.display}} ({{reservation.pickup_time}})</p>'),
(uuid_generate_v4(), 'pickup_notification', 'ko', '픽업 안내', '[픽업 안내] {{reservation.id}}',
  '<h1>픽업 안내</h1>\n<p><strong>예약번호:</strong> {{reservation.id}}</p>\n<p><strong>투어일:</strong> {{reservation.tour_date}}</p>\n<p><strong>픽업 호텔:</strong> {{pickup.display}}</p>\n<p><strong>픽업 시간:</strong> {{reservation.pickup_time}}</p>'),
(uuid_generate_v4(), 'reservation_receipt', 'ko', '예약 영수증', '[예약 영수증] {{reservation.id}}',
  '<h1>예약 영수증</h1>\n<p><strong>예약번호:</strong> {{reservation.id}}</p>\n<p><strong>고객명:</strong> {{customer.name}}</p>\n<p><strong>상품:</strong> {{product.name}}</p>\n<p><strong>인원:</strong> 성인 {{reservation.adults}} / 아동 {{reservation.child}} / 유아 {{reservation.infant}}</p>\n<p><strong>총액:</strong> {{pricing.total_locale}}</p>');

-- 8. 테이블 상태 확인
SELECT 'document_templates 테이블이 성공적으로 생성되었습니다' as status;
SELECT COUNT(*) as template_count FROM public.document_templates;
