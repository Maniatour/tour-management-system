'use client'

import {
  DEFAULT_MESSENGER_CONTACT_SETTINGS,
  type MessengerContactSettings,
} from '@/lib/preTourContactSms'

let cached: MessengerContactSettings | null = null
let inflight: Promise<MessengerContactSettings> | null = null

function normalizeContacts(data: Partial<MessengerContactSettings>): MessengerContactSettings {
  return {
    line_id: String(data.line_id ?? '').trim(),
    whatsapp: String(data.whatsapp ?? '').trim(),
    kakao: String(data.kakao ?? '').trim(),
    contact_email: String(data.contact_email ?? '').trim(),
  }
}

async function fetchFromApi(): Promise<MessengerContactSettings> {
  try {
    const res = await fetch('/api/messenger-contact-settings')
    const data = (await res.json()) as Partial<MessengerContactSettings>
    if (!res.ok) return { ...DEFAULT_MESSENGER_CONTACT_SETTINGS }
    const normalized = normalizeContacts(data)
    const hasAny =
      normalized.line_id ||
      normalized.whatsapp ||
      normalized.kakao ||
      normalized.contact_email
    return hasAny ? normalized : { ...DEFAULT_MESSENGER_CONTACT_SETTINGS }
  } catch {
    return { ...DEFAULT_MESSENGER_CONTACT_SETTINGS }
  }
}

export function getCachedMessengerContactSettings(): MessengerContactSettings | null {
  return cached
}

export function getInitialMessengerContactSettings(): MessengerContactSettings {
  return cached ?? { ...DEFAULT_MESSENGER_CONTACT_SETTINGS }
}

export function prefetchMessengerContactSettings(): void {
  if (cached || inflight) return
  inflight = fetchFromApi().then((settings) => {
    cached = settings
    inflight = null
    return settings
  })
}

export async function loadMessengerContactSettings(options?: {
  force?: boolean
}): Promise<MessengerContactSettings> {
  if (!options?.force) {
    if (cached) return cached
    if (inflight) return inflight
  } else {
    cached = null
    inflight = null
  }

  const promise = fetchFromApi().then((settings) => {
    cached = settings
    inflight = null
    return settings
  })
  inflight = promise
  return promise
}

export function invalidateMessengerContactSettingsCache(): void {
  cached = null
  inflight = null
}
