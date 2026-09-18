import assert from 'node:assert/strict'
import test from 'node:test'
import {
  extractReservationFromEmail,
  isBookingChangeEmailSubject,
  isGygBookingChangeEmail,
  isReservationImportBookingChange,
} from '@/lib/emailReservationParser'

const GYG_FROM = 'supplier@getyourguide.com'
const GYG_CHANGE_SUBJECT = 'Booking changed - S382661 - GYGN6B2ZHXQM'

const GYG_PICKUP_CHANGE_BODY = `Hi trip mania llc
We would like to inform you that the following booking has changed.

Las Vegas: Grand Canyon Sunrise, Antelope Canyon, Horseshoe
Las Vegas: Grand Canyon Sunrise, Antelope Canyon, Horseshoe

Group Tour with Lower Antelope Canyon

ticket-booking
Booking reference

GYGN6B2ZHXQM
calendar
Date

September 23, 2026 at 12:00 AM

pin
Pickup location New

Excalibur Hotel & Casino, 3850 S Las Vegas Blvd, Las Vegas, NV 89109, USA
(coordinates: 36.0987973, -115.1754312)

Open in Google Maps
Customer hasn't specified a pickup location. We will remind them to specify a location. If no arrangements have been made 1 day before the activity starts, please contact the customer directly.

users
Number of participants

4

globe
Language

English
`

test('GYG 변경 제목은 예약 변경으로 분류한다', () => {
  assert.equal(isBookingChangeEmailSubject(GYG_CHANGE_SUBJECT), true)
  assert.equal(isBookingChangeEmailSubject('Booking detail change: - S382661 - GYG48YKXW2AA'), true)
  assert.equal(isBookingChangeEmailSubject('Booking cancelled - S382661 - GYGN6B2ZHXQM'), false)
  assert.equal(isBookingChangeEmailSubject('Urgent : New Booking received - S382661 - GYGN6B2ZHXQM'), false)
})

test('GYG 픽업 지정 변경 메일은 Excalibur를 추출하고 신규 접수로 보지 않는다', () => {
  const { platform_key, extracted_data } = extractReservationFromEmail({
    subject: GYG_CHANGE_SUBJECT,
    sourceEmail: GYG_FROM,
    text: GYG_PICKUP_CHANGE_BODY,
  })
  assert.equal(platform_key, 'getyourguide')
  assert.equal(extracted_data.is_booking_change, true)
  assert.equal(extracted_data.is_booking_confirmed, false)
  assert.equal(extracted_data.channel_rn, 'GYGN6B2ZHXQM')
  assert.equal(extracted_data.pickup_hotel, 'Excalibur Hotel & Casino')
  assert.deepEqual(extracted_data.booking_change_fields, ['pickup_hotel'])
  assert.equal(
    isReservationImportBookingChange({ subject: GYG_CHANGE_SUBJECT, extracted: extracted_data }),
    true
  )
})

test('GYG 변경 본문만 있어도 변경 메일로 본다', () => {
  assert.equal(isGygBookingChangeEmail('FYI', GYG_PICKUP_CHANGE_BODY), true)
  const { extracted_data } = extractReservationFromEmail({
    subject: 'GetYourGuide update',
    sourceEmail: GYG_FROM,
    text: GYG_PICKUP_CHANGE_BODY,
  })
  assert.equal(extracted_data.is_booking_change, true)
  assert.equal(extracted_data.pickup_hotel, 'Excalibur Hotel & Casino')
  assert.equal(extracted_data.channel_rn, 'GYGN6B2ZHXQM')
})

test('GYG Booking detail change 제목에서도 RN을 추출한다', () => {
  const { extracted_data } = extractReservationFromEmail({
    subject: 'Booking detail change: - S382661 - GYG48YKXW2AA',
    sourceEmail: GYG_FROM,
    text: GYG_PICKUP_CHANGE_BODY,
  })
  assert.equal(extracted_data.is_booking_change, true)
  assert.equal(extracted_data.channel_rn, 'GYG48YKXW2AA')
})

const VIATOR_FROM = 'partners@viator.com'
const VIATOR_AMENDMENT_SUBJECT =
  'Please Respond: Amendment Request for Booking: Mon, Oct 12, 2026 (#BR-1330282749)'
