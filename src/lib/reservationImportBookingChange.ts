/**
 * 예약 가져오기: GYG 등 변경 메일에서 픽업 호텔을 기존 예약에 반영.
 * 신규 예약은 만들지 않는다.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExtractedReservationData } from '@/types/reservationImport'
import { tryAutoConfirmReservationImport } from '@/lib/autoConfirmReservationImport'
import {
  isGygBookingChangeEmail,
  isReservationImportBookingChange,
} from '@/lib/emailReservationParser'
import {
  isNotDecidedPickupHotel,
  isPickupHotelImportTextUnusable,
  isPickupImportNotDecidedLabel,
} from '@/lib/reservationImportPickup'
import { matchPickupHotelId } from '@/utils/reservationUtils'
import { expandChannelRnMatchVariants } from '@/utils/channelRnMatch'

export const AUTO_PICKUP_CHANGE_CONFIRMED_BY = 'system:email-auto-pickup-change'
export const MANUAL_PICKUP_CHANGE_CONFIRMED_BY = 'staff:email-pickup-change'

type PickupHotelCatalogRow = {
  id: string
  hotel?: string | null
  pick_up_location?: string | null
  address?: string | null
  internal_name?: string | null
}

function asExtracted(json: unknown): ExtractedReservationData {
  if (!json || typeof json !== 'object') return {}
  return json as ExtractedReservationData
}

function isCancelledStatus(status: string | null | undefined): boolean {
  const s = String(status || '').toLowerCase()
  return s === 'cancelled' || s === 'canceled' || s === 'deleted'
}

export type ApplyPickupChangeOutcome =
  | { handledAsChange: false; reason: string }
  | {
      handledAsChange: true
      ok: boolean
      reason: string
      reservation_id?: string
      pickup_hotel_id?: string
    }

async function loadPickupHotelCatalog(client: SupabaseClient): Promise<PickupHotelCatalogRow[]> {
  const { data } = await client
    .from('pickup_hotels')
    .select('id, hotel, pick_up_location, address, internal_name')
  return (data || []) as PickupHotelCatalogRow[]
}

async function findReservationByChannelRn(
  client: SupabaseClient,
  channelRn: string
): Promise<{
  id: string
  status: string | null
  pickup_hotel: string | null
  channel_rn: string | null
} | null> {
  const variants = expandChannelRnMatchVariants(channelRn)
  if (variants.length === 0) return null
  const { data } = await client
    .from('reservations')
    .select('id, status, pickup_hotel, channel_rn')
    .in('channel_rn', variants)
    .order('created_at', { ascending: false })
    .limit(8)
  const rows = (data || []) as Array<{
    id: string
    status: string | null
    pickup_hotel: string | null
    channel_rn: string | null
  }>
  const active = rows.find((row) => !isCancelledStatus(row.status))
  return active ?? rows[0] ?? null
}

async function markImportPickupChange(
  client: SupabaseClient,
  importId: string,
  extracted: ExtractedReservationData,
  args: {
    reservationId: string
    hotelId: string
    confirmedBy: string
    applied: boolean
    confirmImport: boolean
  }
): Promise<void> {
  const nextExtracted: ExtractedReservationData = {
    ...extracted,
    is_booking_change: true,
    is_booking_confirmed: false,
    pickup_change_applied: args.applied,
    pickup_change_applied_at: new Date().toISOString(),
    pickup_change_applied_hotel_id: args.hotelId,
  }
  const patch: Record<string, unknown> = {
    extracted_data: nextExtracted,
    reservation_id: args.reservationId,
    updated_at: new Date().toISOString(),
  }
  if (args.confirmImport) {
    patch.status = 'confirmed'
    patch.confirmed_by = args.confirmedBy
  }
  await client.from('reservation_imports').update(patch).eq('id', importId)
}

/**
 * 변경 메일이면 기존 예약의 픽업 호텔을 갱신하고, 신규 예약 자동 생성은 건너뛴다.
 */
