import type { SupabaseClient } from '@supabase/supabase-js'
import webpush from 'web-push'

function setupVapid() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  const vapidEmail = process.env.VAPID_EMAIL || 'mailto:your-email@example.com'
  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error('VAPID keys not configured')
  }
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)
}

/** SOP 개정 알림을 staff_push_subscriptions 대상으로 전송 (실패 시 만료 구독 삭제) */
export async function sendSopPublishedStaffPush(
  admin: SupabaseClient,
  params: { versionId: string; title: string; signPath: string }
): Promise<{ sent: number; failed: number; skippedNoVapid: boolean }> {
  let skippedNoVapid = false
  try {
    setupVapid()
  } catch {
    skippedNoVapid = true
    return { sent: 0, failed: 0, skippedNoVapid: true }
  }

  const { data: channels } = await admin
    .from('channels')
    .select('favicon_url')
    .eq('type', 'self')
    .not('favicon_url', 'is', null)
    .limit(1)
    .maybeSingle()

  let faviconUrl = '/favicon.ico'
  if (channels?.favicon_url) faviconUrl = channels.favicon_url

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.kovegas.com')
  const iconUrl = faviconUrl.startsWith('http') ? faviconUrl : `${baseUrl}${faviconUrl}`

  const { data: subscriptions, error } = await admin.from('staff_push_subscriptions').select('*')
  if (error || !subscriptions?.length) {
    return { sent: 0, failed: 0, skippedNoVapid: false }
  }

  let sent = 0
  let failed = 0

  await Promise.all(
    subscriptions.map(async (subscription) => {
      const row = subscription as {
        endpoint: string
        p256dh_key: string
        auth_key: string
        language?: string | null
      }
      const language = row.language || 'ko'
      const isKo = language === 'ko'
      const payload = JSON.stringify({
        title: isKo ? 'SOP이 개정되었습니다' : 'Company SOP updated',
        body: isKo
          ? `${params.title} — 확인 후 서명해 주세요.`
          : `${params.title} — Please review and sign.`,
        icon: iconUrl,
        badge: iconUrl,
        tag: `sop-${params.versionId}`,
        data: {
          url: params.signPath.startsWith('http') ? params.signPath : `${baseUrl}${params.signPath}`,
          sopVersionId: params.versionId,
        },
      })
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: {
              p256dh: row.p256dh_key,
              auth: row.auth_key,
            },
          },
          payload
        )
        sent++
      } catch (err: unknown) {
        failed++
        const status = (err as { statusCode?: number })?.statusCode
        if (status === 410 || status === 404) {
          await admin.from('staff_push_subscriptions').delete().eq('endpoint', row.endpoint)
        }
      }
    })
  )

  return { sent, failed, skippedNoVapid: false }
}

/** 직원 계약서 개정 알림 (동일 구독 테이블, 다른 문구·딥링크) */
export async function sendEmployeeContractPublishedStaffPush(
  admin: SupabaseClient,
  params: { versionId: string; title: string; signPath: string }
): Promise<{ sent: number; failed: number; skippedNoVapid: boolean }> {
  let skippedNoVapid = false
  try {
    setupVapid()
  } catch {
    skippedNoVapid = true
    return { sent: 0, failed: 0, skippedNoVapid: true }
  }

  const { data: channels } = await admin
    .from('channels')
    .select('favicon_url')
    .eq('type', 'self')
    .not('favicon_url', 'is', null)
    .limit(1)
    .maybeSingle()

  let faviconUrl = '/favicon.ico'
  if (channels?.favicon_url) faviconUrl = channels.favicon_url

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.kovegas.com')
  const iconUrl = faviconUrl.startsWith('http') ? faviconUrl : `${baseUrl}${faviconUrl}`

  const { data: subscriptions, error } = await admin.from('staff_push_subscriptions').select('*')
  if (error || !subscriptions?.length) {
    return { sent: 0, failed: 0, skippedNoVapid: false }
  }

  let sent = 0
  let failed = 0

  await Promise.all(
    subscriptions.map(async (subscription) => {
      const row = subscription as {
        endpoint: string
        p256dh_key: string
        auth_key: string
        language?: string | null
      }
      const language = row.language || 'ko'
      const isKo = language === 'ko'
      const payload = JSON.stringify({
        title: isKo ? '직원 계약서가 개정되었습니다' : 'Employment contract updated',
        body: isKo
          ? `${params.title} — 확인 후 서명해 주세요.`
          : `${params.title} — Please review and sign.`,
        icon: iconUrl,
        badge: iconUrl,
        tag: `employee-contract-${params.versionId}`,
        data: {
          url: params.signPath.startsWith('http') ? params.signPath : `${baseUrl}${params.signPath}`,
          employeeContractVersionId: params.versionId,
        },
      })
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: {
              p256dh: row.p256dh_key,
              auth: row.auth_key,
            },
          },
          payload
        )
        sent++
      } catch (err: unknown) {
        failed++
        const status = (err as { statusCode?: number })?.statusCode
        if (status === 410 || status === 404) {
          await admin.from('staff_push_subscriptions').delete().eq('endpoint', row.endpoint)
        }
      }
    })
  )

  return { sent, failed, skippedNoVapid: false }
}
