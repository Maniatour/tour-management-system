-- Supabase Database Schema for Tour Management System

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 감사 추적 시스템
-- 감사 로그 테이블
CREATE TABLE audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL,
  record_id TEXT NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[],
  user_id UUID,
  user_email VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 감사 로그 뷰 (사용자 친화적인 형태)
CREATE OR REPLACE VIEW audit_logs_view AS
SELECT 
  al.id,
  al.table_name,
  al.record_id,
  al.action,
  al.old_values,
  al.new_values,
  al.changed_fields,
  al.user_id,
  al.user_email,
  al.ip_address,
  al.user_agent,
  al.created_at,
  CASE 
    WHEN al.table_name = 'products' THEN p.name
    WHEN al.table_name = 'customers' THEN c.name
    WHEN al.table_name = 'employees' THEN e.name_ko
    WHEN al.table_name = 'options' THEN opt.name
    WHEN al.table_name = 'tours' THEN CONCAT('투어 #', t.id::text)
    WHEN al.table_name = 'reservations' THEN CONCAT('예약 #', r.id::text)
    WHEN al.table_name = 'channels' THEN ch.name
    WHEN al.table_name = 'dynamic_pricing' THEN CONCAT('동적가격 #', dp.id::text)
    ELSE al.record_id::text
  END as record_name
FROM audit_logs al
LEFT JOIN products p ON al.table_name = 'products' AND al.record_id = p.id
LEFT JOIN customers c ON al.table_name = 'customers' AND al.record_id = c.id
LEFT JOIN employees e ON al.table_name = 'employees' AND al.record_id = e.id
LEFT JOIN options opt ON al.table_name = 'options' AND al.record_id = opt.id
LEFT JOIN tours t ON al.table_name = 'tours' AND al.record_id = t.id
LEFT JOIN reservations r ON al.table_name = 'reservations' AND al.record_id = r.id
LEFT JOIN channels ch ON al.table_name = 'channels' AND al.record_id = ch.id
LEFT JOIN dynamic_pricing dp ON al.table_name = 'dynamic_pricing' AND al.record_id = dp.id
ORDER BY al.created_at DESC;

-- 감사 로그 트리거 함수
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  old_data JSONB;
  new_data JSONB;
  changed_fields TEXT[] := '{}';
  field_name TEXT;
  old_value JSONB;
  new_value JSONB;
BEGIN
  -- 감사 로그에 사용자 정보 추가 (실제로는 auth.users에서 가져와야 함)
  IF TG_OP = 'INSERT' THEN
    new_data = to_jsonb(NEW);
    INSERT INTO audit_logs (table_name, record_id, action, new_values, changed_fields, user_id, user_email)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', new_data, array_keys(new_data), 
            COALESCE(current_setting('app.current_user_id', true)::UUID, NULL),
            COALESCE(current_setting('app.current_user_email', true), 'system'));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    old_data = to_jsonb(OLD);
    new_data = to_jsonb(NEW);
    
    -- 변경된 필드 찾기
    FOR field_name IN SELECT unnest(array_keys(new_data))
    LOOP
      old_value = old_data->field_name;
      new_value = new_data->field_name;
      IF old_value IS DISTINCT FROM new_value THEN
        changed_fields = array_append(changed_fields, field_name);
      END IF;
    END LOOP;
    
    INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, changed_fields, user_id, user_email)
    VALUES (TG_TABLE_NAME, OLD.id, 'UPDATE', old_data, new_data, changed_fields,
            COALESCE(current_setting('app.current_user_id', true)::UUID, NULL),
            COALESCE(current_setting('app.current_user_email', true), 'system'));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    old_data = to_jsonb(OLD);
    INSERT INTO audit_logs (table_name, record_id, action, old_values, changed_fields, user_id, user_email)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', old_data, array_keys(old_data),
            COALESCE(current_setting('app.current_user_id', true)::UUID, NULL),
            COALESCE(current_setting('app.current_user_email', true), 'system'));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 주요 테이블들에 감사 트리거 적용
