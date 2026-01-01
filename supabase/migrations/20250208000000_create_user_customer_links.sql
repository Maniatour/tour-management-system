-- 사용자-고객 연결 테이블 생성
-- Supabase Auth 사용자와 customers 테이블을 연결하여
-- 구글 로그인 이메일과 OTA 임시 이메일이 다른 경우에도 매칭 가능하도록 함
-- 작성일: 2025-02-08

-- user_customer_links 테이블 생성
CREATE TABLE IF NOT EXISTS user_customer_links (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL, -- Supabase Auth 사용자 ID (auth.users.id)
  customer_id TEXT NOT NULL, -- customers 테이블의 ID
  auth_email TEXT NOT NULL, -- 구글 로그인 이메일 (참고용)
  matched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- 매칭 시각
  matched_by TEXT DEFAULT 'user', -- 매칭 방법: 'user' (사용자 직접), 'auto' (자동 매칭)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 제약 조건
  CONSTRAINT fk_user_customer_links_customer 
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  
  -- 한 사용자는 한 고객과만 연결 (1:1 관계)
  -- 동일한 사용자-고객 조합은 중복 불가
  CONSTRAINT unique_user_customer_link UNIQUE (user_id, customer_id),
  
  -- 한 사용자는 한 고객과만 활성 연결 가능 (1:1 관계)
  -- 새로운 매칭 시 기존 연결은 삭제되고 새 연결이 생성됨
  CONSTRAINT unique_user_active_customer UNIQUE (user_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_customer_links_user_id ON user_customer_links(user_id);
CREATE INDEX IF NOT EXISTS idx_user_customer_links_customer_id ON user_customer_links(customer_id);
CREATE INDEX IF NOT EXISTS idx_user_customer_links_auth_email ON user_customer_links(auth_email);

-- 주석 추가
COMMENT ON TABLE user_customer_links IS 'Supabase Auth 사용자와 customers 테이블 연결 테이블';
COMMENT ON COLUMN user_customer_links.user_id IS 'Supabase Auth 사용자 ID (auth.users.id)';
COMMENT ON COLUMN user_customer_links.customer_id IS '고객 ID (customers.id)';
COMMENT ON COLUMN user_customer_links.auth_email IS '구글 로그인 이메일 주소 (참고용)';
COMMENT ON COLUMN user_customer_links.matched_at IS '매칭 시각';
COMMENT ON COLUMN user_customer_links.matched_by IS '매칭 방법: user (사용자 직접), auto (자동 매칭)';

-- RLS (Row Level Security) 정책 설정
ALTER TABLE user_customer_links ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 연결 정보만 조회 가능
CREATE POLICY "Users can view their own customer links"
  ON user_customer_links
  FOR SELECT
  USING (auth.uid() = user_id);

-- 사용자는 자신의 연결 정보만 생성 가능
CREATE POLICY "Users can create their own customer links"
  ON user_customer_links
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 연결 정보만 업데이트 가능
CREATE POLICY "Users can update their own customer links"
  ON user_customer_links
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 사용자는 자신의 연결 정보만 삭제 가능
CREATE POLICY "Users can delete their own customer links"
  ON user_customer_links
  FOR DELETE
  USING (auth.uid() = user_id);

-- 관리자는 모든 연결 정보 조회 가능 (서비스 역할 사용)
-- 주의: 서비스 역할은 RLS를 우회하므로 별도 정책 불필요

