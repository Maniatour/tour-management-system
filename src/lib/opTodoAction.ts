import type { ActionRequiredTabId } from '@/components/reservation/ReservationActionRequiredModal'
import type { FollowUpQueueTabId } from '@/components/reservation/ReservationFollowUpQueueModal'
import type { Reservation } from '@/types/reservation'
import type { OpTodoNotifyCategory } from '@/lib/opTodoSchedule'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

const LV_TZ = 'America/Los_Angeles'

export type OpTodoActionType =
  | 'none'
  | 'tour_detail'
  | 'tours_page'
  | 'reservation_action'
  | 'reservation_follow_up'
  | 'reservations_page'
  | 'team_board'
  | 'custom_url'

export type OpTodoActionConfig = {
  tourId?: string
  tourDateOffsetDays?: number
  productId?: string
  productNameContains?: string
  tab?: ActionRequiredTabId | FollowUpQueueTabId | string
  url?: string
  path?: string
  query?: Record<string, string>
}

export type OpTodoWithAction = {
  id: string
  title: string
  description?: string | null
  category: OpTodoNotifyCategory | string
  department?: string | null
  completed: boolean
  completed_at?: string | null
  on_hold?: boolean | null
  next_notify_at?: string | null
  notify_enabled?: boolean | null
  notify_time?: string | null
  notify_weekday?: number | null
  notify_day_of_month?: number | null
  notify_month?: number | null
  action_type?: OpTodoActionType | string | null
  action_config?: OpTodoActionConfig | Record<string, unknown> | null
  linked_hub_article_id?: string | null
}

export type OpTodoLinkedChip = Pick<OpTodoWithAction, 'id' | 'completed' | 'title'>

export const OP_TODO_ACTION_TYPES: Array<{ value: OpTodoActionType; labelKo: string; labelEn: string }> = [
  { value: 'none', labelKo: '연결 없음', labelEn: 'No link' },
  { value: 'tour_detail', labelKo: '투어 상세 모달', labelEn: 'Tour detail modal' },
  { value: 'tours_page', labelKo: '투어 관리 페이지', labelEn: 'Tours page' },
  { value: 'reservation_action', labelKo: '예약 처리 필요 모달', labelEn: 'Action required modal' },
  { value: 'reservation_follow_up', labelKo: '예약 Follow-up 모달', labelEn: 'Follow-up modal' },
  { value: 'reservations_page', labelKo: '예약 관리 페이지', labelEn: 'Reservations page' },
  { value: 'team_board', labelKo: '팀 게시판', labelEn: 'Team board' },
  { value: 'custom_url', labelKo: '직접 URL', labelEn: 'Custom URL' },
]

export const RESERVATION_ACTION_TABS: Array<{ value: ActionRequiredTabId; labelKo: string }> = [
  { value: 'status', labelKo: '상태' },
  { value: 'tour', labelKo: '투어' },
  { value: 'pricing', labelKo: '가격' },
  { value: 'deposit', labelKo: '입금' },
  { value: 'cancel', labelKo: '취소' },
  { value: 'balance', labelKo: '잔액' },
  { value: 'incompleteDraft', labelKo: '미완성' },
]

export const FOLLOW_UP_TABS: Array<{ value: FollowUpQueueTabId; labelKo: string }> = [
  { value: 'confirm', labelKo: '확인 메일' },
  { value: 'resident', labelKo: '거주자' },
  { value: 'departure', labelKo: '출발 안내' },
  { value: 'pickup', labelKo: '픽업 안내' },
  { value: 'cancel', labelKo: '취소 Follow-up' },
]

export function parseOpTodoActionConfig(raw: unknown): OpTodoActionConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return raw as OpTodoActionConfig
}

export function normalizeOpTodoActionType(raw: unknown): OpTodoActionType {
  const v = String(raw || 'none') as OpTodoActionType
  return OP_TODO_ACTION_TYPES.some((t) => t.value === v) ? v : 'none'
}

export function getOpTodoActionLabel(
  actionType: OpTodoActionType,
  config: OpTodoActionConfig,
  locale: string
): string {
  const isKo = locale === 'ko'
  const base = OP_TODO_ACTION_TYPES.find((t) => t.value === actionType)
  const parts = [isKo ? base?.labelKo : base?.labelEn]
  if (config.tab) parts.push(String(config.tab))
  if (config.productNameContains) parts.push(config.productNameContains)
  if (config.tourDateOffsetDays != null) {
    parts.push(isKo ? `D+${config.tourDateOffsetDays}` : `+${config.tourDateOffsetDays}d`)
  }
  return parts.filter(Boolean).join(' · ')
}

export function filterReservationsForOpTodoAction(
  reservations: Reservation[],
  config: OpTodoActionConfig,
  productsById?: Map<string, { name?: string | null; name_ko?: string | null; name_en?: string | null }>
): Reservation[] {
  let rows = reservations
  if (config.productId) {
    rows = rows.filter((r) => String(r.productId || '') === config.productId)
  }
  if (config.productNameContains?.trim()) {
    const needle = config.productNameContains.trim().toLowerCase()
    rows = rows.filter((r) => {
      const fromMap = productsById?.get(r.productId)
      const label = [fromMap?.name, fromMap?.name_ko, fromMap?.name_en].filter(Boolean).join(' ')
      return label.toLowerCase().includes(needle)
    })
  }
  if (config.tourDateOffsetDays != null && Number.isFinite(config.tourDateOffsetDays)) {
    const target = dayjs().tz(LV_TZ).add(config.tourDateOffsetDays, 'day').format('YYYY-MM-DD')
    rows = rows.filter((r) => String(r.tourDate || '').slice(0, 10) === target)
  }
  return rows
}

export function tourDateFromOffset(offsetDays?: number): string | null {
  if (offsetDays == null || !Number.isFinite(offsetDays)) return null
  return dayjs().tz(LV_TZ).add(offsetDays, 'day').format('YYYY-MM-DD')
}
