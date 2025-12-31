# 복잡한 초이스 시나리오 분석 및 구조 설계

## 시나리오 분석

### 시나리오 1: 밤도깨비 투어

#### 기존 (2025년 12월 31일까지)
- **초이스 그룹 1개**: 앤텔롭 캐년 선택
  - 로어 앤텔롭 캐년
  - 엑스 앤텔롭 캐년
  - 선택: 단일 선택 (택1)

#### 변경 후 (2026년 1월 1일부터)
- **초이스 그룹 1**: 앤텔롭 캐년 선택 (기존 유지)
  - 로어 앤텔롭 캐년
  - 엑스 앤텔롭 캐년
  
- **초이스 그룹 2**: 그랜드캐년 입장료 (신규 추가)
  - 미국 거주자 입장료: $8
  - 비 거주자 입장료: $100
  - 애뉴얼 패스 구매자: $250
  - 애뉴얼 패스 구매자와의 동행: $0

**특수 규칙:**
- 애뉴얼 패스 구매 시 구매자 포함 최대 4인까지 입장료 커버
- 동행자는 $0

---

### 시나리오 2: 그랜드서클 1박2일 투어

#### 초이스 그룹들
- **초이스 그룹 1**: 그랜드캐년 입장료
- **초이스 그룹 2**: 자이언캐년 입장료
- **초이스 그룹 3**: 브라이스 캐년 입장료

각 그룹의 옵션:
- 미국 거주자 입장료: $8
- 비 거주자 입장료: $100
- 애뉴얼 패스 구매자: $250
- 애뉴얼 패스 구매자와의 동행: $0

**특수 규칙:**
- 애뉴얼 패스 1개 구매 시 구매자 포함 최대 4인까지 **3곳 모두** 커버
- 각 캐년마다 개별적으로 입장료를 내거나, 애뉴얼 패스로 통합 커버

---

## 현재 구조의 한계

### 문제점

1. **조건부 가격**
   - 애뉴얼 패스 구매 시 동행자 가격이 $0
   - 현재 구조: 각 옵션의 가격이 고정되어 있음
   - 필요: 다른 초이스 선택에 따라 가격이 변경되어야 함

2. **그룹 할인**
   - 애뉴얼 패스 1개로 최대 4인까지 커버
   - 현재 구조: 개별 옵션 선택만 가능
   - 필요: 그룹 단위 할인 로직

3. **다중 캐년**
   - 그랜드서클 투어는 3곳의 캐년에서 각각 입장료 필요
   - 현재 구조: 각 캐년을 별도 초이스 그룹으로 관리 가능
   - 문제: 애뉴얼 패스가 3곳 모두에 적용되는 로직 필요

4. **상품별 차이**
   - 밤도깨비: 그랜드캐년만
   - 그랜드서클: 3곳의 캐년
   - 현재 구조: 상품별로 다른 초이스 그룹 구성 가능 ✅

---

## 해결 방안

### 방안 1: 조건부 가격 + 그룹 할인 로직 (권장)

#### 구조 설계

```
초이스 그룹: 그랜드캐년 입장료
├── 옵션 1: 미국 거주자 ($8)
├── 옵션 2: 비 거주자 ($100)
├── 옵션 3: 애뉴얼 패스 구매자 ($250)
└── 옵션 4: 애뉴얼 패스 구매자와의 동행 ($0)

특수 규칙:
- 애뉴얼 패스 구매자가 선택되면, 동행자 옵션만 선택 가능
- 애뉴얼 패스 1개로 최대 4인까지 커버
- 동행자 수량 선택 가능 (최대 3명)
```

#### 구현 방법

1. **초이스 그룹 구조**
   ```typescript
   // product_choices
   {
     choice_group: "grand_canyon_fee",
     choice_group_ko: "그랜드캐년 입장료",
     choice_type: "single", // 또는 "quantity" (동행자 수량 선택)
     is_required: true
   }
   
   // choice_options
   [
     { option_key: "us_resident", option_name_ko: "미국 거주자", adult_price: 8 },
     { option_key: "non_resident", option_name_ko: "비 거주자", adult_price: 100 },
     { option_key: "annual_pass_buyer", option_name_ko: "애뉴얼 패스 구매자", adult_price: 250 },
     { option_key: "annual_pass_companion", option_name_ko: "애뉴얼 패스 구매자와의 동행", adult_price: 0 }
   ]
   ```

