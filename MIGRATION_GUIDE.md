# 기존 Choices 데이터 마이그레이션 가이드

## 📋 마이그레이션 개요

기존 JSONB `choices` 컬럼의 모든 데이터를 새로운 정규화된 구조로 안전하게 마이그레이션합니다.

## 🔄 마이그레이션 과정

### 1단계: 데이터 백업
```sql
-- 기존 데이터 백업 테이블 생성
CREATE TABLE products_choices_backup AS
SELECT id, choices, created_at FROM products WHERE choices IS NOT NULL;

CREATE TABLE reservations_choices_backup AS
SELECT id, choices, created_at FROM reservations WHERE choices IS NOT NULL;
```

### 2단계: 새로운 구조 생성
```sql
-- create_simple_choices_system.sql 실행
-- 새로운 테이블 구조 생성
```

### 3단계: 데이터 마이그레이션
```sql
-- migrate_existing_choices_data.sql 실행
-- 기존 JSONB 데이터를 새로운 구조로 변환
```

## 📊 마이그레이션 매핑

### 상품 Choices 변환
| 기존 JSONB 구조 | 새로운 테이블 구조 |
|----------------|------------------|
| `choices.required[].id` | `product_choices.choice_group` |
| `choices.required[].name_ko` | `product_choices.choice_group_ko` |
| `choices.required[].type` | `product_choices.choice_type` |
| `choices.required[].validation.min_selections` | `product_choices.min_selections` |
| `choices.required[].validation.max_selections` | `product_choices.max_selections` |
| `choices.required[].options[].id` | `choice_options.option_key` |
| `choices.required[].options[].name_ko` | `choice_options.option_name_ko` |
| `choices.required[].options[].adult_price` | `choice_options.adult_price` |
| `choices.required[].options[].capacity_per_room` | `choice_options.capacity` |

### 예약 Choices 변환
| 기존 JSONB 구조 | 새로운 테이블 구조 |
|----------------|------------------|
| `choices.required[].selected` | `reservation_choices.option_id` |
| `choices.required[].selections[].quantity` | `reservation_choices.quantity` |
| `choices.required[].selections[].total_price` | `reservation_choices.total_price` |

## 🔍 마이그레이션 검증

### 데이터 무결성 확인
```sql
-- 1. 상품별 choices 개수 확인
SELECT 
  p.id,
  p.name_ko,
  COUNT(pc.id) as choices_count,
  COUNT(co.id) as options_count
FROM products p
LEFT JOIN product_choices pc ON p.id = pc.product_id
LEFT JOIN choice_options co ON pc.id = co.choice_id
WHERE p.choices IS NOT NULL
GROUP BY p.id, p.name_ko;

-- 2. 예약별 choices 개수 확인
SELECT 
  r.id,
  r.customer_name,
  COUNT(rc.id) as choices_count
FROM reservations r
LEFT JOIN reservation_choices rc ON r.id = rc.reservation_id
WHERE r.choices IS NOT NULL
GROUP BY r.id, r.customer_name;
```

### 샘플 데이터 비교
```sql
-- 기존 JSONB 데이터 확인
SELECT 
  id,
  choices
FROM products_choices_backup
WHERE id = 'ACCOMMODATION_TOUR';

-- 새로운 구조 데이터 확인
SELECT 
  pc.choice_group,
  pc.choice_group_ko,
  pc.choice_type,
  co.option_key,
  co.option_name_ko,
  co.adult_price,
  co.capacity
FROM product_choices pc
JOIN choice_options co ON pc.id = co.choice_id
WHERE pc.product_id = 'ACCOMMODATION_TOUR'
ORDER BY pc.sort_order, co.sort_order;
```

## ⚠️ 주의사항

### 1. 마이그레이션 전 체크리스트
- [ ] 데이터베이스 백업 완료
- [ ] 기존 choices 데이터 구조 파악 완료
- [ ] 새로운 테이블 구조 생성 완료
- [ ] 테스트 환경에서 마이그레이션 테스트 완료

### 2. 마이그레이션 중 주의사항
- 마이그레이션 중에는 예약 생성/수정 중단
- 대용량 데이터의 경우 배치 처리 고려
- 각 단계별 검증 수행

### 3. 마이그레이션 후 작업
- [ ] 데이터 무결성 검증
- [ ] 애플리케이션 테스트
- [ ] 기존 컬럼 제거 (선택사항)
- [ ] 백업 데이터 보관 정책 수립

## 🚀 롤백 계획

문제 발생 시 롤백 방법:
```sql
-- 1. 새로운 테이블 삭제
DROP TABLE IF EXISTS reservation_choices;
DROP TABLE IF EXISTS choice_options;
DROP TABLE IF EXISTS product_choices;

-- 2. 기존 컬럼 복원 (필요시)
ALTER TABLE products ADD COLUMN choices JSONB;
ALTER TABLE reservations ADD COLUMN choices JSONB;

-- 3. 백업 데이터 복원
UPDATE products SET choices = pcb.choices
FROM products_choices_backup pcb
WHERE products.id = pcb.id;

UPDATE reservations SET choices = rcb.choices
FROM reservations_choices_backup rcb
WHERE reservations.id = rcb.id;
```

## 📈 마이그레이션 효과

### Before (JSONB 구조)
```json
{
  "required": [
    {
      "id": "accommodation_choice",
      "name": "Accommodation Choice",
      "name_ko": "숙박 선택",
      "type": "multiple_quantity",
      "validation": {
        "min_selections": 1,
        "max_selections": 10,
        "require_capacity_match": true
      },
      "options": [
        {
          "id": "single_room",
          "name": "1인 1실",
          "name_ko": "1인 1실",
          "adult_price": 50000,
          "child_price": 30000,
          "infant_price": 0,
          "capacity_per_room": 1,
          "max_quantity": 20
        }
      ]
    }
  ]
}
```

### After (정규화된 구조)
```sql
-- product_choices 테이블
id: uuid, product_id: 'ACCOMMODATION_TOUR', choice_group: 'accommodation_choice', 
choice_group_ko: '숙박 선택', choice_type: 'quantity', is_required: true

-- choice_options 테이블  
id: uuid, choice_id: uuid, option_key: 'single_room', option_name_ko: '1인 1실',
adult_price: 50000, child_price: 30000, infant_price: 0, capacity: 1
```

## ✅ 마이그레이션 완료 체크리스트

- [ ] 모든 상품의 choices 데이터 마이그레이션 완료
- [ ] 모든 예약의 choices 데이터 마이그레이션 완료
- [ ] 데이터 무결성 검증 완료
- [ ] 애플리케이션 테스트 완료
- [ ] 성능 테스트 완료
- [ ] 백업 데이터 보관 완료
- [ ] 문서화 완료

이제 기존의 모든 choices 데이터가 새로운 간결한 구조로 안전하게 마이그레이션됩니다! 🎉
