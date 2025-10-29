# i18n 번역 사용자 관리 시스템

## 개요

일반 i18n 번역도 사용자가 직접 관리할 수 있도록 DB 기반 시스템을 구현할 수 있습니다.

## 두 가지 방식 비교

### 방식 1: 기존 i18n 파일 방식 (현재 상태)

**특징:**
- ✅ 모든 번역이 포함되어 있음
- ✅ 배포 없이 적용됨
- ❌ 사용자가 직접 수정 불가
- ❌ 개발자가 파일 수정 필요

**파일:** `src/i18n/locales/ko.json`, `en.json`

### 방식 2: DB 기반 번역 관리 (추가 가능)

**특징:**
- ✅ 사용자가 직접 수정 가능
- ✅ 실시간 반영
- ✅ 변경 이력 추적 가능
- ❌ 시스템 구축 필요
- ❌ 복잡도 증가

## 사용자 관리 가능한 시스템 설계

### 데이터베이스 구조

```sql
-- 번역 키 마스터
CREATE TABLE translations (
  id TEXT PRIMARY KEY,
  namespace VARCHAR(100) NOT NULL, -- 'common', 'options' 등
  key_path TEXT NOT NULL, -- 'title', 'add', 'form.name' 등
  is_system BOOLEAN DEFAULT false,
  UNIQUE(namespace, key_path)
);

-- 실제 번역 값
CREATE TABLE translation_values (
  id TEXT PRIMARY KEY,
  translation_id TEXT REFERENCES translations(id),
  locale VARCHAR(10) NOT NULL, -- 'ko', 'en'
  value TEXT NOT NULL,
  notes TEXT,
  UNIQUE(translation_id, locale)
);
```

### 관리자 페이지 생성 예시

```
/admin/translations
- 네임스페이스별로 필터
- 키 검색
- 번역 편집
- 새 번역 추가
```

## 추천: 하이브리드 방식

### 가장 실용적인 방법

1. **기본 번역**: i18n 파일 (빠르고 간단)
2. **사용자 커스터마이징**: DB에 저장, 우선순위 높음
3. **우선순위**: DB 번역 > i18n 파일

```typescript
// 번역 로드 우선순위
const translation = 
  dbTranslations?.[namespace]?.[key] ||  // DB 번역 우선
  i18nFile[namespace]?.[key] ||          // i18n 파일 차선
  key                                    // 없으면 원본
```

### 장점
- ✅ 기본 번역은 i18n 파일로 빠르게 유지
- ✅ 사용자가 필요한 부분만 DB로 커스터마이징
- ✅ 유연성과 관리 편의성 모두 확보

## 구현 여부 결정

**질문**: i18n 번역도 사용자가 관리해야 하나요?

**추천**:
- **태그 번역**: ✅ DB 관리 (자주 변경, 고유명사 많음)
- **일반 번역**: ⚠️ 선택적 (필요한 부분만)

**비교:**
- 태그: 높은 확률로 추가/수정 필요 → DB 관리 필수
- 일반 번역: 자주 변경되지 않음 → i18n 파일 충분

## 결론

**현재 구현:**
- ✅ 태그 번역: DB 기반 사용자 관리
- 📝 일반 번역: i18n 파일 (사용자 수정 불가)

**원하면 추가 가능:**
- 일반 번역도 DB 기반으로 마이그레이션 가능
- 관리자 페이지에서 모든 번역 관리 가능
협
- 다만 시스템 복잡도가 증가함

원하시면 i18n 번역도 DB 기반으로 구현해드릴 수 있습니다.
