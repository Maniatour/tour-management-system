# 초이스 관리 시스템 구조 정리

## 개요

현재 시스템에는 **두 가지 다른 초이스 관리 시스템**이 존재합니다:

1. **통합 옵션 - 초이스 관리** (`GlobalChoicesManager`)
2. **상품 편집 - 초이스 관리** (`ChoicesTabNew`)

## 1. 통합 옵션 - 초이스 관리 (`GlobalChoicesManager`)

### 위치
- 경로: `src/components/admin/GlobalChoicesManager.tsx`
- 접근: `통합 옵션` > `초이스 관리` 탭
- URL: `/admin/options?tab=choices`

### 데이터 구조
- **테이블**: `options`
- **필터**: `is_choice_template = true`
- **그룹화**: `template_group`, `template_group_ko`
- **개별 항목**: 각 `option` 레코드가 하나의 초이스 옵션

### 기능
- ✅ 초이스 옵션 추가/편집/삭제
- ✅ 템플릿 그룹별 관리
- ❌ **초이스 그룹 편집 불가** (템플릿 그룹 이름만 변경 가능)
- ✅ 템플릿으로 내보내기 (상품 편집에서 사용)

### 데이터 구조 예시
```typescript
interface ChoiceTemplate {
  id: string
  name: string
  name_ko?: string
  template_group?: string        // 그룹 식별자
  template_group_ko?: string    // 그룹 한글명
  choice_type: 'single' | 'multiple' | 'quantity'
  is_choice_template: true      // 필수: true
  // ... 기타 옵션 필드
}
```

### 제한사항
- 초이스 그룹(`template_group`)의 구조를 변경할 수 없음
- 그룹 이름만 변경 가능
- 그룹 삭제 시 해당 그룹의 모든 옵션이 삭제됨

---

## 2. 상품 편집 - 초이스 관리 (`ChoicesTabNew`)

### 위치
- 경로: `src/components/product/ChoicesTabNew.tsx`
- 접근: `상품 편집` > `초이스 관리` 탭
- URL: `/admin/products/[id]?tab=choices`

### 데이터 구조
- **테이블**: `product_choices` (그룹), `choice_options` (옵션)
- **그룹화**: `choice_group`, `choice_group_ko`, `choice_group_key`
- **관계**: `product_choices` 1:N `choice_options`

### 기능
- ✅ 초이스 그룹 추가/편집/삭제
- ✅ 그룹 내 초이스 옵션 관리
- ✅ 템플릿에서 불러오기 (통합 옵션의 템플릿 사용)
- ✅ 템플릿으로 내보내기 (통합 옵션으로 저장)

### 데이터 구조 예시
```typescript
interface ProductChoice {
  id: string
  product_id: string
  choice_group: string           // 그룹 식별자
  choice_group_ko: string        // 그룹 한글명
  choice_group_key: string       // 안정적인 그룹 키
  choice_type: 'single' | 'multiple' | 'quantity'
  is_required: boolean
  options: ChoiceOption[]        // 하위 옵션들
}

interface ChoiceOption {
  id: string
  choice_id: string              // product_choices.id 참조
  option_key: string             // 안정적인 옵션 키
  option_name_ko: string
  // ... 기타 옵션 필드
}
```

### 제한사항
- 상품별로 독립적인 초이스 구조
- 다른 상품의 초이스를 직접 복사할 수 없음 (템플릿을 통해서만)

---

## 두 시스템의 관계

### 템플릿 흐름

```
통합 옵션 (초이스 관리)
    ↓ [템플릿으로 내보내기]
options 테이블 (is_choice_template = true)
    ↓ [템플릿에서 불러오기]
상품 편집 (초이스 관리)
    ↓ [저장]
product_choices + choice_options 테이블
```

### 데이터 변환

1. **템플릿 → 상품 초이스**
   - `options` (template_group) → `product_choices` (choice_group)
   - `options` (개별 항목) → `choice_options` (개별 옵션)

2. **상품 초이스 → 템플릿**
   - `product_choices` → `options` (template_group 설정)
   - `choice_options` → `options` (is_choice_template = true)

---

## 문제점 및 개선 방안

### 현재 문제점

1. **구조 불일치**
   - 통합 옵션: `options` 테이블 하나로 관리
   - 상품 편집: `product_choices` + `choice_options` 두 테이블로 관리

