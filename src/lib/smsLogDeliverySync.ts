import twilio from 'twilio'
import { supabaseAdmin } from '@/lib/supabase'
import type { SmsLogRowForDelivery } from '@/lib/smsLogDeliveryState'

export type SmsLogRowForDeliverySync = SmsLogRowForDelivery & {
  id: string
  reservation_id?: string
  twilio_message_sid?: string | null
}

type TwilioMessageSnapshot = {
  status?: string | null
  errorCode?: number | null
  errorMessage?: string | null
}

function isPendingDeliveryLog(log: SmsLogRowForDeliverySync): boolean {
  const status = String(log.status ?? '').toLowerCase()
  if (log.delivered_at || log.failed_at) return false
  if (log.error_message && !log.twilio_message_sid) return false
  return status === 'sent' || status === 'sending' || status === 'queued'
}

function buildFailureReason(snapshot: TwilioMessageSnapshot): string | null {
  const parts = [
    snapshot.errorMessage,
    snapshot.errorCode != null ? `Error ${snapshot.errorCode}` : null,
  ].filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
  return parts.length > 0 ? parts.join(' · ') : 'Delivery failed'
}

/** Twilio MessageStatus를 sms_logs 컬럼 업데이트로 변환합니다. */
export function buildSmsLogDeliveryUpdate(
  log: SmsLogRowForDeliverySync,
  snapshot: TwilioMessageSnapshot
): Record<string, string> | null {
  const status = String(snapshot.status ?? '').toLowerCase()
  const now = new Date().toISOString()

  if (status === 'delivered') {
    if (log.delivered_at && String(log.status ?? '').toLowerCase() === 'delivered') {
      return null
    }
    return {
      delivered_at: log.delivered_at ?? now,
      status: 'delivered',
      twilio_status: status,
    }
  }

  if (status === 'failed' || status === 'undelivered') {
    if (log.failed_at) return null
    return {
      failed_at: now,
      failure_reason: buildFailureReason(snapshot) ?? 'Delivery failed',
      status,
      twilio_status: status,
    }
  }

  return null
}

/** Twilio API에서 단일 SMS 전달 상태를 조회합니다. */
export async function fetchTwilioMessageSnapshot(
  messageSid: string
): Promise<TwilioMessageSnapshot | null> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  if (!accountSid || !authToken) {
    console.error('[smsLogDeliverySync] Twilio credentials missing')
    return null
  }

  try {
    const client = twilio(accountSid, authToken)
    const message = await client.messages(messageSid).fetch()
    return {
      status: message.status,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage,
    }
  } catch (error) {
    console.error('[smsLogDeliverySync] Twilio API 조회 오류:', { messageSid, error })
    return null
  }
}

/** 단일 SMS 로그를 Twilio API와 동기화합니다. */
export async function syncSmsLogDeliveryFromTwilio(
  log: SmsLogRowForDeliverySync
): Promise<boolean> {
  if (!supabaseAdmin) return false
  if (!isPendingDeliveryLog(log)) return false

  const messageSid = String(log.twilio_message_sid ?? '').trim()
  if (!messageSid) return false

  const snapshot = await fetchTwilioMessageSnapshot(messageSid)
  if (!snapshot) return false

  const twilioStatus = String(snapshot.status ?? '').toLowerCase()
  if (!twilioStatus || twilioStatus === 'sent' || twilioStatus === 'queued' || twilioStatus === 'sending') {
    return false
  }

  const update = buildSmsLogDeliveryUpdate(log, snapshot)
  if (!update) return false

  const { error } = await supabaseAdmin
    .from('pre_tour_contact_sms_logs' as never)
    .update(update as never)
    .eq('id', log.id)

  if (error) {
    console.error('[smsLogDeliverySync] sms log 업데이트 오류:', { logId: log.id, error })
    return false
  }

  return true
}

const DEFAULT_MAX_LOGS_PER_BATCH = 8

/** 예약의 전달 확인 중 SMS 로그를 Twilio API와 동기화합니다. */
export async function syncReservationSmsLogsFromTwilio(
  reservationId: string
): Promise<{ synced: number; checked: number }> {
  if (!supabaseAdmin) return { synced: 0, checked: 0 }

  const { data, error } = await supabaseAdmin
    .from('pre_tour_contact_sms_logs' as never)
    .select('id, reservation_id, twilio_message_sid, status, delivered_at, failed_at, error_message')
    .eq('reservation_id', reservationId)
    .is('delivered_at', null)
    .is('failed_at', null)
    .not('twilio_message_sid', 'is', null)
    .in('status', ['sent', 'sending', 'queued'])
    .order('created_at', { ascending: false })
    .limit(DEFAULT_MAX_LOGS_PER_BATCH)

  if (error) {
    console.error('[smsLogDeliverySync] pending logs 조회 오류:', error)
    return { synced: 0, checked: 0 }
  }

  const logs = (data ?? []) as unknown as SmsLogRowForDeliverySync[]
  let synced = 0

  for (const log of logs) {
    const updated = await syncSmsLogDeliveryFromTwilio(log)
    if (updated) synced++
  }

  return { synced, checked: logs.length }
}

/** Twilio 웹훅에서 SMS 로그를 업데이트합니다. */
export async function updateSmsLogFromTwilioWebhook(params: {
  messageSid: string
  messageStatus: string
  errorCode?: string | null
}): Promise<boolean> {
  if (!supabaseAdmin) return false

  const messageSid = params.messageSid.trim()
  if (!messageSid) return false

  const { data: log, error: findError } = await supabaseAdmin
    .from('pre_tour_contact_sms_logs' as never)
    .select('id, status, delivered_at, failed_at, error_message')
    .eq('twilio_message_sid', messageSid)
    .maybeSingle()

  if (findError) {
    console.error('[smsLogDeliverySync] webhook log lookup error:', findError)
    return false
  }

  if (!log) {
    console.log('[smsLogDeliverySync] webhook: log not found for sid', messageSid)
    return false
  }

  const snapshot: TwilioMessageSnapshot = {
    status: params.messageStatus,
    errorCode: params.errorCode ? Number.parseInt(params.errorCode, 10) : null,
    errorMessage: params.errorCode ? `Twilio error ${params.errorCode}` : null,
  }

  const typedLog = log as unknown as SmsLogRowForDeliverySync & { id: string }
  const update = buildSmsLogDeliveryUpdate(typedLog, snapshot)
  if (!update) return false

  const { error: updateError } = await supabaseAdmin
    .from('pre_tour_contact_sms_logs' as never)
    .update(update as never)
    .eq('id', typedLog.id)

  if (updateError) {
    console.error('[smsLogDeliverySync] webhook update error:', updateError)
    return false
  }

  return true
}
