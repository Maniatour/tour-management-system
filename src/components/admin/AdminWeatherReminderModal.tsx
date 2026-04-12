'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Cloud, ExternalLink, Loader2, RefreshCw } from 'lucide-react'

const DISMISS_KEY = 'admin_weather_reminder_dismissed'

export type WeatherStatusPayload = {
  today: string
  todayComplete: boolean
  missingTodayLocations: string[]
  lastUpdatedAt: string | null
  collectionStale: boolean
  needsReminder: boolean
}

interface AdminWeatherReminderModalProps {
  locale: string
}

export default function AdminWeatherReminderModal({ locale }: AdminWeatherReminderModalProps) {
  const pathname = usePathname() ?? ''
  const t = useTranslations('adminWeatherReminder')
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<WeatherStatusPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const [collectMessage, setCollectMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/weather-status', { cache: 'no-store' })
      if (!res.ok) {
        setError(t('loadError'))
        return
      }
      const json = (await res.json()) as WeatherStatusPayload
      setStatus(json)
    } catch {
      setError(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  useEffect(() => {
    if (loading || !status) return
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(DISMISS_KEY) === '1') return
    if (pathname.includes('/admin/data-sync')) return
    if (!status.needsReminder) return
    setOpen(true)
  }, [loading, status, pathname])

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
    setOpen(false)
  }

  const formatLastUpdated = (iso: string | null) => {
    if (!iso) return t('never')
    try {
      return new Date(iso).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    } catch {
      return iso
    }
  }

  const collectNext7Days = async () => {
    setCollecting(true)
    setCollectMessage(null)
    setError(null)
    try {
      const response = await fetch('/api/weather-scheduler', { method: 'GET' })
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}))
        setError(
          typeof errBody.error === 'string' ? errBody.error : t('collectError')
        )
        return
      }
      const result = await response.json()
      let msg = t('collectDone')
      if (result.results && Array.isArray(result.results)) {
        const ok = result.results.filter((r: { status?: string }) => r.status === 'success').length
        const bad = result.results.filter((r: { status?: string }) => r.status === 'error').length
        msg = t('collectDoneDetail', { ok: String(ok), bad: String(bad) })
      }
      setCollectMessage(msg)
      await loadStatus()
      const res2 = await fetch('/api/admin/weather-status', { cache: 'no-store' })
      if (res2.ok) {
        const j = (await res2.json()) as WeatherStatusPayload
        setStatus(j)
        if (!j.needsReminder) {
          setOpen(false)
        }
      }
    } catch {
      setError(t('collectError'))
    } finally {
      setCollecting(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-weather-reminder-title"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 relative">
        <div className="flex items-start gap-3 mb-4">
          <div className="bg-sky-100 rounded-full p-2 shrink-0">
            <Cloud className="h-6 w-6 text-sky-600" />
          </div>
          <div>
            <h2 id="admin-weather-reminder-title" className="text-lg font-semibold text-gray-900">
              {t('title')}
            </h2>
            <p className="text-sm text-gray-600 mt-1">{t('subtitle')}</p>
          </div>
        </div>

        {status && (
          <ul className="text-sm text-gray-700 space-y-2 mb-4 bg-gray-50 rounded-md p-3 border border-gray-100">
            <li>
              <span className="font-medium text-gray-800">{t('labelToday')}:</span>{' '}
              {status.today} —{' '}
              {status.todayComplete ? (
                <span className="text-green-700">{t('todayOk')}</span>
              ) : (
                <span className="text-amber-700">{t('todayMissing')}</span>
              )}
            </li>
            {!status.todayComplete && status.missingTodayLocations.length > 0 && (
              <li className="text-xs text-gray-600 pl-1">
                {t('missingLocations')}: {status.missingTodayLocations.join(', ')}
              </li>
            )}
            <li>
              <span className="font-medium text-gray-800">{t('labelLastCollect')}:</span>{' '}
              {formatLastUpdated(status.lastUpdatedAt)}
              {status.collectionStale && (
                <span className="text-amber-700 ml-1">({t('staleWeek')})</span>
              )}
            </li>
          </ul>
        )}

        {error && (
          <p className="text-sm text-red-600 mb-3">{error}</p>
        )}
        {collectMessage && (
          <p className="text-sm text-green-700 mb-3">{collectMessage}</p>
        )}

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <button
            type="button"
            disabled={collecting}
            onClick={collectNext7Days}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
          >
            {collecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {t('collect7Days')}
          </button>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-2 text-sm">
          <Link
            href={`/${locale}/admin/weather-records`}
            className="inline-flex items-center gap-1 text-sky-700 hover:underline"
            onClick={() => setOpen(false)}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t('linkRecords')}
          </Link>
          <Link
            href={`/${locale}/admin/data-sync`}
            className="inline-flex items-center gap-1 text-gray-600 hover:underline"
            onClick={() => setOpen(false)}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t('linkDataSync')}
          </Link>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={handleDismiss}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
          >
            {t('dismissSession')}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2 text-sm bg-gray-800 text-white rounded-md hover:bg-gray-900"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  )
}
