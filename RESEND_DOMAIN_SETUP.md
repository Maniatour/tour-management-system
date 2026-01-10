# Resend 도메인 설정 가이드

## 개요
`updates.kovegas.com` 도메인을 Resend에서 사용하기 위해 DNS 레코드를 설정해야 합니다.

## 필요한 DNS 레코드

Resend 대시보드에서 표시된 다음 DNS 레코드들을 도메인 제공업체에 추가해야 합니다:

### 1. Domain Verification (DKIM) - 필수
**도메인 인증을 위한 TXT 레코드**

- **Type**: `TXT`
- **Name**: `resend._domainkey.updates` (또는 `resend._domainkey.updates.kovegas.com`)
- **Value**: Resend 대시보드에 표시된 긴 문자열 (예: `p=MIGfMAOGCSqGSIb3DQEB...`)
- **TTL**: `Auto` 또는 `3600`

### 2. Enable Sending (SPF) - 필수
**이메일 발송을 위한 TXT 레코드**

- **Type**: `TXT`
- **Name**: `send.updates` (또는 `send.updates.kovegas.com`)
- **Value**: `v=spf1 include:amazonses.com ~all` (Resend 대시보드에 표시된 전체 값)
- **TTL**: `Auto` 또는 `3600`

### 3. Enable Sending (MX) - 필수
**이메일 수신을 위한 MX 레코드**

- **Type**: `MX`
- **Name**: `send.updates` (또는 `send.updates.kovegas.com`)
- **Value**: `feedback-smtp.us-east-1.amazonses.com` (Resend 대시보드에 표시된 전체 값)
- **Priority**: `10`
- **TTL**: `Auto` 또는 `3600`

### 4. DMARC (선택사항)
**이메일 보안을 위한 TXT 레코드**

- **Type**: `TXT`
- **Name**: `_dmarc`
- **Value**: `v=DMARC1; p=none;`
- **TTL**: `Auto` 또는 `3600`

## 단계별 설정 방법

### Step 1: 도메인 제공업체 확인
`kovegas.com` 도메인을 관리하는 곳을 확인하세요:
- GoDaddy
- Namecheap
- Cloudflare
- AWS Route 53
- 기타 DNS 제공업체

### Step 2: DNS 관리 페이지 접속
도메인 제공업체의 대시보드에서 DNS 관리 페이지로 이동하세요.

### Step 3: DNS 레코드 추가

#### 3.1 DKIM 레코드 추가
1. "DNS 레코드 추가" 또는 "Add Record" 클릭
2. 다음 정보 입력:
   - **Type**: `TXT` 선택
   - **Name/Host**: `resend._domainkey.updates` (또는 제공업체에 따라 `resend._domainkey.updates.kovegas.com`)
   - **Value/Content**: Resend 대시보드에 표시된 전체 DKIM 값 복사
   - **TTL**: `3600` 또는 `Auto`
3. 저장

#### 3.2 SPF 레코드 추가
1. "DNS 레코드 추가" 클릭
2. 다음 정보 입력:
   - **Type**: `TXT` 선택
   - **Name/Host**: `send.updates` (또는 `send.updates.kovegas.com`)
   - **Value/Content**: Resend 대시보드에 표시된 전체 SPF 값 복사 (예: `v=spf1 include:amazonses.com ~all`)
   - **TTL**: `3600` 또는 `Auto`
3. 저장

#### 3.3 MX 레코드 추가
1. "DNS 레코드 추가" 클릭
2. 다음 정보 입력:
   - **Type**: `MX` 선택
   - **Name/Host**: `send.updates` (또는 `send.updates.kovegas.com`)
   - **Value/Content**: Resend 대시보드에 표시된 MX 값 (예: `feedback-smtp.us-east-1.amazonses.com`)
   - **Priority**: `10`
   - **TTL**: `3600` 또는 `Auto`
3. 저장

#### 3.4 DMARC 레코드 추가 (선택사항)
1. "DNS 레코드 추가" 클릭
2. 다음 정보 입력:
   - **Type**: `TXT` 선택
   - **Name/Host**: `_dmarc`
   - **Value/Content**: `v=DMARC1; p=none;`
   - **TTL**: `3600` 또는 `Auto`
3. 저장

### Step 4: DNS 전파 대기
DNS 레코드 변경사항이 전 세계에 전파되는 데 시간이 걸립니다:
- **일반적으로**: 5분 ~ 24시간
- **평균**: 1-2시간

### Step 5: Resend에서 확인
1. Resend 대시보드로 돌아가기
2. `updates.kovegas.com` 도메인 페이지 새로고침
3. DNS 레코드 상태가 "Failed"에서 "Verified" 또는 "Success"로 변경될 때까지 대기
4. 모든 레코드가 "Verified" 상태가 되면 도메인 인증 완료

## 주요 도메인 제공업체별 설정 방법

