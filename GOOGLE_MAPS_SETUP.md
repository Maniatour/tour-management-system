# Google Maps API 설정 가이드

## 1. Google Cloud Console에서 API 키 생성

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. **APIs & Services** > **Library**로 이동
4. 다음 API들을 활성화:
   - **Maps JavaScript API**
   - **Geocoding API**
   - **Places API**
   - **Maps JavaScript API (Advanced Markers)** (권장)

## 2. API 키 생성

1. **APIs & Services** > **Credentials**로 이동
2. **Create Credentials** > **API Key** 클릭
3. 생성된 API 키를 복사

## 3. API 키 제한 설정 (보안)

### HTTP referrers 제한 (권장)
- **Application restrictions** > **HTTP referrers (web sites)** 선택
- 다음 패턴 추가:
  ```
  localhost:3000/*
  yourdomain.com/*
  *.yourdomain.com/*
  ```

### API 제한
- **API restrictions** > **Restrict key** 선택
- 다음 API만 선택:
  - Maps JavaScript API
  - Geocoding API
  - Places API
  - Maps JavaScript API (Advanced Markers)

## 4. 환경변수 설정

프로젝트 루트에 `.env.local` 파일 생성:

```bash
# Google Maps API Key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
```

## 5. API 키 확인

환경변수가 올바르게 설정되었는지 확인:

```bash
# 개발 서버 재시작
npm run dev
```

## 6. 비용 관리

- Google Maps API는 사용량에 따라 과금됩니다
- 무료 할당량이 있지만 초과 시 비용이 발생할 수 있습니다
- [Google Maps Platform Pricing](https://developers.google.com/maps/billing-and-pricing) 참조

## 7. 문제 해결

### InvalidKeyMapError
- API 키가 올바른지 확인
- Maps JavaScript API가 활성화되었는지 확인
- 도메인 제한이 올바르게 설정되었는지 확인

### API 로드 실패
- 네트워크 연결 확인
- 브라우저 개발자 도구에서 오류 메시지 확인
- API 키 권한 확인

## 8. 보안 주의사항

- API 키를 절대 공개 저장소에 커밋하지 마세요
- `.env.local` 파일을 `.gitignore`에 추가하세요
- 프로덕션에서는 적절한 도메인 제한을 설정하세요