2. **조건부 로직 (예약/인보이스 생성 시)**
   ```typescript
   // 예약 시 가격 계산 로직
   function calculateGrandCanyonFee(selectedChoices: SelectedChoice[]) {
     const annualPassBuyer = selectedChoices.find(c => c.option_key === 'annual_pass_buyer')
     const companions = selectedChoices.filter(c => c.option_key === 'annual_pass_companion')
     
     if (annualPassBuyer) {
       // 애뉴얼 패스 구매자: $250
       // 동행자: $0 (최대 3명)
       const companionCount = Math.min(companions.length, 3)
       return 250 + (0 * companionCount)
     } else {
       // 일반 입장료
       return selectedChoices.reduce((sum, choice) => {
         if (choice.option_key === 'us_resident') return sum + 8
         if (choice.option_key === 'non_resident') return sum + 100
         return sum
       }, 0)
     }
   }
   ```

3. **다중 캐년 처리 (그랜드서클 투어)**
   ```typescript
   // 각 캐년별로 초이스 그룹 생성
   product_choices: [
     { choice_group: "grand_canyon_fee", ... },
     { choice_group: "zion_canyon_fee", ... },
     { choice_group: "bryce_canyon_fee", ... }
   ]
   
   // 애뉴얼 패스가 3곳 모두에 적용되는지 확인
   function calculateMultiCanyonFee(selectedChoices: SelectedChoice[]) {
     const annualPassBuyer = selectedChoices.find(c => 
       c.option_key === 'annual_pass_buyer' && 
       (c.choice_group === 'grand_canyon_fee' || 
        c.choice_group === 'zion_canyon_fee' || 
        c.choice_group === 'bryce_canyon_fee')
     )
     
     if (annualPassBuyer) {
       // 애뉴얼 패스 1개로 3곳 모두 커버
       // 구매자: $250 (한 번만)
       // 동행자: $0 (3곳 모두)
       return 250
     } else {
       // 각 캐년별로 개별 입장료 계산
       return calculateIndividualFees(selectedChoices)
     }
   }
   ```

---

### 방안 2: 통합 애뉴얼 패스 옵션

#### 구조 설계

```
초이스 그룹: 국립공원 입장료
├── 옵션 1: 미국 거주자 (그랜드캐년) ($8)
├── 옵션 2: 비 거주자 (그랜드캐년) ($100)
├── 옵션 3: 미국 거주자 (자이언캐년) ($8)
├── 옵션 4: 비 거주자 (자이언캐년) ($100)
├── 옵션 5: 미국 거주자 (브라이스 캐년) ($8)
├── 옵션 6: 비 거주자 (브라이스 캐년) ($100)
├── 옵션 7: 애뉴얼 패스 구매자 ($250) ← 3곳 모두 커버
└── 옵션 8: 애뉴얼 패스 동행자 ($0) ← 3곳 모두 커버

특수 규칙:
- 애뉴얼 패스 선택 시 다른 옵션 선택 불가
- 동행자는 수량 선택 가능 (최대 3명)
```

**장점:**
- 구조가 단순함
- 애뉴얼 패스 로직이 명확함

**단점:**
- 캐년이 많아지면 옵션이 너무 많아짐
- 각 캐년별로 다른 가격 적용이 어려움

---

### 방안 3: 하이브리드 구조 (권장)

#### 구조 설계

```
초이스 그룹 1: 앤텔롭 캐년 선택
├── 로어 앤텔롭 캐년
└── 엑스 앤텔롭 캐년

초이스 그룹 2: 국립공원 입장료 (통합)
├── 옵션 1: 미국 거주자 ($8) ← 각 캐년별로 개별 선택
├── 옵션 2: 비 거주자 ($100) ← 각 캐년별로 개별 선택
├── 옵션 3: 애뉴얼 패스 구매자 ($250) ← 1개로 모든 캐년 커버
└── 옵션 4: 애뉴얼 패스 동행자 ($0) ← 수량 선택 가능

특수 규칙:
- 애뉴얼 패스 구매자 선택 시:
  - 동행자 옵션만 추가 선택 가능
  - 동행자 수량: 최대 3명
  - 모든 캐년에 자동 적용
- 애뉴얼 패스 미선택 시:
  - 각 캐년별로 개별 입장료 선택
  - 그랜드캐년, 자이언캐년, 브라이스 캐년 각각 선택
```

#### 구현 방법

