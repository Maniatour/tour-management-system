import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/database.types'
import { todoMatrixDedupeKey } from '@/lib/opTodoQueuePanelFilter'
import type { DailyReportTodoActivityItem } from '@/lib/dailyReport/types'

type JsonRecord = Record<string, unknown>

const CUSTOMER_INFO_REVIEW_FIELDS = [
  'customer_communication_channel',
  'pickup_hotel',
] as const

type CustomerInfoField = (typeof CUSTOMER_INFO_REVIEW_FIELDS)[number]

function asRecord(v: Json | null | undefined): JsonRecord {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  return v as JsonRecord
}

function str(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

function communicationChannelLabel(raw: string, isKo: boolean): string {
  const v = raw.trim().toLowerCase()
  const map: Record<string, [string, string]> = {
    no_reply: ['답변없음', 'No reply'],
    platform: ['플랫폼', 'Platform'],
    email: ['이메일', 'Email'],
    whatsapp: ['WhatsApp', 'WhatsApp'],
    text_message: ['문자', 'Text'],
    kakaotalk: ['카카오톡', 'KakaoTalk'],
    line: ['LINE', 'LINE'],
    phone_call: ['전화', 'Phone'],
    chatroom: ['채팅방', 'Chatroom'],
  }
  const pair = map[v]
  if (!pair) return raw || '—'
  return isKo ? pair[0] : pair[1]
}

function fieldLabel(field: CustomerInfoField, isKo: boolean): string {
  if (field === 'customer_communication_channel') {
    return isKo ? '소통 채널' : 'Comm. channel'
  }
  return isKo ? '픽업 호텔' : 'Pickup hotel'
}

function formatFieldValue(
  field: CustomerInfoField,
  raw: unknown,
  hotelNameById: Map<string, string>,
  isKo: boolean
): string {
  const value = str(raw)
  if (!value) return '—'
  if (field === 'customer_communication_channel') {
    return communicationChannelLabel(value, isKo)
  }
  return hotelNameById.get(value) || value
}

function overlapsCustomerInfoFields(changed: string[] | null | undefined): CustomerInfoField[] {
  if (!changed?.length) return []
  const set = new Set(changed)
  return CUSTOMER_INFO_REVIEW_FIELDS.filter((f) => set.has(f))
}

/**
 * 고객 정보 검수 관련 예약 필드 변경을 Daily Report 어코디언용으로 수집.
 * (소통 채널 · 픽업 호텔 — audit_logs 기준)
 */
export async function buildCustomerInfoReviewActivityItems(
  client: SupabaseClient<Database>,
  args: {
    rangeStartIso: string
    rangeEndIso: string
    staffNameForEmail: (email: string | null | undefined) => string | null
    locale?: string
    limit?: number
  }
): Promise<DailyReportTodoActivityItem[]> {
  const isKo = (args.locale ?? 'ko') !== 'en'
  const limit = args.limit ?? 400

  const { data, error } = await client
    .from('audit_logs')
    .select(
      'id, record_id, user_email, created_at, changed_fields, old_values, new_values'
    )
    .eq('table_name', 'reservations')
    .eq('action', 'UPDATE')
    .gte('created_at', args.rangeStartIso)
    .lte('created_at', args.rangeEndIso)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('daily-report customer-info activity audit:', error)
    return []
  }

  const rows = (data ?? []).filter((row) => overlapsCustomerInfoFields(row.changed_fields).length > 0)
  if (!rows.length) return []

  const customerIds = new Set<string>()
  const hotelIds = new Set<string>()
  const reservationIds = new Set<string>()

  for (const row of rows) {
    const rid = str(row.record_id)
    if (rid) reservationIds.add(rid)
    const oldR = asRecord(row.old_values)
    const newR = asRecord(row.new_values)
    for (const rec of [oldR, newR]) {
      const cid = str(rec.customer_id)
      if (cid) customerIds.add(cid)
      const hotel = str(rec.pickup_hotel)
      if (hotel) hotelIds.add(hotel)
    }
  }

  let reservationCustomerIds: Array<{ id: string; customer_id: string | null }> = []
  if (reservationIds.size) {
    const { data: reservationRows } = await client
      .from('reservations')
      .select('id, customer_id')
      .in('id', [...reservationIds])
    reservationCustomerIds = reservationRows ?? []
    for (const r of reservationCustomerIds) {
      const cid = (r.customer_id || '').trim()
      if (cid) customerIds.add(cid)
    }
  }

  const [customersRes, hotelsRes] = await Promise.all([
    customerIds.size
      ? client.from('customers').select('id, name').in('id', [...customerIds])
      : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }>, error: null }),
    hotelIds.size
      ? client.from('pickup_hotels').select('id, hotel, internal_name').in('id', [...hotelIds])
      : Promise.resolve({
          data: [] as Array<{ id: string; hotel: string | null; internal_name: string | null }>,
          error: null,
        }),
  ])

  const customerNameById = new Map<string, string>()
  for (const c of customersRes.data ?? []) {
    if (c.name?.trim()) customerNameById.set(c.id, c.name.trim())
  }

  const hotelNameById = new Map<string, string>()
  for (const h of hotelsRes.data ?? []) {
    const display = (h.internal_name || h.hotel || '').trim()
    if (display) hotelNameById.set(h.id, display)
  }

  const reservationCustomerName = new Map<string, string>()
  for (const r of reservationCustomerIds) {
    const viaId = r.customer_id ? customerNameById.get(r.customer_id) : null
    if (viaId) reservationCustomerName.set(r.id, viaId)
  }

  const items: DailyReportTodoActivityItem[] = []

  for (const row of rows) {
    const fields = overlapsCustomerInfoFields(row.changed_fields)
    if (!fields.length) continue
    const oldR = asRecord(row.old_values)
    const newR = asRecord(row.new_values)
    const changes = fields
      .map((field) => {
        const before = formatFieldValue(field, oldR[field], hotelNameById, isKo)
        const after = formatFieldValue(field, newR[field], hotelNameById, isKo)
        if (before === after) return null
        return {
          field,
          fieldLabel: fieldLabel(field, isKo),
          before,
          after,
        }
      })
      .filter((c): c is NonNullable<typeof c> => Boolean(c))

    if (!changes.length) continue

    const rid = str(row.record_id)
    const customerId = str(newR.customer_id) || str(oldR.customer_id)
    const subject =
      reservationCustomerName.get(rid) ||
      (customerId ? customerNameById.get(customerId) : null) ||
      (isKo ? '고객' : 'Customer')

    const email = (row.user_email || '').trim().toLowerCase() || null

    items.push({
      at: row.created_at,
      actorEmail: email,
      actorName: args.staffNameForEmail(email) || (email ? email.split('@')[0] : null),
      subject,
      changes,
    })
  }

  // 최신순 유지 (쿼리 이미 desc); 동일 시각 안정 정렬
  return items.sort((a, b) => {
    const ta = a.at ? Date.parse(a.at) : 0
    const tb = b.at ? Date.parse(b.at) : 0
    return tb - ta
  })
}

export function isCustomerInfoReviewTodoTitle(title: string): boolean {
  return todoMatrixDedupeKey(title) === todoMatrixDedupeKey('고객 정보 검수')
}
