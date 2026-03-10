# Resend Inbound 예약 이메일 연동 설정 가이드

플랫폼(비아토, 클룩 등)에서 오는 **예약 알림 이메일**을 우리 서버로 자동 수신해서, "예약 가져오기" 페이지에 쌓이게 하는 설정 방법입니다.  
**중학생도 따라 할 수 있도록** 단계별로 적었어요.

---

## Resend 서브도메인/유료가 부담될 때 (무료 대안)

Resend에서 **수신(Inbound)** 을 쓰려면 도메인 추가가 필요하고, 요금제에 따라 **유료**일 수 있습니다.  
**돈 내지 않고** 쓰는 방법은 아래 두 가지예요.

### 방법 1: 이메일 붙여넣기 (바로 사용 가능, 추천)

- **관리자** → **예약 가져오기** 페이지 상단의 **「이메일 붙여넣기」** 버튼 클릭
- Gmail(또는 다른 메일)에서 **예약 알림 메일**을 연 다음, **제목**과 **본문 전체**를 복사
- 열린 창에 **제목** / **본문** 붙여넣기 (발신 주소는 선택)
- **가져오기** 클릭 → 자동으로 정보 추출 후 목록에 한 건 추가됨
- 목록에서 해당 항목 클릭 → 보완 후 **예약으로 생성** 하면 됨

**장점:** Resend, 도메인, 결제 없이 **지금 바로** 사용 가능.  
**단점:** 메일 올 때마다 직접 복사해서 붙여넣기 해야 함 (반자동).

### 방법 2: Gmail API로 자동 수신 (추후 구현 가능)

- Gmail 계정을 한 번 연결해 두면, **새 메일이 올 때마다** 우리 서버가 Gmail을 조회해서 예약 가져오기 목록에 넣는 방식
- Resend·도메인·유료 요금 없이 사용 가능
- 구현하려면: Google Cloud에서 프로젝트 생성 → Gmail API 사용 설정 → OAuth 동의 화면 및 사용자 인증 후, 우리 앱에서 “Gmail 연결” 버튼으로 토큰 발급·저장 → 주기적으로(또는 푸시로) 새 메일 조회 후 파싱·저장

지금은 **방법 1(이메일 붙여넣기)** 만 제공하고, 방법 2는 필요 시 별도 개발로 추가할 수 있어요.

---

## 1. 이게 뭔지 한 줄로 (Resend Inbound 사용 시)

- **Resend** = 이메일 보내기/받기 서비스
- **Inbound** = “우리 주소로 들어오는 이메일을 받아서, 정해진 웹 주소(URL)로 알려준다”는 기능
- 우리가 할 일 = Resend에서 “이메일 받으면 이 URL로 알려줘”라고 설정하고, 우리 서버 주소와 비밀값(환경 변수)만 넣어주면 됨

---

## 2. 미리 준비할 것