const VIATOR_AMENDMENT_BODY = `Amendment Request
TED wants to amend their booking for Las Vegas City Tour with Hotel Pick Up on Mon, Oct 12, 2026. Here are the requested changes:
• Travel date changed from 12 Oct 2026 to 26 Apr 2027.

Manage This Booking

Booking Details
Booking Reference: #BR-1330282749
Las Vegas City Tour with Hotel Pick Up
Location: Las Vegas, United States
Travel Date: Mon, Oct 12, 2026
Lead traveler name: TED HASLEY
Product Code: 343505P10
Hotel Pickup: NoMad Las Vegas, 3772 Las Vegas Blvd S, Las Vegas, NV 89109-4337, Las Vegas 89109-4337 (ph: 18337066623)
Special Requirements: No
Phone: (Alternate Phone)US+1 (903) 258-5062 Send the customer a message
`

test('Viator Amendment Request 제목은 예약 변경으로 분류하고 신규 접수로 보지 않는다', () => {
  assert.equal(isBookingChangeEmailSubject(VIATOR_AMENDMENT_SUBJECT), true)
  assert.equal(
    isReservationImportBookingChange({ subject: VIATOR_AMENDMENT_SUBJECT }),
    true
  )
  const { platform_key, extracted_data } = extractReservationFromEmail({
    subject: VIATOR_AMENDMENT_SUBJECT,
    sourceEmail: VIATOR_FROM,
    text: VIATOR_AMENDMENT_BODY,
  })
  assert.equal(platform_key, 'viator')
  assert.equal(extracted_data.is_booking_change, true)
  assert.equal(extracted_data.is_booking_confirmed, false)
  assert.equal(extracted_data.channel_rn, 'BR-1330282749')
  assert.equal(extracted_data.tour_date, '2026-10-12')
  assert.equal(extracted_data.original_tour_date, '2026-10-12')
  assert.equal(extracted_data.requested_tour_date, '2027-04-26')
  assert.deepEqual(extracted_data.booking_change_fields, ['tour_date'])
  assert.equal(extracted_data.pickup_hotel, 'NoMad Las Vegas')
  assert.equal(extracted_data.product_id, 'MDLVN')
  assert.equal(extracted_data.is_booking_change_request, true)
  assert.match(String(extracted_data.customer_name || ''), /TED/i)
})

test('GYG 인박스 ACTION NEEDED (booking changes) 회신은 예약 변경 메일로 보지 않는다', () => {
  assert.equal(
    isBookingChangeEmailSubject(
      'ACTION NEEDED (booking changes): [Reply required] US residency / Annual Pass & NPS fee — Ref. GYGN6BZW7FX3'
    ),
    false
  )
})

const VIATOR_AMENDED_SUBJECT = 'Amended Booking: Mon, Apr 05, 2027 (#BR-1443337285)'
const VIATOR_AMENDED_PICKUP_BODY = `No action is required. This booking has been amended.

Booking Amended
The following booking for Las Vegas 2 Day Zion Bryce Antelope Grand Canyon Horseshoe Bend on Mon, Apr 05, 2027 has been amended. Here are the changes:
• Pickup point type changed from HOTEL to HOTEL.
• Pickup point changed from Flamingo Las Vegas, 3555 Las Vegas Boulevard South, Las Vegas, NV 89109 (ph: +1 702-733-3111) to Harrah's Las Vegas, 3475 Las Vegas Boulevard South, Las Vegas, NV 89109 (ph: +1 800-214-9110).

Booking Details
Booking Reference: #BR-1443337285
Amended
Las Vegas 2 Day Zion Bryce Antelope Grand Canyon Horseshoe Bend
Location: Las Vegas, United States
Travel Date: Mon, Apr 05, 2027
Lead traveler name: TAMMY KOS
Product Code: 343505P14
Hotel Pickup: Harrah's Las Vegas, 3475 Las Vegas Boulevard South, Las Vegas, NV 89109 (ph: +1 800-214-9110)
Special Requirements: No
Phone: (Alternate Phone)US+1 18152635614 Send the customer a message
`