1. **초이스 그룹 구조**
   ```typescript
   // 밤도깨비 투어
   product_choices: [
     {
       choice_group: "antelope_canyon",
       choice_type: "single",
       options: ["lower_antelope", "x_antelope"]
     },
     {
       choice_group: "national_park_fee",
       choice_type: "single", // 또는 "multiple" (애뉴얼 패스 + 동행자)
       options: ["us_resident", "non_resident", "annual_pass_buyer", "annual_pass_companion"]
     }
   ]
   
   // 그랜드서클 투어
   product_choices: [
     {
       choice_group: "grand_canyon_fee",
       choice_type: "single",
       options: ["us_resident", "non_resident", "annual_pass_buyer", "annual_pass_companion"]
     },
     {
       choice_group: "zion_canyon_fee",
       choice_type: "single",
       options: ["us_resident", "non_resident", "annual_pass_buyer", "annual_pass_companion"]
     },
     {
       choice_group: "bryce_canyon_fee",
       choice_type: "single",
       options: ["us_resident", "non_resident", "annual_pass_buyer", "annual_pass_companion"]
     }
   ]
   ```

2. **가격 계산 로직**
   ```typescript
   function calculateNationalParkFees(
     selectedChoices: SelectedChoice[],
     productId: string
   ): number {
     // 애뉴얼 패스 구매자 확인
     const annualPassBuyers = selectedChoices.filter(c => 
       c.option_key === 'annual_pass_buyer'
     )
     
     if (annualPassBuyers.length > 0) {
       // 애뉴얼 패스 구매자가 있으면
       const companionCount = selectedChoices.filter(c => 
         c.option_key === 'annual_pass_companion'
       ).length
       
       // 구매자 수만큼 $250
       // 동행자는 $0 (최대 3명)
       const totalCompanions = Math.min(companionCount, annualPassBuyers.length * 3)
       return (annualPassBuyers.length * 250) + (0 * totalCompanions)
     } else {
       // 일반 입장료
       // 각 캐년별로 개별 계산
       return selectedChoices.reduce((sum, choice) => {
         if (choice.option_key === 'us_resident') return sum + 8
         if (choice.option_key === 'non_resident') return sum + 100
         return sum
       }, 0)
     }
   }
   ```

3. **UI 로직**
   ```typescript
   // 애뉴얼 패스 구매자 선택 시
   if (selectedOption === 'annual_pass_buyer') {
     // 다른 캐년의 일반 입장료 옵션 비활성화
     // 동행자 옵션만 선택 가능하도록
     enableCompanionOption()
     disableOtherOptions()
   }
   ```

---

## 권장 구조: 방안 3 (하이브리드)

### 이유

1. **유연성**
   - 상품별로 다른 캐년 구성 가능
   - 밤도깨비: 그랜드캐년만
   - 그랜드서클: 3곳의 캐년

2. **확장성**
   - 새로운 캐년 추가 시 초이스 그룹만 추가
   - 애뉴얼 패스 로직은 공통으로 처리

3. **명확성**
   - 각 캐년별로 명확히 구분
   - 가격 계산 로직이 직관적

### 구현 단계

#### Step 1: 템플릿 생성 (통합 옵션)

```
템플릿 그룹: 국립공원 입장료
├── 옵션: 미국 거주자 ($8)
├── 옵션: 비 거주자 ($100)
├── 옵션: 애뉴얼 패스 구매자 ($250)
└── 옵션: 애뉴얼 패스 동행자 ($0)
```

#### Step 2: 상품별 초이스 생성

**밤도깨비 투어:**
```
초이스 그룹 1: 앤텔롭 캐년 선택
초이스 그룹 2: 그랜드캐년 입장료 (템플릿에서 불러오기)
```

**그랜드서클 투어:**
```
초이스 그룹 1: 그랜드캐년 입장료 (템플릿에서 불러오기)
초이스 그룹 2: 자이언캐년 입장료 (템플릿에서 불러오기)
초이스 그룹 3: 브라이스 캐년 입장료 (템플릿에서 불러오기)
```

#### Step 3: 가격 계산 로직 구현

```typescript
// 예약/인보이스 생성 시
function calculateNationalParkFees(selectedChoices: SelectedChoice[]): number {
  // 1. 애뉴얼 패스 구매자 확인
  const annualPassBuyers = selectedChoices.filter(c => 
    c.option_key === 'annual_pass_buyer'
  )
  
  if (annualPassBuyers.length > 0) {
    // 애뉴얼 패스 모드
    const companionCount = selectedChoices.filter(c => 
      c.option_key === 'annual_pass_companion'
    ).length
    
    // 구매자당 최대 3명 동행 가능
    const maxCompanions = annualPassBuyers.length * 3
    const validCompanions = Math.min(companionCount, maxCompanions)
    
    return (annualPassBuyers.length * 250) + (0 * validCompanions)
  } else {
    // 일반 입장료 모드
    return selectedChoices.reduce((sum, choice) => {
      if (choice.option_key === 'us_resident') return sum + 8
      if (choice.option_key === 'non_resident') return sum + 100
      return sum
    }, 0)
  }
}
```

