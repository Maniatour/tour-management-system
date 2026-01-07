# 썸네일 생성 스크립트

기존 투어 사진들에 대한 썸네일을 일괄 생성하는 스크립트입니다.

## 사전 준비

1. 필요한 패키지 설치:
```bash
npm install sharp dotenv
```

2. 환경 변수 확인:
- `.env.local` 파일에 다음 변수가 설정되어 있어야 합니다:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` (또는 `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

## 사용법

### 모든 투어의 사진에 대해 썸네일 생성:
```bash
npm run generate-thumbnails
```

또는:
```bash
node scripts/generate-thumbnails.js
```

### 특정 투어의 사진에만 썸네일 생성:
```bash
node scripts/generate-thumbnails.js <tourId>
```

예시:
```bash
node scripts/generate-thumbnails.js eca6d4cf
```

## 동작 방식

1. Storage에서 원본 사진 목록 조회
2. 썸네일이 없는 사진만 필터링
3. 각 사진의 원본 다운로드
4. 400x400px 크기로 리사이즈하여 썸네일 생성
5. 썸네일을 Storage에 업로드
6. 데이터베이스의 `tour_photos` 테이블에 `thumbnail_path` 업데이트

## 주의사항

- 썸네일이 이미 존재하는 사진은 건너뜁니다
- 실패한 사진은 로그에 기록되고 계속 진행합니다
- 서버 부하를 방지하기 위해 각 사진 처리 사이에 100ms 대기합니다
- 대량의 사진이 있는 경우 시간이 오래 걸릴 수 있습니다

