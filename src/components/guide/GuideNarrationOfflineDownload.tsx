'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, DownloadCloud, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useNarrationOfflineStatus } from '@/hooks/useNarrationOfflineStatus'
import {
  getNarrationOfflineStatus,
  syncGuideNarrationOffline,
} from '@/lib/guideNarrationOffline'

export default function GuideNarrationOfflineDownload() {
  const t = useTranslations('guide')
  const narrationStatus = useNarrationOfflineStatus()
  const [offline, setOffline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false,
  )
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const sync = () => setOffline(typeof navigator !== 'undefined' && navigator.onLine === false)
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  const syncing = busy || narrationStatus.status === 'syncing'
  const ready = narrationStatus.status === 'ready' && narrationStatus.total > 0

  const handleDownload = async () => {
    if (offline) {
      toast.error(t('narrationOfflineDownloadNeedsNetwork'))
      return
    }
    setBusy(true)
    try {
      await syncGuideNarrationOffline()
      const next = getNarrationOfflineStatus()
      if (next.status === 'ready' && next.total > 0) {
        toast.success(t('narrationOfflineDownloadDone'))
        return
      }
      if (next.total === 0) {
        toast.message(t('narrationOfflineDownloadEmpty'))
        return
      }
      toast.error(t('narrationOfflineDownloadFailed'))
    } finally {
      setBusy(false)
    }
  }

  const label = syncing
    ? t('narrationOfflineSyncing', {
        cached: narrationStatus.cached,
        total: narrationStatus.total,
      })
    : ready
      ? t('narrationOfflineDownloadAgain')
      : t('narrationOfflineDownload')

  return (
    <div className="mt-3 space-y-2">
      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={syncing}
        className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70 ${
          ready && !syncing
            ? 'border border-border bg-white text-gray-900 shadow-sm hover:bg-gray-50'
            : 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
        }`}
      >
        {syncing ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        ) : ready ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden />
        ) : (
          <DownloadCloud className="h-5 w-5" aria-hidden />
        )}
        {label}
      </button>
      {narrationStatus.total > 0 && !syncing && (
        <p className="flex items-center gap-1.5 text-xs text-gray-500">
          {ready ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" aria-hidden />
          ) : (
            <DownloadCloud className="h-3.5 w-3.5 text-primary" aria-hidden />
          )}
          <span>{ready ? t('narrationOfflineReady') : t('narrationOfflinePartial')}</span>
        </p>
      )}
    </div>
  )
}
