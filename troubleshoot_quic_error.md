# QUIC Protocol Error 해결 가이드

## 🚨 증상
```
POST https://[supabase-url]/auth/v1/token?grant_type=refresh_token net::ERR_QUIC_PROTOCOL_ERROR
TypeError: Failed to fetch
```

## 🔧 해결 방법들

### 1. 브라우저 QUIC 비활성화 (Chrome)

**방법 1: 설정에서 변경**
1. Chrome 주소창에 `chrome://flags/#enable-quic` 입력
2. QUIC 프로토콜을 **Disabled**로 설정
3. 브라우저 재시작

**방법 2: 명령줄 옵션 추가**
```bash
chrome --disable-quic --disable-http2
```

### 2. 네트워크 설정 확인

**방법 1: VPN/프록시 비활성화**
- VPN 또는 프록시 사용 시 일시적으로 비활성화 테스트

**방법 2: DNS 변경**
- Google DNS: `8.8.8.8`, `8.8.4.4`
- Cloudflare DNS: `1.1.1.1`, `1.0.0.1`

### 3. 개발 환경 설정

**환경 변수 추가** (로컬 개발용):
```
SUPABASE_BYPASS_RATE_LIMIT=true
```

### 4. Supabase 클라이언트 설정 수정

**supabase.ts 파일에 옵션 추가**:
```typescript
const supabaseUrl = 'your-supabase-url'
const supabaseAnonKey = 'your-supabase-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    fetch: (url, options = {}) => {
      return fetch(url, {
        ...options,
        // HTTP/1.1 강제 사용
        headers: {
          ...options.headers,
          'Connection': 'close'
        }
      })
    }
  }
})
```

## 🔄 즉시 해결 책

### 임시 해결책
1. **브라우저 캐시 및 쿠키 삭제**
2. **시크릿 모드**에서 테스트
3. **다른 브라우저**로 테스트 (Firefox, Edge)

### 근본 해결책
1. **QUIC 비활성화** (Chrome에서)
2. **안정적인 네트워크** 연결 사용
3. **Supabase 클라이언트 설정** 개선

## 💡 권장사항

**개발 환경**에서는 QUIC를 비활성화하는 것을 권장합니다:
- 다양한 네트워크 환경에서 호환성 향상
- 디버깅이 용이함
- 안정적인 개발 환경 제공
