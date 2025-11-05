# Channels 테이블 구조 재구성 가이드

## 개요

자체 판매 채널들(kakaotalk, blog 등 11개)을 하나의 "Self" 채널로 통합하고, `sub_channels` 컬럼에 서브 채널 목록을 저장하는 구조로 변경합니다.

## 변경 사항

### 현재 구조
```
채널명        | 카테고리
kakaotalk     | Self
blog          | Self
instagram     | Self
...
getyourguide  | OTA
viator        | OTA
```

### 새로운 구조
```
채널명        | 카테고리 | sub_channels
Self          | Self     | [kakaotalk, blog, instagram, ...]
getyourguide  | OTA      | []
viator        | OTA      | []
```

## 마이그레이션 파일

`supabase/migrations/20250123000000_restructure_channels_with_sub_channels.sql`

## 주요 변경 내용

### 1. 테이블 구조 변경
- `channels` 테이블에 `sub_channels` 컬럼 추가 (TEXT[] 타입)
- `customers` 테이블에 `sub_channel` 컬럼 추가 (원래 서브 채널 정보 보존용)
- `reservations` 테이블에 `sub_channel` 컬럼 추가 (원래 서브 채널 정보 보존용)
- 배열 인덱스 생성 (검색 성능 향상)
- category 제약조건에 'Self' 추가

### 2. 데이터 마이그레이션
- 기존 Self 채널들을 찾아서 서브 채널 목록 생성
- `reservations`, `customers`, `dynamic_pricing` 테이블의 channel_id를 'SELF'로 업데이트
- **중요**: 원래 서브 채널 정보를 보존하기 위해 `sub_channel` 필드에 원래 채널 이름 저장
  - 예: `channel_id = 'kakaotalk'` → `channel_id = 'SELF'`, `sub_channel = 'kakaotalk'`
- 기존 Self 채널들 삭제

### 3. 주의사항

#### ⚠️ dynamic_pricing 테이블
- 현재 마이그레이션은 기존 Self 채널들의 가격 데이터를 하나로 통합합니다.
- **만약 서브 채널별로 다른 가격이 필요하다면**, 다음 중 하나를 선택해야 합니다:

**옵션 1: dynamic_pricing에 sub_channel 컬럼 추가**
```sql
ALTER TABLE dynamic_pricing ADD COLUMN sub_channel TEXT;
-- UNIQUE 제약조건 수정: (product_id, channel_id, date, sub_channel)
```

**옵션 2: 서브 채널별 가격을 별도 테이블로 관리**
```sql
CREATE TABLE sub_channel_pricing (
    id UUID PRIMARY KEY,
    dynamic_pricing_id UUID REFERENCES dynamic_pricing(id),
    sub_channel TEXT NOT NULL,
    price_adjustment DECIMAL(10,2) DEFAULT 0,
    ...
);
```

#### ⚠️ reservations 테이블
- `channel_rn` 필드와 새로 추가된 `sub_channel` 필드에 실제 서브 채널 이름을 저장합니다.
- 예: `channel_id = 'SELF'`, `sub_channel = 'kakaotalk'`, `channel_rn = 'kakaotalk'`

#### ⚠️ customers 테이블
- 새로 추가된 `sub_channel` 필드에 원래 서브 채널 이름을 저장합니다.
- 예: `channel_id = 'SELF'`, `sub_channel = 'kakaotalk'`

## 사용 예시

### Self 채널에 서브 채널 추가
```sql
UPDATE channels 
SET sub_channels = ARRAY['kakaotalk', 'blog', 'instagram', 'facebook', 'naver', 'youtube', 'tiktok', 'line', 'wechat', 'telegram', 'direct']
WHERE id = 'SELF';
```

### 서브 채널 목록 조회
```sql
SELECT name, category, sub_channels, array_length(sub_channels, 1) as sub_channel_count
FROM channels
WHERE category = 'Self';
```

### 특정 서브 채널이 포함된 채널 찾기
```sql
SELECT * FROM channels
WHERE 'kakaotalk' = ANY(sub_channels);
```

### 서브 채널별 고객/예약 조회
```sql
-- kakaotalk 서브 채널을 통해 온 고객 조회
SELECT * FROM customers
WHERE channel_id = 'SELF' AND sub_channel = 'kakaotalk';

-- kakaotalk 서브 채널을 통해 온 예약 조회
SELECT * FROM reservations
WHERE channel_id = 'SELF' AND sub_channel = 'kakaotalk';
```

## 마이그레이션 실행 전 체크리스트

1. ✅ 데이터베이스 백업
2. ✅ 기존 Self 채널 목록 확인
3. ✅ dynamic_pricing에서 서브 채널별 가격 차이 확인
4. ✅ reservations에서 channel_rn 사용 여부 확인
5. ✅ 애플리케이션 코드에서 channels 테이블 사용 부분 확인

## 애플리케이션 코드 변경 필요 사항

### 1. 채널 목록 조회 시
```typescript
// Before
const channels = await supabase.from('channels').select('*');

// After - sub_channels도 함께 조회
const channels = await supabase
  .from('channels')
  .select('*, sub_channels');
```

### 2. 채널 선택 UI
- Self 채널 선택 시 서브 채널도 선택할 수 있도록 UI 수정
- 예: 드롭다운에서 "Self" 선택 → 서브 드롭다운에서 "kakaotalk" 선택

### 3. 가격 조회
```typescript
// dynamic_pricing 조회 시 sub_channel도 함께 고려
const pricing = await supabase
  .from('dynamic_pricing')
  .select('*')
  .eq('channel_id', 'SELF')
  .eq('sub_channel', selectedSubChannel) // 옵션 1인 경우
```

## 롤백 방법

마이그레이션을 롤백하려면:

1. 기존 Self 채널들을 다시 생성
2. reservations, customers, dynamic_pricing의 channel_id를 원래대로 복원
3. sub_channels 컬럼 제거 (또는 그대로 유지)

## 추가 고려사항

1. **서브 채널 관리**: 새로운 서브 채널을 추가/제거할 때는 `sub_channels` 배열을 업데이트
2. **통계 및 리포트**: 서브 채널별 통계가 필요한 경우 `channel_rn` 필드를 활용
3. **가격 정책**: 서브 채널별로 가격이 다른 경우 별도 처리 로직 필요