export async function tryApplyReservationImportPickupChange(
  client: SupabaseClient,
  importId: string,
  options?: { hotelId?: string; source?: 'auto' | 'manual' }
): Promise<ApplyPickupChangeOutcome> {
  const source = options?.source ?? 'auto'
  const { data: row, error } = await client
    .from('reservation_imports')
    .select('id, status, platform_key, subject, source_email, raw_body_text, raw_body_html, extracted_data')
    .eq('id', importId)
    .maybeSingle()

  if (error || !row) return { handledAsChange: false, reason: 'not_found' }

  const ext = asExtracted(row.extracted_data)
  const body = `${row.raw_body_text || ''}\n${row.raw_body_html || ''}`
  const isChange =
    isReservationImportBookingChange({ subject: row.subject, extracted: ext }) ||
    isGygBookingChangeEmail(row.subject, body)

  if (!isChange) return { handledAsChange: false, reason: 'not_change' }

  const channelRn = String(ext.channel_rn || '').trim()
  if (!channelRn || channelRn.toLowerCase() === 'id') {
    return { handledAsChange: true, ok: false, reason: 'missing_channel_rn' }
  }

  const reservation = await findReservationByChannelRn(client, channelRn)
  if (!reservation) {
    return { handledAsChange: true, ok: false, reason: 'reservation_not_found' }
  }
  if (isCancelledStatus(reservation.status)) {
    return {
      handledAsChange: true,
      ok: false,
      reason: 'reservation_cancelled',
      reservation_id: reservation.id,
    }
  }

  if (source === 'auto' && ext.is_booking_change_request === true) {
    return {
      handledAsChange: true,
      ok: false,
      reason: 'change_request_needs_review',
      reservation_id: reservation.id,
    }
  }

  const hotels = await loadPickupHotelCatalog(client)
  const resolvedHotelId =
    options?.hotelId?.trim() ||
    (() => {
      const raw = String(ext.pickup_hotel || '').trim()
      if (!raw || isPickupHotelImportTextUnusable(raw) || isPickupImportNotDecidedLabel(raw)) {
        return null
      }
      return matchPickupHotelId(raw, hotels)
    })()

  if (!resolvedHotelId) {
    return {
      handledAsChange: true,
      ok: false,
      reason: 'pickup_unmatched',
      reservation_id: reservation.id,
    }
  }

  const confirmedBy =
    source === 'manual' ? MANUAL_PICKUP_CHANGE_CONFIRMED_BY : AUTO_PICKUP_CHANGE_CONFIRMED_BY

  if (reservation.pickup_hotel === resolvedHotelId) {
    await markImportPickupChange(client, importId, ext, {
      reservationId: reservation.id,
      hotelId: resolvedHotelId,
      confirmedBy,
      applied: true,
      confirmImport: true,
    })
    return {
      handledAsChange: true,
      ok: true,
      reason: 'already_same',
      reservation_id: reservation.id,
      pickup_hotel_id: resolvedHotelId,
    }
  }

  const currentIsUndecided = isNotDecidedPickupHotel(reservation.pickup_hotel, hotels)
  const pickupMarkedNew = (ext.booking_change_fields || []).includes('pickup_hotel')
  if (
    source === 'auto' &&
    reservation.pickup_hotel &&
    !currentIsUndecided &&
    reservation.pickup_hotel !== resolvedHotelId &&
    !pickupMarkedNew
  ) {
    return {
      handledAsChange: true,
      ok: false,
      reason: 'pickup_already_set',
      reservation_id: reservation.id,
      pickup_hotel_id: resolvedHotelId,
    }
  }

  const { error: updErr } = await client
    .from('reservations')
    .update({ pickup_hotel: resolvedHotelId })
    .eq('id', reservation.id)
  if (updErr) {
    return {
      handledAsChange: true,
      ok: false,
      reason: `update_failed:${updErr.message}`,
      reservation_id: reservation.id,
    }
  }

  await markImportPickupChange(client, importId, ext, {
    reservationId: reservation.id,
    hotelId: resolvedHotelId,
    confirmedBy,
    applied: true,
    confirmImport: true,
  })

  return {
    handledAsChange: true,
    ok: true,
    reason: source === 'manual' ? 'applied_manual' : 'applied_auto',
    reservation_id: reservation.id,
    pickup_hotel_id: resolvedHotelId,
  }
}

/** 파싱 저장 직후: 변경 메일이면 픽업 반영, 아니면 신규 예약 자동 추가 */
export async function processReservationImportAfterSave(
  client: SupabaseClient,
  importId: string
): Promise<{ kind: 'pickup_change' | 'auto_confirm' | 'none'; reason?: string }> {
  const pickup = await tryApplyReservationImportPickupChange(client, importId)
  if (pickup.handledAsChange) {
    return { kind: 'pickup_change', reason: pickup.reason }
  }
  const auto = await tryAutoConfirmReservationImport(client, importId)
  if (!auto.attempted) return { kind: 'none', reason: auto.reason }
  return { kind: 'auto_confirm', reason: auto.ok ? 'ok' : auto.reason }
}
