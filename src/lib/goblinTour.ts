import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { LV_TZ } from '@/lib/lasVegasCalendar'

dayjs.extend(utc)
dayjs.extend(timezone)

export const GOBLIN_NARRATION_REMINDER_HOUR = 18

export type GoblinProductNameFields = {
  id?: string | null
  name?: string | null
  name_ko?: string | null
  name_en?: string | null
  customer_name_ko?: string | null
  customer_name_en?: string | null
}

function productIdLooksGoblin(productId: string | null | undefined): boolean {
  const id = String(productId || '').trim().toUpperCase()
  if (!id) return false
  return id === 'MDGCSUNRISE' || id.startsWith('MDGCSUNRISE') || id.startsWith('MDGCSUNR')
}

export function isGoblinTourProduct(
  product?: GoblinProductNameFields | null,
  productId?: string | null,
): boolean {
  if (productIdLooksGoblin(productId) || productIdLooksGoblin(product?.id)) return true
  const text = [
    product?.name,
    product?.name_ko,
    product?.name_en,
    product?.customer_name_ko,
    product?.customer_name_en,
  ]
    .map((value) => (value || '').trim())
    .filter(Boolean)
    .join(' ')
  if (!text) return false
  if (text.includes('밤도깨비') || text.includes('도깨비')) return true
  return /night\s*goblin|midnight\s*goblin|\bgoblin\b/i.test(text)
}

export function lasVegasHour(): number {
  return dayjs().tz(LV_TZ).hour()
}

export function isGoblinNarrationReminderWindow(now = dayjs()): boolean {
  return now.tz(LV_TZ).hour() >= GOBLIN_NARRATION_REMINDER_HOUR
}

export function shouldAttachOvernightGoblinPlayback(now = dayjs()): boolean {
  return now.tz(LV_TZ).hour() >= GOBLIN_NARRATION_REMINDER_HOUR
}
