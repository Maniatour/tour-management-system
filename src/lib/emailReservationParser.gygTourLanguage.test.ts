import assert from 'node:assert/strict'
import test from 'node:test'
import { extractReservationFromEmail } from '@/lib/emailReservationParser'
import { resolveImportTourLanguage } from '@/lib/importCustomerLanguage'

const GYG_FROM = 'supplier@getyourguide.com'
const GYG_SUBJECT = 'Urgent : New Booking received - S382661 - GYGJA12345678'

test('GYG Tour language 줄바꿈 Japanese (Live tour guide) 는 일본어 투어로 파싱한다', () => {
  const { extracted_data } = extractReservationFromEmail({
    subject: GYG_SUBJECT,
    sourceEmail: GYG_FROM,
    text: `Main customer
Hanako Suzuki
customer-abc@reply.getyourguide.com
Phone: +81 90-1234-5678
Language: Japanese
globe
Tour language

Japanese (Live tour guide)
currency
Price
$ 199.00
`,
  })
  assert.equal(extracted_data.tour_language, 'JA')
  assert.equal(resolveImportTourLanguage(extracted_data, 'getyourguide'), 'ja')
})

test('GYG Tour language 한 줄 Japanese (Live tour guide) 도 일본어 투어다', () => {
  const { extracted_data } = extractReservationFromEmail({
    subject: GYG_SUBJECT,
    sourceEmail: GYG_FROM,
    text: 'Main customer Hanako Suzuki Phone: +819012345678 Language: Japanese Tour language Japanese (Live tour guide) Price $ 199.00',
  })
  assert.equal(extracted_data.tour_language, 'JA')
  assert.equal(resolveImportTourLanguage(extracted_data, 'getyourguide'), 'ja')
})

test('GYG Tour language English (Live tour guide) 는 영어 투어로 유지한다', () => {
  const { extracted_data } = extractReservationFromEmail({
    subject: GYG_SUBJECT,
    sourceEmail: GYG_FROM,
    text: `Language: Spanish
Tour language

English (Live tour guide)
Price
$ 199.00
`,
  })
  assert.equal(extracted_data.tour_language, 'EN')
  assert.equal(resolveImportTourLanguage(extracted_data, 'getyourguide'), 'en')
})
