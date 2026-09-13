import assert from 'node:assert/strict'
import test from 'node:test'
import { extractReservationFromEmail } from '@/lib/emailReservationParser'
import { isMyrealtripChannelName } from '@/lib/platformChannelMapping'

const MYREALTRIP_FROM = 'Myrealtrip Customer Service <help@myrealtrip.com>'

const MYREALTRIP_TAB_BODY = `
마이리얼트립
라스베가스 매니아 파트너님,
새로운 예약이 들어왔어요.
주문정보
예약번호	EXP-20260913-00003792
상품명	라스베가스 > 그랜드캐년 일출+앤텔롭캐년+홀슈밴드 도깨비 당일투어 | 소규모 프리미엄
옵션명	라스베가스 > 그랜드캐년 일출+앤텔롭캐년+홀슈밴드 도깨비 당일투어 | 소규모 프리미엄
여행일	2026-10-07 ~ 2026-10-07
여행자	김현우
예약이 가능한 경우
아래 [새로운 예약 확인하기] 버튼을 눌러주세요.
`

test('마이리얼트립 탭 구분 본문에서 여행자·채널·예약번호를 파싱한다', () => {
  const { platform_key, extracted_data } = extractReservationFromEmail({
    subject: '새로운 예약이 들어왔어요.',
    sourceEmail: MYREALTRIP_FROM,
    text: MYREALTRIP_TAB_BODY,
  })
  assert.equal(platform_key, 'myrealtrip')
  assert.equal(extracted_data.customer_name, '김현우')
  assert.equal(extracted_data.channel_rn, 'EXP-20260913-00003792')
  assert.equal(extracted_data.tour_date, '2026-10-07')
  assert.equal(extracted_data.product_id, 'MDGCSUNRISE')
  assert.equal(extracted_data.is_booking_confirmed, true)
})

test('마이리얼트립 여행자 : 이름 형식도 파싱한다', () => {
  const { extracted_data } = extractReservationFromEmail({
    subject: '새로운 예약이 들어왔어요',
    sourceEmail: MYREALTRIP_FROM,
    text: '주문정보\n여행자 : 김현우\n예약번호 EXP-20260913-00003792\n',
  })
  assert.equal(extracted_data.customer_name, '김현우')
})

test('마이리얼트립 HTML 한 줄 본문에서도 여행자를 파싱한다', () => {
  const html =
    '<p>새로운 예약이 들어왔어요.</p><table><tr><td>예약번호</td><td>EXP-20260913-00003792</td></tr><tr><td>상품명</td><td>라스베가스 &gt; 그랜드캐년 일출+앤텔롭캐년+홀슈밴드 도깨비 당일투어 | 소규모 프리미엄</td></tr><tr><td>여행일</td><td>2026-10-07 ~ 2026-10-07</td></tr><tr><td>여행자</td><td>김현우</td></tr></table>'
  const { platform_key, extracted_data } = extractReservationFromEmail({
    subject: '파트너 알림',
    sourceEmail: MYREALTRIP_FROM,
    html,
  })
  assert.equal(platform_key, 'myrealtrip')
  assert.equal(extracted_data.customer_name, '김현우')
  assert.equal(extracted_data.channel_rn, 'EXP-20260913-00003792')
  assert.equal(extracted_data.tour_date, '2026-10-07')
  assert.equal(extracted_data.is_booking_confirmed, true)
})

test('마이리얼트립 채널명은 한글명·My Real Trip 모두 매칭한다', () => {
  assert.equal(isMyrealtripChannelName('마이리얼트립'), true)
  assert.equal(isMyrealtripChannelName('MyRealTrip'), true)
  assert.equal(isMyrealtripChannelName('My Real Trip'), true)
  assert.equal(isMyrealtripChannelName('Klook'), false)
})
