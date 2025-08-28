-- Enable UUID extension (if not already enabled)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
    CREATE EXTENSION "uuid-ossp";
  END IF;
END $$;

-- Enable pgcrypto extension (if not already enabled)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    CREATE EXTENSION "pgcrypto";
  END IF;
END $$;

-- Customers table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
    CREATE TABLE customers (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      name_ko VARCHAR(255) NOT NULL,
      name_en VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      nationality VARCHAR(100),
      passport_number VARCHAR(100),
      emergency_contact VARCHAR(255),
      special_requests TEXT,
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  END IF;
END $$;

-- Products table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
    CREATE TABLE products (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      product_code VARCHAR(100) UNIQUE,
      category VARCHAR(100) NOT NULL,
      sub_category VARCHAR(100),
      description TEXT,
      duration VARCHAR(100),
      departure_city VARCHAR(100),
      arrival_city VARCHAR(100),
      departure_country VARCHAR(100),
      arrival_country VARCHAR(100),
      languages TEXT[],
      group_size VARCHAR(50),
      adult_age INTEGER,
      child_age_min INTEGER,
      child_age_max INTEGER,
      infant_age INTEGER,
      base_price DECIMAL(10,2) NOT NULL,
      min_participants INTEGER DEFAULT 1,
      max_participants INTEGER,
      difficulty VARCHAR(50),
      status VARCHAR(50) DEFAULT 'active',
      tags TEXT[],
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  END IF;
END $$;

-- Options table
CREATE TABLE options (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  base_price DECIMAL(10,2) NOT NULL,
  price_type VARCHAR(50) NOT NULL,
  min_quantity INTEGER DEFAULT 1,
  max_quantity INTEGER,
  status VARCHAR(50) DEFAULT 'active',
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employees table
CREATE TABLE employees (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name_ko VARCHAR(255) NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  language VARCHAR(50) NOT NULL,
  type VARCHAR(100) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  emergency_contact VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  date_of_birth DATE,
  address TEXT,
  ssn VARCHAR(50),
  photo VARCHAR(500),
  personal_car_model VARCHAR(255),
  car_year INTEGER,
  car_plate VARCHAR(50),
  bank_name VARCHAR(255),
  account_holder VARCHAR(255),
  bank_number VARCHAR(255),
  routing_number VARCHAR(255),
  cpr BOOLEAN DEFAULT false,
  cpr_acquired DATE,
  cpr_expired DATE,
  medical_report BOOLEAN DEFAULT false,
  medical_acquired DATE,
  medical_expired DATE,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tours table
CREATE TABLE tours (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES products(id),
  tour_date DATE NOT NULL,
  tour_guide_id UUID REFERENCES employees(id),
  assistant_id UUID REFERENCES employees(id),
  tour_car_id VARCHAR(255),
  reservation_ids UUID[],
  tour_status VARCHAR(50) DEFAULT 'scheduled',
  tour_start_datetime TIMESTAMP WITH TIME ZONE,
  tour_end_datetime TIMESTAMP WITH TIME ZONE,
  guide_fee DECIMAL(10,2) DEFAULT 0,
  assistant_fee DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reservations table
CREATE TABLE reservations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  product_id UUID REFERENCES products(id),
  tour_date DATE NOT NULL,
  tour_time TIME,
  pickup_hotel VARCHAR(255),
  pickup_time TIME,
  adults INTEGER DEFAULT 0,
  child INTEGER DEFAULT 0,
  infant INTEGER DEFAULT 0,
  total_people INTEGER NOT NULL,
  channel VARCHAR(100) NOT NULL,
  channel_rn VARCHAR(255),
  added_by VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  event_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Channels table
CREATE TABLE channels (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  commission_percent DECIMAL(5,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product Options table (Many-to-Many relationship)
CREATE TABLE product_options (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  option_id UUID REFERENCES options(id) ON DELETE CASCADE,
  is_required BOOLEAN DEFAULT false,
  min_quantity INTEGER DEFAULT 1,
  max_quantity INTEGER,
  price_adjustment DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, option_id)
);

-- Seasonal Pricing table
CREATE TABLE seasonal_pricing (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  season_name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  adult_price DECIMAL(10,2) NOT NULL,
  child_price DECIMAL(10,2) NOT NULL,
  infant_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Coupons table
CREATE TABLE coupons (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  discount_percent DECIMAL(5,2) NOT NULL,
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Global Options table
CREATE TABLE global_options (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  value TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 동적 가격 테이블 (간단하고 효율적인 구조)
CREATE TABLE dynamic_pricing (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  adult_price DECIMAL(10,2) NOT NULL,
  child_price DECIMAL(10,2) NOT NULL,
  infant_price DECIMAL(10,2) NOT NULL,
  options_pricing JSONB, -- 옵션별 가격 정보 (예: {"option_1": {"adult": 50, "child": 30, "infant": 20}})
  commission_percent DECIMAL(5,2) DEFAULT 0,
  markup_amount DECIMAL(10,2) DEFAULT 0,
  coupon_percent DECIMAL(5,2) DEFAULT 0,
  is_sale_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, channel_id, date)
);

-- 동적 가격 인덱스 (성능 최적화)
CREATE INDEX idx_dynamic_pricing_product ON dynamic_pricing(product_id);
CREATE INDEX idx_dynamic_pricing_channel ON dynamic_pricing(channel_id);
CREATE INDEX idx_dynamic_pricing_date ON dynamic_pricing(date);
CREATE INDEX idx_dynamic_pricing_composite ON dynamic_pricing(product_id, channel_id, date);
CREATE INDEX idx_dynamic_pricing_options ON dynamic_pricing USING GIN(options_pricing);

-- RLS 활성화 및 정책
ALTER TABLE dynamic_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access" ON dynamic_pricing FOR ALL USING (true);

-- 감사 추적 시스템
CREATE TABLE audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[],
  user_id UUID,
  user_email VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 감사 로그 뷰 (사용자 친화적 표시)
CREATE OR REPLACE VIEW audit_logs_view AS
SELECT 
  al.id,
  al.table_name,
  al.record_id,
  al.action,
  al.old_values,
  al.new_values,
  al.changed_fields,
  al.user_email,
  al.ip_address,
  al.user_agent,
  al.created_at,
  CASE 
    WHEN al.table_name = 'products' THEN CONCAT('상품 #', p.id::text)
    WHEN al.table_name = 'customers' THEN CONCAT('고객 #', c.id::text)
    WHEN al.table_name = 'employees' THEN CONCAT('직원 #', e.id::text)
    WHEN al.table_name = 'options' THEN CONCAT('옵션 #', o.id::text)
    WHEN al.table_name = 'tours' THEN CONCAT('투어 #', t.id::text)
    WHEN al.table_name = 'reservations' THEN CONCAT('예약 #', r.id::text)
    WHEN al.table_name = 'channels' THEN CONCAT('채널 #', ch.id::text)
    WHEN al.table_name = 'dynamic_pricing' THEN CONCAT('동적가격 #', dp.id::text)
    ELSE al.record_id::text
  END as record_name
FROM audit_logs al
LEFT JOIN products p ON al.table_name = 'products' AND al.record_id = p.id
LEFT JOIN customers c ON al.table_name = 'customers' AND al.record_id = c.id
LEFT JOIN employees e ON al.table_name = 'employees' AND al.record_id = e.id
LEFT JOIN options o ON al.table_name = 'options' AND al.record_id = o.id
LEFT JOIN tours t ON al.table_name = 'tours' AND al.record_id = t.id
LEFT JOIN reservations r ON al.table_name = 'reservations' AND al.record_id = r.id
LEFT JOIN channels ch ON al.table_name = 'channels' AND al.record_id = ch.id
LEFT JOIN dynamic_pricing dp ON al.table_name = 'dynamic_pricing' AND al.record_id = dp.id;

-- 감사 트리거 함수
CREATE OR REPLACE FUNCTION audit_trigger_function() RETURNS TRIGGER AS $$
DECLARE
  old_data JSONB;
  new_data JSONB;
  changed_fields TEXT[] := '{}';
  field_name TEXT;
  old_value JSONB;
  new_value JSONB;
BEGIN
  -- 감사 로그에 기록할 데이터 준비
  IF TG_OP = 'INSERT' THEN
    new_data = to_jsonb(NEW);
    old_data = NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    new_data = to_jsonb(NEW);
    old_data = to_jsonb(OLD);
    
    -- 변경된 필드들 찾기
    FOR field_name IN SELECT column_name FROM information_schema.columns WHERE table_name = TG_TABLE_NAME LOOP
      old_value = old_data->field_name;
      new_value = new_data->field_name;
      
      IF old_value IS DISTINCT FROM new_value THEN
        changed_fields = array_append(changed_fields, field_name);
      END IF;
    END LOOP;
  ELSIF TG_OP = 'DELETE' THEN
    old_data = to_jsonb(OLD);
    new_data = NULL;
  END IF;

  -- 감사 로그에 기록
  INSERT INTO audit_logs (
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    changed_fields,
    user_email,
    ip_address,
    user_agent
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    old_data,
    new_data,
    changed_fields,
    current_setting('app.current_user_email', true),
    inet_client_addr(),
    current_setting('app.current_user_agent', true)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 감사 트리거 적용
CREATE TRIGGER audit_products_trigger 
AFTER INSERT OR UPDATE OR DELETE ON products
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_customers_trigger 
AFTER INSERT OR UPDATE OR DELETE ON customers
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_employees_trigger 
AFTER INSERT OR UPDATE OR DELETE ON employees
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_options_trigger 
AFTER INSERT OR UPDATE OR DELETE ON options
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_tours_trigger 
AFTER INSERT OR UPDATE OR DELETE ON tours
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_reservations_trigger 
AFTER INSERT OR UPDATE OR DELETE ON reservations
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_channels_trigger 
AFTER INSERT OR UPDATE OR DELETE ON channels
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_dynamic_pricing_trigger 
AFTER INSERT OR UPDATE OR DELETE ON dynamic_pricing
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- updated_at 컬럼 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dynamic_pricing_updated_at_trigger 
BEFORE UPDATE ON dynamic_pricing
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 샘플 데이터 삽입
INSERT INTO channels (name, description, commission_percent) VALUES
('직접 판매', '회사 직접 판매 채널', 0),
('온라인 여행사', '온라인 여행 예약 사이트', 15),
('오프라인 여행사', '오프라인 여행사 제휴', 20),
('호텔 제휴', '호텔 투어 데스크', 10);

INSERT INTO products (name, product_code, category, sub_category, description, duration, departure_city, arrival_city, departure_country, arrival_country, languages, group_size, adult_age, child_age_min, child_age_max, infant_age, base_price, min_participants, max_participants, difficulty, status) VALUES
('그랜드 캐니언 투어', 'GC001', 'nature', 'canyon', '세계적인 자연 경관 그랜드 캐니언을 탐험하는 투어', '8시간', '라스베가스', '그랜드 캐니언', '미국', '미국', ARRAY['korean', 'english'], 'small', 18, 5, 12, 2, 299.99, 2, 15, 'easy', 'active'),
('모뉴먼트 밸리 투어', 'MV001', 'nature', 'desert', '아름다운 사막 풍경과 바위 형상을 감상하는 투어', '6시간', '라스베가스', '모뉴먼트 밸리', '미국', '미국', ARRAY['korean', 'english'], 'private', 18, 3, 10, 1, 199.99, 1, 8, 'easy', 'active'),
('라스베가스 시티 투어', 'LV001', 'city', 'entertainment', '라스베가스의 주요 명소와 엔터테인먼트를 체험하는 투어', '4시간', '라스베가스', '라스베가스', '미국', '미국', ARRAY['korean', 'english'], 'big', 18, 5, 15, 2, 89.99, 5, 50, 'easy', 'active');

INSERT INTO options (name, category, description, base_price, price_type, min_quantity, max_quantity, status) VALUES
('호텔 픽업', 'transportation', '호텔에서 투어 시작 지점까지 픽업 서비스', 25.00, 'per_person', 1, 10, 'active'),
('점심 식사', 'food', '투어 중 점심 식사 포함', 35.00, 'per_person', 1, 20, 'active'),
('가이드 팁', 'service', '투어 가이드에게 줄 팁', 15.00, 'per_person', 1, 20, 'active'),
('보험', 'safety', '투어 중 사고 보험', 20.00, 'per_person', 1, 20, 'active');

-- 상품-옵션 연결
INSERT INTO product_options (product_id, option_id, is_required, min_quantity, price_adjustment) VALUES
((SELECT id FROM products WHERE product_code = 'GC001'), (SELECT id FROM options WHERE name = '호텔 픽업'), true, 1, 0),
((SELECT id FROM products WHERE product_code = 'GC001'), (SELECT id FROM options WHERE name = '점심 식사'), false, 1, 0),
((SELECT id FROM products WHERE product_code = 'MV001'), (SELECT id FROM options WHERE name = '호텔 픽업'), true, 1, 0),
((SELECT id FROM products WHERE product_code = 'LV001'), (SELECT id FROM options WHERE name = '가이드 팁'), true, 1, 0);

-- 샘플 동적 가격 데이터 (테스트용)
INSERT INTO dynamic_pricing (product_id, channel_id, date, adult_price, child_price, infant_price, options_pricing, commission_percent, markup_amount, coupon_percent, is_sale_available) VALUES
((SELECT id FROM products WHERE product_code = 'GC001'), (SELECT id FROM channels WHERE name = '직접 판매'), '2025-01-15', 299.99, 199.99, 99.99, '{"호텔 픽업": {"adult": 25, "child": 20, "infant": 15}}', 0, 0, 0, true),
((SELECT id FROM products WHERE product_code = 'GC001'), (SELECT id FROM channels WHERE name = '온라인 여행사'), '2025-01-15', 299.99, 199.99, 99.99, '{"호텔 픽업": {"adult": 25, "child": 20, "infant": 15}}', 15, 0, 5, true),
((SELECT id FROM products WHERE product_code = 'MV001'), (SELECT id FROM channels WHERE name = '직접 판매'), '2025-01-16', 199.99, 149.99, 79.99, '{"호텔 픽업": {"adult": 25, "child": 20, "infant": 15}}', 0, 0, 0, true);
