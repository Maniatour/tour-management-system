# 다국어 태그 관리 가이드

## 개요

이 문서는 투어 관리 시스템에서 태그를 다국어로 관리하는 방법을 설명합니다.

## 추천 방법: 영어 키 + i18n 번역

### 왜 이 방법인가?

✅ **장점:**
- 하나의 태그 키만 저장하면 됨 (데이터 중복 없음)
- 번역 추가/수정이 쉬움 (번역 파일만 수정)
- 태그 목록이 일관됨 (같은 키 사용)
- 검색/필터링이 쉬움
- 관리자 편집이 간단함

❌ **단점:**
- 번역 파일에 모든 태그를 등록해야 함
- 새로운 태그 추가 시 번역 파일도 업데이트 필요

### 작동 방식

1. **데이터베이스**: 영어 키로 저장
   ```javascript
   tags: ['popular', 'new', 'recommended']
   ```

2. **UI 표시**: 현재 언어로 자동 번역
   - 한국어: `popular` → "인기"
   - 영어: `popular` → "Popular"

## 사용 방법

### 1. 데이터베이스에 태그 저장

```typescript
// 옵션 생성/수정 시
{
  tags: ['popular', 'family', 'adventure']  // 영어 키 사용
}
```

### 2. UI에서 태그 표시

#### 방법 A: TagDisplay 컴포넌트 사용 (추천)

```tsx
import TagDisplay from '@/components/common/TagDisplay'

// 기본 사용
<TagDisplay tags={option.tags} />

// 최대 표시 개수 제한
<TagDisplay tags={option.tags} maxDisplay={3} />

// 커스텀 스타일
<TagDisplay 
  tags={option.tags} 
  className="gap-2"
  itemClassName="px-3 py-1 bg-blue-100 text-blue-800"
/>
```

#### 방법 B: 직접 번역 사용

```tsx
import { useTranslations } from 'next-intl'

const t = useTranslations('common.tagLabels')

{option.tags.map((tag) => (
  <span key={tag}>
    {t(tag as any) || tag}  {/* 번역 실패 시 원본 표시 */}
  </span>
))}
```

### 3. 새로운 태그 추가

1. **번역 파일에 추가**

`src/i18n/locales/ko.json`:
```json
{
  "common": {
    "tagLabels": {
      "my_new_tag": "내 새 태그"
    }
  }
}
```

`src/i18n/locales/en.json`:
```json
{
  "common": {
    "tagLabels": {
      "my_new_tag": "My New Tag"
    }
    }
  }
}
```

2. **데이터베이스에 사용**
```typescript
tags: ['my_new_tag', 'popular']
```

## 기존 태그 마이그레이션

기존에 한글로 저장된 태그가 있다면, 영어 키로 변경해야 합니다.

### SQL 마이그레이션 예시

```sql
-- 기존 한글 태그를 영어 키로 변환
UPDATE options 
SET tags = ARRAY(
  SELECT CASE 
    WHEN tag = '인기' THEN 'popular'
    WHEN tag = '신규' THEN 'new'
    WHEN tag = '추천' THEN 'recommended'
    ELSE tag  -- 매핑되지 않은 태그는 그대로 유지
  END
  FROM unnest(tags) AS tag
);
```

## 예제: 옵션 페이지에 적용

```tsx
import TagDisplay from '@/components/common/TagDisplay'

// 옵션 카드에서
<div className="flex flex-wrap gap-1">
  <TagDisplay 
    tags={option.tags || []} 
    maxDisplay={3}
    itemClassName="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"
  />
</div>
```

## 태그 목록 관리

현재 지원하는 태그들:

- **인기도**: popular, new, hot, recommended, best, sale, limited, premium
- **예산**: budget
- **그룹**: family, couple, group, solo
- **분위기**: romantic
- **활동**: adventure
- **테마**: nature, culture, history, food, nightlife, shopping
- **장소**: beach, mountain, desert, city
- **난이도**: easy, moderate, hard
- **기간**: half_day, full_day, multi_day
- **시간**: morning, afternoon, evening

## FAQ

### Q: 새로운 태그를 추가할 때마다 번역 파일을 수정해야 하나요?

A: 네. 하지만 번역 파일을 수정하는 것이 다른 방법들보다 훨씬 간단합니다.

### Q: 임시로 번역이 없는 태그는 어떻게 표시되나요?

A: 원본 키가 그대로 표시됩니다. 예: `my_custom_tag`

### Q: 같은 태그를 여러 언어로 사용하고 싶어요

A: 새로운 언어(예: 일본어)가 추가되면, 해당 언어의 `src/i18n/locales/ja.json` 파일에 태그 번역을 추가하면 됩니다.

## 대안 방법 (비추천)

### 방법 B: tags_ko, tags_en 배열 저장

```typescript
{
  tags_ko: ['인기', '신규'],
  tags_en: ['Popular', 'New']
}
```

❌ **단점:**
- 태그 개수가 언어 수만큼 증가
- 태그 간 불일치 가능성
- 관리 복잡도 증가

### 방법 C: JSONB 객체 저장

```typescript
{
  tags: [
    { key: 'popular', ko: '인기', en: 'Popular' }
  ]
}
```

❌ **단점:**
- 데이터 구조 복잡
- 쿼리/인덱싱 어려움
- UI 렌더링 복잡
