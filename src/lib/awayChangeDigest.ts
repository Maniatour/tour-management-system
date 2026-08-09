import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/database.types'
import { getAssignmentStatusText, getStatusText } from '@/utils/tourStatusUtils'

export const AWAY_CHANGE_IDLE_MS_DEFAULT = 5 * 60 * 1000

export type AwayChangeDigestScope = {
  reservations?: boolean
  tours?: boolean
  bookings?: boolean
}

export type AwayChangeItemKind = 'reservation_audit' | 'tour_audit' | 'booking_history'

export type AwayChangeBadgeKind = 'capacity' | 'guide' | 'assistant' | 'vehicle'

export type AwayChangeBadge = {
  kind: AwayChangeBadgeKind
  text: string
}

export type AwayChangeDiffLine = {
  label: string
  beforeText: string
  afterText: string
}

export type AwayChangeItem = {
  kind: AwayChangeItemKind
  id: string
  at: string
  actor: string | null
  /** team.nick_name (없으면 null) */
  actorNickName: string | null
  action: string
  recordId: string
  /** 짧은 설명 (번역 키 조합용) */
  labelKey: 'reservation' | 'tour' | 'ticketBooking' | 'hotelBooking'
  /** 카드 본문 — 이미 locale 반영된 문자열 */
  headerTitle: string
  /** 예약: 고객명 · 인원 등 */
  headerSubtitle?: string
  headerBadges: AwayChangeBadge[]
  diffLines: AwayChangeDiffLine[]
  /** audit user_agent 의 cause:… (예: auto_tour_assign) */
  auditCause?: string | null
}

/** 시스템/미상 작성자 (표시용) */
export function isSystemActorEmail(email: string | null | undefined): boolean {
  const a = (email || '').trim().toLowerCase()
  return !a || a === 'system' || a === 'unknown' || a === '알 수 없음'
}

export function parseAuditCauseFromUserAgent(userAgent: string | null | undefined): string | null {
  const m = (userAgent || '').match(/cause:([a-z0-9_:-]+)/i)
  return m?.[1]?.trim() || null
}

type JsonRecord = Record<string, unknown>

const SKIP_DIFF_FIELDS = new Set([
  'updated_at',
  'created_at',
  'photos_extended_access',
  // booking_history 노이즈
  'id',
  'created_by',
  'submitted_by',
])

function hasMeaningfulAuditChanges(
  action: string,
  changedFields: string[] | null | undefined,
  oldR: JsonRecord,
  newR: JsonRecord
): boolean {
  const a = (action || '').toUpperCase()
  if (a === 'INSERT' || a === 'DELETE') return true
  const listed = (changedFields || []).filter((f) => f && !SKIP_DIFF_FIELDS.has(f))
  if (listed.length > 0) return true
  return Object.keys({ ...oldR, ...newR }).some(
    (k) => !SKIP_DIFF_FIELDS.has(k) && JSON.stringify(oldR[k]) !== JSON.stringify(newR[k])
  )
}

function normEmail(v: string | null | undefined): string {
  return (v || '').trim().toLowerCase()
}

function isOtherActor(actor: string | null, myEmail: string): boolean {
  const a = normEmail(actor)
  const me = normEmail(myEmail)
  if (!me) return true
  if (!a) return true
  return a !== me
}

function lo(locale: string, ko: string, en: string): string {
  return locale === 'en' ? en : ko
}

function asRecord(j: Json | null | undefined): JsonRecord {
  if (!j || typeof j !== 'object' || Array.isArray(j)) return {}
  return j as JsonRecord
}

