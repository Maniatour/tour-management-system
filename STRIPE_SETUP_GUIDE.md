# Stripe 결제 연동 가이드 (초보자용)

## 📚 목차
1. [Stripe 계정 만들기](#1-stripe-계정-만들기)
2. [API 키 가져오기](#2-api-키-가져오기)
3. [환경 변수 설정](#3-환경-변수-설정)
4. [코드 구조 이해하기](#4-코드-구조-이해하기)
5. [테스트하기](#5-테스트하기)

---

## 1. Stripe 계정 만들기

### 1-1. Stripe 웹사이트 가입
1. 웹 브라우저에서 https://stripe.com 접속
2. 우측 상단 "Sign in" 또는 "Get started" 클릭
3. 이메일 주소로 계정 생성
4. 이메일 인증 완료

### 1-2. 대시보드 확인
- 가입 후 Stripe Dashboard(대시보드) 페이지로 이동됩니다
- 왼쪽 메뉴에 "Payments", "Products", "Customers" 등이 보입니다

---

## 2. API 키 가져오기

### 2-1. 개발용 키 vs 실사용 키
Stripe에는 두 가지 환경이 있습니다:
- **테스트 모드 (Test mode)**: 연습용, 실제 돈이 빠지지 않음 ⚠️
- **라이브 모드 (Live mode)**: 실제 운영용, 실제 돈이 빠짐 💰

**처음에는 반드시 테스트 모드로 시작하세요!**

### 2-2. 테스트 키 가져오기
1. Stripe Dashboard 왼쪽 메뉴에서 **"Developers"** 클릭
2. **"API keys"** 클릭
3. 상단에 **"Test mode"** 토글이 있는지 확인 (켜져 있어야 함)
4. **"Publishable key"** 복사 (예: `pk_test_xxxxx...`)
5. **"Secret key"**의 "Reveal test key" 클릭 후 복사 (예: `sk_test_xxxxx...`)

⚠️ **중요**: Secret key는 절대 공개하거나 GitHub에 올리지 마세요!

---

## 3. 환경 변수 설정

### 3-1. 환경 변수가 뭔가요?
- 환경 변수는 프로그램이 실행될 때 필요한 설정값입니다
- API 키 같은 민감한 정보를 코드에 직접 쓰지 않고 파일에 저장합니다
- `.env.local` 파일은 Git에 올라가지 않도록 설정됩니다 (보안)

### 3-2. .env.local 파일 만들기
1. 프로젝트 루트 폴더에 `.env.local` 파일 생성
2. 다음 내용 입력:

```env
# Stripe API Keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_여기에_복사한_키_붙여넣기
STRIPE_SECRET_KEY=sk_test_여기에_복사한_키_붙여넣기

# 예시 (실제로는 이렇게 쓰지 마세요!)
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51AbC123...
# STRIPE_SECRET_KEY=sk_test_51XyZ789...
```

### 3-3. 파일 저장 위치 확인
```
tour-management-system/
  ├── .env.local          ← 여기에 만드세요!
  ├── package.json
  ├── src/
  └── ...
```

---

## 4. 코드 구조 이해하기

### 4-1. 전체 흐름
```
사용자가 카드 정보 입력
         ↓
클라이언트 (브라우저)에서 API 호출
         ↓
서버 (API Route)에서 Stripe API 호출
         ↓
Stripe에서 결제 처리
         ↓
결과를 클라이언트로 반환
         ↓
예약 완료!
```

### 4-2. 주요 파일 위치
1. **서버 API**: `src/app/api/payment/create-payment-intent/route.ts`
   - 실제 결제 처리가 일어나는 곳
   - Stripe API를 직접 호출

2. **클라이언트 코드**: `src/components/booking/BookingFlow.tsx`
   - 사용자가 보는 화면
   - API를 호출하여 결제 요청

---

## 5. 테스트하기

### 5-1. 테스트 카드 번호 사용
Stripe는 테스트용 카드 번호를 제공합니다:

| 카드 번호 | 결과 | 설명 |
|---------|------|------|
| 4242 4242 4242 4242 | ✅ 성공 | Visa 테스트 카드 |
| 4000 0000 0000 0002 | ❌ 거부 | 결제 실패 테스트 |
| 4000 0025 0000 3155 | ✅ 3D Secure | 인증 필요 테스트 |

**만료일**: 아무 미래 날짜 (예: 12/25)  
**CVV**: 아무 3자리 숫자 (예: 123)

### 5-2. 테스트 순서
1. 개발 서버 실행: `npm run dev`
2. 예약 플로우에서 결제 단계까지 진행
3. 테스트 카드 번호 입력
4. 결제 버튼 클릭
5. Stripe Dashboard에서 결제 확인

### 5-3. 문제 해결

**문제**: "Invalid API Key" 에러
- 해결: `.env.local` 파일의 키가 올바른지 확인

**문제**: 결제가 안 됨
- 해결: Stripe Dashboard의 로그 확인

**문제**: CORS 에러
- 해결: 서버가 제대로 실행 중인지 확인

---

## 📝 추가 참고사항

### 보안 체크리스트
- [ ] `.env.local` 파일이 `.gitignore`에 포함되어 있는지 확인
- [ ] Secret key를 절대 코드에 직접 쓰지 않음
- [ ] 테스트 모드로 충분히 테스트 후 라이브 모드 전환

### 라이브 모드로 전환 시
1. Stripe Dashboard에서 "Live mode" 토글 ON
2. 라이브 키로 `.env.local` 업데이트
3. 다시 테스트
4. 실제 결제 시도 전에 충분히 검증

---

---

## 6. 코드 구조 이해하기 (심화)

### 6-1. 왜 서버와 클라이언트를 나눌까요?

**보안 때문입니다!**

```
❌ 나쁜 방법 (하지 마세요):
클라이언트 → 카드 정보 직접 전송 → Stripe
문제: 카드 정보가 코드에 노출될 수 있음

✅ 좋은 방법 (지금 사용 중):
클라이언트 → Payment Intent 요청 → 서버
서버 → Stripe (Secret Key 사용)
서버 → Client Secret 반환 → 클라이언트
클라이언트 → Client Secret으로 결제 완료
장점: Secret Key는 서버에만 있어서 안전함!
```

### 6-2. 파일 구조

```
프로젝트/
├── .env.local                          ← 환경 변수 (여기에 키 저장)
├── src/
│   ├── app/
│   │   └── api/
│   │       └── payment/
│   │           └── create-payment-intent/
│   │               └── route.ts        ← 서버 API (Stripe 호출)
│   └── components/
│       └── booking/
│           └── BookingFlow.tsx        ← 클라이언트 (사용자 화면)
```

### 6-3. 작동 순서 (플로우차트)

```
[1] 사용자가 카드 정보 입력
        ↓
[2] "예약 완료" 버튼 클릭
        ↓
[3] BookingFlow.tsx에서 API 호출
   POST /api/payment/create-payment-intent
        ↓
[4] route.ts에서 Stripe API 호출
   stripe.paymentIntents.create()
        ↓
[5] Stripe가 Payment Intent 생성
        ↓
[6] Client Secret 반환
        ↓
[7] 클라이언트에서 Stripe.js로 결제 확인
   stripe.confirmCardPayment()
        ↓
[8] 결제 성공! 예약 완료
```

---

## 7. 실제 사용하기

### 7-1. 환경 변수 설정 확인

`.env.local` 파일이 제대로 설정되었는지 확인:

```bash
# 프로젝트 루트에서 실행
cat .env.local  # Windows: type .env.local
```

다음 두 줄이 보여야 합니다:
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
```

### 7-2. 서버 재시작

환경 변수를 변경했으면 반드시 서버를 재시작하세요!

```bash
# 서버 중지 (Ctrl + C)
# 다시 시작
npm run dev
```

### 7-3. 테스트 카드로 결제해보기

1. 브라우저에서 `http://localhost:3000` 접속
2. 예약 플로우 진행
3. 결제 단계에서 테스트 카드 입력:
   - 카드 번호: `4242 4242 4242 4242`
   - 만료일: `12/25` (미래 날짜면 됨)
   - CVV: `123`
   - 이름: 아무 이름이나 입력
4. "예약 완료" 버튼 클릭
5. 성공 메시지 확인! ✅

---

## 8. 문제 해결 (트러블슈팅)

### 문제 1: "Invalid API Key" 에러

**원인**: 환경 변수가 제대로 로드되지 않음

**해결 방법**:
1. `.env.local` 파일 위치 확인 (프로젝트 루트)
2. 파일 이름이 정확한지 확인 (`.env.local` - 점으로 시작!)
3. 서버 재시작
4. 키 앞뒤에 공백 없이 정확히 복사했는지 확인

### 문제 2: "Payment Intent creation failed"

**원인**: Stripe 키가 잘못되었거나 금액이 0 이하

**해결 방법**:
1. Stripe Dashboard에서 키 다시 복사
2. `.env.local` 업데이트
3. 서버 재시작
4. 결제 금액이 0보다 큰지 확인

### 문제 3: "Failed to load Stripe"

**원인**: Publishable Key가 없거나 잘못됨

**해결 방법**:
1. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` 확인
2. `NEXT_PUBLIC_` 접두사가 있는지 확인 (필수!)
3. 서버 재시작

### 문제 4: CORS 에러

**원인**: API 라우트가 제대로 작동하지 않음

**해결 방법**:
1. `src/app/api/payment/create-payment-intent/route.ts` 파일 존재 확인
2. 파일 내용이 올바른지 확인
3. 브라우저 개발자 도구(F12) → Network 탭에서 에러 확인

---

## 9. 다음 단계 (고급)

### 9-1. Stripe Elements 사용하기

현재는 간단한 입력 폼을 사용하지만, 더 안전하고 전문적인 방법은 Stripe Elements를 사용하는 것입니다.

**장점**:
- 카드 정보가 직접 우리 서버를 거치지 않음 (더 안전!)
- 자동으로 카드 타입 감지 (Visa, MasterCard 등)
- 더 나은 사용자 경험

**추가 공부**:
- Stripe Elements 문서: https://stripe.com/docs/stripe-js/elements

### 9-2. 웹훅(Webhook) 설정하기

결제 완료, 환불 등 이벤트를 자동으로 받아서 처리할 수 있습니다.

**예시**:
- 결제 성공 시 자동으로 이메일 발송
- 결제 실패 시 자동으로 고객에게 알림

### 9-3. 라이브 모드로 전환하기

실제 서비스에서 사용하려면:

1. Stripe Dashboard에서 "Live mode" 전환
2. 라이브 키 복사
3. `.env.local` 업데이트
4. 충분히 테스트
5. 실제 결제 시작!

---

## 10. 보안 체크리스트 ✅

개발 전에 반드시 확인하세요:

- [ ] `.env.local` 파일이 `.gitignore`에 포함되어 있음
- [ ] Secret Key를 코드에 직접 쓰지 않음
- [ ] GitHub에 Secret Key를 올리지 않음
- [ ] 테스트 모드로 충분히 테스트함
- [ ] HTTPS를 사용함 (실제 운영 시)
- [ ] PCI DSS 규정을 준수함

---

## 🆘 도움이 필요하신가요?

- **Stripe 공식 문서**: https://stripe.com/docs
- **Stripe 대시보드**: https://dashboard.stripe.com
- **한국어 지원**: Stripe Dashboard에서 언어 설정 가능
- **커뮤니티**: https://stripe.com/docs/support

---

## 📝 요약

1. ✅ Stripe 계정 만들기
2. ✅ API 키 가져오기
3. ✅ `.env.local` 파일 만들기
4. ✅ 패키지 설치 완료 (`npm install stripe @stripe/stripe-js`)
5. ✅ 코드 작성 완료
6. ✅ 테스트하기

**이제 테스트 카드로 결제해보세요!** 🎉


