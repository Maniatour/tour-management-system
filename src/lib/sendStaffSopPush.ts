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
  try {
    setupVapid()
  } catch {
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
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.maniatour.com')
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

type ReminderPushResult = {
  sent: number
  failed: number
  skippedNoVapid: boolean
  noSubscriptions: number
}

/** 미서명 직원 이메일에 해당하는 web push 구독만 리마인드 */
export async function sendStructuredDocUnsignedReminderPush(
  admin: SupabaseClient,
  params: {
    docKind: 'sop' | 'employee_contract'
    versionId: string
    title: string
    signPath: string
    targetEmailsLower: string[]
  }
): Promise<ReminderPushResult> {
  const targets = new Set(params.targetEmailsLower.map((e) => e.trim().toLowerCase()).filter(Boolean))
  if (targets.size === 0) {
    return { sent: 0, failed: 0, skippedNoVapid: false, noSubscriptions: 0 }
  }

  try {
    setupVapid()
  } catch {
    return { sent: 0, failed: 0, skippedNoVapid: true, noSubscriptions: 0 }
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
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.maniatour.com')
  const iconUrl = faviconUrl.startsWith('http') ? faviconUrl : `${baseUrl}${faviconUrl}`

  const { data: subscriptions, error } = await admin.from('staff_push_subscriptions').select('*')
  if (error || !subscriptions?.length) {
    return { sent: 0, failed: 0, skippedNoVapid: false, noSubscriptions: targets.size }
  }

  const matched = subscriptions.filter((sub) => {
    const email = ((sub as { user_email?: string }).user_email || '').trim().toLowerCase()
    return email && targets.has(email)
  })

  if (matched.length === 0) {
    return { sent: 0, failed: 0, skippedNoVapid: false, noSubscriptions: targets.size }
  }

  let sent = 0
  let failed = 0
  const isSop = params.docKind === 'sop'
  const tagPrefix = isSop ? 'sop-remind' : 'employee-contract-remind'

  await Promise.all(
    matched.map(async (subscription) => {
      const row = subscription as {
        endpoint: string
        p256dh_key: string
        auth_key: string
        language?: string | null
      }
      const language = row.language || 'ko'
      const isKo = language === 'ko'
      const payload = JSON.stringify({
        title: isKo
          ? isSop
            ? 'SOP 서명이 필요합니다'
            : '직원 계약서 서명이 필요합니다'
          : isSop
            ? 'SOP signature required'
            : 'Employment contract signature required',
        body: isKo
          ? `${params.title} — 아직 서명하지 않으셨습니다.`
          : `${params.title} — Your signature is still pending.`,
        icon: iconUrl,
        badge: iconUrl,
        tag: `${tagPrefix}-${params.versionId}`,
        data: {
          url: params.signPath.startsWith('http') ? params.signPath : `${baseUrl}${params.signPath}`,
          ...(isSop ? { sopVersionId: params.versionId } : { employeeContractVersionId: params.versionId }),
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

  const subscribedEmails = new Set(
    matched.map((s) => ((s as { user_email?: string }).user_email || '').trim().toLowerCase()).filter(Boolean)
  )
  const noSubscriptions = [...targets].filter((e) => !subscribedEmails.has(e)).length

  return { sent, failed, skippedNoVapid: false, noSubscriptions }
}

/** 직원 계약서 개정 알림 (동일 구독 테이블, 다른 문구·딥링크) */
export async function sendEmployeeContractPublishedStaffPush(
  admin: SupabaseClient,
  params: { versionId: string; title: string; signPath: string }
): Promise<{ sent: number; failed: number; skippedNoVapid: boolean }> {
  try {
    setupVapid()
  } catch {
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
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.maniatour.com')
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

/** 미완료 투어 SOP 체크리스트 — 배정 가이드 web push */
export async function sendTourChecklistIncompleteReminderPush(
  admin: SupabaseClient,
  params: {
    tourId: string
    tourDate: string
    productLabel: string
    missingRequired: number
    targetEmail: string
    locale?: string
  }
): Promise<ReminderPushResult> {
  const email = params.targetEmail.trim().toLowerCase()
  if (!email) {
    return { sent: 0, failed: 0, skippedNoVapid: false, noSubscriptions: 0 }
  }

  try {
    setupVapid()
  } catch {
    return { sent: 0, failed: 0, skippedNoVapid: true, noSubscriptions: 0 }
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
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.maniatour.com')
  const iconUrl = faviconUrl.startsWith('http') ? faviconUrl : `${baseUrl}${faviconUrl}`

  const { data: subscriptions, error } = await admin.from('staff_push_subscriptions').select('*')
  if (error || !subscriptions?.length) {
    return { sent: 0, failed: 0, skippedNoVapid: false, noSubscriptions: 1 }
  }

  const matched = subscriptions.filter((sub) => {
    const subEmail = ((sub as { user_email?: string }).user_email || '').trim().toLowerCase()
    return subEmail === email
  })

  if (matched.length === 0) {
    return { sent: 0, failed: 0, skippedNoVapid: false, noSubscriptions: 1 }
  }

  let sent = 0
  let failed = 0
  const guidePath = `/${params.locale === 'en' ? 'en' : 'ko'}/guide/tours/${params.tourId}`

  await Promise.all(
    matched.map(async (subscription) => {
      const row = subscription as {
        endpoint: string
        p256dh_key: string
        auth_key: string
        language?: string | null
      }
      const language = row.language || params.locale || 'ko'
      const isKo = language === 'ko'
      const payload = JSON.stringify({
        title: isKo ? 'SOP 체크리스트 미완료' : 'SOP checklist incomplete',
        body: isKo
          ? `${params.tourDate} ${params.productLabel} — 필수 ${params.missingRequired}개 남음`
          : `${params.tourDate} ${params.productLabel} — ${params.missingRequired} required item(s) left`,
        icon: iconUrl,
        badge: iconUrl,
        tag: `tour-checklist-${params.tourId}`,
        data: {
          url: `${baseUrl}${guidePath}`,
          tourId: params.tourId,
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

  return { sent, failed, skippedNoVapid: false, noSubscriptions: 0 }
}