test('Viator Amended Booking은 확정 변경으로 분류하고 픽업 변경 호텔을 읽는다', () => {
  assert.equal(isBookingChangeEmailSubject(VIATOR_AMENDED_SUBJECT), true)
  const { extracted_data } = extractReservationFromEmail({
    subject: VIATOR_AMENDED_SUBJECT,
    sourceEmail: VIATOR_FROM,
    text: VIATOR_AMENDED_PICKUP_BODY,
  })
  assert.equal(extracted_data.is_booking_change, true)
  assert.equal(extracted_data.is_booking_confirmed, false)
  assert.equal(extracted_data.is_booking_change_request, undefined)
  assert.equal(extracted_data.channel_rn, 'BR-1443337285')
  assert.equal(extracted_data.pickup_hotel, "Harrah's Las Vegas")
  assert.ok((extracted_data.booking_change_fields || []).includes('pickup_hotel'))
})

const VIATOR_PICKUP_REQUEST_BODY = `Amendment Request
Alicia wants to amend their booking for Grand Canyon, Antelope Canyon, Horseshoe Bend Tour from Las Vegas on Sun, May 24, 2026. Here are the requested changes:
• Pick up point changed from I will select my pickup location later to Circus Circus Hotel & Casino, 2880 Las Vegas Blvd S, Las Vegas, NV 89109-1138.

Booking Details
Booking Reference: #BR-1399891359
Grand Canyon, Antelope Canyon, Horseshoe Bend Tour from Las Vegas
Location: Las Vegas, United States
Travel Date: Sun, May 24, 2026
Lead traveler name: Alicia Gil
Product Code: 343505P2
Hotel Pickup: Circus Circus Hotel & Casino, 2880 Las Vegas Blvd S, Las Vegas, NV 89109-1138
Special Requirements: No
Phone: (Alternate Phone)US+1 2398983623 Send the customer a message
`

test('Viator Amendment Request 픽업 지정은 later to 호텔로 오인하지 않는다', () => {
  const { extracted_data } = extractReservationFromEmail({
    subject: 'Please Respond: Amendment Request for Booking: Sun, May 24, 2026 (#BR-1399891359)',
    sourceEmail: VIATOR_FROM,
    text: VIATOR_PICKUP_REQUEST_BODY,
  })
  assert.equal(extracted_data.is_booking_change, true)
  assert.equal(extracted_data.is_booking_change_request, true)
  assert.equal(extracted_data.pickup_hotel, 'Circus Circus Hotel & Casino')
  assert.ok((extracted_data.booking_change_fields || []).includes('pickup_hotel'))
  assert.equal(extracted_data.channel_rn, 'BR-1399891359')
})

test('Tripadvisor Experiences Amendment 확정 메일은 날짜 변경과 RN을 읽는다', () => {
  const subject =
    'Tripadvisor Experiences Amendment: BR-1372241553    [ ref:!00Dd00gJSL.!500Vu013AEvV:ref ]'
  assert.equal(isBookingChangeEmailSubject(subject), true)
  const { extracted_data } = extractReservationFromEmail({
    subject,
    sourceEmail: 'reservations-experiences@tripadvisor.com',
    text: `Dear Reservations,

We already amended this booking from April 7, 2026 to April 8, 2026 as per your notification.

Booking Details :
Booking Reference: 1372241553
Travel Date: 8 April 2026
Hotel Pickup: Mandalay Bay Resort & Casino, 3950 S Las Vegas Blvd, Las Vegas, NV 89119-1006
Lead traveler: Rogelio Guerra
`,
  })
  assert.equal(extracted_data.is_booking_change, true)
  assert.notEqual(extracted_data.is_booking_change_request, true)
  assert.equal(extracted_data.channel_rn, 'BR-1372241553')
  assert.equal(extracted_data.original_tour_date, '2026-04-07')
  assert.equal(extracted_data.requested_tour_date, '2026-04-08')
  assert.equal(extracted_data.tour_date, '2026-04-08')
  assert.equal(extracted_data.pickup_hotel, 'Mandalay Bay Resort & Casino')
})