2. **기능 제한**
   - 통합 옵션에서 초이스 그룹 편집 불가
   - 상품 편집에서 다른 상품의 초이스 직접 복사 불가

3. **데이터 중복**
   - 템플릿과 상품 초이스가 별도로 저장되어 동기화 문제 발생 가능

### 개선 방안

#### 옵션 1: 통합 옵션 시스템 개선 (권장)

**통합 옵션에서도 초이스 그룹 편집 가능하도록 개선**

```typescript
// GlobalChoicesManager에 추가할 기능
- 초이스 그룹 추가/편집/삭제
- 그룹 내 옵션 관리
- 그룹 메타데이터 관리 (description, choice_type 등)
```

**장점:**
- 두 시스템의 기능 통일
- 템플릿 관리가 더 유연해짐

**단점:**
- `options` 테이블 구조 변경 필요
- 기존 데이터 마이그레이션 필요

#### 옵션 2: 상품 편집 시스템 개선

**상품 편집에서 다른 상품의 초이스를 직접 복사 가능하도록 개선**

```typescript
// ChoicesTabNew에 추가할 기능
- 다른 상품의 초이스 복사
- 초이스 그룹 단위 복사
- 초이스 옵션 단위 복사
```

**장점:**
- 기존 구조 유지
- 구현이 상대적으로 간단

**단점:**
- 두 시스템의 기능 차이 유지
- 템플릿 시스템의 필요성 감소

#### 옵션 3: 통합 시스템 구축 (장기)

**단일 초이스 관리 시스템으로 통합**

- `product_choices` + `choice_options` 구조를 표준으로 사용
- 통합 옵션도 동일한 구조 사용
- 템플릿은 별도 테이블로 관리

**장점:**
- 구조 일관성
- 유지보수 용이
- 확장성 향상

**단점:**
- 대규모 리팩토링 필요
- 기존 데이터 마이그레이션 복잡

---

## 권장 사항

### 단기 (즉시 적용 가능)

1. **통합 옵션 - 초이스 그룹 편집 기능 추가**
   - `GlobalChoicesManager`에 그룹 편집 모달 추가
   - 그룹 메타데이터 관리 기능 추가

2. **문서화 강화**
   - 두 시스템의 차이점 명확히 문서화
   - 사용 가이드 작성

### 중기 (1-2개월)

1. **데이터 구조 통일**
   - 통합 옵션도 `product_choices` + `choice_options` 구조 사용 검토
   - 또는 `options` 테이블에 그룹 관리 기능 강화

2. **템플릿 시스템 개선**
   - 템플릿과 상품 초이스 간 동기화 기능
   - 템플릿 버전 관리

### 장기 (3-6개월)

1. **통합 시스템 구축**
   - 단일 초이스 관리 시스템
   - 템플릿과 상품 초이스의 명확한 분리

---

## 데이터베이스 스키마 비교

### 통합 옵션 (현재)
```sql
options (
  id UUID,
  name TEXT,
  template_group TEXT,           -- 그룹 식별자
  template_group_ko TEXT,        -- 그룹 한글명
  is_choice_template BOOLEAN,    -- true인 경우만 초이스 관리에서 표시
  choice_type TEXT,
  -- ... 기타 필드
)
```

### 상품 편집 (현재)
```sql
product_choices (
  id UUID,
  product_id TEXT,
  choice_group TEXT,             -- 그룹 식별자
  choice_group_ko TEXT,          -- 그룹 한글명
  choice_group_key TEXT,         -- 안정적인 그룹 키
  choice_type TEXT,
  -- ... 기타 필드
)

choice_options (
  id UUID,
  choice_id UUID,               -- product_choices.id 참조
  option_key TEXT,               -- 안정적인 옵션 키
  option_name_ko TEXT,
  -- ... 기타 필드
)
```

---

## 결론

현재 두 시스템은 서로 다른 목적과 구조를 가지고 있습니다:
- **통합 옵션**: 템플릿 관리 (재사용 가능한 초이스 템플릿)
- **상품 편집**: 상품별 초이스 관리 (실제 상품에 적용되는 초이스)

**즉시 개선이 필요한 부분:**
1. 통합 옵션에서 초이스 그룹 편집 기능 추가
2. 두 시스템의 관계와 사용법 명확화
3. 데이터 구조 일관성 확보