#### Step 4: UI 조건부 로직

```typescript
// 초이스 선택 시
function handleChoiceSelect(choiceGroup: string, optionKey: string) {
  if (optionKey === 'annual_pass_buyer') {
    // 애뉴얼 패스 구매자 선택 시
    // 1. 같은 그룹의 다른 옵션 비활성화
    // 2. 다른 캐년 그룹의 일반 입장료 옵션 비활성화
    // 3. 동행자 옵션 활성화
    disableOtherOptions(choiceGroup)
    disableOtherCanyonOptions()
    enableCompanionOption()
  } else if (optionKey === 'annual_pass_companion') {
    // 동행자 수량 확인 (최대 3명)
    const companionCount = getCompanionCount()
    if (companionCount >= 3) {
      alert('동행자는 최대 3명까지 가능합니다.')
      return
    }
  } else {
    // 일반 입장료 선택 시
    // 애뉴얼 패스 관련 옵션 비활성화
    disableAnnualPassOptions()
  }
}
```

---

## 데이터베이스 구조

### product_choices

```sql
-- 밤도깨비 투어
INSERT INTO product_choices (product_id, choice_group, choice_group_ko, choice_type, is_required)
VALUES 
  ('night_ghost_tour', 'antelope_canyon', '앤텔롭 캐년 선택', 'single', true),
  ('night_ghost_tour', 'grand_canyon_fee', '그랜드캐년 입장료', 'single', true);

-- 그랜드서클 투어
INSERT INTO product_choices (product_id, choice_group, choice_group_ko, choice_type, is_required)
VALUES 
  ('grand_circle_tour', 'grand_canyon_fee', '그랜드캐년 입장료', 'single', true),
  ('grand_circle_tour', 'zion_canyon_fee', '자이언캐년 입장료', 'single', true),
  ('grand_circle_tour', 'bryce_canyon_fee', '브라이스 캐년 입장료', 'single', true);
```

### choice_options

```sql
-- 국립공원 입장료 옵션 (템플릿에서 불러오기)
INSERT INTO choice_options (choice_id, option_key, option_name_ko, adult_price, child_price, infant_price)
VALUES 
  (grand_canyon_choice_id, 'us_resident', '미국 거주자', 8, 8, 0),
  (grand_canyon_choice_id, 'non_resident', '비 거주자', 100, 100, 0),
  (grand_canyon_choice_id, 'annual_pass_buyer', '애뉴얼 패스 구매자', 250, 250, 0),
  (grand_canyon_choice_id, 'annual_pass_companion', '애뉴얼 패스 동행자', 0, 0, 0);
```

---

## 결론

### 현재 구조로 가능한 것

✅ **상품별 다른 초이스 그룹 구성**
- 밤도깨비: 앤텔롭 캐년 + 그랜드캐년
- 그랜드서클: 그랜드캐년 + 자이언캐년 + 브라이스 캐년

✅ **템플릿 재사용**
- 국립공원 입장료 템플릿을 각 상품에서 사용

✅ **동적 가격**
- 상품별, 날짜별로 다른 가격 설정 가능

### 추가 구현이 필요한 것

⚠️ **조건부 가격 로직**
- 애뉴얼 패스 구매 시 동행자 $0
- 예약/인보이스 생성 시 가격 계산 로직에 추가 필요

⚠️ **그룹 할인 로직**
- 애뉴얼 패스 1개로 최대 4인까지 커버
- 예약/인보이스 생성 시 검증 로직 추가 필요

⚠️ **UI 조건부 로직**
- 애뉴얼 패스 선택 시 다른 옵션 비활성화
- 동행자 수량 제한 (최대 3명)

### 권장 구현 순서

1. ✅ **초이스 그룹 구조 설계** (완료)
2. ⏳ **가격 계산 로직 구현** (예약/인보이스)
3. ⏳ **UI 조건부 로직 구현** (초이스 선택 시)
4. ⏳ **검증 로직 구현** (애뉴얼 패스 + 동행자 수량)