1. **Resend 계정**  
   - [https://resend.com](https://resend.com) 에서 가입(이메일로 가입 가능)
2. **받을 이메일을 쓸 도메인**  
   - 예: `bookings.maniatour.com` 같은 **서브도메인** 하나 정하기  
   - (루트 도메인 `maniatour.com` 대신 서브도메인 쓰는 걸 Resend도 추천함)
3. **우리 서비스가 배포된 주소**  
   - 예: `https://tour.maniatour.com` (실제 사용하는 주소로 바꾸면 됨)

---

## 3. Resend에서 “이메일 받기” 켜기 (도메인 설정)

1. **Resend 로그인** 후 왼쪽 메뉴에서 **Domains** 클릭
2. **Add Domain** 버튼 클릭
3. **도메인 입력**  
   - 예: `bookings.maniatour.com` (앞에서 정한 서브도메인)
4. **Receiving(수신)** 이 켜져 있는지 확인  
   - “Receive emails” / “Receiving” 같은 옵션이 있으면 **ON** 으로
5. Resend가 **DNS 기록**을 알려줌  
   - MX 레코드 등이 나옴
6. **도메인 관리하는 곳**(가비아, Cloudflare, AWS 등)에 들어가서  
   - Resend가 알려준 **이름**, **타입**, **값**을 그대로 DNS에 추가
7. Resend 화면에서 **Verify** 버튼 눌러서 **검증 완료**될 때까지 기다리기  
   - 보통 몇 분~몇 십 분 걸릴 수 있음

이렇게 하면 `xxx@bookings.maniatour.com` 같은 주소로 **들어오는 이메일을 Resend가 받을 수** 있게 됨.

---

## 4. 웹훅(Webhook) 만들기 — “이메일 오면 우리 서버에 알려줘”

1. Resend 왼쪽 메뉴에서 **Webhooks** 로 이동
2. **Add Webhook** (또는 “Create webhook”) 클릭
3. **설정 입력**
   - **Endpoint URL**  
     우리 서버의 예약 수신 API 주소를 넣음:
     ```text
     https://여기에는-실제-도메인/api/reservation-imports
     ```
     예시:
     - 로컬 테스트: `https://abc123.ngrok.io/api/reservation-imports` (ngrok 사용 시)
     - 실제 서비스: `https://tour.maniatour.com/api/reservation-imports`
   - **Events(이벤트)**  
     **email.received** 만 선택 (체크)
   - 나머지는 기본값으로 두고 **Create** (또는 “Save”) 클릭
4. 생성된 웹훅 상세 화면으로 들어가면 **Signing Secret** (시크릿 값)이 보임  
   - **나중에 환경 변수에 넣을 값**이니까 **복사해서 안전한 곳에 메모**해 두기  
   - 예: `whsec_xxxxxxxxxxxx` 형태

정리하면:  
“이메일이 우리 도메인으로 들어오면 → Resend가 `email.received` 이벤트로 → 우리가 적어준 URL(`/api/reservation-imports`)로 요청을 보낸다” 까지 설정한 상태.

---

## 5. 환경 변수 설정 (우리 서버가 Resend를 믿을 수 있게)

우리 서버는 “이 요청이 진짜 Resend에서 온 거다”를 **비밀값(시크릿)** 으로 확인합니다.  
그래서 아래 두 값을 **환경 변수**로 넣어줘야 합니다.

### 5-1. 어떤 파일에 넣나요?

- **로컬 개발**: 프로젝트 루트의 `.env.local`  
- **Vercel 등 호스팅**: 해당 서비스의 “Environment Variables” / “환경 변수” 설정 화면

파일이 없으면 프로젝트 루트에 `.env.local` 파일을 새로 만들어서 넣으면 됨.

### 5-2. 넣을 변수 두 개

| 변수 이름 | 설명 | 어디서 구하나요 |
|-----------|------|------------------|
| `RESEND_API_KEY` | Resend API 호출용 키 (이메일 본문 가져오기 등) | Resend 대시보드 → **API Keys** → Create / 기존 키 복사 (보통 `re_` 로 시작) |
| `RESEND_WEBHOOK_SECRET` | 웹훅 서명 검증용 비밀값 | Resend 대시보드 → **Webhooks** → 방금 만든 웹훅 클릭 → **Signing Secret** 복사 (보통 `whsec_` 로 시작) |

### 5-3. .env.local 예시

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxx
```

- `=` 뒤에 **공백 없이** 값만 넣기
- 따옴표 넣지 않아도 됨 (보통)
- 이 파일은 **절대 Git에 올리지 말기** (이미 `.gitignore`에 있을 수 있음)

### 5-4. Vercel에서 설정하는 경우

1. Vercel 대시보드 → 해당 프로젝트 선택
2. **Settings** → **Environment Variables**
3. **Name**: `RESEND_API_KEY`  
   **Value**: (Resend에서 복사한 API 키)  
   → Save
4. 같은 방식으로  
   **Name**: `RESEND_WEBHOOK_SECRET`  
   **Value**: (Resend 웹훅 Signing Secret)  
   → Save
5. 변경 사항 반영을 위해 **재배포** 한 번 하기 (Deployments → Redeploy 등)

---

## 6. 플랫폼 이메일을 우리 주소로 모으기

이제 “예약 알림이 오는 이메일”을 **Resend가 받는 주소**로 넘기면 됩니다.

1. **Resend가 받기로 한 주소**  
   - 위 3번에서 켠 도메인 기준  
   - 예: `reservations@bookings.maniatour.com`
2. **각 플랫폼(비아토, 클룩 등)에서**  
   - “예약 알림을 받을 이메일”을  
   - `reservations@bookings.maniatour.com` (또는 사용하는 주소)로 **변경**하거나  
   - Gmail/Outlook 등에서 **자동 전달 규칙**으로  
     “예약 관련 메일 → reservations@bookings.maniatour.com 으로 전달” 하면 됨

그러면 플랫폼 → 우리 수신 주소 → Resend 수신 → 웹훅으로 우리 서버 `/api/reservation-imports` 호출 → 예약 가져오기 목록에 자동 등록.

---

## 6-A. Gmail로 오는 예약 메일 설정하기 (Gmail → Resend 전달)

예약 알림이 **지금 Gmail**로 오고 있다면, Gmail에서 “이런 메일 오면 Resend 수신 주소로 전달해라”만 설정하면 됩니다.  
**Resend 도메인·웹훅 설정(3~5번)은 이미 끝났다고 가정합니다.**

### Gmail에서 “전달 주소” 추가하기

1. **Gmail** 접속 → 오른쪽 위 **톱니바퀴(설정)** → **모든 설정 보기**
2. 상단 탭에서 **전달 및 POP/IMAP** 클릭
3. **전달** 구역에서 **전달 주소 추가** 클릭
4. **전달할 이메일 주소**에 Resend가 받기로 한 주소 입력  
   - 예: `reservations@bookings.maniatour.com`  
   - (실제로 쓰는 도메인 주소로 바꾸세요)
5. **다음** → **전달 확인 메일 보내기** 등으로 Gmail이 **인증 메일**을 그 주소로 보냅니다.

### Gmail 인증 메일 처리하기 (한 번만 하면 됨)

Gmail이 보낸 인증 메일은 **Resend 수신 주소**로 가고, 우리 서버가 받아서 **예약 가져오기** 목록에 저장합니다.

1. **1~2분 정도 기다린 뒤** 우리 서비스 **관리자** → **예약 가져오기** 메뉴로 이동
2. 목록에서 **제목이 “Gmail 전달 확인” 같은 메일** 한 건 찾기
3. 그 **항목을 클릭**해서 상세 화면으로 들어가기
4. **이메일 요약 / 본문**에 있는 **확인 링크**(`https://mail.google.com/...` 로 시작하는 주소)를 **복사**
5. 브라우저 **새 탭**에 그 주소를 붙여넣어 열기 → Gmail에서 “전달 허용” 완료

이렇게 하면 “Gmail → reservations@... 주소로 전달”이 **한 번만** 인증되고, 앞으로는 계속 전달됩니다.

### “예약 메일만” 전달되도록 필터 만들기

Gmail에서 **예약 알림 메일만** 골라서 전달하려면 **필터**를 쓰면 됩니다.

1. Gmail 검색창 옆 **돋보기 세 개(▼)** 클릭 → **필터 만들기** (또는 설정 → 필터 및 차단된 주소 → 새 필터 만들기)
2. **검색 조건** 입력 (아래 중 편한 대로):
   - **보낸 사람**: `@viator.com` 또는 `@getyourguide.com` 등 플랫폼 도메인  
     (여러 개면 나중에 필터를 여러 개 만들어도 됨)
   - 또는 **제목**: `booking`, `reservation`, `예약` 등
3. **필터 만들기** 클릭
4. **“다음 주소로 전달”** 체크 → 드롭다운에서 **reservations@bookings.maniatour.com** (방금 추가한 전달 주소) 선택
5. **필터 저장** (또는 “필터 만들기” 완료)

이제 조건에 맞는 메일이 Gmail에 도착하면 **자동으로** Resend 주소로 전달되고, 우리 서버 **예약 가져오기**에 쌓입니다.

**요약 (Gmail 사용 시)**

| 단계 | 할 일 |
|------|--------|
| 1 | Gmail 설정 → 전달 및 POP/IMAP → 전달 주소 추가 → `reservations@...` 입력 |
| 2 | 예약 가져오기 목록에서 Gmail 인증 메일 찾기 → 본문의 확인 링크 클릭 |
| 3 | Gmail 필터 만들기: 예약 메일 조건(발신자/제목) → “다음 주소로 전달” → Resend 주소 선택 |

---

## 7. 확인하는 방법

1. **관리자 페이지**  
   - 로그인 후 **예약 가져오기** 메뉴로 이동  
   - `/admin/reservation-imports` 같은 주소
2. **테스트 이메일**  
   - 본인 이메일에서 `reservations@bookings.maniatour.com` (실제 사용 주소)로 **메일 한 통 보내기**  
   - 제목/본문에 이름, 날짜, 인원 등 적어두면 추출이 잘 되는지 확인 가능
3. 1~2분 안에 **예약 가져오기 목록**에 한 건 생겼는지 확인  
   - 안 보이면:  
     - Resend **Webhooks** 화면에서 해당 웹훅 **최근 요청/로그** 확인  
     - 우리 서버 로그에서 `/api/reservation-imports` 401/502 등 에러 확인  
     - 환경 변수(`RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`) 다시 확인

---

## 8. 한 페이지 요약 체크리스트

- [ ] Resend 가입 및 로그인
- [ ] 도메인 추가 + **Receiving(수신)** 켜기 + DNS 설정 + Verify 완료
- [ ] Webhooks에서 **Add Webhook** → URL: `https://우리도메인/api/reservation-imports`, 이벤트: **email.received**
- [ ] 웹훅의 **Signing Secret** 복사
- [ ] API Keys에서 **RESEND_API_KEY** 복사
- [ ] `.env.local`(로컬) 또는 호스팅 환경 변수에 `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` 넣기
- [ ] 재배포 후 테스트 이메일로 한 통 보내서 “예약 가져오기”에 뜨는지 확인

**Gmail 사용 시** 추가 체크: 위 **6-A** 참고 (Gmail 전달 주소 추가 → 인증 메일에서 확인 링크 클릭 → 필터로 예약 메일만 전달).

이 순서대로 하면 Resend Inbound 설정은 끝납니다.  
중간에 막히는 단계가 있으면 “몇 번 단계에서, 어떤 화면에서” 막혔는지 알려주면 그 부분만 더 풀어서 설명해 줄 수 있어요.
