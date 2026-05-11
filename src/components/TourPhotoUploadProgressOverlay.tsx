'use client'

import { useSyncExternalStore, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import {
  getTourPhotoUploadSession,
  subscribeTourPhotoUploadSession,
} from '@/lib/tourPhotoUploadSession'

export default function TourPhotoUploadProgressOverlay() {
  const t = useTranslations('tours.tourPhoto')
  const snap = useSyncExternalStore(
    subscribeTourPhotoUploadSession,
    getTourPhotoUploadSession,
    getTourPhotoUploadSession
  )

  useEffect(() => {
    if (!snap.active) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [snap.active])

  if (!snap.active || !snap.tourId) return null

  if (snap.preparing) {
    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-photo-upload-preparing-title"
      >
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
          <div className="flex items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 shrink-0" aria-hidden />
            <div>
              <h2 id="tour-photo-upload-preparing-title" className="text-lg font-semibold text-gray-900">
                {t('uploadProgressModalPreparingTitle')}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {t('uploadProgressModalPreparingHint', { count: snap.prepareSelectedCount })}
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-500">{t('uploadProgressBackgroundNote')}</p>
        </div>
      </div>
    )
  }

  if (!snap.total) return null

  const pct = Math.min(100, Math.round((snap.current / snap.total) * 100))

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-photo-upload-progress-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 shrink-0" aria-hidden />
          <div>
            <h2 id="tour-photo-upload-progress-title" className="text-lg font-semibold text-gray-900">
              {t('uploadProgressModalTitle')}
            </h2>
            <p className="text-sm text-gray-600 mt-1">{t('uploadProgressModalHint')}</p>
          </div>
        </div>
        <p className="text-sm font-medium text-gray-800 mb-2">
          {t('uploadProgressCount', { current: snap.current, total: snap.total })}
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-blue-600 transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-3 text-xs text-gray-500">{t('uploadProgressBackgroundNote')}</p>
      </div>
    </div>
  )
}
