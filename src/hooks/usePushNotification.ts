'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface PushSubscriptionData {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export function usePushNotification(roomId?: string, customerEmail?: string, language?: 'ko' | 'en') {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    // 브라우저 지원 여부 확인
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    ) {
      setIsSupported(true)
      setPermission(Notification.permission)
      checkSubscription()
    }
  }, [])

  const checkSubscription = useCallback(async () => {
    if (!isSupported) return

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      setIsSubscribed(!!subscription)
    } catch (error) {
      console.error('Error checking subscription:', error)
    }
  }, [isSupported])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      alert('이 브라우저는 푸시 알림을 지원하지 않습니다.')
      return false
    }

    if (permission === 'granted') {
      return true
    }

    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      return result === 'granted'
    } catch (error) {
      console.error('Error requesting permission:', error)
      return false
    }
  }, [isSupported, permission])

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !roomId) {
      return false
    }

    setIsLoading(true)

    try {
      // 권한 요청
      const hasPermission = await requestPermission()
      if (!hasPermission) {
        setIsLoading(false)
        return false
      }

      // Service Worker 등록
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      })
      await registration.update()

      // VAPID 공개 키 (환경 변수에서 가져오거나 서버에서 받아야 함)
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) {
        console.error('VAPID public key not found')
        setIsLoading(false)
        return false
      }

      // Push 구독
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      })

      // 구독 정보 추출
      const subscriptionData: PushSubscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: arrayBufferToBase64(subscription.getKey('auth')!)
        }
      }

      // 서버에 구독 정보 저장
      // 먼저 기존 구독이 있는지 확인
      const { data: existingSubscription } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('endpoint', subscriptionData.endpoint)
        .maybeSingle()

      let error
      if (existingSubscription) {
        // 기존 구독 업데이트
        const { error: updateError } = await supabase
          .from('push_subscriptions')
          .update({
            room_id: roomId,
            customer_email: customerEmail || null,
            p256dh_key: subscriptionData.keys.p256dh,
            auth_key: subscriptionData.keys.auth,
            language: language || 'ko'
          })
          .eq('endpoint', subscriptionData.endpoint)
        error = updateError
      } else {
        // 새 구독 생성
        const { error: insertError } = await supabase
          .from('push_subscriptions')
          .insert({
            room_id: roomId,
            customer_email: customerEmail || null,
            endpoint: subscriptionData.endpoint,
            p256dh_key: subscriptionData.keys.p256dh,
            auth_key: subscriptionData.keys.auth,
            language: language || 'ko'
          })
        error = insertError
      }

      if (error) {
        console.error('Error saving subscription:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          fullError: error
        })
        setIsLoading(false)
        return false
      }

      setIsSubscribed(true)
      setIsLoading(false)
      return true
    } catch (error) {
      console.error('Error subscribing to push:', error)
      setIsLoading(false)
      return false
    }
  }, [isSupported, roomId, customerEmail, language, requestPermission])

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false

    setIsLoading(true)

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await subscription.unsubscribe()

        // 서버에서 구독 정보 삭제
        const { error } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', subscription.endpoint)

        if (error) {
          console.error('Error deleting subscription:', error)
        }

        setIsSubscribed(false)
      }

      setIsLoading(false)
      return true
    } catch (error) {
      console.error('Error unsubscribing from push:', error)
      setIsLoading(false)
      return false
    }
  }, [isSupported])

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
    requestPermission
  }
}

// VAPID 키 변환 유틸리티
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