CREATE TRIGGER audit_products_trigger AFTER INSERT OR UPDATE OR DELETE ON products
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_customers_trigger AFTER INSERT OR UPDATE OR DELETE ON customers
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_employees_trigger AFTER INSERT OR UPDATE OR DELETE ON employees
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_options_trigger AFTER INSERT OR UPDATE OR DELETE ON options
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_tours_trigger AFTER INSERT OR UPDATE OR DELETE ON tours
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_reservations_trigger AFTER INSERT OR UPDATE OR DELETE ON reservations
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_channels_trigger AFTER INSERT OR UPDATE OR DELETE ON channels
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_dynamic_pricing_trigger AFTER INSERT OR UPDATE OR DELETE ON dynamic_pricing
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Customers table
CREATE TABLE customers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50) NOT NULL,
  channel_id UUID REFERENCES channels(id),
  language VARCHAR(10) NOT NULL DEFAULT 'ko',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  name_ko VARCHAR(255) NOT NULL,
  display_name JSONB,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  duration VARCHAR(100),
  base_price DECIMAL(10,2) NOT NULL,
  max_participants INTEGER,
  status VARCHAR(50) DEFAULT 'active',
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Options table
CREATE TABLE options (
  id TEXT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  adult_price DECIMAL(10,2) NOT NULL,
  child_price DECIMAL(10,2) NOT NULL,
  infant_price DECIMAL(10,2) NOT NULL,
  price_type VARCHAR(50) NOT NULL,
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
  tour_note TEXT,
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
  channel_id UUID REFERENCES channels(id),
  channel_rn VARCHAR(255),
  added_by VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  event_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Channels table
CREATE TABLE channels (
  id TEXT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'Own',
  website VARCHAR(500),
  commission DECIMAL(5,2) DEFAULT 0,
  base_price DECIMAL(10,2) DEFAULT 0,
  markup DECIMAL(5,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT chk_channel_category CHECK (category IN ('Own', 'OTA', 'Partner'))
);

-- Product Options table (Many-to-Many relationship)
CREATE TABLE product_options (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  option_id UUID REFERENCES options(id) ON DELETE CASCADE,
  is_required BOOLEAN DEFAULT false,
  min_quantity INTEGER DEFAULT 1,
  max_quantity INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, option_id)
);

-- Insert sample data
INSERT INTO customers (name, email, phone, channel_id, language) VALUES
('김철수', 'kim@example.com', '010-1234-5678', (SELECT id FROM channels WHERE name = '직접 방문'), 'ko'),
('이영희', 'lee@example.com', '010-2345-6789', (SELECT id FROM channels WHERE name = '네이버 여행'), 'ko'),
('박민수', 'park@example.com', '010-3456-7890', (SELECT id FROM channels WHERE name = '제휴 호텔'), 'en');

INSERT INTO products (name, category, description, duration, base_price, min_participants, max_participants, difficulty, status) VALUES
('앤텔로프 캐니언 투어', '자연', '세계적인 자연 경관을 감상하는 투어', '8시간', 150.00, 2, 15, '보통', 'active'),
('그랜드 캐니언 투어', '자연', '세계 7대 불가사의를 체험하는 투어', '10시간', 200.00, 2, 20, '보통', 'active'),
('라스베가스 시티 투어', '도시', '세계적인 엔터테인먼트 도시를 탐험하는 투어', '6시간', 120.00, 1, 25, '쉬움', 'active');

INSERT INTO options (name, category, description, base_price, price_type, min_quantity, max_quantity, status) VALUES
('호텔 픽업', '교통수단', '호텔에서 투어 시작 지점까지 픽업 서비스', 25.00, 'perPerson', 1, 10, 'active'),
('점심 도시락', '식사', '투어 중 간단한 점심 도시락 제공', 15.00, 'perPerson', 1, 20, 'active'),
('카시트', '장비', '유아용 카시트 대여', 10.00, 'perPerson', 1, 5, 'active');

INSERT INTO employees (email, name_ko, name_en, language, type, phone, status) VALUES
('guide1@company.com', '김가이드', 'Kim Guide', 'both', 'guide', '010-1111-1111', 'active'),
('assistant1@company.com', '이어시스턴트', 'Lee Assistant', 'both', 'assistant', '010-2222-2222', 'active'),
('driver1@company.com', '박운전기사', 'Park Driver', 'ko', 'driver', '010-3333-3333', 'active');

INSERT INTO channels (name, type, website, commission, base_price, markup, status) VALUES
('직접 방문', 'Direct', '', 0.00, 0.00, 0.00, 'active'),
('네이버 여행', 'OTA', 'https://travel.naver.com', 15.00, 0.00, 5.00, 'active'),
('카카오 여행', 'OTA', 'https://travel.kakao.com', 12.00, 0.00, 3.00, 'active'),
('마이리얼트립', 'OTA', 'https://www.myrealtrip.com', 18.00, 0.00, 8.00, 'active'),
('제휴 호텔', 'Partner', '', 10.00, 0.00, 2.00, 'active'),
('제휴 카페', 'Partner', '', 8.00, 0.00, 1.00, 'active');

-- Create indexes for better performance
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_options_category ON options(category);
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_employees_type ON employees(type);
CREATE INDEX idx_tours_date ON tours(tour_date);
CREATE INDEX idx_tours_status ON tours(tour_status);
CREATE INDEX idx_reservations_date ON reservations(tour_date);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_channels_type ON channels(type);

-- Enable Row Level Security (RLS)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE options ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_options ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (for demo purposes)
-- In production, you should implement proper authentication and authorization
CREATE POLICY "Allow public read access" ON customers FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON customers FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON customers FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON products FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON products FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON products FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON options FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON options FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON options FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON options FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON employees FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON employees FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON employees FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON employees FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON tours FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON tours FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON tours FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON tours FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON reservations FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON reservations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON reservations FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON reservations FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON channels FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON channels FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON channels FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON channels FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON product_options FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON product_options FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON product_options FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON product_options FOR DELETE USING (true);

-- ========================================
-- 동적 가격 관리 시스템
-- ========================================

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
  
  -- 복합 유니크 제약조건: 같은 상품, 같은 채널, 같은 날짜에 중복 가격 설정 방지
  UNIQUE(product_id, channel_id, date)
);

