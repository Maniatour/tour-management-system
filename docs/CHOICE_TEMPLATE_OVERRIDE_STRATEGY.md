# 초이스 템플릿 + 상품별 커스터마이징 전략

## 문제 상황

**시나리오:**
- "국립공원 입장료" 초이스 그룹이 여러 상품에 공통으로 사용됨
- 하지만 각 상품마다:
  - 입장하는 국립공원이 다름 (예: 상품A는 그랜드 캐년, 상품B는 요세미티)
  - 입장료 가격이 다름 (예: 상품A는 $35, 상품B는 $30)

**현재 구조의 한계:**
- 템플릿으로 관리하면 모든 상품이 같은 옵션과 가격을 공유
- 상품별로 다른 국립공원과 가격을 설정할 수 없음

---

## 해결 방안

### 방안 1: 템플릿 구조 + 상품별 오버라이드 (권장)

#### 개념
- **템플릿**: 초이스 그룹의 **구조만** 정의 (이름, 타입 등)
- **상품별 초이스**: 템플릿을 불러온 후, 각 상품에서 **옵션과 가격을 독립적으로 관리**

#### 구조

```
템플릿 (통합 옵션 - 초이스 관리)
├── 그룹명: "국립공원 입장료"
├── 타입: single
└── 구조만 정의 (옵션은 예시)

상품 A (상품 편집 - 초이스 관리)
├── 그룹명: "국립공원 입장료" (템플릿에서 불러옴)
├── 타입: single
└── 옵션:
    ├── 그랜드 캐년 ($35) ← 상품별로 다름
    └── 앤텔롭 캐년 ($90) ← 상품별로 다름

상품 B (상품 편집 - 초이스 관리)
├── 그룹명: "국립공원 입장료" (템플릿에서 불러옴)
├── 타입: single
└── 옵션:
    ├── 요세미티 ($30) ← 상품별로 다름
    └── 세쿼이아 ($25) ← 상품별로 다름
```

#### 구현 방법

1. **템플릿 생성 (통합 옵션)**
   ```typescript
   // options 테이블
   {
     template_group: "national_park_fee",
     template_group_ko: "국립공원 입장료",
     choice_type: "single",
     is_choice_template: true,
     // 옵션은 예시로만 (실제 사용 안 함)
   }
   ```

2. **상품별 초이스 생성 (상품 편집)**
   ```typescript
   // 템플릿에서 불러오기
   loadFromTemplate("national_park_fee")
   
   // 불러온 후 상품별로 커스터마이징
   product_choices: {
     choice_group: "national_park_fee",
     choice_group_ko: "국립공원 입장료",
     choice_type: "single",
     options: [
       // 상품 A: 그랜드 캐년, 앤텔롭 캐년
       // 상품 B: 요세미티, 세쿼이아
     ]
   }
   ```

3. **가격 관리 (동적 가격)**
   ```typescript
   // dynamic_pricing.choices_pricing
   {
     "national_park_fee+grand_canyon": {
       adult: 35,  // 상품 A
       child: 25,
       infant: 0
     },
     "national_park_fee+yosemite": {
       adult: 30,  // 상품 B
       child: 20,
       infant: 0
     }
   }
   ```

#### 장점
- ✅ 템플릿으로 초이스 그룹 구조 재사용
- ✅ 각 상품에서 독립적으로 옵션과 가격 관리
- ✅ 동적 가격 시스템과 완벽 호환
- ✅ 기존 구조 유지 (큰 변경 없음)

#### 단점
- ⚠️ 템플릿을 불러온 후 수동으로 옵션 추가/수정 필요
- ⚠️ 상품이 많으면 관리가 번거로울 수 있음

---

### 방안 2: 템플릿 옵션 풀 + 상품별 선택

#### 개념
- **템플릿**: 모든 가능한 국립공원 옵션을 정의
- **상품별**: 템플릿에서 필요한 옵션만 선택하여 활성화
- **가격**: 동적 가격에서 상품별로 다른 가격 설정

#### 구조

