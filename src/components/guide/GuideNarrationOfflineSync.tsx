'use client'

import { useEffect } from 'react'
import { syncGuideNarrationOffline } from '@/lib/guideNarrationOffline'
import { isBrowserOffline } from '@/lib/guideOfflineStore'

export default function GuideNarrationOfflineSync() {
  useEffect(() => {
    void syncGuideNarrationOffline()
    const onOnline = () => {
      void syncGuideNarrationOffline()
    }
    window.addEventListener('online', onOnline)
    if (!isBrowserOffline()) {
      const timer = window.setTimeout(() => {
        void syncGuideNarrationOffline()
      }, 1500)
      return () => {
        window.clearTimeout(timer)
        window.removeEventListener('online', onOnline)
      }
    }
    return () => window.removeEventListener('online', onOnline)
  }, [])

  return null
}
