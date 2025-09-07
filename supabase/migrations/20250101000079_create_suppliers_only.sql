-- 공급업체 테이블만 생성 (기존 정책 오류 방지)
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 공급업체 상품 테이블 생성
CREATE TABLE IF NOT EXISTS supplier_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    product_id UUID, -- 투어 상품 ID (products 테이블과 연결)
    option_id UUID,  -- 상품 옵션 ID (product_options 테이블과 연결)
    ticket_name VARCHAR(255) NOT NULL, -- 티켓명 (예: A티켓, B티켓)
    regular_price DECIMAL(10,2) NOT NULL, -- 정가
    supplier_price DECIMAL(10,2) NOT NULL, -- 공급업체 제공가
    season_dates JSONB, -- 시즌 날짜 정보 (예: [{"start": "2024-12-20", "end": "2025-01-05"}, {"start": "2025-07-01", "end": "2025-08-31"}])
    season_price DECIMAL(10,2), -- 시즌 가격
    entry_times JSONB, -- 입장 시간들 (예: ["09:00", "11:00", "14:00", "16:00"])
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 공급업체 티켓 구매 기록 테이블
CREATE TABLE IF NOT EXISTS supplier_ticket_purchases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    supplier_product_id UUID NOT NULL REFERENCES supplier_products(id) ON DELETE CASCADE,
    booking_id TEXT NOT NULL REFERENCES ticket_bookings(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL, -- 구매 단가
    total_amount DECIMAL(10,2) NOT NULL, -- 총 금액
    is_season_price BOOLEAN DEFAULT false, -- 시즌 가격 여부
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_status VARCHAR(20) DEFAULT 'pending', -- pending, paid, cancelled
    payment_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier_id ON supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_product_id ON supplier_products(product_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_option_id ON supplier_products(option_id);
CREATE INDEX IF NOT EXISTS idx_supplier_ticket_purchases_supplier_id ON supplier_ticket_purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_ticket_purchases_booking_id ON supplier_ticket_purchases(booking_id);
CREATE INDEX IF NOT EXISTS idx_supplier_ticket_purchases_purchase_date ON supplier_ticket_purchases(purchase_date);

-- RLS 정책 설정
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_ticket_purchases ENABLE ROW LEVEL SECURITY;

-- 공급업체 테이블 RLS 정책
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = '공급업체 조회 허용') THEN
        CREATE POLICY "공급업체 조회 허용" ON suppliers FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = '공급업체 수정 허용') THEN
        CREATE POLICY "공급업체 수정 허용" ON suppliers FOR ALL USING (true);
    END IF;
END $$;

-- 공급업체 상품 테이블 RLS 정책
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'supplier_products' AND policyname = '공급업체 상품 조회 허용') THEN
        CREATE POLICY "공급업체 상품 조회 허용" ON supplier_products FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'supplier_products' AND policyname = '공급업체 상품 수정 허용') THEN
        CREATE POLICY "공급업체 상품 수정 허용" ON supplier_products FOR ALL USING (true);
    END IF;
END $$;

-- 공급업체 티켓 구매 테이블 RLS 정책
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'supplier_ticket_purchases' AND policyname = '공급업체 티켓 구매 조회 허용') THEN
        CREATE POLICY "공급업체 티켓 구매 조회 허용" ON supplier_ticket_purchases FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'supplier_ticket_purchases' AND policyname = '공급업체 티켓 구매 수정 허용') THEN
        CREATE POLICY "공급업체 티켓 구매 수정 허용" ON supplier_ticket_purchases FOR ALL USING (true);
    END IF;
END $$;

-- 업데이트 트리거 함수 (이미 존재할 수 있음)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 업데이트 트리거 생성
DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_supplier_products_updated_at ON supplier_products;
CREATE TRIGGER update_supplier_products_updated_at BEFORE UPDATE ON supplier_products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_supplier_ticket_purchases_updated_at ON supplier_ticket_purchases;
CREATE TRIGGER update_supplier_ticket_purchases_updated_at BEFORE UPDATE ON supplier_ticket_purchases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
