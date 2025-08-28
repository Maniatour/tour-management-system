-- Supabase Database Schema for Tour Management System

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Customers table
CREATE TABLE customers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50) NOT NULL,
  channel VARCHAR(100) NOT NULL,
  language VARCHAR(10) NOT NULL DEFAULT 'ko',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  duration VARCHAR(100),
  base_price DECIMAL(10,2) NOT NULL,
  min_participants INTEGER DEFAULT 1,
  max_participants INTEGER,
  difficulty VARCHAR(50),
  status VARCHAR(50) DEFAULT 'active',
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
  type VARCHAR(100) NOT NULL,
  website VARCHAR(500),
  commission DECIMAL(5,2) DEFAULT 0,
  base_price DECIMAL(10,2) DEFAULT 0,
  markup DECIMAL(5,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  description TEXT,
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, option_id)
);

-- Insert sample data
INSERT INTO customers (name, email, phone, channel, language) VALUES
('김철수', 'kim@example.com', '010-1234-5678', '직접 방문', 'ko'),
('이영희', 'lee@example.com', '010-2345-6789', '네이버 여행', 'ko'),
('박민수', 'park@example.com', '010-3456-7890', '제휴 호텔', 'en');

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
