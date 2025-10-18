# LightRichEditor 컴포넌트

재사용 가능한 리치 텍스트 에디터 컴포넌트입니다. 다른 페이지에서도 동일하게 사용할 수 있습니다.

## 설치 및 사용

### 1. 컴포넌트 Import

```typescript
import LightRichEditor from '@/components/LightRichEditor'
```

### 2. 기본 사용법

```typescript
import React, { useState } from 'react'
import LightRichEditor from '@/components/LightRichEditor'

const MyComponent = () => {
  const [content, setContent] = useState('')

  return (
    <LightRichEditor
      value={content}
      onChange={setContent}
      height={300}
    />
  )
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | - | 에디터의 현재 내용 (필수) |
| `onChange` | `(value: string \| undefined) => void` | - | 내용 변경 시 호출되는 함수 (필수) |
| `height` | `number` | `200` | 에디터의 최소 높이 (px) |
| `placeholder` | `string` | `"텍스트를 입력하세요..."` | 플레이스홀더 텍스트 |
| `className` | `string` | `""` | 추가 CSS 클래스 |
| `showToolbar` | `boolean` | `true` | 툴바 표시 여부 |
| `enableImageUpload` | `boolean` | `true` | 이미지 업로드 기능 활성화 |
| `enableColorPicker` | `boolean` | `true` | 색상 선택기 활성화 |
| `enableFontSize` | `boolean` | `true` | 폰트 크기 선택기 활성화 |
| `enableLink` | `boolean` | `true` | 링크 삽입 기능 활성화 |
| `enableList` | `boolean` | `true` | 목록 기능 활성화 |
| `enableBold` | `boolean` | `true` | 굵게 기능 활성화 |
| `enableItalic` | `boolean` | `true` | 기울임 기능 활성화 |
| `enableUnderline` | `boolean` | `true` | 밑줄 기능 활성화 |
| `enableResize` | `boolean` | `true` | 사이즈 조정 기능 활성화 |
| `minHeight` | `number` | `100` | 최소 높이 (px) |
| `maxHeight` | `number` | `800` | 최대 높이 (px) |

## 사용 예시

### 1. 기본 에디터 (모든 기능)

```typescript
<LightRichEditor
  value={content}
  onChange={setContent}
  height={300}
  placeholder="모든 기능이 활성화된 에디터입니다..."
  enableResize={true}
  minHeight={150}
  maxHeight={600}
/>
```

### 2. 간단한 에디터 (기본 서식만)

```typescript
<LightRichEditor
  value={content}
  onChange={setContent}
  height={200}
  enableImageUpload={false}
  enableColorPicker={false}
  enableFontSize={false}
  enableLink={false}
  enableList={false}
  enableResize={true}
  minHeight={100}
  maxHeight={400}
/>
```

### 3. 최소한의 에디터 (툴바 없음)

```typescript
<LightRichEditor
  value={content}
  onChange={setContent}
  height={150}
  showToolbar={false}
  enableResize={false}
/>
```

### 4. 커스텀 스타일링

```typescript
<LightRichEditor
  value={content}
  onChange={setContent}
  height={250}
  className="my-custom-editor border-2 border-blue-500"
  placeholder="커스텀 플레이스홀더..."
  enableResize={true}
  minHeight={200}
  maxHeight={500}
/>
```

## 기능

### 지원하는 서식

- **굵게**: Ctrl+B 또는 툴바 버튼
- **기울임**: Ctrl+I 또는 툴바 버튼  
- **밑줄**: Ctrl+U 또는 툴바 버튼
- **목록**: 툴바 버튼
- **링크**: 툴바 버튼
- **이미지**: 툴바 버튼 (로컬 파일 업로드)
- **색상**: 색상 팔레트에서 선택
- **폰트 크기**: 드롭다운에서 선택

### 사이즈 조정 기능

- **드래그 핸들**: 에디터 하단의 핸들을 드래그하여 높이 조정
- **최소/최대 높이**: `minHeight`와 `maxHeight` props로 제한 설정
- **실시간 조정**: 드래그하는 동안 실시간으로 크기 변경
- **비활성화**: `enableResize={false}`로 사이즈 조정 기능 비활성화

### 키보드 단축키

- `Ctrl+B`: 굵게
- `Ctrl+I`: 기울임
- `Ctrl+U`: 밑줄

### 데이터 형식

- **저장**: 마크다운 형식으로 저장
- **표시**: HTML로 렌더링하여 표시
- **변환**: 자동으로 마크다운 ↔ HTML 변환

## 다른 페이지에서 사용하기

### 1. 블로그 에디터

```typescript
// pages/blog/create.tsx
import LightRichEditor from '@/components/LightRichEditor'

const CreateBlogPost = () => {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  return (
    <div className="max-w-4xl mx-auto p-6">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목을 입력하세요..."
        className="w-full text-2xl font-bold mb-4 p-2 border rounded"
      />
      <LightRichEditor
        value={content}
        onChange={setContent}
        height={500}
        placeholder="블로그 내용을 작성하세요..."
      />
    </div>
  )
}
```

### 2. 댓글 에디터

```typescript
// components/CommentEditor.tsx
import LightRichEditor from '@/components/LightRichEditor'

const CommentEditor = ({ onSubmit }) => {
  const [comment, setComment] = useState('')

  return (
    <div className="border rounded p-4">
      <LightRichEditor
        value={comment}
        onChange={setComment}
        height={150}
        placeholder="댓글을 작성하세요..."
        enableImageUpload={false}
        enableColorPicker={false}
        enableFontSize={false}
      />
      <button
        onClick={() => onSubmit(comment)}
        className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
      >
        댓글 작성
      </button>
    </div>
  )
}
```

### 3. 이메일 에디터

```typescript
// components/EmailEditor.tsx
import LightRichEditor from '@/components/LightRichEditor'

const EmailEditor = () => {
  const [emailContent, setEmailContent] = useState('')

  return (
    <div className="email-composer">
      <LightRichEditor
        value={emailContent}
        onChange={setEmailContent}
        height={400}
        placeholder="이메일 내용을 작성하세요..."
        className="email-editor"
      />
    </div>
  )
}
```

## 주의사항

1. **이미지 업로드**: 현재는 로컬 파일을 Base64로 변환하여 저장합니다. 프로덕션에서는 서버 업로드 기능을 추가하는 것을 권장합니다.

2. **성능**: 큰 문서의 경우 성능 최적화가 필요할 수 있습니다.

3. **브라우저 호환성**: `contentEditable`과 `document.execCommand`를 사용하므로 최신 브라우저에서 최적화됩니다.

## 라이선스

이 컴포넌트는 프로젝트 내에서 자유롭게 사용할 수 있습니다.