```
템플릿 (통합 옵션 - 초이스 관리)
├── 그룹명: "국립공원 입장료"
└── 옵션 풀:
    ├── 그랜드 캐년 (기본 가격: $0)
    ├── 요세미티 (기본 가격: $0)
    ├── 세쿼이아 (기본 가격: $0)
    └── 앤텔롭 캐년 (기본 가격: $0)

상품 A
├── 템플릿에서 불러오기
└── 활성화된 옵션:
    ├── 그랜드 캐년 (동적 가격: $35)
    └── 앤텔롭 캐년 (동적 가격: $90)

상품 B
├── 템플릿에서 불러오기
└── 활성화된 옵션:
    ├── 요세미티 (동적 가격: $30)
    └── 세쿼이아 (동적 가격: $25)
```

#### 구현 방법

1. **템플릿에 모든 옵션 정의**
   ```typescript
   // options 테이블 (is_choice_template = true)
   [
     {
       template_group: "national_park_fee",
       name: "grand_canyon",
       name_ko: "그랜드 캐년",
       adult_price: 0,  // 기본값 (실제 가격은 동적 가격에서)
     },
     {
       template_group: "national_park_fee",
       name: "yosemite",
       name_ko: "요세미티",
       adult_price: 0,
     },
     // ... 모든 국립공원
   ]
   ```

2. **상품별로 필요한 옵션만 활성화**
   ```typescript
   // 상품 편집에서 템플릿 불러올 때
   loadFromTemplate("national_park_fee", {
     // 필요한 옵션만 선택
     selectedOptions: ["grand_canyon", "antelope_canyon"]
   })
   ```

3. **동적 가격에서 상품별 가격 설정**
   ```typescript
   // dynamic_pricing.choices_pricing
   {
     "national_park_fee+grand_canyon": {
       adult: 35,  // 상품 A
     },
     "national_park_fee+antelope_canyon": {
       adult: 90,  // 상품 A
     }
   }
   ```

#### 장점
- ✅ 템플릿에서 모든 옵션 관리 (중앙 집중식)
- ✅ 상품별로 필요한 옵션만 선택
- ✅ 새로운 국립공원 추가 시 템플릿만 수정

#### 단점
- ⚠️ 템플릿에 모든 옵션을 미리 정의해야 함
- ⚠️ 사용하지 않는 옵션도 템플릿에 포함됨
- ⚠️ 상품별 옵션 선택 기능 추가 필요

---

### 방안 3: 상품별 완전 독립 관리

#### 개념
- 템플릿은 참고용으로만 사용
- 각 상품에서 초이스를 완전히 독립적으로 관리
- 템플릿과의 연결은 이름만 공유

#### 구조

```
템플릿 (참고용)
└── "국립공원 입장료" 구조 예시

상품 A
└── "국립공원 입장료" (템플릿과 이름만 같음)
    └── 완전히 독립적인 옵션과 가격

상품 B
└── "국립공원 입장료" (템플릿과 이름만 같음)
    └── 완전히 독립적인 옵션과 가격
```

#### 장점
- ✅ 각 상품에서 완전한 자유도
- ✅ 템플릿과 독립적 (템플릿 변경 영향 없음)

#### 단점
- ⚠️ 템플릿의 의미가 약해짐
- ⚠️ 각 상품마다 수동으로 관리 필요
- ⚠️ 일관성 유지 어려움

---

## 권장 방안: 방안 1 (템플릿 구조 + 상품별 오버라이드)

### 구현 단계

#### Step 1: 템플릿 구조 정의

**통합 옵션 - 초이스 관리에서:**
1. "국립공원 입장료" 템플릿 그룹 생성
2. 그룹 메타데이터만 정의:
   - 그룹명: "국립공원 입장료"
   - 타입: single
   - 필수 여부: true
3. 옵션은 예시로만 추가 (실제 사용 안 함)

#### Step 2: 상품별 초이스 생성

**상품 편집 - 초이스 관리에서:**
1. 템플릿에서 "국립공원 입장료" 불러오기
2. 불러온 후 상품별로:
   - 필요한 국립공원 옵션 추가
   - 각 옵션의 기본 가격 설정
   - 옵션 순서 조정

#### Step 3: 동적 가격 설정

