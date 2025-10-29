# 태그 번역 관리 가이드 (사용자 편집 가능)

## 개요

이 시스템은 **사용자가 직접 태그 번역을 관리**할 수 있도록 설계되었습니다. 특히 Las Vegas와 같은 고유명사나 외래어의 다양한 발음을 유연하게 처리할 수 있습니다.

## 핵심 기능

### 1. 사용자가 번역 관리 가능
- ✅ 데이터베이스 기반 번역 시스템
- ✅ 관리자 페이지에서 CRUD 작업
- ✅ 실시간 번역 수정/추가/삭제

### 2. 다양한 발음 지원
- ✅ **Pronunciation 필드**: 여러 발음을 `|`로 구분
- ✅ 예: `라스베가스|라스베이거스`
- ✅ UI에서는 첫 번째 발음만 표시

## 데이터베이스 구조

### tags 테이블
```sql
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,  -- 'las_vegas', 'popular' 등
  is_system BOOLEAN DEFAULT false,   -- 시스템 태그 vs 사용자 태그
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### tag_translations 테이블
```sql
CREATE TABLE tag_translations (
  id TEXT PRIMARY KEY,
  tag_id TEXT REFERENCES tags(id),
  locale VARCHAR(10) NOT NULL,       -- 'ko', 'en', 'ja' 등
  label VARCHAR(255) NOT NULL,       -- 번역된 텍스트
  pronunciation VARCHAR(255),        -- 발음 (라스베가스|라스베이거스)
  notes TEXT,                        -- 메모
  UNIQUE(tag_id, locale)
);
```

## 사용 방법

### 1. 관리자 페이지에서 번역 추가/수정

**경로**: `/admin/tag-translations`

**기능:**
- 태그별로 언어별 번역 표시
- 번역 추가/수정/삭제
- 발음(pronunciation) 필드에 여러 발음 입력 가능
- 메모 필드로 관리

**예시:**
```
태그 키: las_vegas

한국어 (KO):
  - 번역: 라스베가스
  - 발음: 라스베가스|라스베이거스
  - 메모: 공식 표기는 라스베가스

영어 (EN):
  - 번역: Las Vegas
```

### 2. 코드에서 태그 사용

```tsx
import TagDisplay from '@/components/common/TagDisplay'

// 기본 사용
<TagDisplay tags={['las_vegas', 'grand_canyon']} />

// 결과:
// 한국어: "라스베가스", "그랜드 캐니언"
// 영어: "Las Vegas", "Grand Canyon"
```

### 3. 발음 처리

**데이터베이스에 저장:**
```
pronunciation: "라스베가스|라스베이거스"
```

**UI 표시:**
- 첫 번째 발음만 표시: `라스베가스`
- 마우스 오버 시 툴팁으로 원본 태그 키 표시: `las_vegas`

### 4. 새로운 태그 추가

**가장 쉬운 방법: 관리자 페이지에서 추가** ✅

1. **`/ko/admin/tag-translations` 페이지 접속**
2. **"새 태그 추가" 버튼 클릭** (우측 상단)
3. **태그 키 입력** (예: `zion_national_park`)
   - 영문 소문자로 시작
   - 숫자와 언더스코어(_)만 사용 가능
   - 예: `las_vegas`, `grand_canyon`, `zion_national_park`
4. **시스템 태그 여부 선택** (선택사항)
   - [시스템 태그란?](#시스템-태그-vs-사용자-태그)
5. **언어별 번역 입력** (선택사항)
   - 모달 하단에 각 언어별 입력 필드 제공
   - 번역 + 발음 필드 사용 가능
   - 번역은 나중에 추가해도 가능
6. **"추가" 버튼 클릭**

### 시스템 태그 vs 사용자 태그

| 구분 | 시스템 태그 | 사용자 태그 |
|------|-----------|-----------|
| **생성** | 자동 생성 | 사용자가 직접 생성 |
| **예시** | popular, new, recommended | las_vegas, grand_canyon |
| **용도** | 기본 태그로 모든 상품에 공통 적용 | 특정 상품이나 상황에 맞춤 |
| **현재 차이** | 없음 (구분 목적) | 없음 (구분 목적) |

**현재는 기능상 차이가 없으며, 미래 확장을 위한 구분 목적입니다.**

## 중앙 관리 방식 사용 (권장)

### ✅ 추천: 태그 번역 관리 페이지에서 미리 등록하고 사용

**장점:**
- ✅ 일관성 유지 (오타 방지)
- ✅ 번역 자동 적용
- ✅ 재사용성
- ✅ 검색/필터링 효율성
- ✅ 유지보수 용이

### 🔧 TagSelector 컴포넌트 사용

옵션, 상품 등 태그를 사용하는 모든 곳에서 `TagSelector` 컴포넌트를 사용하세요:

```tsx
import TagSelector from '@/components/admin/TagSelector'

function OptionForm() {
  const [tags, setTags] = useState<string[]>([])
  
  return (
    <div>
      <label>태그</label>
      <TagSelector 
        selectedTags={tags}
        onTagsChange={setTags}
        locale="ko"
        placeholder="태그를 선택하세요"
      />
    </div>
  )
}
```

**기능:**
- 중앙 관리된 태그만 선택 가능
- 자동완성 검색
- 다국어 번역 자동 적용
- 드롭다운에서 선택/해제
- 필요시 즉시 새 태그 추가

### 📝 사용 예시

```tsx
// 옵션 관리 페이지
<TagSelector 
  selectedTags={option.tags} 
  onTagsChange={(tags) => updateOption({...option, tags})}
