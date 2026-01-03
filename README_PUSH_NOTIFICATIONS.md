# 푸시 알림 설정 가이드

## 개요
채팅방에서 새 메시지가 도착할 때 고객에게 푸시 알림을 보낼 수 있는 기능입니다. 고객이 사이트에 접속하지 않아도 알림을 받을 수 있습니다.

## 설정 단계

### ⚠️ 배포 환경 설정은 `DEPLOYMENT_PUSH_NOTIFICATIONS.md` 파일을 참고하세요

### 1. VAPID 키 생성

VAPID (Voluntary Application Server Identification) 키를 생성해야 합니다.

```bash
npm install -g web-push
web-push generate-vapid-keys
```

출력 예시:
```
Public Key: BKx... (공개 키)
Private Key: ... (비공개 키)
```

### 2. 환경 변수 설정

`.env.local` 파일에 다음 환경 변수를 추가하세요:

```env
# VAPID 키
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
VAPID_EMAIL=mailto:your-email@example.com

# Supabase
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 3. 패키지 설치

```bash
npm install web-push
npm install --save-dev @types/web-push
```

### 4. 데이터베이스 마이그레이션

```bash
# Supabase CLI를 사용하여 마이그레이션 실행
supabase db push

# 또는 Supabase 대시보드에서 직접 실행
# supabase/migrations/20250212000000_create_push_subscriptions_table.sql 파일 내용을 실행
```

### 5. Service Worker 등록

브라우저가 Service Worker를 자동으로 등록합니다. `public/sw.js` 파일이 올바르게 배포되었는지 확인하세요.

## 사용 방법

### 고객 측

1. 채팅방 공유 모달에서 "푸시 알림 받기" 버튼 클릭
2. 브라우저에서 알림 권한 요청 시 "허용" 선택
3. 새 메시지가 도착하면 알림을 받습니다

### 가이드/관리자 측

- 메시지를 보내면 자동으로 해당 채팅방의 모든 구독자에게 푸시 알림이 전송됩니다
- Supabase Realtime을 통해 실시간으로 처리됩니다

## 작동 원리

1. **구독 등록**: 고객이 푸시 알림을 활성화하면 브라우저의 Push API를 통해 구독 정보가 생성됩니다
2. **구독 저장**: 구독 정보는 `push_subscriptions` 테이블에 저장됩니다
3. **메시지 감지**: 새 메시지가 생성되면 Supabase Realtime 또는 데이터베이스 트리거가 이를 감지합니다
4. **알림 전송**: `/api/push-notification/send` API를 통해 모든 구독자에게 푸시 알림이 전송됩니다
5. **알림 표시**: Service Worker가 백그라운드에서 알림을 받아 사용자에게 표시합니다

## 보안 고려사항

- VAPID 비공개 키는 절대 클라이언트에 노출되지 않도록 서버 사이드에서만 사용합니다
- RLS (Row Level Security) 정책으로 구독 정보 접근을 제한합니다
- 만료된 구독은 자동으로 삭제됩니다

## 브라우저 지원

- Chrome/Edge: 완전 지원
- Firefox: 완전 지원
- Safari: iOS 16.4+ 지원
- Opera: 완전 지원

## 문제 해결

### 알림이 오지 않는 경우

1. 브라우저 알림 권한이 허용되었는지 확인
2. HTTPS 연결인지 확인 (로컬 개발은 localhost 허용)
3. Service Worker가 정상적으로 등록되었는지 확인
4. VAPID 키가 올바르게 설정되었는지 확인

### 구독 오류

- 브라우저 콘솔에서 오류 메시지 확인
- `usePushNotification` 훅의 에러 로그 확인
- Supabase 데이터베이스에서 구독 정보 확인

## 추가 기능

향후 추가할 수 있는 기능:
- 알림 설정 페이지 (채팅방별 알림 on/off)
- 알림 소리 설정
- 알림 배지 카운트
- 알림 그룹화

