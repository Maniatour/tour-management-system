'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  fetchHubArticlesForManualLink,
  type HubArticleLinkOption,
} from '@/lib/hubArticleManualLink'
import {
  canUseAuthenticatedRest,
  getStoredAccessTokenIfValid,
  updateSupabaseToken,
} from '@/lib/supabase'

function authEmailReady(user: { email?: string } | null, authUser: { email?: string } | null): string {
  return (authUser?.email || user?.email || '').trim()
}

async function ensureRestAuthReady(): Promise<boolean> {
  const token = getStoredAccessTokenIfValid(0)
  if (!token) return false
  updateSupabaseToken(token)
  return canUseAuthenticatedRest()
}

export function useHubArticlesForManualLink(enabled = true) {
  const { user, authUser, isInitialized } = useAuth()
  const [articles, setArticles] = useState<HubArticleLinkOption[]>([])
  const [loading, setLoading] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const fetchGenRef = useRef(0)

  const email = authEmailReady(user, authUser)
  const authReady = enabled && isInitialized && email.length > 0

  const reload = useCallback(async () => {
    if (!authReady) return []

    const ready = await ensureRestAuthReady()
    if (!ready) {
      setLoadFailed(true)
      setArticles([])
      return []
    }

    const gen = ++fetchGenRef.current
    setLoading(true)
    setLoadFailed(false)
    try {
      const rows = await fetchHubArticlesForManualLink()
      if (gen !== fetchGenRef.current) return rows
      setArticles(rows)
      setLoadFailed(rows.length === 0)
      return rows
    } catch (e) {
      if (gen === fetchGenRef.current) {
        console.error('useHubArticlesForManualLink', e)
        setLoadFailed(true)
        setArticles([])
      }
      return []
    } finally {
      if (gen === fetchGenRef.current) setLoading(false)
    }
  }, [authReady])

  useEffect(() => {
    if (!authReady) return
    void reload()
  }, [authReady, reload])

  return {
    articles,
    loading,
    loadFailed: loadFailed && !loading,
    reload,
  }
}