/>

// 상품 관리 페이지
<TagSelector 
  selectedTags={product.tags} 
  onTagsChange={(tags) => updateProduct({...product, tags})}
/>

// 초이스 템플릿 관리 페이지
<TagSelector 
  selectedTags={choice.tags} 
  onTagsChange={(tags) => updateChoice({...choice, tags})}
/>
```

#### SQL로 직접 추가 (고급)

```sql
-- 1. 태그 마스터 추가
INSERT INTO tags (id, key, is_system) 
VALUES (gen_random_uuid()::text, 'zion_national_park', false);

-- 2. 한국어 번역 추가
INSERT INTO tag_translations (id, tag_id, locale, label, pronunciation)
SELECT 
  gen_random_uuid()::text,
  id,
  'ko',
  '자이온 국립공원',
  '자이온 국립공원|시온 국립공원'
FROM tags 
WHERE key = 'zion_national_park';

-- 3. 영어 번역 추가
INSERT INTO tag_translations (id, tag_id, locale, label)
SELECT 
  gen_random_uuid()::text,
  id,
  'en',
  'Zion National Park'
FROM tags 
WHERE key = 'zion_national_park';
```

## 우선순위

태그 번역은 다음 우선순위로 처리됩니다:

1. **데이터베이스 번역** (최우선)
   - `tag_translations` 테이블의 번역 사용
   - 사용자가 직접 관리 가능

2. **i18n 번역 파일** (차선)
   - `src/i18n/locales/{locale}.json`의 `common.tagLabels`
   - 기본 태그용 (popular, new 등)

3. **원본 태그 키** (최후)
   - 번역이 없으면 그대로 표시
   - 예: `custom_tag` → `custom_tag`

## 예제 시나리오

### 시나리오 1: Las Vegas 다양한 발음 처리

**문제**: 
- 라스베가스 (공식 표기)
- 라스베이거스 (일반 발음)

**해결**:
```sql
INSERT INTO tag_translations (tag_id, locale, label, pronunciation)
VALUES 
  (tag_id_for_las_vegas, 'ko', '라스베가스', '라스베가스|라스베이거스');
```

**UI 표시**: `라스베가스` (첫 번째 발음)
**데이터 저장**: 원본 키 `las_vegas`로 저장

### 시나리오 2: 지역별 다른 번역

**문제**: 
- 미국 서부: Las Vegas
- 한국: 라스베가스
- 중국: 拉斯维加斯

**해결**:
```sql
INSERT INTO tag_translations (tag_id, locale, label)
VALUES 
  (tag_id, 'en', 'Las Vegas'),
  (tag_id, 'ko', '라스베가스'),
  (tag_id, 'zh', '拉斯维加斯');
```

### 시나리오 3: 계절별 태그 (겨울, 여름 등)

**문제**: 같은 키, 다른 번역

**해결**: 키는 그대로, 번역만 언어별로 다르게
```sql
-- 키: 'seasonal'
INSERT INTO tag_translations VALUES
  (tag_id, 'ko', '계절'),
  (tag_id, 'en', 'Seasonal');
```

## 마이그레이션

기존 i18n 파일 기반 태그를 DB로 마이그레이션:

```sql
-- i18n의 태그들을 DB로 이전
INSERT INTO tags (id, key, is_system)
SELECT 
  gen_random_uuid()::text,
  jsonb_object_keys((jsonb_each("common"."tagLabels"))::jsonb) as key,
  true
FROM (SELECT 1);

-- 번역도 이전
INSERT INTO tag_translations (id, tag_id, locale, label)
SELECT 
  gen_random_uuid()::text,
  t.id,
  'ko',
  j.value::text
FROM tags t
CROSS JOIN LATERAL jsonb_each('{
  "popular": "인기",
  "new": "신규",
  ...
}'::jsonb) j
ON j.key = t.key;
```

## 장점

### 기존 방식 (i18n 파일)
❌ 개발자가 코드 수정 필요
❌ 배포 과정 필요
❌ 발음 다양성 처리 어려움
❌ 실시간 수정 불가

### 새로운 방식 (DB 기반)
✅ 관리자가 직접 수정 가능
✅ 실시간 반영
✅ 발음 필드로 다양성 처리
✅ 언어별 독립적 관리
✅ 메모로 관리 정보 추가 가능

## 관리자 UI

태그 번역 관리 페이지 (`/admin/tag-translations`)에서:

- 📋 모든 태그와 번역을 테이블로 표시
- ✏️ 번역 편집 (레이블, 발음, 메모)
- ➕ 새로운 번역 추가
- 🗑️ 번역 삭제
- 👁️ 발음과 메모 표시

## FAQ

### Q: 기존 i18n 태그는 어떻게 되나요?
A: DB 번역이 우선이고, 없으면 i18n을 참조합니다. 점진적으로 마이그레이션하면 됩니다.

### Q: 발음을 여러 개 입력하면 UI에 어떻게 표시되나요?
A: 첫 번째 발음만 표시됩니다. 나머지는 관리자 페이지에서 참조용으로 보관됩니다.

### Q: 시스템 태그와 사용자 태그의 차이는?
A: `is_system` 필드로 구분합니다. 시스템 태그는 자동 생성, 사용자 태그는 수동 추가합니다.

### Q: 새로운 언어를 추가하려면?
A: `locales` 배열에 언어 코드를 추가하면 자동으로 관리 UI에 반영됩니다.