-- 동적 가격 인덱스 (성능 최적화)
CREATE INDEX idx_dynamic_pricing_product ON dynamic_pricing(product_id);
CREATE INDEX idx_dynamic_pricing_channel ON dynamic_pricing(channel_id);
CREATE INDEX idx_dynamic_pricing_date ON dynamic_pricing(date);
CREATE INDEX idx_dynamic_pricing_composite ON dynamic_pricing(product_id, channel_id, date);
CREATE INDEX idx_dynamic_pricing_options ON dynamic_pricing USING GIN(options_pricing);

-- RLS 활성화
ALTER TABLE dynamic_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access" ON dynamic_pricing FOR ALL USING (true);

-- 감사 트리거 적용 (동적 가격 변경사항 추적)
CREATE TRIGGER audit_dynamic_pricing_trigger 
AFTER INSERT OR UPDATE OR DELETE ON dynamic_pricing
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- updated_at 컬럼 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_dynamic_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dynamic_pricing_updated_at_trigger
  BEFORE UPDATE ON dynamic_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_dynamic_pricing_updated_at();

-- 샘플 동적 가격 데이터 (테스트용)
INSERT INTO dynamic_pricing (
  product_id, 
  channel_id, 
  date, 
  adult_price, 
  child_price, 
  infant_price, 
  options_pricing,
  commission_percent,
  markup_amount,
  coupon_percent
) VALUES 
-- 첫 번째 상품의 네이버 여행 채널 가격 (2024년 1월 15일)
(
  (SELECT id FROM products WHERE name = '앤텔로프 캐니언 투어' LIMIT 1),
  (SELECT id FROM channels WHERE name = '네이버 여행' LIMIT 1),
  '2024-01-15',
  180.00,
  120.00,
  80.00,
  '{"호텔픽업": {"adult": 30, "child": 20, "infant": 15}, "점심도시락": {"adult": 20, "child": 15, "infant": 10}}',
  15.00,
  5.00,
  0.00
),
-- 첫 번째 상품의 카카오 여행 채널 가격 (2024년 1월 16일)
(
  (SELECT id FROM products WHERE name = '앤텔로프 캐니언 투어' LIMIT 1),
  (SELECT id FROM channels WHERE name = '카카오 여행' LIMIT 1),
  '2024-01-16',
  175.00,
  115.00,
  75.00,
  '{"호텔픽업": {"adult": 28, "child": 18, "infant": 13}, "카시트": {"adult": 15, "child": 10, "infant": 8}}',
  12.00,
  3.00,
  5.00
);
