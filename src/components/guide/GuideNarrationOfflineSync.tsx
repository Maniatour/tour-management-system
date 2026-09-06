'use client'

import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { syncGuideNarrationOffline } from '@/lib/guideNarrationOffline'
import { isBrowserOffline } from '@/lib/guideOfflineStore'
import { canUseAuthenticatedRest } from '@/lib/supabase'

export default function GuideNarrationOfflineSync() {
  const { isInitialized, loading, user } = useAuth()
  const canSync = isInitialized && !loading && Boolean(user) && canUseAuthenticatedRest()

  useEffect(() => {
    if (!canSync) return
    void syncGuideNarrationOffline()
    const onOnline = () => {
      if (!canUseAuthenticatedRest()) return
      void syncGuideNarrationOffline()
    }
    window.addEventListener('online', onOnline)
    if (!isBrowserOffline()) {
      const timer = window.setTimeout(() => {
        if (!canUseAuthenticatedRest()) return
        void syncGuideNarrationOffline()
      }, 1500)
      return () => {
        window.clearTimeout(timer)
        window.removeEventListener('online', onOnline)
      }
    }
    return () => window.removeEventListener('online', onOnline)
  }, [canSync])

  return null
}
