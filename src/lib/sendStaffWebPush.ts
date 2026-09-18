import type { SupabaseClient } from '@supabase/supabase-js'
import webpush from 'web-push'

type StaffPushRow = {
  endpoint: string
  p256dh_key: string
  auth_key: string
  user_email?: string | null
  language?: string | null
}

export type StaffPushPayload = {
  title: string
  body: string
  tag: string
  url: string
  extraData?: Record<string, unknown>
}

function setupVapid() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  const vapidEmail = process.env.VAPID_EMAIL || 'mailto:your-email@example.com'
  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error('VAPID keys not configured')
  }
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)
}

function staffPushIconUrl(): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.maniatour.com')
  return `${baseUrl.replace(/\/$/, '')}/favicon.ico`
}

function siteBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.maniatour.com')
  ).replace(/\/$/, '')
}

function absoluteUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return `${siteBaseUrl()}${path}`
}

export function staffPushLanguage(raw: string | null | undefined): 'ko' | 'en' {
  return raw === 'en' ? 'en' : 'ko'
}

/** 지정 이메일들의 staff_push_subscriptions로 web push 전송 (만료 구독 삭제) */
export async function sendStaffPushToEmails(
  admin: SupabaseClient,
  params: {
    targetEmailsLower: Iterable<string>
    buildPayload: (sub: { email: string; language: 'ko' | 'en' }) => StaffPushPayload
  }
): Promise<{ sent: number; failed: number; skippedNoVapid: boolean }> {
  const targets = [
    ...new Set([...params.targetEmailsLower].map((e) => e.trim().toLowerCase()).filter(Boolean)),
  ]
  if (targets.length === 0) {
    return { sent: 0, failed: 0, skippedNoVapid: false }
  }

  try {
    setupVapid()
  } catch {
    return { sent: 0, failed: 0, skippedNoVapid: true }
  }

  const { data: subscriptions, error } = await admin
    .from('staff_push_subscriptions')
    .select('endpoint, p256dh_key, auth_key, user_email, language')

  if (error || !subscriptions?.length) {
    return { sent: 0, failed: 0, skippedNoVapid: false }
  }

  const targetSet = new Set(targets)
  const matched = subscriptions.filter((subscription) => {
    const email = ((subscription as StaffPushRow).user_email || '').trim().toLowerCase()
    return email.length > 0 && targetSet.has(email)
  })

  if (matched.length === 0) {
    return { sent: 0, failed: 0, skippedNoVapid: false }
  }

  const iconUrl = staffPushIconUrl()
  let sent = 0
  let failed = 0

  await Promise.all(
    matched.map(async (subscription) => {
      const row = subscription as StaffPushRow
      const email = (row.user_email || '').trim().toLowerCase()
      if (!email || !targets.includes(email)) return
      const language = staffPushLanguage(row.language)
      const built = params.buildPayload({ email, language })
      const payload = JSON.stringify({
        title: built.title,
        body: built.body,
        icon: iconUrl,
        badge: iconUrl,
        tag: built.tag,
        data: {
          url: absoluteUrl(built.url),
          ...(built.extraData || {}),
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
