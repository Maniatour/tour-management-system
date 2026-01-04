import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// VAPID 키 설정 (환경 변수에서 가져오기)
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:your-email@example.com'

// web-push 설정
webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)

export async function POST(request: NextRequest) {
  try {
    const { roomId, message, senderName } = await request.json()

    if (!roomId || !message) {
      return NextResponse.json(
        { error: 'roomId and message are required' },
        { status: 400 }
      )
    }

    // Supabase 클라이언트 생성
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 채팅방 정보 가져오기 (room_code 필요)
    const { data: room, error: roomError } = await supabase
      .from('chat_rooms')
      .select('room_code')
      .eq('id', roomId)
      .single()

    if (roomError || !room) {
      console.error('Error fetching room:', roomError)
      return NextResponse.json(
        { error: 'Failed to fetch room information' },
        { status: 500 }
      )
    }

    // 해당 채팅방의 모든 구독 가져오기
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('room_id', roomId)

    if (error) {
      console.error('Error fetching subscriptions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch subscriptions' },
        { status: 500 }
      )
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json(
        { message: 'No subscriptions found for this room' },
        { status: 200 }
      )
    }

    // 모든 구독에 푸시 알림 전송
    const notifications = subscriptions.map(async (subscription) => {
      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh_key,
            auth: subscription.auth_key
          }
        }

        const payload = JSON.stringify({
          title: '새 메시지',
          body: `${senderName || '가이드'}: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`,
          icon: '/images/logo.png',
          badge: '/images/logo.png',
          tag: `chat-${roomId}`,
          data: {
            url: `/chat/${room.room_code}`,
            roomId: roomId
          }
        })

        await webpush.sendNotification(pushSubscription, payload)
        return { success: true, endpoint: subscription.endpoint }
      } catch (error: any) {
        // 구독이 만료되었거나 유효하지 않은 경우 삭제
        if (error.statusCode === 410 || error.statusCode === 404) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', subscription.endpoint)
        }
        return { success: false, endpoint: subscription.endpoint, error: error.message }
      }
    })

    const results = await Promise.allSettled(notifications)
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
    const failed = results.length - successful

    return NextResponse.json({
      message: 'Push notifications sent',
      successful,
      failed,
      total: subscriptions.length
    })
  } catch (error: any) {
    console.error('Error sending push notification:', error)
    return NextResponse.json(
      { error: 'Failed to send push notification', details: error.message },
      { status: 500 }
    )
  }
}