**동적 가격 관리에서:**
1. 각 상품별로 날짜별 가격 설정
2. `choices_pricing`에서 상품별로 다른 가격 적용:
   ```json
   {
     "national_park_fee+grand_canyon": {
       "adult": 35,
       "child": 25,
       "infant": 0
     }
   }
   ```

### 데이터 흐름

```
1. 템플릿 생성 (통합 옵션)
   ↓
2. 상품 A: 템플릿 불러오기
   ↓
3. 상품 A: 그랜드 캐년, 앤텔롭 캐년 옵션 추가
   ↓
4. 동적 가격: 상품 A의 국립공원별 가격 설정
   ↓
5. 상품 B: 템플릿 불러오기
   ↓
6. 상품 B: 요세미티, 세쿼이아 옵션 추가
   ↓
7. 동적 가격: 상품 B의 국립공원별 가격 설정
```

---

## 개선 사항

### 1. 템플릿 불러오기 기능 개선

현재는 템플릿의 모든 옵션을 불러오지만, 향후:
- 옵션 선택 기능 추가
- 기본 가격 설정 기능 추가

### 2. 템플릿 메타데이터 강화

템플릿에 다음 정보 추가:
- 그룹 설명
- 권장 옵션 목록 (참고용)
- 가격 범위 (참고용)

### 3. 상품별 초이스 복사 기능

다른 상품의 초이스를 복사하여 사용:
- 상품 A의 "국립공원 입장료" → 상품 C로 복사
- 복사 후 옵션과 가격 수정

---

## 예시: 국립공원 입장료 구현

### 템플릿 (통합 옵션)

```typescript
{
  template_group: "national_park_fee",
  template_group_ko: "국립공원 입장료",
  template_group_description_ko: "국립공원 입장료를 선택하세요",
  choice_type: "single",
  is_required: true,
  min_selections: 1,
  max_selections: 1
}
```

### 상품 A (그랜드 캐년 투어)

```typescript
// product_choices
{
  choice_group: "national_park_fee",
  choice_group_ko: "국립공원 입장료",
  choice_type: "single",
  is_required: true
}

// choice_options
[
  {
    option_key: "grand_canyon",
    option_name_ko: "그랜드 캐년",
    adult_price: 35,  // 기본 가격
    child_price: 25,
    infant_price: 0
  },
  {
    option_key: "antelope_canyon",
    option_name_ko: "앤텔롭 캐년",
    adult_price: 90,
    child_price: 70,
    infant_price: 0
  }
]

// dynamic_pricing.choices_pricing
{
  "national_park_fee+grand_canyon": {
    adult: 35,
    child: 25,
    infant: 0
  },
  "national_park_fee+antelope_canyon": {
    adult: 90,
    child: 70,
    infant: 0
  }
}
```

### 상품 B (요세미티 투어)

```typescript
// product_choices
{
  choice_group: "national_park_fee",
  choice_group_ko: "국립공원 입장료",
  choice_type: "single",
  is_required: true
}

// choice_options
[
  {
    option_key: "yosemite",
    option_name_ko: "요세미티",
    adult_price: 30,
    child_price: 20,
    infant_price: 0
  },
  {
    option_key: "sequoia",
    option_name_ko: "세쿼이아",
    adult_price: 25,
    child_price: 15,
    infant_price: 0
  }
]

// dynamic_pricing.choices_pricing
{
  "national_park_fee+yosemite": {
    adult: 30,
    child: 20,
    infant: 0
  },
  "national_park_fee+sequoia": {
    adult: 25,
    child: 15,
    infant: 0
  }
}
```

---

## 결론

**권장 구조:**
- 템플릿: 초이스 그룹의 **구조와 메타데이터만** 정의
- 상품별: 템플릿을 불러온 후 **옵션과 가격을 독립적으로 관리**
- 동적 가격: 상품별, 날짜별로 **다른 가격 적용**

이 구조를 통해:
1. ✅ 템플릿으로 초이스 그룹 구조 재사용
2. ✅ 각 상품에서 필요한 국립공원과 가격 독립 관리
3. ✅ 동적 가격 시스템과 완벽 호환
4. ✅ 기존 시스템 구조 유지

