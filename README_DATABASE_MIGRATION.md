# 데이터베이스 마이그레이션 가이드

## Customers 테이블 구조 변경

이 가이드는 customers 테이블을 새로운 구조로 변경하는 방법을 설명합니다.

### 새로운 테이블 구조

```sql
CREATE TABLE customers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,              -- 고객 이름 (name_ko + name_en)
  name_ko VARCHAR(255) NOT NULL,           -- 한국어 이름
  name_en VARCHAR(255),                     -- 영어 이름 (선택사항)
  phone VARCHAR(50) NOT NULL,               -- 전화번호
  emergency_contact VARCHAR(255),           -- 비상연락처
  email VARCHAR(255) UNIQUE NOT NULL,       -- 이메일
  address TEXT,                            -- 주소 (새로 추가)
  language VARCHAR(10) DEFAULT 'ko',        -- 언어 (새로 추가)
  special_requests TEXT,                   -- 특별요청사항
  booking_count INTEGER DEFAULT 0,         -- 예약 수 (새로 추가)
  channel_id VARCHAR(255),                 -- 채널 ID
  status VARCHAR(50) DEFAULT 'active',     -- 상태
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 변경사항

#### 추가된 컬럼
- `name`: 고객 이름 (name_ko + name_en 조합)
- `address`: 고객 주소
- `language`: 선호 언어 (기본값: 'ko')
- `booking_count`: 예약 횟수 (기본값: 0)

#### 제거된 컬럼
- `nationality`: 국적
- `passport_number`: 여권번호

#### 수정된 컬럼
- `name_en`: NOT NULL 제약조건 제거 (선택사항으로 변경)

### 마이그레이션 적용 방법

#### 방법 1: Supabase CLI 사용 (권장)

1. Docker Desktop을 실행합니다.
2. 터미널에서 다음 명령어를 실행합니다:

```bash
# 데이터베이스 리셋 (모든 데이터 삭제)
npx supabase db reset

# 또는 마이그레이션만 적용 (기존 데이터 보존)
npx supabase db push
```

#### 방법 2: Supabase Dashboard 사용

1. [Supabase Dashboard](https://supabase.com/dashboard)에 로그인합니다.
2. 프로젝트를 선택합니다.
3. SQL Editor로 이동합니다.
4. 다음 SQL을 실행합니다:

```sql
-- 안전한 마이그레이션 (기존 데이터 보존)
-- Step 1: 백업 생성
CREATE TABLE customers_backup AS SELECT * FROM customers;

-- Step 2: 새 컬럼 추가
ALTER TABLE customers ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'ko';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS booking_count INTEGER DEFAULT 0;

-- Step 3: 불필요한 컬럼 제거
ALTER TABLE customers DROP COLUMN IF EXISTS nationality;
ALTER TABLE customers DROP COLUMN IF EXISTS passport_number;

-- Step 4: 제약조건 수정
ALTER TABLE customers ALTER COLUMN name_en DROP NOT NULL;

-- Step 4.5: name 컬럼 업데이트
UPDATE customers 
SET name = CASE 
  WHEN name_en IS NOT NULL AND name_en != '' THEN name_ko || ' (' || name_en || ')'
  ELSE name_ko
END
WHERE name IS NULL;

-- Step 5: 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at);
CREATE INDEX IF NOT EXISTS idx_customers_channel_id ON customers(channel_id);
```

#### 방법 3: 완전한 테이블 재생성 (데이터 손실)

기존 데이터가 필요없다면 다음 SQL을 실행할 수 있습니다:

```sql
-- 기존 테이블 삭제
DROP TABLE IF EXISTS customers CASCADE;

-- 새 테이블 생성
CREATE TABLE customers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  name_ko VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),
  phone VARCHAR(50) NOT NULL,
  emergency_contact VARCHAR(255),
  email VARCHAR(255) UNIQUE NOT NULL,
  address TEXT,
  language VARCHAR(10) DEFAULT 'ko',
  special_requests TEXT,
  booking_count INTEGER DEFAULT 0,
  channel_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_created_at ON customers(created_at);
CREATE INDEX idx_customers_channel_id ON customers(channel_id);
```

### 마이그레이션 후 확인사항

1. **테이블 구조 확인**:
```sql
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'customers' 
ORDER BY ordinal_position;
```

2. **인덱스 확인**:
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'customers';
```

3. **샘플 데이터 삽입 테스트**:
```sql
INSERT INTO customers (name, name_ko, name_en, phone, email, address, language) 
VALUES ('홍길동 (Hong Gil-dong)', '홍길동', 'Hong Gil-dong', '010-1234-5678', 'hong@example.com', '서울시 강남구', 'ko');
```

### 주의사항

- **백업**: 마이그레이션 전에 반드시 데이터를 백업하세요.
- **테스트**: 프로덕션 환경에 적용하기 전에 개발 환경에서 먼저 테스트하세요.
- **의존성**: customers 테이블을 참조하는 다른 테이블이나 뷰가 있다면 함께 업데이트해야 합니다.

### 문제 해결

#### 마이그레이션 실패 시
1. 백업 테이블에서 데이터 복원:
```sql
INSERT INTO customers SELECT * FROM customers_backup;
```

2. 롤백:
```sql
-- 백업에서 원래 구조로 복원
DROP TABLE customers;
CREATE TABLE customers AS SELECT * FROM customers_backup;
```

#### 타입 오류 발생 시
TypeScript 타입 정의가 업데이트되었는지 확인하세요:
```bash
# 타입 재생성
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/database.types.ts
```
