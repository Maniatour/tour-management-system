'use client'

import { supabase } from '@/lib/supabase'

export interface StaffPushSubscriptionKeys {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

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

/** 직원용(SOP 등) 웹푸시 구독을 DB에 저장 */
export async function saveStaffPushSubscription(
  userId: string,
  userEmail: string,
  language: 'ko' | 'en'
): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, error: 'not_supported' }
  }

  if (process.env.NODE_ENV !== 'production') {
    return { ok: false, error: 'dev_no_service_worker' }
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidPublicKey) {
    return { ok: false, error: 'no_vapid' }
  }

  const perm = await Notification.requestPermission()
  if (perm !== 'granted') {
    return { ok: false, error: 'permission_denied' }
  }

  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  await registration.update()

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  })

  const subscriptionData: StaffPushSubscriptionKeys = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
      auth: arrayBufferToBase64(subscription.getKey('auth')!),
    },
  }

  const row = {
    user_id: userId,
    user_email: userEmail.trim().toLowerCase(),
    endpoint: subscriptionData.endpoint,
    p256dh_key: subscriptionData.keys.p256dh,
    auth_key: subscriptionData.keys.auth,
    language,
  }

  const { error } = await supabase.from('staff_push_subscriptions').upsert(row, { onConflict: 'endpoint' })

  if (error) {
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
