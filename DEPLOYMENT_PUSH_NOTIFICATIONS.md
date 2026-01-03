# 배포 환경 푸시 알림 설정 가이드

## Vercel 배포 환경 설정

### 1. Vercel 환경 변수 설정

Vercel 대시보드에서 다음 환경 변수를 설정하세요:

1. **Vercel 프로젝트 대시보드 접속**
   - https://vercel.com/dashboard
   - 프로젝트 선택 → Settings → Environment Variables

2. **환경 변수 추가**

   **Production, Preview, Development 모두에 추가:**

   ```
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key_here
   VAPID_PRIVATE_KEY=your_private_key_here
   VAPID_EMAIL=mailto:your-email@example.com
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

   ⚠️ **중요**: 
   - `NEXT_PUBLIC_` 접두사가 있는 변수는 클라이언트에서 접근 가능합니다
   - `VAPID_PRIVATE_KEY`는 절대 클라이언트에 노출되지 않습니다 (서버 사이드에서만 사용)

### 2. Service Worker 파일 확인

`public/sw.js` 파일이 배포에 포함되는지 확인:

```bash
# 빌드 테스트
npm run build

# .next 폴더에 public 파일들이 복사되었는지 확인
ls .next/static
```

Next.js는 자동으로 `public` 폴더의 파일들을 빌드에 포함시킵니다.

### 3. HTTPS 확인

푸시 알림은 HTTPS에서만 작동합니다 (localhost 제외):
- ✅ Vercel은 자동으로 HTTPS를 제공합니다
- ✅ 도메인이 `https://`로 시작하는지 확인하세요

### 4. Service Worker 등록 확인

배포 후 브라우저 개발자 도구에서 확인:

1. **Chrome DevTools**:
   - F12 → Application 탭 → Service Workers
   - `/sw.js`가 등록되어 있는지 확인

2. **콘솔 확인**:
   ```javascript
   navigator.serviceWorker.getRegistrations().then(console.log)
   ```

### 5. 배포 후 테스트

1. **알림 권한 확인**:
   - 브라우저 주소창 옆 자물쇠 아이콘 클릭
   - "알림" 권한이 "허용"인지 확인

2. **구독 테스트**:
   - 채팅방 공유 모달 열기
   - "푸시 알림 받기" 버튼 클릭
   - 브라우저 알림 권한 요청 → "허용"

3. **알림 테스트**:
   - 가이드가 메시지 전송
   - 고객이 사이트를 닫아도 알림 수신 확인

## 문제 해결

### Service Worker가 등록되지 않는 경우

1. **캐시 삭제**:
   - 브라우저 캐시 및 Service Worker 캐시 삭제
   - Chrome: Application → Storage → Clear site data

2. **Service Worker 파일 경로 확인**:
   - `https://your-domain.com/sw.js` 접속 시 파일이 보여야 함
   - 404 에러가 나면 `public/sw.js` 파일 위치 확인

3. **콘솔 오류 확인**:
   - 브라우저 개발자 도구 콘솔에서 오류 메시지 확인

### 알림이 오지 않는 경우

1. **VAPID 키 확인**:
   ```bash
   # 환경 변수가 올바르게 설정되었는지 확인
   # Vercel 대시보드에서 확인
   ```

2. **API 라우트 확인**:
   - `/api/push-notification/send` 엔드포인트가 정상 작동하는지 확인
   - Vercel Functions 로그 확인

3. **구독 정보 확인**:
   - Supabase `push_subscriptions` 테이블에서 구독 정보 확인
   - `room_id`가 올바른지 확인

### Vercel Functions 로그 확인

1. **Vercel 대시보드**:
   - 프로젝트 → Functions 탭
   - `/api/push-notification/send` 함수 로그 확인

2. **로컬에서 테스트**:
   ```bash
   # 로컬에서 프로덕션 빌드 테스트
   npm run build
   npm start
   ```

## 보안 체크리스트

- [ ] VAPID 비공개 키가 환경 변수에 안전하게 저장됨
- [ ] `NEXT_PUBLIC_VAPID_PUBLIC_KEY`만 클라이언트에 노출됨
- [ ] HTTPS 연결 사용 중
- [ ] RLS 정책으로 구독 정보 보호
- [ ] 만료된 구독 자동 삭제

## 추가 최적화

### 1. Service Worker 캐싱

필요시 `sw.js`에 캐싱 전략 추가:

```javascript
// sw.js에 추가
self.addEventListener('fetch', (event) => {
  // 캐싱 전략 구현
})
```

### 2. 알림 배지 카운트

Service Worker에서 알림 배지 카운트 업데이트:

```javascript
self.addEventListener('push', (event) => {
  // ...
  self.registration.showNotification(title, {
    ...options,
    badge: '/images/badge.png',
    tag: 'chat-message'
  })
})
```

### 3. 알림 액션 버튼

알림에 액션 버튼 추가:

```javascript
const options = {
  // ...
  actions: [
    { action: 'open', title: '열기' },
    { action: 'close', title: '닫기' }
  ]
}
```

## 모니터링

### 1. 구독 통계

Supabase에서 구독 통계 확인:

```sql
SELECT 
  COUNT(*) as total_subscriptions,
  COUNT(DISTINCT room_id) as rooms_with_subscriptions,
  COUNT(DISTINCT customer_email) as unique_customers
FROM push_subscriptions;
```

### 2. 알림 전송 성공률

API 로그에서 성공/실패 비율 확인

### 3. 만료된 구독 정리

정기적으로 만료된 구독 삭제:

```sql
-- 만료된 구독 확인 (수동)
SELECT * FROM push_subscriptions 
WHERE updated_at < NOW() - INTERVAL '30 days';
```

## 참고 자료

- [Web Push API 문서](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Vercel 환경 변수 설정](https://vercel.com/docs/concepts/projects/environment-variables)

