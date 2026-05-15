import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function setupVapidDetails() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  const vapidEmail = process.env.VAPID_EMAIL || 'mailto:your-email@example.com'
  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error('VAPID keys are not configured')
  }
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)
}

/**
 * 고객이 음성 통화를 걸었을 때 해당 방에 푸시 구독 중인 가이드(및 기타)에게 알림.
 * 기존 채팅 push_subscriptions(room_id)를 그대로 사용합니다.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const roomId = typeof body.roomId === 'string' ? body.roomId.trim() : ''
    const callerName =
      typeof body.callerName === 'string' && body.callerName.trim() ? body.callerName.trim() : '고객'

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!roomId || !uuidRegex.test(roomId)) {
      return NextResponse.json({ error: 'Invalid roomId' }, { status: 400 })
    }

    setupVapidDetails()
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: room, error: roomError } = await supabase
      .from('chat_rooms')
      .select('id, tour_id, room_code')
      .eq('id', roomId)
      .maybeSingle()

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    let faviconUrl = '/favicon.ico'
    try {
      const { data: channels } = await supabase
        .from('channels')
        .select('favicon_url')
        .eq('type', 'self')
        .not('favicon_url', 'is', null)
        .limit(1)
        .single()
      if (channels?.favicon_url) faviconUrl = channels.favicon_url
    } catch {
      /* ignore */
    }

    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('room_id', roomId)

    if (subError) {
      console.error('[voice-call-notify] subscriptions:', subError)
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
    }

    if (!subscriptions?.length) {
      return NextResponse.json({ message: 'No subscriptions', sent: 0 }, { status: 200 })
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.kovegas.com')
    const iconUrl = faviconUrl.startsWith('http') ? faviconUrl : `${baseUrl}${faviconUrl}`

    const tourId = room.tour_id as string | null
    let sent = 0

    for (const subscription of subscriptions) {
      try {
        const language = (subscription as { language?: string }).language || 'ko'
        const isKorean = language === 'ko'
        const pathLocale = isKorean ? 'ko' : 'en'
        const openPath =
          tourId != null && tourId !== ''
            ? `/${pathLocale}/guide/tours/${tourId}`
            : room.room_code
              ? `/chat/${room.room_code}`
              : `/${pathLocale}/guide/chat`

        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh_key,
            auth: subscription.auth_key
          }
        }

        const payload = JSON.stringify({
          title: isKorean ? '음성 통화 요청' : 'Voice call request',
          body: isKorean ? `${callerName}님이 통화를 요청했습니다.` : `${callerName} is requesting a voice call.`,
          icon: iconUrl,
          badge: iconUrl,
          tag: `voice-call-${roomId}`,
          requireInteraction: true,
          data: {
            url: openPath.startsWith('http') ? openPath : `${baseUrl}${openPath}`,
            roomId,
            kind: 'voice-call'
          }
        })

        await webpush.sendNotification(pushSubscription, payload)
        sent++
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode
        if (statusCode === 410 || statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
        }
        console.error('[voice-call-notify] send failed:', err)
      }
    }

    return NextResponse.json({ sent, total: subscriptions.length })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    if (message.includes('VAPID')) {
      return NextResponse.json({ error: 'Push not configured', sent: 0 }, { status: 200 })
    }
    console.error('[voice-call-notify]', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
