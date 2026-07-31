'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import {
  mergeAdminSmsCategorySettings,
  type AdminSmsCategorySettingsRow,
} from '@/lib/adminSmsCategorySettings'
import type { AdminSmsCategoryId } from '@/lib/adminSmsTemplateCatalog'

let cachedSettings: Record<AdminSmsCategoryId, AdminSmsCategorySettingsRow> | null = null
let cachePromise: Promise<Record<AdminSmsCategoryId, AdminSmsCategorySettingsRow>> | null = null

async function fetchSettings(): Promise<Record<AdminSmsCategoryId, AdminSmsCategorySettingsRow>> {
  const res = await fetchApiWithAuth('/api/admin-sms-category-settings')
  const data = (await res.json()) as {
    settings?: AdminSmsCategorySettingsRow[]
    error?: string
  }
  if (!res.ok) {
    return mergeAdminSmsCategorySettings([])
  }
  const merged = mergeAdminSmsCategorySettings(data.settings ?? [])
  cachedSettings = merged
  return merged
}

export function invalidateAdminSmsCategorySettingsCache() {
  cachedSettings = null
  cachePromise = null
}

/** 헤더 버튼 등에서 모달 열기 전에 설정을 미리 불러옵니다. */
export function prefetchAdminSmsCategorySettings(): void {
  if (cachedSettings || cachePromise) return
  cachePromise = fetchSettings()
}

export function useAdminSmsCategorySettings(options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false
  const [settings, setSettings] = useState<Record<AdminSmsCategoryId, AdminSmsCategorySettingsRow>>(
    () => cachedSettings ?? mergeAdminSmsCategorySettings([])
  )
  const [loading, setLoading] = useState(!cachedSettings && enabled)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const next = await fetchSettings()
      setSettings(next)
      return next
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    if (cachedSettings) {
      setSettings(cachedSettings)
      setLoading(false)
      return
    }
    if (!cachePromise) {
      cachePromise = fetchSettings()
    }
    void cachePromise.then((next) => {
      setSettings(next)
      setLoading(false)
    })
  }, [enabled])

  return { settings, loading, reload }
}

export function getDefaultAdminSmsCategorySettings(): Record<
  AdminSmsCategoryId,
  AdminSmsCategorySettingsRow
> {
  return mergeAdminSmsCategorySettings([])
}
