-- 공급업체 테이블 생성 (이미 존재하면 스킵)
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

-- 공급업체 상품 테이블 생성 (이미 존재하면 스킵)
CREATE TABLE IF NOT EXISTS supplier_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    product_id UUID, -- 투어 상품 ID (products 테이블과 연결)
    option_id UUID,  -- 상품 옵션 ID (product_options 테이블과 연결)
    ticket_name VARCHAR(255) NOT NULL, -- 티켓명 (예: A티켓, B티켓)
    regular_price DECIMAL(10,2) NOT NULL, -- 정가
    supplier_price DECIMAL(10,2) NOT NULL, -- 공급업체 제공가
    season_dates JSONB, -- 시즌 날짜 정보 (예: {"start": "2024-12-20", "end": "2025-01-05"})
    season_price DECIMAL(10,2), -- 시즌 가격
    entry_time TIME, -- 입장 시간 (선택사항)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 공급업체 티켓 구매 기록 테이블 (이미 존재하면 스킵)
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

-- 인덱스 생성 (이미 존재하면 스킵)
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

-- 공급업체 테이블 RLS 정책 (이미 존재하면 스킵)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = '공급업체 조회 허용') THEN
        CREATE POLICY "공급업체 조회 허용" ON suppliers FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = '공급업체 수정 허용') THEN
        CREATE POLICY "공급업체 수정 허용" ON suppliers FOR ALL USING (true);
    END IF;
END $$;

-- 공급업체 상품 테이블 RLS 정책 (이미 존재하면 스킵)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'supplier_products' AND policyname = '공급업체 상품 조회 허용') THEN
        CREATE POLICY "공급업체 상품 조회 허용" ON supplier_products FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'supplier_products' AND policyname = '공급업체 상품 수정 허용') THEN
        CREATE POLICY "공급업체 상품 수정 허용" ON supplier_products FOR ALL USING (true);
    END IF;
END $$;

-- 공급업체 티켓 구매 테이블 RLS 정책 (이미 존재하면 스킵)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'supplier_ticket_purchases' AND policyname = '공급업체 티켓 구매 조회 허용') THEN
        CREATE POLICY "공급업체 티켓 구매 조회 허용" ON supplier_ticket_purchases FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'supplier_ticket_purchases' AND policyname = '공급업체 티켓 구매 수정 허용') THEN
        CREATE POLICY "공급업체 티켓 구매 수정 허용" ON supplier_ticket_purchases FOR ALL USING (true);
    END IF;
END $$;

-- 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 업데이트 트리거 생성 (이미 존재하면 스킵)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_suppliers_updated_at') THEN
        CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_supplier_products_updated_at') THEN
        CREATE TRIGGER update_supplier_products_updated_at BEFORE UPDATE ON supplier_products
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_supplier_ticket_purchases_updated_at') THEN
        CREATE TRIGGER update_supplier_ticket_purchases_updated_at BEFORE UPDATE ON supplier_ticket_purchases
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- customers, tours, reservations 테이블에 updated_at 컬럼 추가
-- customers 테이블에 updated_at 컬럼 추가 (이미 존재하면 스킵)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'updated_at') THEN
        ALTER TABLE customers ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- tours 테이블에 updated_at 컬럼 추가 (이미 존재하면 스킵)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tours' AND column_name = 'updated_at') THEN
        ALTER TABLE tours ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- reservations 테이블에 updated_at 컬럼 추가 (이미 존재하면 스킵)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'updated_at') THEN
        ALTER TABLE reservations ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- customers 테이블 업데이트 트리거 생성 (이미 존재하면 스킵)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_customers_updated_at') THEN
        CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- tours 테이블 업데이트 트리거 생성 (이미 존재하면 스킵)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tours_updated_at') THEN
        CREATE TRIGGER update_tours_updated_at BEFORE UPDATE ON tours
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- reservations 테이블 업데이트 트리거 생성 (이미 존재하면 스킵)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_reservations_updated_at') THEN
        CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON reservations
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;