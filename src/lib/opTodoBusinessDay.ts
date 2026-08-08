import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

/** OP Todo / 고정 패널 완료 상태가 하루 단위로 넘어가는 시각 (Las Vegas) */
export const OP_TODO_DAY_RESET_HOUR_LV = 2

export const OP_TODO_LV_TZ = 'America/Los_Angeles'

/**
 * 업무일 날짜 키 (YYYY-MM-DD).
 * Las Vegas 기준 매일 02:00 에 다음 날로 넘어감.
 * 예: 8/8 00:05 → 여전히 8/7, 8/8 02:00 → 8/8
 */
export function opTodoBusinessDateKey(now: Date | string | number = new Date()): string {
  return dayjs(now).tz(OP_TODO_LV_TZ).subtract(OP_TODO_DAY_RESET_HOUR_LV, 'hour').format('YYYY-MM-DD')
}