test('Tripadvisor Experiences Amendment Request는 변경 요청으로 분류한다', () => {
  const subject = 'TripAdvisor Experiences Amendment Request: BR-1372241553'
  assert.equal(isBookingChangeEmailSubject(subject), true)
  const { extracted_data } = extractReservationFromEmail({
    subject,
    sourceEmail: 'reservations-experiences@tripadvisor.com',
    text: `The customer has requested to amend this booking from April 7, 2026 to April 8, 2026.
Please reply as soon as possible so that we may notify the customer.

Booking Details :
Booking Reference: 1372241553
Travel Date: 7 April 2026
Hotel Pickup: Mandalay Bay Resort & Casino, 3950 S Las Vegas Blvd, Las Vegas, NV 89119-1006
`,
  })
  assert.equal(extracted_data.is_booking_change, true)
  assert.equal(extracted_data.is_booking_change_request, true)
  assert.equal(extracted_data.channel_rn, 'BR-1372241553')
  assert.equal(extracted_data.original_tour_date, '2026-04-07')
  assert.equal(extracted_data.requested_tour_date, '2026-04-08')
  assert.equal(extracted_data.tour_date, '2026-04-07')
})

const KLOOK_ORDER_RECEIVED_SUBJECT =
  'Klook Order Received - [한국어 가이드] 라스베가스 > 그랜드캐년 일출+앤텔롭캐년+홀슈밴드 도깨비 당일투어 | 소규모 프리미엄 - 2026-10-02 - jo hajin - GPW748162'

const KLOOK_ORDER_RECEIVED_BODY = `Hey there Wooyong Shim,
Klook has received an order for [한국어 가이드] 라스베가스 > 그랜드캐년 일출+앤텔롭캐년+홀슈밴드 도깨비 당일투어 | 소규모 프리미엄. Please confirm availability with us ASAP - see below order details:

Booking reference ID: GPW748162
Date Request: 2026-10-02
Lead participant: ()jo hajin
Participant: 2 x Person
Departure location: 더코스모폴리탄 호텔
Activity URL: https://www.klook.com/ko/activity/206813

If you cannot confirm this booking, please send an amendment request or contact the customer to discuss alternatives
`

test('Klook Order Received는 본문 amendment request 안내가 있어도 신규 접수다', () => {
  assert.equal(isBookingChangeEmailSubject(KLOOK_ORDER_RECEIVED_SUBJECT), false)
  assert.equal(isGygBookingChangeEmail(KLOOK_ORDER_RECEIVED_SUBJECT, KLOOK_ORDER_RECEIVED_BODY), false)
  assert.equal(
    isReservationImportBookingChange({
      subject: KLOOK_ORDER_RECEIVED_SUBJECT,
      extracted: { is_booking_change: true },
    }),
    false
  )
  const { platform_key, extracted_data } = extractReservationFromEmail({
    subject: KLOOK_ORDER_RECEIVED_SUBJECT,
    sourceEmail: 'operator@klook.com',
    text: KLOOK_ORDER_RECEIVED_BODY,
  })
  assert.equal(platform_key, 'klook')
  assert.equal(extracted_data.is_booking_change, undefined)
  assert.equal(extracted_data.is_booking_confirmed, true)
  assert.equal(extracted_data.channel_rn, 'GPW748162')
  assert.equal(extracted_data.customer_name, 'jo hajin')
})

test('Viator Amended Booking 인원 추가는 people 필드로 표시한다', () => {
  const { extracted_data } = extractReservationFromEmail({
    subject: 'Amended Booking: Wed, Oct 14, 2026 (#BR-1416980871)',
    sourceEmail: VIATOR_FROM,
    text: `No action is required. This booking has been amended.
Booking Amended
Here are the changes:
• Traveller Jouee Joy C. Visitacion has been added to this booking.

Booking Details
Booking Reference: #BR-1416980871
Travel Date: Wed, Oct 14, 2026
Lead traveler name: Mae Joy Coscolluela-Harvey
Hotel Pickup: Flamingo Las Vegas, 3555 Las Vegas Boulevard South, Las Vegas, NV 89109
`,
  })
  assert.equal(extracted_data.is_booking_change, true)
  assert.ok((extracted_data.booking_change_fields || []).includes('people'))
  assert.equal(extracted_data.pickup_hotel, 'Flamingo Las Vegas')
})