### Cloudflare
1. Cloudflare 대시보드 → `kovegas.com` 선택
2. DNS → Records
3. "Add record" 클릭
4. Type, Name, Content 입력 후 저장

### AWS Route 53
1. Route 53 콘솔 → Hosted zones
2. `kovegas.com` 선택
3. "Create record" 클릭
4. Record type, Record name, Value 입력 후 저장

### GoDaddy
1. **GoDaddy 대시보드 접속**
   - https://www.godaddy.com/ 에 로그인
   - "My Products" 또는 "내 제품" 클릭

2. **도메인 선택**
   - `kovegas.com` 도메인 찾기
   - "DNS" 또는 "DNS 관리" 클릭
   - ⚠️ **주의**: "DS Records"가 아닌 **"DNS Records"** 또는 **"Records"** 섹션 사용

3. **DNS 레코드 추가**
   - "Add" 또는 "추가" 버튼 클릭
   - 다음 정보 입력:
     - **Type**: `TXT` 또는 `MX` 선택
     - **Name/Host**: 레코드 이름 입력 (예: `resend._domainkey.updates`)
     - **Value/Points to**: 레코드 값 입력
     - **TTL**: `600` 또는 `1 hour` 선택
   - "Save" 또는 "저장" 클릭

4. **중요 사항**
   - ❌ **DS Records는 사용하지 않습니다** (DNSSEC용)
   - ✅ **DNS Records 섹션을 사용하세요**
   - 서브도메인(`updates`)의 경우 Name에 `resend._domainkey.updates` 또는 `send.updates` 입력

### Namecheap
1. Namecheap 대시보드 → Domain List
2. `kovegas.com` → Manage → Advanced DNS
3. "Add New Record" 클릭
4. Type, Host, Value 입력 후 저장

## 문제 해결

### DNS 레코드가 여전히 "Failed"로 표시되는 경우

1. **레코드 값 확인**
   - Resend 대시보드의 값과 DNS에 입력한 값이 정확히 일치하는지 확인
   - 공백, 따옴표, 줄바꿈이 없는지 확인

2. **레코드 이름 확인**
   - 서브도메인(`updates.kovegas.com`)의 경우:
     - 일부 제공업체: `resend._domainkey.updates` (서브도메인만)
     - 일부 제공업체: `resend._domainkey.updates.kovegas.com` (전체 도메인)
   - 제공업체 문서를 확인하거나 둘 다 시도

3. **DNS 전파 확인**
   - 온라인 DNS 확인 도구 사용:
     - https://mxtoolbox.com/
     - https://dnschecker.org/
   - 레코드가 전 세계에 전파되었는지 확인

4. **TTL 확인**
   - TTL이 너무 높으면(예: 86400) 변경사항 반영이 느릴 수 있음
   - 설정 시 TTL을 3600 이하로 설정 권장

5. **캐시 클리어**
   - 브라우저 캐시 클리어
   - Resend 대시보드 새로고침
   - "Verify" 또는 "Check" 버튼 클릭

### 일반적인 오류

**"Domain Verification: Missing required DKIM record"**
- DKIM TXT 레코드가 추가되지 않았거나 잘못 입력됨
- 레코드 이름과 값 재확인

**"Sending: Missing required SPF records"**
- SPF TXT 레코드가 추가되지 않았거나 잘못 입력됨
- 레코드 이름과 값 재확인

**"Sending: Missing required MX records"**
- MX 레코드가 추가되지 않았거나 잘못 입력됨
- Priority 값 확인 (10으로 설정)

## 확인 방법

### DNS 레코드 확인 명령어 (터미널)

```bash
# DKIM 레코드 확인
nslookup -type=TXT resend._domainkey.updates.kovegas.com

# SPF 레코드 확인
nslookup -type=TXT send.updates.kovegas.com

# MX 레코드 확인
nslookup -type=MX send.updates.kovegas.com
```

### 온라인 도구로 확인

1. **MXToolbox**: https://mxtoolbox.com/
   - "DNS Lookup" 선택
   - 도메인 입력: `updates.kovegas.com`
   - 레코드 타입 선택 (TXT, MX)

2. **DNS Checker**: https://dnschecker.org/
   - 레코드 타입과 도메인 입력
   - 전 세계 DNS 서버에서 확인

## 완료 후

모든 DNS 레코드가 "Verified" 상태가 되면:

1. ✅ `.env.local` 파일의 `RESEND_FROM_EMAIL=updates@kovegas.com` 사용 가능
2. ✅ 이메일 발송 테스트
3. ✅ 운영 환경에서도 동일한 설정 사용

## 참고 자료

- [Resend 도메인 설정 문서](https://resend.com/docs/dashboard/domains/introduction)
- [Resend DNS 레코드 가이드](https://resend.com/docs/dashboard/domains/dns-records)
- [Resend "How to add records" 버튼](https://resend.com/docs/dashboard/domains/add-domain)
