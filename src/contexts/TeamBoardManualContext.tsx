'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import SopHubArticleReadModal from '@/components/sop/SopHubArticleReadModal'
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
import type { SopEditLocale } from '@/types/sopStructure'

type TeamBoardManualContextValue = {
  hubArticles: HubArticleLinkOption[]
  hubArticlesLoading: boolean
  openManual: (articleId: string | null | undefined) => void
  refreshHubArticles: () => Promise<void>
}

const TeamBoardManualContext = createContext<TeamBoardManualContextValue | null>(null)

export function TeamBoardManualProvider({
  locale,
  children,
}: {
  locale: string
  children: ReactNode
}) {
  const viewLang: SopEditLocale = locale === 'en' ? 'en' : 'ko'
  const uiLocaleEn = locale === 'en'
  const { user, authUser, isInitialized } = useAuth()
  const [hubArticles, setHubArticles] = useState<HubArticleLinkOption[]>([])
  const [hubArticlesLoading, setHubArticlesLoading] = useState(false)
  const hubArticlesRef = useRef(hubArticles)
  hubArticlesRef.current = hubArticles
  const [open, setOpen] = useState(false)
  const [articleId, setArticleId] = useState<string | null>(null)

  const authEmail = (authUser?.email || user?.email || '').trim()
  const authReady = isInitialized && authEmail.length > 0

  const refreshHubArticles = useCallback(async () => {
    if (!authReady) return

    const token = getStoredAccessTokenIfValid(0)
    if (!token || !canUseAuthenticatedRest()) return
    updateSupabaseToken(token)

    const isInitialLoad = hubArticlesRef.current.length === 0
    if (isInitialLoad) setHubArticlesLoading(true)
    try {
      const rows = await fetchHubArticlesForManualLink()
      setHubArticles(rows)
    } catch (e) {
      console.error('TeamBoardManualContext.refreshHubArticles', e)
      setHubArticles([])
    } finally {
      setHubArticlesLoading(false)
    }
  }, [authReady])

  useEffect(() => {
    if (!authReady) return
    void refreshHubArticles()
  }, [authReady, refreshHubArticles])

  const openManual = useCallback((id: string | null | undefined) => {
    const trimmed = id?.trim()
    if (!trimmed) return
    setArticleId(trimmed)
    setOpen(true)
  }, [])

  const value = useMemo(
    () => ({
      hubArticles,
      hubArticlesLoading,
      openManual,
      refreshHubArticles,
    }),
    [hubArticles, hubArticlesLoading, openManual, refreshHubArticles]
  )

  return (
    <TeamBoardManualContext.Provider value={value}>
      {children}
      <SopHubArticleReadModal
        open={open}
        onOpenChange={setOpen}
        articleId={articleId}
        hubArticles={hubArticles}
        viewLang={viewLang}
        uiLocaleEn={uiLocaleEn}
      />
    </TeamBoardManualContext.Provider>
  )
}

export function useTeamBoardManual() {
  const ctx = useContext(TeamBoardManualContext)
  if (!ctx) {
    throw new Error('useTeamBoardManual must be used within TeamBoardManualProvider')
  }
  return ctx
}

export function useTeamBoardManualOptional() {
  return useContext(TeamBoardManualContext)
}
