import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { sendTwilioSms } from '@/lib/twilioClient'
import { formatPhoneToE164 } from '@/utils/formatPhoneToE164'
import { isTourCancelled, isTourDeleted } from '@/utils/tourStatusUtils'
import {
  buildRentalCarPickupDropoffSms,
  rentalCarPickupDropoffSmsParamsForRecipient,
  type RentalCarPickupDropoffSmsKind,
} from '@/lib/rentalCarPickupDropoffSms'
import {
  buildRentalCarPickupDropoffCards,
  rentalCarCardRecipients,
  rentalCarPickupDropoffTodayYmd,
  type RentalCarPickupDropoffCard,
  type TeamNameRow,
  type TourAssignmentRow,
  type VehicleRentalRow,
} from '@/lib/rentalCarPickupDropoffQueue'

type RecipientOverride = { email: string; smsBody?: string }

function isSmsKind(value: unknown): value is RentalCarPickupDropoffSmsKind {
  return value === 'pickup' || value === 'return' || value === 'airport_shuttle'
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const date = new Date(y, (m || 1) - 1, (d || 1) + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

async function loadCard(vehicleId: string, locale: string): Promise<RentalCarPickupDropoffCard | null> {
  const db = supabaseAdmin ?? supabase
  const today = rentalCarPickupDropoffTodayYmd()
  const fromDate = addDaysYmd(today, -7)
  const toDate = addDaysYmd(today, 1)

  const { data: vehiclesData, error: vehiclesErr } = await db
    .from('vehicles')
    .select(
      'id, vehicle_number, nick, status, vehicle_category, rental_company, rental_agreement_number, rental_start_date, rental_end_date, rental_pickup_location, rental_return_location, rental_pickup_time, rental_return_time, rental_reserved_by'
    )
    .eq('vehicle_category', 'rental')
    .lte('rental_start_date', today)
    .gte('rental_end_date', today)

  if (vehiclesErr) throw vehiclesErr
  const vehicles = (vehiclesData || []) as VehicleRentalRow[]
  if (!vehicles.some((v) => v.id === vehicleId)) return null

  const { data: toursData, error: toursErr } = await db
    .from('tours')
    .select(
      'id, tour_date, tour_status, tour_guide_id, assistant_id, tour_car_id, product_id, products(id, name, name_ko, name_en)'
    )
    .in(
      'tour_car_id',
      vehicles.map((v) => v.id)
    )
    .gte('tour_date', fromDate)
    .lte('tour_date', toDate)

  if (toursErr) throw toursErr
  const tours = ((toursData || []) as TourAssignmentRow[]).filter(
    (t) => !isTourDeleted(t.tour_status) && !isTourCancelled(t.tour_status)
  )

  const emails = [
    ...vehicles.map((v) => v.rental_reserved_by),
    ...tours.map((t) => t.tour_guide_id),
    ...tours.map((t) => t.assistant_id),
  ]
    .map((e) => String(e || '').trim())
    .filter(Boolean)

  const teamMap = new Map<string, TeamNameRow>()
  if (emails.length) {
    const { data: teamData } = await db
      .from('team')
      .select('email, name_ko, name_en, nick_name, display_name, phone, is_active, languages')
      .in('email', emails)
    for (const member of (teamData || []) as TeamNameRow[]) {
      const email = String(member.email || '').trim()
      if (!email) continue
      teamMap.set(email, member)
      teamMap.set(email.toLowerCase(), member)
    }
  }

  const cards = buildRentalCarPickupDropoffCards({ today, vehicles, tours, teamMap, locale })
  return (
    cards.pickups.find((c) => c.vehicleId === vehicleId) ||
    cards.returns.find((c) => c.vehicleId === vehicleId) ||
    null
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const vehicleId = typeof body.vehicleId === 'string' ? body.vehicleId.trim() : ''
    const locale = typeof body.locale === 'string' ? body.locale.trim() : 'ko'
    const kind = isSmsKind(body.kind) ? body.kind : null
    const continuingVehicleId =
      typeof body.continuingVehicleId === 'string' ? body.continuingVehicleId.trim() : null
    const recipientEmails =
      Array.isArray(body.recipientEmails) && body.recipientEmails.length > 0
        ? (body.recipientEmails as string[]).map((e) => e.trim().toLowerCase()).filter(Boolean)
        : null

    const overrideMap = new Map<string, string>()
    if (Array.isArray(body.recipientOverrides)) {
      for (const item of body.recipientOverrides as RecipientOverride[]) {
        if (!item || typeof item.email !== 'string') continue
        const smsBody = item.smsBody?.trim()
        if (smsBody) overrideMap.set(item.email.trim().toLowerCase(), smsBody)
      }
    }

    if (!vehicleId || !kind) {
      return NextResponse.json({ error: 'vehicleId와 kind가 필요합니다.' }, { status: 400 })
    }

    const card = await loadCard(vehicleId, locale)
    if (!card) {
      return NextResponse.json({ error: '오늘 픽업/반납 대상 렌터카를 찾을 수 없습니다.' }, { status: 404 })
    }

    const recipients = rentalCarCardRecipients(card, kind, continuingVehicleId).filter((r) =>
      recipientEmails ? recipientEmails.includes(r.email.toLowerCase()) : true
    )

    if (recipients.length === 0) {
      return NextResponse.json({ error: '발송 대상이 없습니다.' }, { status: 400 })
    }

    const continuing = card.continuingCrews.find((c) => c.vehicleId === continuingVehicleId) ?? card.continuingCrews[0]

    const results: Array<{ email: string; smsStatus: string; smsError?: string }> = []

    for (const recipient of recipients) {
      const smsBody =
        overrideMap.get(recipient.email.toLowerCase()) ||
        buildRentalCarPickupDropoffSms(
          kind,
          rentalCarPickupDropoffSmsParamsForRecipient({
            kind,
            recipient,
            card,
            continuingVehicleLabel: continuing?.vehicleLabel,
            fallbackLocale: locale.toLowerCase().startsWith('en') ? 'en' : 'ko',
          })
        )

      if (!smsBody.trim()) {
        return NextResponse.json({ error: 'SMS 내용이 비어 있습니다.' }, { status: 400 })
      }

      const phoneE164 = formatPhoneToE164(recipient.phone, 'US') || formatPhoneToE164(recipient.phone, 'KR')
      if (!phoneE164) {
        results.push({ email: recipient.email, smsStatus: 'failed', smsError: '전화번호 없음' })
        continue
      }

      const twilioResult = await sendTwilioSms(phoneE164, smsBody)
      if ('error' in twilioResult) {
        results.push({ email: recipient.email, smsStatus: 'failed', smsError: twilioResult.error })
      } else {
        results.push({ email: recipient.email, smsStatus: 'sent' })
      }
    }

    const sentCount = results.filter((r) => r.smsStatus === 'sent').length
    const failedCount = results.filter((r) => r.smsStatus === 'failed').length

    return NextResponse.json({
      success: sentCount > 0,
      message: `SMS ${sentCount}건 발송${failedCount > 0 ? `, 실패 ${failedCount}건` : ''}.`,
      results,
    })
  } catch (e) {
    console.error('[rental-car-pickup-dropoff/send]', e)
    return NextResponse.json({ error: '발송 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