function str(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function formatHeaderDate(iso: string | undefined, locale: string): string {
  const d = (iso || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d || '—'
  const [y, m, day] = d.split('-')
  if (locale === 'en') return `${m}/${day}/${y}`
  return `${y}.${m}.${day}`
}

function peopleLabel(n: unknown, locale: string): string {
  const num = typeof n === 'number' ? n : Number.parseInt(String(n), 10)
  if (!Number.isFinite(num)) return String(n ?? '—')
  return locale === 'en' ? `${num} pax` : `${num}인`
}

function reservationStatusLabel(status: unknown, locale: string): string {
  const s = str(status).toLowerCase()
  const mapKo: Record<string, string> = {
    inquiry: '문의',
    pending: '대기',
    confirmed: '확정',
    completed: '완료',
    cancelled: '취소',
    canceled: '취소',
    no_show: '노쇼',
    recruiting: '모집',
    deleted: '삭제',
    'payment requested': '입금요청',
  }
  const mapEn: Record<string, string> = {
    inquiry: 'Inquiry',
    pending: 'Pending',
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled',
    canceled: 'Cancelled',
    no_show: 'No-show',
    recruiting: 'Recruiting',
    deleted: 'Deleted',
    'payment requested': 'Payment requested',
  }
  const map = locale === 'en' ? mapEn : mapKo
  return map[s] || str(status) || '—'
}

function productName(
  productMap: Map<
    string,
    {
      name?: string | null
      name_ko?: string | null
      name_en?: string | null
      internal_name_ko?: string | null
      internal_name_en?: string | null
    }
  >,
  productId: unknown,
  locale: string
): string {
  const id = str(productId)
  if (!id) return '—'
  const p = productMap.get(id)
  if (!p) return id
  if (locale === 'en') {
    return str(p.internal_name_en || p.internal_name_ko || p.name_en || p.name || p.name_ko) || id
  }
  return str(p.internal_name_ko || p.internal_name_en || p.name_ko || p.name || p.name_en) || id
}

type TeamRow = { email: string; name_ko: string; nick_name: string | null }

function teamDisplayName(map: Map<string, TeamRow>, email: unknown, locale: string): string {
  const e = normEmail(str(email))
  if (!e) return lo(locale, '미배정', 'Unassigned')
  const row = map.get(e)
  if (!row) return str(email)
  const nick = str(row.nick_name)
  const name = str(row.name_ko)
  if (nick && name) return locale === 'en' ? `${name} (${nick})` : `${name} (${nick})`
  return name || nick || str(email)
}

function vehicleDisplay(map: Map<string, string>, id: unknown, locale: string): string {
  const raw = str(id)
  if (!raw) return lo(locale, '미배정', 'Unassigned')
  const label = map.get(raw) || map.get(raw.replace(/\s/g, ''))
  return label || raw
}

function collectEmailsFromTourRecord(r: JsonRecord): string[] {
  const out: string[] = []
  const g = str(r.tour_guide_id)
  const a = str(r.assistant_id)
  if (g) out.push(g)
  if (a) out.push(a)
  return out
}

function mergeFullRow(oldR: JsonRecord, newR: JsonRecord): JsonRecord {
  return { ...oldR, ...newR }
}

function snapshotForHeader(action: string, oldR: JsonRecord, newR: JsonRecord): JsonRecord {
  if (action === 'DELETE') return oldR
  return mergeFullRow(oldR, newR)
}

function idListCount(v: unknown): number {
  if (Array.isArray(v)) return v.filter((x) => x != null && String(x).trim()).length
  if (typeof v === 'string') {
    const t = v.trim()
    if (!t) return 0
    try {
      const parsed = JSON.parse(t)
      if (Array.isArray(parsed)) return parsed.filter((x) => x != null && String(x).trim()).length
    } catch {
      /* ignore */
    }
    return t.split(',').filter(Boolean).length
  }
  return 0
}

function orderedChangedFields(changed: string[] | null, table: 'tours' | 'reservations'): string[] {
  const raw = (changed || []).filter((f) => f && !SKIP_DIFF_FIELDS.has(f))
  const priority =
    table === 'tours'
      ? [
          'tour_status',
          'assignment_status',
          'reservation_ids',
          'max_participants',
          'tour_guide_id',
          'assistant_id',
          'tour_car_id',
          'guide_fee',
          'assistant_fee',
          'tour_date',
          'product_id',
          'tour_note',
          'tour_start_datetime',
          'tour_end_datetime',
          'team_type',
          'is_private_tour',
        ]
      : [
          'status',
          'pickup_time',
          'pickup_hotel',
          'pickup_notification_sent',
          'choices',
          'selected_options',
          'event_note',
          'total_people',
          'adults',
          'child',
          'infant',
          'tour_date',
          'product_id',
          'tour_id',
          'channel_rn',
          'tour_time',
        ]
  const rest = raw.filter((f) => !priority.includes(f)).sort()
  const head = priority.filter((f) => raw.includes(f))
  return [...head, ...rest]
}

function formatClockHm(raw: unknown): string {
  const s = str(raw)
  if (!s || s === '—') return '—'
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`
  if (/^\d{3,4}$/.test(s)) {
    const padded = s.padStart(4, '0')
    return `${padded.slice(0, 2)}:${padded.slice(2)}`
  }
  return s
}

function formatPrimitive(v: unknown, locale: string): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? (locale === 'en' ? 'Yes' : '예') : locale === 'en' ? 'No' : '아니오'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function buildTourDiffLines(args: {
  action: string
  oldR: JsonRecord
  newR: JsonRecord
  changed_fields: string[] | null
  teamMap: Map<string, TeamRow>
  vehicleMap: Map<string, string>
  productMap: Map<
    string,
    {
      name: string | null
      name_ko: string | null
      name_en: string | null
      internal_name_ko?: string | null
      internal_name_en?: string | null
    }
  >
  locale: string
}): AwayChangeDiffLine[] {
  const { action, oldR, newR, changed_fields, teamMap, vehicleMap, productMap, locale } = args
  if (action === 'INSERT') {
    return [
      {
        label: lo(locale, '생성', 'Created'),
        beforeText: '—',
        afterText: lo(locale, '새 투어 레코드가 추가되었습니다.', 'A new tour record was added.'),
      },
    ]
  }
  if (action === 'DELETE') {
    return [
      {
        label: lo(locale, '삭제', 'Deleted'),
        beforeText: lo(locale, '투어 데이터', 'Tour data'),
        afterText: lo(locale, '삭제됨', 'Removed'),
      },
    ]
  }
  let fields = orderedChangedFields(changed_fields, 'tours')
  if (!fields.length) {
    const computed = Object.keys({ ...oldR, ...newR }).filter(
      (k) => !SKIP_DIFF_FIELDS.has(k) && JSON.stringify(oldR[k]) !== JSON.stringify(newR[k])
    )
    fields = orderedChangedFields(computed, 'tours')
  }
  const lines: AwayChangeDiffLine[] = []
  for (const field of fields) {
    const before = oldR[field]
    const after = newR[field]
    if (JSON.stringify(before) === JSON.stringify(after)) continue
    let label = field
    let bText = formatPrimitive(before, locale)
    let aText = formatPrimitive(after, locale)
    switch (field) {
      case 'tour_status':
        label = lo(locale, '투어 상태', 'Tour status')
        bText = getStatusText(str(before), locale)
        aText = getStatusText(str(after), locale)
        break
      case 'assignment_status':
        label = lo(locale, '배정 상태', 'Assignment status')
        bText = getAssignmentStatusText({ assignment_status: str(before) }, locale)
        aText = getAssignmentStatusText({ assignment_status: str(after) }, locale)
        break
      case 'reservation_ids': {
        label = lo(locale, '예약 배정', 'Reservations')
        const bCount = idListCount(before)
        const aCount = idListCount(after)
        const delta = aCount - bCount
        const deltaText =
          delta === 0 ? '' : delta > 0 ? ` (+${delta})` : ` (${delta})`
        bText = locale === 'en' ? `${bCount}` : `${bCount}건`
        aText = locale === 'en' ? `${aCount}${deltaText}` : `${aCount}건${deltaText}`
        break
      }
      case 'max_participants':
        label = lo(locale, '투어 정원', 'Max participants')
        bText = peopleLabel(before, locale)
        aText = peopleLabel(after, locale)
        break
      case 'tour_guide_id':
        label = lo(locale, '가이드', 'Guide')
        bText = teamDisplayName(teamMap, before, locale)
        aText = teamDisplayName(teamMap, after, locale)
        break
      case 'assistant_id':
        label = lo(locale, '어시스턴트', 'Assistant')
        bText = teamDisplayName(teamMap, before, locale)
        aText = teamDisplayName(teamMap, after, locale)
        break
      case 'tour_car_id':
        label = lo(locale, '차량', 'Vehicle')
        bText = vehicleDisplay(vehicleMap, before, locale)
        aText = vehicleDisplay(vehicleMap, after, locale)
        break
      case 'guide_fee':
        label = lo(locale, '가이드비', 'Guide fee')
        bText = formatMoneyish(before, locale)
        aText = formatMoneyish(after, locale)
        break
      case 'assistant_fee':
        label = lo(locale, '어시스턴트비', 'Assistant fee')
        bText = formatMoneyish(before, locale)
        aText = formatMoneyish(after, locale)
        break
      case 'tour_note':
        label = lo(locale, '투어 메모', 'Tour note')
        bText = truncateText(formatPrimitive(before, locale), 40)
        aText = truncateText(formatPrimitive(after, locale), 40)
        break
      case 'tour_start_datetime':
        label = lo(locale, '시작 시각', 'Start time')
        break
      case 'tour_end_datetime':
        label = lo(locale, '종료 시각', 'End time')
        break
      case 'team_type':
        label = lo(locale, '팀 유형', 'Team type')
        break
      case 'is_private_tour':
        label = lo(locale, '프라이빗 투어', 'Private tour')
        bText = formatPrimitive(before, locale)
        aText = formatPrimitive(after, locale)
        break
      case 'tour_date':
        label = lo(locale, '투어일', 'Tour date')
        bText = formatHeaderDate(str(before), locale)
        aText = formatHeaderDate(str(after), locale)
        break
      case 'product_id':
        label = lo(locale, '상품', 'Product')
        bText = productName(productMap, before, locale)
        aText = productName(productMap, after, locale)
        break
      default:
        label = `${field}`
        break
    }
    lines.push({ label, beforeText: bText, afterText: aText })
  }
  return lines
}

function formatMoneyish(v: unknown, locale: string): string {
  if (v === null || v === undefined || v === '') return '—'
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v))
  if (!Number.isFinite(n)) return formatPrimitive(v, locale)
  return `$${n}`
}

function truncateText(s: string, max: number): string {
  const t = (s || '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

/** 예약 JSON(choices / selected_options 등)의 ID를 사람이 읽을 수 있는 라벨로 바꿀 때 사용 */
type AwayChoiceFormatCtx = {
  choiceGroupById: Map<string, { ko: string; en: string }>
  optionById: Map<string, { ko: string; en: string }>
}

function harvestChoiceOptionIdsFromReservationRecord(
  rec: JsonRecord,
  choiceIds: Set<string>,
  optionIds: Set<string>
): void {
  const ch = rec.choices
  if (ch && typeof ch === 'object' && !Array.isArray(ch)) {
    const req = (ch as { required?: unknown }).required
    if (Array.isArray(req)) {
      for (const item of req) {
        if (!item || typeof item !== 'object') continue
        const o = item as Record<string, unknown>
        const cid = str(o.choice_id)
        const oid = str(o.option_id)
        if (cid) choiceIds.add(cid)
        if (oid && oid !== '__undecided__') optionIds.add(oid)
      }
    }
  }
  const so = rec.selected_options
  if (so && typeof so === 'object' && !Array.isArray(so)) {
    for (const [k, val] of Object.entries(so as Record<string, unknown>)) {
      if (k) choiceIds.add(k)
      const vals = Array.isArray(val) ? val : val != null ? [val] : []
      for (const v of vals) {
        const s = str(v)
        if (s && s !== '__undecided__') optionIds.add(s)
      }
    }
  }
  const sop = rec.selected_option_prices
  if (sop && typeof sop === 'object' && !Array.isArray(sop)) {
    for (const k of Object.keys(sop as Record<string, unknown>)) {
      if (k) optionIds.add(k)
    }
  }
}

function choiceGroupLabel(ctx: AwayChoiceFormatCtx, choiceId: string, locale: string): string {
  const row = ctx.choiceGroupById.get(choiceId)
  if (!row) return choiceId || '—'
  if (locale === 'en') return str(row.en || row.ko) || choiceId
  return str(row.ko || row.en) || choiceId
}

function optionDisplayLabel(ctx: AwayChoiceFormatCtx, optionId: string, locale: string): string {
  if (optionId === '__undecided__') return lo(locale, '미정', 'Undecided')
  const row = ctx.optionById.get(optionId)
  if (!row) return optionId || '—'
  if (locale === 'en') return str(row.en || row.ko) || optionId
  return str(row.ko || row.en) || optionId
}

function formatReservationSelectedOptions(v: unknown, ctx: AwayChoiceFormatCtx, locale: string): string {
  if (v === null || v === undefined) return '—'
  if (typeof v !== 'object' || Array.isArray(v)) return formatPrimitive(v, locale)
  const o = v as Record<string, unknown>
  const keys = Object.keys(o)
  if (!keys.length) return '—'
  const parts: string[] = []
  for (const choiceKey of keys) {
    const group = choiceGroupLabel(ctx, choiceKey, locale)
    const rawVal = o[choiceKey]
    const vals = Array.isArray(rawVal) ? rawVal : rawVal != null ? [rawVal] : []
    const opts = vals
      .map((x) => optionDisplayLabel(ctx, str(x), locale))
      .filter((s) => s && s !== '—')
    parts.push(`${group}: ${opts.length ? opts.join(', ') : '—'}`)
  }
  return parts.join(locale === 'en' ? '; ' : ' · ')
}

function formatReservationSelectedOptionPrices(v: unknown, ctx: AwayChoiceFormatCtx, locale: string): string {
  if (v === null || v === undefined) return '—'
  if (typeof v !== 'object' || Array.isArray(v)) return formatPrimitive(v, locale)
  const o = v as Record<string, unknown>
  const keys = Object.keys(o)
  if (!keys.length) return '—'
  const parts: string[] = []
  for (const k of keys) {
    const label = optionDisplayLabel(ctx, k, locale)
    parts.push(`${label}: ${o[k]}`)
  }
  return parts.join(locale === 'en' ? '; ' : ' · ')
}

function pickupHotelDisplayName(
  hotelMap: Map<string, string>,
  raw: unknown
): string {
  const key = str(raw)
  if (!key) return '—'
  return hotelMap.get(key) || hotelMap.get(key.toLowerCase()) || key
}

function choiceOptionNamesFromValue(v: unknown, locale: string): string[] {
  if (!v || typeof v !== 'object') return []
  const required = (v as { required?: unknown }).required
  const list = Array.isArray(required) ? required : Array.isArray(v) ? v : []
  const names: string[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const name =
      locale === 'en'
        ? str(o.option_name_en || o.option_name || o.option_name_ko)
        : str(o.option_name_ko || o.option_name || o.option_name_en)
    if (name) names.push(name)
  }
  return names
}

function summarizeChoicesChange(before: unknown, after: unknown, locale: string): {
  beforeText: string
  afterText: string
} {
  const bNames = choiceOptionNamesFromValue(before, locale)
  const aNames = choiceOptionNamesFromValue(after, locale)
  if (bNames.length || aNames.length) {
    const bSet = new Set(bNames)
    const aSet = new Set(aNames)
    const removed = bNames.filter((n) => !aSet.has(n))
    const added = aNames.filter((n) => !bSet.has(n))
    if (removed.length || added.length) {
      const parts: string[] = []
      if (removed.length) {
        parts.push(
          locale === 'en' ? `removed ${removed.join(', ')}` : `제거 ${removed.join(', ')}`
        )
      }
      if (added.length) {
        parts.push(locale === 'en' ? `added ${added.join(', ')}` : `추가 ${added.join(', ')}`)
      }
      return { beforeText: '—', afterText: parts.join(locale === 'en' ? '; ' : ' · ') }
    }
    return {
      beforeText: bNames.join(', ') || '—',
      afterText: aNames.join(', ') || '—',
    }
  }
  return {
    beforeText: truncateText(formatPrimitive(before, locale), 48),
    afterText: truncateText(formatPrimitive(after, locale), 48),
  }
}

function buildReservationDiffLines(args: {
  action: string
  oldR: JsonRecord
  newR: JsonRecord
  changed_fields: string[] | null
  productMap: Map<string, { name: string | null; name_ko: string | null; name_en: string | null }>
  choiceFormatCtx: AwayChoiceFormatCtx
  hotelMap: Map<string, string>
  locale: string
}): AwayChangeDiffLine[] {
  const { action, oldR, newR, changed_fields, productMap, choiceFormatCtx, hotelMap, locale } = args
  if (action === 'INSERT') {
    const snap = Object.keys(newR).length ? newR : oldR
    const lines: AwayChangeDiffLine[] = [
      {
        label: lo(locale, '예약 생성', 'Reservation created'),
        beforeText: '—',
        afterText: reservationStatusLabel(snap.status, locale),
      },
    ]
    if (snap.total_people != null) {
      lines.push({
        label: lo(locale, '인원', 'Party'),
        beforeText: '—',
        afterText: peopleLabel(snap.total_people, locale),
      })
    }
    return lines.slice(0, 3)
  }
  if (action === 'DELETE') {
    return [
      {
        label: lo(locale, '예약 삭제', 'Reservation deleted'),
        beforeText: lo(locale, '예약 데이터', 'Reservation data'),
        afterText: '—',
      },
    ]
  }
  let fields = orderedChangedFields(changed_fields, 'reservations')
  if (!fields.length) {
    const computed = Object.keys({ ...oldR, ...newR }).filter(
      (k) => !SKIP_DIFF_FIELDS.has(k) && JSON.stringify(oldR[k]) !== JSON.stringify(newR[k])
    )
    fields = orderedChangedFields(computed, 'reservations')
  }
  const lines: AwayChangeDiffLine[] = []
  for (const field of fields) {
    const before = oldR[field]
    const after = newR[field]
    if (JSON.stringify(before) === JSON.stringify(after)) continue
    let label = field
    let bText = formatPrimitive(before, locale)
    let aText = formatPrimitive(after, locale)
    switch (field) {
      case 'status':
        label = lo(locale, '예약 상태', 'Reservation status')
        bText = reservationStatusLabel(before, locale)
        aText = reservationStatusLabel(after, locale)
        break
      case 'total_people':
        label = lo(locale, '예약 인원', 'Party size')
        bText = peopleLabel(before, locale)
        aText = peopleLabel(after, locale)
        break
      case 'adults':
        label = lo(locale, '성인', 'Adults')
        bText = peopleLabel(before, locale)
        aText = peopleLabel(after, locale)
        break
      case 'child':
        label = lo(locale, '아동', 'Children')
        bText = peopleLabel(before, locale)
        aText = peopleLabel(after, locale)
        break
      case 'infant':
        label = lo(locale, '유아', 'Infants')
        bText = peopleLabel(before, locale)
        aText = peopleLabel(after, locale)
        break
      case 'tour_date':
        label = lo(locale, '투어일', 'Tour date')
        bText = formatHeaderDate(str(before), locale)
        aText = formatHeaderDate(str(after), locale)
        break
      case 'product_id':
        label = lo(locale, '상품', 'Product')
        bText = productName(productMap, before, locale)
        aText = productName(productMap, after, locale)
        break
      case 'tour_id':
        label = lo(locale, '연결 투어', 'Linked tour')
        bText = str(before) || '—'
        aText = str(after) || '—'
        break
      case 'pickup_time':
        label = lo(locale, '픽업시간 변경', 'Pickup time changed')
        bText = formatClockHm(before)
        aText = formatClockHm(after)
        break
      case 'pickup_hotel':
        label = lo(locale, '픽업 호텔', 'Pickup hotel')
        bText = pickupHotelDisplayName(hotelMap, before)
        aText = pickupHotelDisplayName(hotelMap, after)
        break
      case 'pickup_notification_sent':
        label = lo(locale, '픽업 안내 발송', 'Pickup notice sent')
        bText = formatPrimitive(before, locale)
        aText = formatPrimitive(after, locale)
        break
      case 'event_note':
        label = lo(locale, '이벤트 메모', 'Event note')
        bText = truncateText(formatPrimitive(before, locale), 40)
        aText = truncateText(formatPrimitive(after, locale), 40)
        break
      case 'channel_rn':
        label = lo(locale, '채널 RN', 'Channel RN')
        break
      case 'tour_time':
        label = lo(locale, '투어 시간', 'Tour time')
        bText = formatClockHm(before)
        aText = formatClockHm(after)
        break
      case 'choices': {
        label = lo(locale, '초이스', 'Choices')
        const summarized = summarizeChoicesChange(before, after, locale)
        bText = summarized.beforeText
        aText = summarized.afterText
        break
      }
      case 'selected_options':
        label = lo(locale, '선택 옵션', 'Selected options')
        bText = truncateText(
          formatReservationSelectedOptions(before, choiceFormatCtx, locale),
          48
        )
        aText = truncateText(
          formatReservationSelectedOptions(after, choiceFormatCtx, locale),
          48
        )
        break
      case 'selected_option_prices':
        label = lo(locale, '옵션 가격', 'Option prices')
        bText = truncateText(
          formatReservationSelectedOptionPrices(before, choiceFormatCtx, locale),
          48
        )
        aText = truncateText(
          formatReservationSelectedOptionPrices(after, choiceFormatCtx, locale),
          48
        )
        break
      default:
        break
    }
    lines.push({ label, beforeText: bText, afterText: aText })
  }
  return lines
}

function buildTourBadges(
  snap: JsonRecord,
  teamMap: Map<string, TeamRow>,
  vehicleMap: Map<string, string>,
  locale: string
): AwayChangeBadge[] {
  const cap = snap.max_participants
  return [
    { kind: 'capacity', text: peopleLabel(cap, locale) },
    { kind: 'guide', text: teamDisplayName(teamMap, snap.tour_guide_id, locale) },
    { kind: 'assistant', text: teamDisplayName(teamMap, snap.assistant_id, locale) },
    { kind: 'vehicle', text: vehicleDisplay(vehicleMap, snap.tour_car_id, locale) },
  ]
}

type TourCtxRow = {
  id: string
  tour_date: string
  max_participants: number
  tour_guide_id: string | null
  assistant_id: string | null
  tour_car_id: string | null
  product_id: string | null
}

async function enrichAuditItems(
  supabase: SupabaseClient<Database>,
  rows: Array<{
    id: string
    table_name: string
    record_id: string
    action: string
    user_email: string | null
    created_at: string | null
    changed_fields: string[] | null
    old_values: Json | null
    new_values: Json | null
    user_agent?: string | null
  }>,
  locale: string
): Promise<AwayChangeItem[]> {
  if (!rows.length) return []

  const oldRecords = rows.map((r) => asRecord(r.old_values))
  const newRecords = rows.map((r) => asRecord(r.new_values))

  const actorEmails = [
    ...new Set(
      rows
        .map((r) => normEmail(r.user_email))
        .filter((e) => e && !isSystemActorEmail(e))
    ),
  ]
  const productIds = new Set<string>()
  const customerIds = new Set<string>()
  const tourIds = new Set<string>()
  const teamEmails = new Set<string>()
  const vehicleIds = new Set<string>()
  const pickupHotelKeys = new Set<string>()

  for (let i = 0; i < rows.length; i++) {
    const table = rows[i].table_name
    const oldR = oldRecords[i]
    const newR = newRecords[i]
    if (table === 'tours') {
      ;[oldR, newR].forEach((rec) => {
        if (str(rec.product_id)) productIds.add(str(rec.product_id))
        collectEmailsFromTourRecord(rec).forEach((e) => teamEmails.add(normEmail(e)))
        const vid = str(rec.tour_car_id)
        if (vid) vehicleIds.add(vid)
      })
    } else {
      ;[oldR, newR].forEach((rec) => {
        if (str(rec.product_id)) productIds.add(str(rec.product_id))
        if (str(rec.customer_id)) customerIds.add(str(rec.customer_id))
        const tid = str(rec.tour_id)
        if (tid) tourIds.add(tid)
        const hotel = str(rec.pickup_hotel)
        if (hotel) pickupHotelKeys.add(hotel)
      })
    }
  }

  actorEmails.forEach((e) => teamEmails.add(e))

  const customerIdList = [...customerIds]
  const tourIdList = [...tourIds]

  const tourCtxMap = new Map<string, TourCtxRow>()
  if (tourIdList.length) {
    const { data: toursData } = await supabase
      .from('tours')
      .select('id, tour_date, max_participants, tour_guide_id, assistant_id, tour_car_id, product_id')
      .in('id', tourIdList)
    for (const t of toursData || []) {
      const row = t as TourCtxRow
      tourCtxMap.set(str(row.id), row)
      if (str(row.product_id)) productIds.add(str(row.product_id))
      collectEmailsFromTourRecord(row as unknown as JsonRecord).forEach((e) => teamEmails.add(normEmail(e)))
      const vid = str(row.tour_car_id)
      if (vid) vehicleIds.add(vid)
    }
  }

  const teamEmailListFinal = [...teamEmails].filter(Boolean)
  const productIdListFinal = [...productIds]
  const vehicleIdListFinal = [...vehicleIds]
  const pickupHotelKeyList = [...pickupHotelKeys]

  const [teamRes, productsRes, customersRes, vehiclesRes, hotelsByIdRes, hotelsByNameRes, hotelsByInternalRes] =
    await Promise.all([
    teamEmailListFinal.length
      ? supabase.from('team').select('email, name_ko, nick_name').in('email', teamEmailListFinal)
      : Promise.resolve({ data: [] as TeamRow[], error: null }),
    productIdListFinal.length
      ? supabase
          .from('products')
          .select('id, name, name_ko, name_en, internal_name_ko, internal_name_en')
          .in('id', productIdListFinal)
      : Promise.resolve({
          data: [] as Array<{
            id: string
            name: string | null
            name_ko: string | null
            name_en: string | null
            internal_name_ko?: string | null
            internal_name_en?: string | null
          }>,
          error: null,
        }),
    customerIdList.length
      ? supabase.from('customers').select('id, name').in('id', customerIdList)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }>, error: null }),
    vehicleIdListFinal.length
      ? supabase.from('vehicles').select('id, vehicle_number').in('id', vehicleIdListFinal)
      : Promise.resolve({ data: [] as Array<{ id: string; vehicle_number: string }>, error: null }),
    pickupHotelKeyList.length
      ? supabase
          .from('pickup_hotels')
          .select('id, hotel, internal_name')
          .in('id', pickupHotelKeyList)
      : Promise.resolve({
          data: [] as Array<{ id: string; hotel: string; internal_name: string | null }>,
          error: null,
        }),
    pickupHotelKeyList.length
      ? supabase
          .from('pickup_hotels')
          .select('id, hotel, internal_name')
          .in('hotel', pickupHotelKeyList)
      : Promise.resolve({
          data: [] as Array<{ id: string; hotel: string; internal_name: string | null }>,
          error: null,
        }),
    pickupHotelKeyList.length
      ? supabase
          .from('pickup_hotels')
          .select('id, hotel, internal_name')
          .in('internal_name', pickupHotelKeyList)
      : Promise.resolve({
          data: [] as Array<{ id: string; hotel: string; internal_name: string | null }>,
          error: null,
        }),
  ])

  const teamMap = new Map<string, TeamRow>()
  for (const m of teamRes.data || []) {
    teamMap.set(normEmail(m.email), m as TeamRow)
  }

  if (productsRes.error) {
    console.error('enrichAuditItems products:', productsRes.error)
  }

  const productMap = new Map<
    string,
    {
      name: string | null
      name_ko: string | null
      name_en: string | null
      internal_name_ko?: string | null
      internal_name_en?: string | null
    }
  >()
  for (const p of productsRes.data || []) {
    productMap.set(p.id, p)
  }

  const customerMap = new Map<string, string>()
  for (const c of customersRes.data || []) {
    customerMap.set(c.id, c.name)
  }

  const vehicleMap = new Map<string, string>()
  for (const v of vehiclesRes.data || []) {
    vehicleMap.set(str(v.id), str(v.vehicle_number))
  }

  const hotelMap = new Map<string, string>()
  const addHotelMapping = (h: { id: string; hotel: string; internal_name: string | null }) => {
    const display = str(h.internal_name) || str(h.hotel)
    if (!display) return
    if (str(h.id)) {
      hotelMap.set(str(h.id), display)
      hotelMap.set(str(h.id).toLowerCase(), display)
    }
    if (str(h.hotel)) {
      hotelMap.set(str(h.hotel), display)
      hotelMap.set(str(h.hotel).toLowerCase(), display)
    }
    if (str(h.internal_name)) {
      hotelMap.set(str(h.internal_name), display)
      hotelMap.set(str(h.internal_name).toLowerCase(), display)
    }
  }
  for (const h of hotelsByIdRes.data || []) addHotelMapping(h)
  for (const h of hotelsByNameRes.data || []) addHotelMapping(h)
  for (const h of hotelsByInternalRes.data || []) addHotelMapping(h)

  const reservationChoiceIds = new Set<string>()
  const reservationOptionIds = new Set<string>()
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].table_name !== 'reservations') continue
    harvestChoiceOptionIdsFromReservationRecord(oldRecords[i], reservationChoiceIds, reservationOptionIds)
    harvestChoiceOptionIdsFromReservationRecord(newRecords[i], reservationChoiceIds, reservationOptionIds)
  }

  const choiceIdList = [...reservationChoiceIds]
  const optionIdList = [...reservationOptionIds]

  const [{ data: productChoicesData }, { data: choiceOptionsData }] = await Promise.all([
    choiceIdList.length
      ? supabase
          .from('product_choices')
          .select('id, choice_group_ko, choice_group_en, choice_group')
          .in('id', choiceIdList)
      : Promise.resolve({ data: [] as Array<{ id: string; choice_group_ko: string; choice_group_en: string | null; choice_group: string }>, error: null }),
    optionIdList.length
      ? supabase
          .from('choice_options')
          .select('id, choice_id, option_name, option_name_ko')
          .in('id', optionIdList)
      : Promise.resolve({ data: [] as Array<{ id: string; choice_id: string | null; option_name: string; option_name_ko: string }>, error: null }),
  ])

  const choiceFormatCtx: AwayChoiceFormatCtx = {
    choiceGroupById: new Map(),
    optionById: new Map(),
  }
  for (const pc of productChoicesData || []) {
    choiceFormatCtx.choiceGroupById.set(str(pc.id), {
      ko: str(pc.choice_group_ko || pc.choice_group),
      en: str(pc.choice_group_en || pc.choice_group || pc.choice_group_ko),
    })
  }
  for (const co of choiceOptionsData || []) {
    choiceFormatCtx.optionById.set(str(co.id), {
      ko: str(co.option_name_ko || co.option_name),
      en: str(co.option_name || co.option_name_ko),
    })
  }

  const items: AwayChangeItem[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const oldR = oldRecords[i]
    const newR = newRecords[i]
    if (
      !hasMeaningfulAuditChanges(row.action, row.changed_fields, oldR, newR)
    ) {
      continue
    }
    const systemActor = isSystemActorEmail(row.user_email)
    const actor = systemActor ? 'system' : row.user_email
    const actorNick = systemActor
      ? null
      : actor
        ? teamMap.get(normEmail(actor))?.nick_name?.trim() || null
        : null
    const auditCause = parseAuditCauseFromUserAgent(row.user_agent)

    if (row.table_name === 'tours') {
      const snap = snapshotForHeader(row.action, oldR, newR)
      const pname = productName(productMap, snap.product_id, locale)
      const d = formatHeaderDate(str(snap.tour_date), locale)
      const headerTitle = `${d} ${pname}${locale === 'en' ? ' tour' : ' 투어'}`
      const headerBadges = buildTourBadges(snap, teamMap, vehicleMap, locale)
      const diffLines = buildTourDiffLines({
        action: row.action,
        oldR,
        newR,
        changed_fields: row.changed_fields,
        teamMap,
        vehicleMap,
        productMap,
        locale,
      })
      items.push({
        kind: 'tour_audit',
        id: row.id,
        at: row.created_at || new Date().toISOString(),
        actor,
        actorNickName: actorNick,
        action: row.action,
        recordId: String(row.record_id),
        labelKey: 'tour',
        headerTitle,
        headerBadges,
        diffLines,
        auditCause,
      })
    } else {
      const snap = snapshotForHeader(row.action, oldR, newR)
      const custName = customerMap.get(str(snap.customer_id)) || lo(locale, '고객', 'Customer')
      const totalP = snap.total_people
      const headerSubtitle =
        locale === 'en'
          ? `${custName} · ${peopleLabel(totalP, locale)}`
          : `${custName} · 예약 ${peopleLabel(totalP, locale)}`

      const tourId = str(snap.tour_id)
      let headerTitle: string
      let headerBadges: AwayChangeBadge[]

      if (tourId && tourCtxMap.has(tourId)) {
        const trow = tourCtxMap.get(tourId)!
        const tourSnap = trow as unknown as JsonRecord
        const pname = productName(productMap, trow.product_id, locale)
        const d = formatHeaderDate(str(trow.tour_date), locale)
        headerTitle = `${d} ${pname}${locale === 'en' ? ' tour' : ' 투어'}`
        headerBadges = buildTourBadges(tourSnap, teamMap, vehicleMap, locale)
      } else {
        const pname = productName(productMap, snap.product_id, locale)
        const d = formatHeaderDate(str(snap.tour_date), locale)
        headerTitle = `${d} ${pname}${locale === 'en' ? ' tour' : ' 투어'}`
        const dash = '—'
        headerBadges = [
          { kind: 'capacity', text: lo(locale, '투어 미연결', 'No linked tour') },
          { kind: 'guide', text: dash },
          { kind: 'assistant', text: dash },
          { kind: 'vehicle', text: dash },
        ]
      }

      const diffLines = buildReservationDiffLines({
        action: row.action,
        oldR,
        newR,
        changed_fields: row.changed_fields,
        productMap,
        choiceFormatCtx,
        hotelMap,
        locale,
      })

      items.push({
        kind: 'reservation_audit',
        id: row.id,
        at: row.created_at || new Date().toISOString(),
        actor,
        actorNickName: actorNick,
        action: row.action,
        recordId: String(row.record_id),
        labelKey: 'reservation',
        headerTitle,
        headerSubtitle,
        headerBadges,
        diffLines,
        auditCause,
      })
    }
  }

  return items
}

function normalizeBookingHistoryAction(action: string): 'INSERT' | 'UPDATE' | 'DELETE' | string {
  const a = (action || '').trim().toLowerCase()
  if (a === 'insert' || a === 'created' || a === 'create') return 'INSERT'
  if (a === 'update' || a === 'updated' || a === 'confirmed' || a === 'cancelled') return 'UPDATE'
  if (a === 'delete' || a === 'deleted' || a === 'remove' || a === 'removed') return 'DELETE'
  return (action || '').toUpperCase()
}

/** ticket/hotel booking_history 주요 필드 라벨 */
function bookingFieldLabel(key: string, locale: string): string {
  const map: Record<string, [string, string]> = {
    status: ['상태', 'Status'],
    booking_status: ['예약 상태', 'Booking status'],
    change_status: ['변경 상태', 'Change status'],
    payment_status: ['결제 상태', 'Payment status'],
    refund_status: ['환불 상태', 'Refund status'],
    vendor_status: ['벤더 상태', 'Vendor status'],
    operation_status: ['운영 상태', 'Operation status'],
    rn_number: ['RN#', 'RN#'],
    company: ['업체', 'Vendor'],
    category: ['카테고리', 'Category'],
    ea: ['수량', 'Qty'],
    pending_ea: ['대기 수량', 'Pending qty'],
    quantity: ['수량', 'Qty'],
    adult_count: ['성인', 'Adults'],
    child_count: ['아동', 'Children'],
    expense: ['비용', 'Expense'],
    paid_amount: ['결제액', 'Paid'],
    time: ['시간', 'Time'],
    pending_time: ['대기 시간', 'Pending time'],
    ticket_time: ['시간', 'Time'],
    check_in_date: ['입장일', 'Check-in'],
    tour_date: ['투어일', 'Tour date'],
    tour_id: ['연결 투어', 'Linked tour'],
    notes: ['메모', 'Notes'],
    note: ['메모', 'Notes'],
    submitted_by: ['제출자', 'Submitted by'],
  }
  const pair = map[key]
  if (pair) return lo(locale, pair[0], pair[1])
  return key
}

function formatTicketQty(ea: unknown, locale: string): string {
  const n = typeof ea === 'number' ? ea : Number.parseFloat(String(ea ?? ''))
  if (!Number.isFinite(n)) return ''
  return locale === 'en' ? `${n} tix` : `${n}장`
}

function formatTicketTime(raw: unknown): string {
  const s = str(raw)
  if (!s) return ''
  // "10:00:00" / "10:00" / "1000"
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`
  if (/^\d{3,4}$/.test(s)) {
    const padded = s.padStart(4, '0')
    return `${padded.slice(0, 2)}:${padded.slice(2)}`
  }
  return s
}

/** 짧은 날짜: 8/10/26 */
function formatShortMdY(iso: string | undefined): string {
  const d = (iso || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d || ''
  const [y, m, day] = d.split('-')
  return `${Number(m)}/${Number(day)}/${y.slice(2)}`
}

function bookingSnapshot(oldR: JsonRecord, newR: JsonRecord): JsonRecord {
  return Object.keys(newR).length ? newR : oldR
}

function buildTicketBookingHeaderTitle(
  snap: JsonRecord,
  locale: string,
  tourLabel: string | null
): string {
  const date = formatShortMdY(str(snap.check_in_date || snap.tour_date))
  const time = formatTicketTime(snap.time || snap.pending_time || snap.ticket_time)
  const company = str(snap.company) || str(snap.category)
  const qty = formatTicketQty(snap.ea ?? snap.pending_ea ?? snap.quantity, locale)
  const parts = [date, time, company, qty].filter(Boolean)
  let title =
    parts.length > 0
      ? parts.join(' ')
      : lo(locale, '티켓 부킹', 'Ticket booking')
  if (tourLabel) {
    title = `${title} · ${locale === 'en' ? 'Tour' : '투어'} ${tourLabel}`
  }
  return title
}

function buildHotelBookingHeaderTitle(snap: JsonRecord, locale: string): string {
  const date = formatShortMdY(str(snap.check_in_date || snap.tour_date))
  const company = str(snap.company) || str(snap.hotel_name) || str(snap.category)
  const parts = [date, company].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : lo(locale, '호텔 부킹', 'Hotel booking')
}

function diffJsonObjects(
  oldV: JsonRecord,
  newV: JsonRecord,
  locale: string
): AwayChangeDiffLine[] {
  const keys = new Set([...Object.keys(oldV), ...Object.keys(newV)])
  const priority = [
    'booking_status',
    'vendor_status',
    'change_status',
    'payment_status',
    'refund_status',
    'operation_status',
    'status',
    'ea',
    'pending_ea',
    'time',
    'pending_time',
    'check_in_date',
    'company',
    'rn_number',
    'tour_id',
  ]
  const ordered = [
    ...priority.filter((k) => keys.has(k)),
    ...[...keys].sort().filter((k) => !priority.includes(k)),
  ]
  const lines: AwayChangeDiffLine[] = []
  for (const k of ordered) {
    if (SKIP_DIFF_FIELDS.has(k)) continue
    // 헤더에 이미 넣는 맥락 필드는 변경될 때만 표시
    const before = oldV[k]
    const after = newV[k]
    if (JSON.stringify(before) === JSON.stringify(after)) continue
    let beforeText = formatPrimitive(before, locale)
    let afterText = formatPrimitive(after, locale)
    if (k === 'ea' || k === 'pending_ea' || k === 'quantity') {
      beforeText = formatTicketQty(before, locale) || beforeText
      afterText = formatTicketQty(after, locale) || afterText
    }
    if (k === 'time' || k === 'pending_time' || k === 'ticket_time') {
      beforeText = formatTicketTime(before) || beforeText
      afterText = formatTicketTime(after) || afterText
    }
    if (k === 'check_in_date' || k === 'tour_date') {
      beforeText = formatShortMdY(str(before)) || beforeText
      afterText = formatShortMdY(str(after)) || afterText
    }
    if (k === 'tour_id') {
      // 실제 투어명은 enrich 단계에서 덮어쓸 수 있음 — ID는 숨기고 연결/해제로
      const bEmpty = !str(before)
      const aEmpty = !str(after)
      if (bEmpty && !aEmpty) {
        beforeText = '—'
        afterText = lo(locale, '연결됨', 'Linked')
      } else if (!bEmpty && aEmpty) {
        beforeText = lo(locale, '연결됨', 'Linked')
        afterText = '—'
      } else {
        beforeText = lo(locale, '투어 A', 'Tour A')
        afterText = lo(locale, '투어 B', 'Tour B')
      }
    }
    lines.push({
      label: bookingFieldLabel(k, locale),
      beforeText,
      afterText,
    })
  }
  if (!lines.length) {
    return [
      {
        label: lo(locale, '내용', 'Details'),
        beforeText: '—',
        afterText: lo(locale, '변경 필드 없음', 'No field changes'),
      },
    ]
  }
  return lines.slice(0, 12)
}

async function enrichBookingItems(
  supabase: SupabaseClient<Database>,
  rows: Array<{
    id: string
    booking_type: string
    booking_id: string
    action: string
    changed_by: string
    changed_at: string | null
    old_values: Json | null
    new_values: Json | null
  }>,
  locale: string
): Promise<AwayChangeItem[]> {
  if (!rows.length) return []
  const actors = [...new Set(rows.map((r) => normEmail(r.changed_by)).filter(Boolean))]
  const { data: teamRows } =
    actors.length > 0
      ? await supabase.from('team').select('email, name_ko, nick_name').in('email', actors)
      : { data: [] as TeamRow[] }
  const teamMap = new Map<string, TeamRow>()
  for (const m of teamRows || []) {
    teamMap.set(normEmail(m.email), m as TeamRow)
  }

  const tourIds = new Set<string>()
  for (const row of rows) {
    const snap = bookingSnapshot(asRecord(row.old_values), asRecord(row.new_values))
    const tid = str(snap.tour_id)
    if (tid) tourIds.add(tid)
    const oldTid = str(asRecord(row.old_values).tour_id)
    const newTid = str(asRecord(row.new_values).tour_id)
    if (oldTid) tourIds.add(oldTid)
    if (newTid) tourIds.add(newTid)
  }

  const tourLabelById = new Map<string, string>()
  if (tourIds.size > 0) {
    const { data: toursData, error: toursErr } = await supabase
      .from('tours')
      .select('id, tour_date, product_id')
      .in('id', [...tourIds])
    if (toursErr) {
      console.error('enrichBookingItems tours:', toursErr)
    } else {
      const productIds = [
        ...new Set((toursData || []).map((t) => str(t.product_id)).filter(Boolean)),
      ]
      const productMap = new Map<
        string,
        {
          id: string
          name?: string | null
          name_ko?: string | null
          name_en?: string | null
          internal_name_ko?: string | null
          internal_name_en?: string | null
        }
      >()
      if (productIds.length > 0) {
        const { data: productsData, error: productsErr } = await supabase
          .from('products')
          .select('id, name, name_ko, name_en, internal_name_ko, internal_name_en')
          .in('id', productIds)
        if (productsErr) {
          console.error('enrichBookingItems products:', productsErr)
        } else {
          for (const p of productsData || []) {
            productMap.set(str(p.id), p)
          }
        }
      }
      for (const t of toursData || []) {
        const pname = productName(productMap, t.product_id, locale)
        const d = formatShortMdY(str(t.tour_date))
        tourLabelById.set(str(t.id), [d, pname].filter(Boolean).join(' '))
      }
    }
  }

  return rows.map((row) => {
    const actorNick = teamMap.get(normEmail(row.changed_by))?.nick_name?.trim() || null
    const oldR = asRecord(row.old_values)
    const newR = asRecord(row.new_values)
    const snap = bookingSnapshot(oldR, newR)
    const bt = (row.booking_type || '').toLowerCase()
    const normAction = normalizeBookingHistoryAction(row.action)
    const rawAction = (row.action || '').trim().toLowerCase()

    let diffLines: AwayChangeDiffLine[]
    if (normAction === 'UPDATE') {
      diffLines = diffJsonObjects(oldR, newR, locale)
      if (rawAction === 'cancelled' || rawAction === 'confirmed') {
        diffLines = [
          {
            label: lo(locale, '액션', 'Action'),
            beforeText: '—',
            afterText:
              rawAction === 'cancelled'
                ? lo(locale, '취소됨', 'Cancelled')
                : lo(locale, '확정됨', 'Confirmed'),
          },
          ...diffLines.filter((d) => d.label !== lo(locale, '내용', 'Details')),
        ].slice(0, 12)
      }
    } else if (normAction === 'INSERT') {
      const highlightKeys = [
        'booking_status',
        'vendor_status',
        'ea',
        'time',
        'check_in_date',
        'company',
        'rn_number',
      ]
      const highlights = highlightKeys
        .filter((k) => snap[k] != null && String(snap[k]).trim() !== '')
        .slice(0, 4)
        .map((k) => {
          let afterText = formatPrimitive(snap[k], locale)
          if (k === 'ea') afterText = formatTicketQty(snap[k], locale) || afterText
          if (k === 'time') afterText = formatTicketTime(snap[k]) || afterText
          if (k === 'check_in_date') afterText = formatShortMdY(str(snap[k])) || afterText
          return {
            label: bookingFieldLabel(k, locale),
            beforeText: '—',
            afterText,
          }
        })
      diffLines = highlights.length
        ? highlights
        : [
            {
              label: lo(locale, '등록', 'Recorded'),
              beforeText: '—',
              afterText: lo(locale, '새 부킹 기록', 'New booking entry'),
            },
          ]
    } else {
      diffLines = [
        {
          label: lo(locale, '삭제', 'Removed'),
          beforeText: lo(locale, '부킹 기록 삭제', 'Booking record deleted'),
          afterText: '—',
        },
      ]
    }

    const tourId = str(snap.tour_id)
    const tourLabel = tourId ? tourLabelById.get(tourId) || null : null

    // tour_id 변경 뱃지에 실제 투어명 반영
    diffLines = diffLines.map((line) => {
      if (line.label !== bookingFieldLabel('tour_id', locale)) return line
      const oldTid = str(oldR.tour_id)
      const newTid = str(newR.tour_id)
      return {
        ...line,
        beforeText: oldTid
          ? tourLabelById.get(oldTid) || lo(locale, '연결됨', 'Linked')
          : '—',
        afterText: newTid
          ? tourLabelById.get(newTid) || lo(locale, '연결됨', 'Linked')
          : '—',
      }
    })

    const headerTitle =
      bt === 'hotel'
        ? buildHotelBookingHeaderTitle(snap, locale)
        : buildTicketBookingHeaderTitle(snap, locale, tourLabel)

    return {
      kind: 'booking_history' as const,
      id: row.id,
      at: row.changed_at || new Date().toISOString(),
      actor: row.changed_by,
      actorNickName: actorNick,
      action: normAction,
      recordId: row.booking_id,
      labelKey: bt === 'hotel' ? ('hotelBooking' as const) : ('ticketBooking' as const),
      headerTitle,
      ...(tourLabel
        ? {
            headerSubtitle:
              locale === 'en' ? `Tour · ${tourLabel}` : `투어 · ${tourLabel}`,
          }
        : {}),
      headerBadges: [],
      diffLines,
    }
  })
}

export async function fetchAwayChangeDigest(
  supabase: SupabaseClient<Database>,
  args: {
    sinceIso: string
    myEmail: string
    scope: AwayChangeDigestScope
    locale?: string
    auditLimit?: number
    bookingLimit?: number
  }
): Promise<AwayChangeItem[]> {
  const { sinceIso, myEmail, scope } = args
  const locale = args.locale === 'en' ? 'en' : 'ko'
  const auditLimit = args.auditLimit ?? 80
  const bookingLimit = args.bookingLimit ?? 80
  const items: AwayChangeItem[] = []

  const auditTables: string[] = []
  if (scope.reservations) auditTables.push('reservations')
  if (scope.tours) auditTables.push('tours')

  if (auditTables.length > 0) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select(
        'id, table_name, record_id, action, user_email, created_at, changed_fields, old_values, new_values, user_agent'
      )
      .in('table_name', auditTables)
      .gt('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(auditLimit)

    if (!error && data) {
      const raw = data.filter((row) => isOtherActor(row.user_email, myEmail))
      const enriched = await enrichAuditItems(supabase, raw, locale)
      items.push(...enriched)
    }
  }

  if (scope.bookings) {
    const { data, error } = await supabase
      .from('booking_history')
      .select('id, booking_type, booking_id, action, changed_by, changed_at, old_values, new_values')
      .gt('changed_at', sinceIso)
      .order('changed_at', { ascending: false })
      .limit(bookingLimit)

    if (!error && data) {
      const raw = data.filter((row) => isOtherActor(row.changed_by, myEmail))
      const enriched = await enrichBookingItems(supabase, raw, locale)
      items.push(...enriched)
    }
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  return items
}

/**
 * Daily Report용 — 구간 내 전 직원 활동(예약·투어·부킹) 조회.
 * rangeStartIso/rangeEndIso 는 라스베가스 일 경계의 UTC ISO를 권장.
 * 본인 제외 필터 없음. 호출측에서 LA 달력일로 재필터하는 것을 권장.
 */
export async function fetchActivityDigestInRange(
  supabase: SupabaseClient<Database>,
  args: {
    rangeStartIso: string
    rangeEndIso: string
    scope?: AwayChangeDigestScope
    locale?: string
    auditLimit?: number
    bookingLimit?: number
  }
): Promise<AwayChangeItem[]> {
  const scope: AwayChangeDigestScope = {
    reservations: true,
    tours: true,
    bookings: true,
    ...args.scope,
  }
  const locale = args.locale === 'en' ? 'en' : 'ko'
  const auditLimit = args.auditLimit ?? 600
  const bookingLimit = args.bookingLimit ?? 300
  const items: AwayChangeItem[] = []

  const auditTables: string[] = []
  if (scope.reservations) auditTables.push('reservations')
  if (scope.tours) auditTables.push('tours')

  const startIso = args.rangeStartIso
  const endIso = args.rangeEndIso

  if (auditTables.length > 0) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select(
        'id, table_name, record_id, action, user_email, created_at, changed_fields, old_values, new_values, user_agent'
      )
      .in('table_name', auditTables)
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .order('created_at', { ascending: false })
      .limit(auditLimit)

    if (error) {
      console.error('fetchActivityDigestInRange audit:', error)
    } else if (data?.length) {
      const enriched = await enrichAuditItems(supabase, data, locale)
      items.push(...enriched)
    }
  }

  if (scope.bookings) {
    const { data, error } = await supabase
      .from('booking_history')
      .select('id, booking_type, booking_id, action, changed_by, changed_at, old_values, new_values')
      .gte('changed_at', startIso)
      .lte('changed_at', endIso)
      .order('changed_at', { ascending: false })
      .limit(bookingLimit)

    if (error) {
      console.error('fetchActivityDigestInRange bookings:', error)
    } else if (data?.length) {
      const enriched = await enrichBookingItems(supabase, data, locale)
      items.push(...enriched)
    }
  }

  // 타임존 경계 오차 대비: 아이템 시각이 구간에 들어오는지 한 번 더 확인
  const startMs = Date.parse(startIso)
  const endMs = Date.parse(endIso)
  const inRange = items.filter((it) => {
    const t = Date.parse(it.at)
    if (!Number.isFinite(t)) return false
    if (Number.isFinite(startMs) && t < startMs) return false
    if (Number.isFinite(endMs) && t > endMs) return false
    return true
  })

  inRange.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  return inRange
}

export function maxAwayChangeAtIso(items: AwayChangeItem[]): string {
  if (!items.length) return new Date().toISOString()
  let max = 0
  for (const it of items) {
    const t = new Date(it.at).getTime()
    if (Number.isFinite(t) && t > max) max = t
  }
  return new Date(max + 1).toISOString()
}
