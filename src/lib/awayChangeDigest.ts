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
}

type JsonRecord = Record<string, unknown>

const SKIP_DIFF_FIELDS = new Set([
  'updated_at',
  'created_at',
  'reservation_ids',
  'photos_extended_access',
  'tour_note',
  'tour_start_datetime',
  'tour_end_datetime',
  'guide_fee',
  'assistant_fee',
  'team_type',
  'is_private_tour',
])

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
    pending: '대기중',
    confirmed: '확정',
    completed: '완료',
    cancelled: '취소',
    canceled: '취소',
    recruiting: '모집중',
    deleted: '삭제됨',
    'payment requested': '입금요청',
  }
  const mapEn: Record<string, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled',
    canceled: 'Cancelled',
    recruiting: 'Recruiting',
    deleted: 'Deleted',
    'payment requested': 'Payment requested',
  }
  const map = locale === 'en' ? mapEn : mapKo
  return map[s] || str(status) || '—'
}

function productName(
  productMap: Map<string, { name: string | null; name_ko: string | null; name_en: string | null }>,
  productId: unknown,
  locale: string
): string {
  const id = str(productId)
  if (!id) return '—'
  const p = productMap.get(id)
  if (!p) return id
  if (locale === 'en') return str(p.name_en || p.name || p.name_ko) || id
  return str(p.name_ko || p.name || p.name_en) || id
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

function orderedChangedFields(changed: string[] | null, table: 'tours' | 'reservations'): string[] {
  const raw = (changed || []).filter((f) => f && !SKIP_DIFF_FIELDS.has(f))
  const priority =
    table === 'tours'
      ? [
          'tour_status',
          'assignment_status',
          'max_participants',
          'tour_guide_id',
          'assistant_id',
          'tour_car_id',
        ]
      : ['status', 'total_people', 'adults', 'child', 'infant', 'tour_date', 'product_id', 'tour_id']
  const rest = raw.filter((f) => !priority.includes(f)).sort()
  const head = priority.filter((f) => raw.includes(f))
  return [...head, ...rest]
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
  locale: string
}): AwayChangeDiffLine[] {
  const { action, oldR, newR, changed_fields, teamMap, vehicleMap, locale } = args
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
  const fields = orderedChangedFields(changed_fields, 'tours')
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
      default:
        label = `${field}`
        break
    }
    lines.push({ label, beforeText: bText, afterText: aText })
  }
  return lines
}

function buildReservationDiffLines(args: {
  action: string
  oldR: JsonRecord
  newR: JsonRecord
  changed_fields: string[] | null
  productMap: Map<string, { name: string | null; name_ko: string | null; name_en: string | null }>
  locale: string
}): AwayChangeDiffLine[] {
  const { action, oldR, newR, changed_fields, productMap, locale } = args
  if (action === 'INSERT') {
    return [
      {
        label: lo(locale, '생성', 'Created'),
        beforeText: '—',
        afterText: lo(locale, '새 예약이 추가되었습니다.', 'A new reservation was added.'),
      },
    ]
  }
  if (action === 'DELETE') {
    return [
      {
        label: lo(locale, '삭제', 'Deleted'),
        beforeText: lo(locale, '예약 데이터', 'Reservation data'),
        afterText: lo(locale, '삭제됨', 'Removed'),
      },
    ]
  }
  const fields = orderedChangedFields(changed_fields, 'reservations')
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
  }>,
  locale: string
): Promise<AwayChangeItem[]> {
  if (!rows.length) return []

  const oldRecords = rows.map((r) => asRecord(r.old_values))
  const newRecords = rows.map((r) => asRecord(r.new_values))

  const actorEmails = [...new Set(rows.map((r) => normEmail(r.user_email)).filter(Boolean))]
  const productIds = new Set<string>()
  const customerIds = new Set<string>()
  const tourIds = new Set<string>()
  const teamEmails = new Set<string>()
  const vehicleIds = new Set<string>()

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

  const [teamRes, productsRes, customersRes, vehiclesRes] = await Promise.all([
    teamEmailListFinal.length
      ? supabase.from('team').select('email, name_ko, nick_name').in('email', teamEmailListFinal)
      : Promise.resolve({ data: [] as TeamRow[], error: null }),
    productIdListFinal.length
      ? supabase.from('products').select('id, name, name_ko, name_en').in('id', productIdListFinal)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string | null; name_ko: string | null; name_en: string | null }>, error: null }),
    customerIdList.length
      ? supabase.from('customers').select('id, name').in('id', customerIdList)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }>, error: null }),
    vehicleIdListFinal.length
      ? supabase.from('vehicles').select('id, vehicle_number').in('id', vehicleIdListFinal)
      : Promise.resolve({ data: [] as Array<{ id: string; vehicle_number: string }>, error: null }),
  ])

  const teamMap = new Map<string, TeamRow>()
  for (const m of teamRes.data || []) {
    teamMap.set(normEmail(m.email), m as TeamRow)
  }

  const productMap = new Map<string, { name: string | null; name_ko: string | null; name_en: string | null }>()
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

  const items: AwayChangeItem[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const oldR = oldRecords[i]
    const newR = newRecords[i]
    const actor = row.user_email
    const actorNick = actor ? teamMap.get(normEmail(actor))?.nick_name?.trim() || null : null

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
      })
    }
  }

  return items
}

function diffJsonObjects(
  oldV: JsonRecord,
  newV: JsonRecord,
  locale: string
): AwayChangeDiffLine[] {
  const keys = new Set([...Object.keys(oldV), ...Object.keys(newV)])
  const lines: AwayChangeDiffLine[] = []
  for (const k of [...keys].sort()) {
    if (SKIP_DIFF_FIELDS.has(k)) continue
    const before = oldV[k]
    const after = newV[k]
    if (JSON.stringify(before) === JSON.stringify(after)) continue
    lines.push({
      label: k,
      beforeText: formatPrimitive(before, locale),
      afterText: formatPrimitive(after, locale),
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
  return rows.map((row) => {
    const actorNick = teamMap.get(normEmail(row.changed_by))?.nick_name?.trim() || null
    const oldR = asRecord(row.old_values)
    const newR = asRecord(row.new_values)
    const bt = (row.booking_type || '').toLowerCase()
    let diffLines: AwayChangeDiffLine[]
    if (row.action === 'UPDATE') {
      diffLines = diffJsonObjects(oldR, newR, locale)
    } else if (row.action === 'INSERT') {
      diffLines = [
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
          beforeText: lo(locale, '기존 기록', 'Previous record'),
          afterText: '—',
        },
      ]
    }
    return {
      kind: 'booking_history' as const,
      id: row.id,
      at: row.changed_at || new Date().toISOString(),
      actor: row.changed_by,
      actorNickName: actorNick,
      action: row.action,
      recordId: row.booking_id,
      labelKey: bt === 'hotel' ? ('hotelBooking' as const) : ('ticketBooking' as const),
      headerTitle:
        bt === 'hotel'
          ? lo(locale, '호텔 부킹 변경', 'Hotel booking change')
          : lo(locale, '티켓 부킹 변경', 'Ticket booking change'),
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
        'id, table_name, record_id, action, user_email, created_at, changed_fields, old_values, new_values'
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

export function maxAwayChangeAtIso(items: AwayChangeItem[]): string {
  if (!items.length) return new Date().toISOString()
  let max = 0
  for (const it of items) {
    const t = new Date(it.at).getTime()
    if (Number.isFinite(t) && t > max) max = t
  }
  return new Date(max + 1).toISOString()
}
