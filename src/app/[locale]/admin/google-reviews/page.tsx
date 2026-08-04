'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { CheckCircle2, ChevronDown, Link2, Loader2, MapPin, Star, Unlink, Users } from 'lucide-react'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import GoogleReviewsImportSection from '@/components/admin/google-reviews/GoogleReviewsImportSection'
import GoogleReviewsManageSection from '@/components/admin/google-reviews/GoogleReviewsManageSection'
import GoogleReviewStaffStatsModal from '@/components/admin/google-reviews/GoogleReviewStaffStatsModal'
import OtaReviewsImportSection from '@/components/admin/google-reviews/OtaReviewsImportSection'
import {
  isOtaReviewSource,
  isReviewSource,
  isReviewSourceTabWithCount,
  REVIEW_SOURCE_TABS,
  type ReviewSource,
  type ReviewSourceTabWithCount,
} from '@/lib/reviewSources'
import type {
  GoogleBusinessAccountItem,
  GoogleBusinessConnectionStatus,
  GoogleBusinessLocationItem,
  GoogleReviewSourceTabSummary,
  GoogleReviewStats,
} from '@/types/googleBusiness'

type StatusResponse = GoogleBusinessConnectionStatus & {
  ok?: boolean
  reviewStats?: GoogleReviewStats
}

type AccountsResponse = {
  ok?: boolean
  accounts?: GoogleBusinessAccountItem[]
  error?: string
}

type LocationsResponse = {
  ok?: boolean
  locations?: GoogleBusinessLocationItem[]
  resolvedAccountName?: string | null
  empty?: boolean
  error?: string
}

export default function AdminGoogleReviewsPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const locale = params?.locale === 'en' ? 'en' : 'ko'
  const isKo = locale === 'ko'

  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [accounts, setAccounts] = useState<GoogleBusinessAccountItem[]>([])
  const [locations, setLocations] = useState<GoogleBusinessLocationItem[]>([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [loadingLocations, setLoadingLocations] = useState(false)
  const [savingSelection, setSavingSelection] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [locationsHint, setLocationsHint] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeSource, setActiveSource] = useState<ReviewSource>('google')
  const [statusLoadFailed, setStatusLoadFailed] = useState(false)
  const [connectionPanelOpen, setConnectionPanelOpen] = useState(true)
  const [sourceReviewSummaries, setSourceReviewSummaries] = useState<
    Partial<Record<ReviewSourceTabWithCount, GoogleReviewSourceTabSummary>>
  >({})
  const [loadingSourceCounts, setLoadingSourceCounts] = useState(true)
  const [staffStatsOpen, setStaffStatsOpen] = useState(false)

  type GoogleTabStatus = 'loading' | 'connected' | 'warning' | 'error' | 'disconnected'

  const oauthError = searchParams.get('error')

  const googleTabStatus = useMemo((): GoogleTabStatus => {
    if (loadingStatus) return 'loading'
    if (oauthError || statusLoadFailed) return 'error'
    if (!status?.connected) return 'disconnected'
    if (!status.googleLocationName || locationsHint) return 'warning'
    return 'connected'
  }, [loadingStatus, oauthError, status, statusLoadFailed, locationsHint])

  const googleTabStatusLabel = useMemo(() => {
    switch (googleTabStatus) {
      case 'connected':
        return isKo ? '연결됨' : 'Connected'
      case 'warning':
        return isKo ? '설정 필요' : 'Setup needed'
      case 'error':
        return isKo ? '연결 오류' : 'Connection error'
      case 'loading':
        return isKo ? '확인 중…' : 'Checking…'
      default:
        return isKo ? '미연결' : 'Not connected'
    }
  }, [googleTabStatus, isKo])

  function getTabButtonClass(tabId: ReviewSource, isActive: boolean): string {
    if (tabId !== 'google') {
      return isActive
        ? 'bg-primary text-primary-foreground border-primary'
        : 'border-border bg-background text-foreground hover:bg-muted/50'
    }

    if (isActive) {
      switch (googleTabStatus) {
        case 'connected':
          return 'bg-success text-white border-success shadow-sm'
        case 'warning':
          return 'bg-amber-500 text-white border-amber-500 shadow-sm'
        case 'error':
          return 'bg-danger text-danger-foreground border-danger shadow-sm'
        case 'loading':
          return 'border-border bg-muted text-muted-foreground'
        default:
          return 'bg-primary text-primary-foreground border-primary'
      }
    }

    switch (googleTabStatus) {
      case 'connected':
        return 'border-success/60 bg-success/10 text-success hover:bg-success/15'
      case 'warning':
        return 'border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/15'
      case 'error':
        return 'border-danger/60 bg-danger/10 text-danger hover:bg-danger/15'
      case 'loading':
        return 'border-border bg-muted/50 text-muted-foreground'
      default:
        return 'border-border bg-background text-muted-foreground hover:bg-muted/50'
    }
  }

  function getTabCountBadgeClass(tabId: ReviewSource, isActive: boolean): string {
    if (!isActive) {
      return 'bg-muted/80 text-muted-foreground'
    }
    if (tabId === 'google') {
      if (googleTabStatus === 'connected' || googleTabStatus === 'warning' || googleTabStatus === 'error') {
        return 'bg-white/20 text-white'
      }
      return 'bg-primary-foreground/15 text-primary-foreground'
    }
    return 'bg-primary-foreground/15 text-primary-foreground'
  }

  const formatTabReviewCount = useCallback(
    (count: number) => count.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US'),
    [locale]
  )

  const formatTabAvgRating = useCallback((avgRating: number | null | undefined) => {
    if (avgRating == null) return null
    return `★${avgRating.toFixed(2)}`
  }, [])

  const handleSourceReviewCount = useCallback((source: ReviewSource, total: number) => {
    if (!isReviewSourceTabWithCount(source)) return
    setSourceReviewSummaries((prev) => ({
      ...prev,
      [source]: { total, avgRating: prev[source]?.avgRating ?? null },
    }))
  }, [])

  const didAutoCollapseRef = useRef(false)

  useEffect(() => {
    if (loadingStatus) return
    if (
      googleTabStatus === 'warning' ||
      googleTabStatus === 'error' ||
      googleTabStatus === 'disconnected'
    ) {
      setConnectionPanelOpen(true)
      didAutoCollapseRef.current = false
      return
    }
    if (googleTabStatus === 'connected' && !didAutoCollapseRef.current) {
      setConnectionPanelOpen(false)
      didAutoCollapseRef.current = true
    }
  }, [loadingStatus, googleTabStatus])

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && isReviewSource(tab)) {
      setActiveSource(tab)
    }
  }, [searchParams])

  const isGoogleTab = activeSource === 'google'

  const connectUrl = `/api/admin/google-business/connect?locale=${locale}`

  const emptyStatus = (): StatusResponse => ({
    connected: false,
    connectedEmail: null,
    googleAccountName: null,
    googleAccountDisplayName: null,
    googleLocationName: null,
    googleLocationTitle: null,
    updatedAt: null,
    lastSyncedAt: null,
    lastImportReviewCount: null,
  })

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true)
    try {
      const res = await fetchApiWithAuth('/api/admin/google-business/status')
      const data = (await res.json()) as StatusResponse
      if (!res.ok) {
        setStatus(emptyStatus())
        setStatusLoadFailed(true)
        return
      }
      setStatusLoadFailed(false)
      setStatus(data)
      if (data.googleAccountName) setSelectedAccount(data.googleAccountName)
      if (data.googleLocationName) setSelectedLocation(data.googleLocationName)
    } catch (error) {
      console.error('[admin/google-reviews] status', error)
      setStatusLoadFailed(true)
    } finally {
      setLoadingStatus(false)
    }
  }, [])

  const refreshAll = useCallback(async () => {
    await loadStatus()
    setRefreshKey((key) => key + 1)
  }, [loadStatus])

  const loadSourceReviewCounts = useCallback(async () => {
    setLoadingSourceCounts(true)
    try {
      const res = await fetchApiWithAuth('/api/admin/google-business/reviews/source-counts')
      const data = (await res.json()) as {
        ok?: boolean
        counts?: Partial<Record<ReviewSourceTabWithCount, number>>
        summaries?: Partial<Record<ReviewSourceTabWithCount, GoogleReviewSourceTabSummary>>
        error?: string
      }
      if (!res.ok || !data.ok) {
        console.error('[admin/google-reviews] source-counts', data.error)
        return
      }
      if (data.summaries) {
        setSourceReviewSummaries(data.summaries)
      } else if (data.counts) {
        setSourceReviewSummaries(
          Object.fromEntries(
            Object.entries(data.counts).map(([source, total]) => [
              source,
              { total: total ?? 0, avgRating: null },
            ])
          ) as Partial<Record<ReviewSourceTabWithCount, GoogleReviewSourceTabSummary>>
        )
      }
    } catch (error) {
      console.error('[admin/google-reviews] source-counts', error)
    } finally {
      setLoadingSourceCounts(false)
    }
  }, [])

  const notify = useCallback((_message: string) => {
    // Page-level alert box removed — Google tab color shows connection status.
  }, [])

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true)
    try {
      const res = await fetchApiWithAuth('/api/admin/google-business/accounts')
      const data = (await res.json()) as AccountsResponse
      if (!res.ok || !data.ok) {
        console.error('[admin/google-reviews] accounts', data.error)
        return
      }
      setAccounts(data.accounts ?? [])
      setSelectedAccount((prev) => prev || data.accounts?.[0]?.name || '')
    } catch (error) {
      console.error('[admin/google-reviews] accounts', error)
    } finally {
      setLoadingAccounts(false)
    }
  }, [])

  const loadLocations = useCallback(
    async (accountName: string) => {
      if (!accountName) {
        setLocations([])
        setLocationsHint(null)
        return
      }
      setLoadingLocations(true)
      setLocationsHint(null)
      try {
        const res = await fetchApiWithAuth(
          `/api/admin/google-business/locations?account=${encodeURIComponent(accountName)}&discover=1`
        )
        const data = (await res.json()) as LocationsResponse
        if (!res.ok || !data.ok) {
          const err = data.error || (isKo ? '위치 목록을 불러오지 못했습니다.' : 'Failed to load locations.')
          setLocationsHint(err)
          return
        }
        setLocations(data.locations ?? [])
        if (data.resolvedAccountName && data.resolvedAccountName !== accountName) {
          setSelectedAccount(data.resolvedAccountName)
        }
        if ((data.locations?.length ?? 0) === 0) {
          setLocationsHint(
            isKo
              ? '연결된 Google 계정에서 위치를 찾지 못했습니다. Google Business Profile에서 이 계정이 해당 위치의 소유자/관리자인지 확인하세요. Google Cloud Console에서 My Business API가 활성화되어 있는지도 확인하세요.'
              : 'No locations found for the linked Google account. Confirm this account owns or manages the business location in Google Business Profile, and that My Business API is enabled in Google Cloud Console.'
          )
        }
      } catch (error) {
        console.error('[admin/google-reviews] locations', error)
        setLocationsHint(isKo ? '위치 목록을 불러오지 못했습니다.' : 'Failed to load locations.')
      } finally {
        setLoadingLocations(false)
      }
    },
    [isKo]
  )

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  useEffect(() => {
    void loadSourceReviewCounts()
  }, [loadSourceReviewCounts, refreshKey])

  useEffect(() => {
    if (searchParams.get('success') === '1') {
      void loadStatus()
    }
  }, [searchParams, loadStatus])

  useEffect(() => {
    if (!status?.connected) return
    void loadAccounts()
  }, [status?.connected, loadAccounts])

  useEffect(() => {
    if (!selectedAccount) return
    void loadLocations(selectedAccount)
  }, [selectedAccount, loadLocations])

  const selectedAccountLabel = useMemo(() => {
    const match = accounts.find((row) => row.name === selectedAccount)
    return match?.accountName || status?.googleAccountDisplayName || selectedAccount
  }, [accounts, selectedAccount, status?.googleAccountDisplayName])

  const selectedLocationLabel = useMemo(() => {
    const match = locations.find((row) => row.name === selectedLocation)
    return match?.title || status?.googleLocationTitle || selectedLocation
  }, [locations, selectedLocation, status?.googleLocationTitle])

  const handleSaveSelection = async () => {
    if (!selectedAccount || !selectedLocation) {
      return
    }

    const account = accounts.find((row) => row.name === selectedAccount)
    const location = locations.find((row) => row.name === selectedLocation)

    setSavingSelection(true)
    try {
      const res = await fetchApiWithAuth('/api/admin/google-business/connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleAccountName: selectedAccount,
          googleAccountDisplayName: account?.accountName ?? null,
          googleLocationName: selectedLocation,
          googleLocationTitle: location?.title ?? null,
        }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string; detail?: string }
      if (!res.ok || !data.ok) {
        console.error('[admin/google-reviews] save', data.error)
        return
      }
      await loadStatus()
    } catch (error) {
      console.error('[admin/google-reviews] save', error)
    } finally {
      setSavingSelection(false)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      const res = await fetchApiWithAuth('/api/admin/google-business/disconnect', { method: 'POST' })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        console.error('[admin/google-reviews] disconnect', data.error)
        return
      }
      setAccounts([])
      setLocations([])
      setSelectedAccount('')
      setSelectedLocation('')
      setStatus(emptyStatus())
      setStatusLoadFailed(false)
    } catch (error) {
      console.error('[admin/google-reviews] disconnect', error)
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-6">
      <div className="mb-4">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Star className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
                {isKo ? '리뷰 연동 관리' : 'Review integration'}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {isKo
                  ? 'Google·OTA 채널별 리뷰를 가져오고 승인·분류·투어 연결을 관리합니다.'
                  : 'Import and moderate reviews per channel — Google, GetYourGuide, Viator, and more.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStaffStatsOpen(true)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card text-foreground shadow-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={isKo ? '가이드·어시스턴트 리뷰 점수' : 'Guide & assistant review scores'}
            title={isKo ? '가이드·어시스턴트 리뷰 점수' : 'Guide & assistant review scores'}
          >
            <Users className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      <GoogleReviewStaffStatsModal
        locale={locale}
        open={staffStatsOpen}
        onOpenChange={setStaffStatsOpen}
        refreshKey={refreshKey}
      />

      <div className="flex flex-wrap gap-2 border-b border-border/60 pb-4">
        {REVIEW_SOURCE_TABS.map((tab) => {
          const isActive = activeSource === tab.id
          const tabSummary = isReviewSourceTabWithCount(tab.id)
            ? sourceReviewSummaries[tab.id]
            : undefined
          const tabAvgLabel = formatTabAvgRating(tabSummary?.avgRating)
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSource(tab.id)}
              title={tab.id === 'google' ? googleTabStatusLabel : undefined}
              aria-label={
                tab.id === 'google'
                  ? `${isKo ? tab.labelKo : tab.labelEn} — ${googleTabStatusLabel}`
                  : undefined
              }
              className={`inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-medium border transition-colors ${getTabButtonClass(tab.id, isActive)}`}
            >
              {tab.id === 'google' && googleTabStatus === 'loading' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
              ) : tab.id === 'google' ? (
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    googleTabStatus === 'connected'
                      ? 'bg-success'
                      : googleTabStatus === 'warning'
                        ? 'bg-amber-500'
                        : googleTabStatus === 'error'
                          ? 'bg-danger'
                          : 'bg-muted-foreground/40'
                  } ${isActive && googleTabStatus === 'connected' ? 'bg-white' : ''} ${
                    isActive && googleTabStatus === 'warning' ? 'bg-white' : ''
                  }`}
                  aria-hidden
                />
              ) : null}
              {isKo ? tab.labelKo : tab.labelEn}
              {isReviewSourceTabWithCount(tab.id) ? (
                <span
                  className={`inline-flex items-center gap-1 justify-center min-w-[1.75rem] h-5 px-1.5 rounded-md text-xs font-medium tabular-nums ${getTabCountBadgeClass(tab.id, isActive)}`}
                >
                  {loadingSourceCounts && tabSummary == null ? (
                    '…'
                  ) : (
                    <>
                      <span>{formatTabReviewCount(tabSummary?.total ?? 0)}</span>
                      {tabAvgLabel ? <span className="opacity-90">{tabAvgLabel}</span> : null}
                    </>
                  )}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {isGoogleTab ? (
      <section className="rounded-2xl border border-border/60 bg-card shadow-sm p-6">
        <button
          type="button"
          onClick={() => setConnectionPanelOpen((open) => !open)}
          aria-expanded={connectionPanelOpen}
          className="flex w-full items-start justify-between gap-4 flex-wrap text-left rounded-lg -m-1 p-1 hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-start gap-2 min-w-0">
            <ChevronDown
              className={`h-5 w-5 mt-0.5 shrink-0 text-muted-foreground transition-transform duration-200 ${
                connectionPanelOpen ? 'rotate-0' : '-rotate-90'
              }`}
              aria-hidden
            />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-foreground">
                {isKo ? '연결 상태' : 'Connection status'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {connectionPanelOpen ? (
                  isKo
                    ? 'OAuth 토큰은 서버에 암호화되어 저장됩니다.'
                    : 'OAuth tokens are stored encrypted on the server only.'
                ) : status?.connected ? (
                  <span className="truncate block">
                    {status.connectedEmail ?? '—'}
                    {status.googleLocationTitle || status.googleLocationName
                      ? ` · ${status.googleLocationTitle || status.googleLocationName}`
                      : ''}
                  </span>
                ) : (
                  isKo
                    ? 'Google Business Profile 연결 설정'
                    : 'Google Business Profile connection setup'
                )}
              </p>
            </div>
          </div>
          {loadingStatus ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground shrink-0" aria-hidden />
          ) : status?.connected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success shrink-0">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              {isKo ? '연결됨' : 'Connected'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground shrink-0">
              {isKo ? '미연결' : 'Not connected'}
            </span>
          )}
        </button>

        {connectionPanelOpen ? (
        <div className="space-y-6 pt-4 mt-2 border-t border-border/50">
        {status?.connected ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/50 bg-muted/30 p-4 text-sm space-y-2">
              <p>
                <span className="text-muted-foreground">{isKo ? 'Google 계정' : 'Google account'}: </span>
                <strong>{status.connectedEmail ?? '—'}</strong>
              </p>
              {status.googleAccountDisplayName || status.googleAccountName ? (
                <p>
                  <span className="text-muted-foreground">{isKo ? '선택된 GBP 계정' : 'Selected GBP account'}: </span>
                  <strong>{status.googleAccountDisplayName || status.googleAccountName}</strong>
                </p>
              ) : null}
              {status.googleLocationTitle || status.googleLocationName ? (
                <p className="flex items-start gap-1.5">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span>
                    <span className="text-muted-foreground">{isKo ? '선택된 위치' : 'Selected location'}: </span>
                    <strong>{status.googleLocationTitle || status.googleLocationName}</strong>
                  </span>
                </p>
              ) : null}
              {status.updatedAt ? (
                <p className="text-xs text-muted-foreground">
                  {isKo ? '마지막 업데이트' : 'Last updated'}:{' '}
                  {new Date(status.updatedAt).toLocaleString(isKo ? 'ko-KR' : 'en-US')}
                </p>
              ) : null}
            </div>

            <div className="space-y-4 pt-2 border-t border-border/50">
              <h3 className="text-sm font-semibold text-foreground">
                {isKo ? '계정 및 위치 선택' : 'Account & location selection'}
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {isKo ? 'Business Profile 계정' : 'Business Profile account'}
                  </span>
                  <select
                    value={selectedAccount}
                    onChange={(e) => {
                      setSelectedAccount(e.target.value)
                      setSelectedLocation('')
                    }}
                    disabled={loadingAccounts}
                    className="w-full h-11 rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    <option value="">{isKo ? '계정 선택…' : 'Select account…'}</option>
                    {accounts.map((account) => (
                      <option key={account.name} value={account.name}>
                        {account.accountName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {isKo ? '위치' : 'Location'}
                  </span>
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    disabled={!selectedAccount || loadingLocations}
                    className="w-full h-11 rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    <option value="">
                      {loadingLocations
                        ? isKo
                          ? '위치 불러오는 중…'
                          : 'Loading locations…'
                        : isKo
                          ? '위치 선택…'
                          : 'Select location…'}
                    </option>
                    {locations.map((location) => (
                      <option key={location.name} value={location.name}>
                        {location.title}
                        {location.storefrontAddress ? ` — ${location.storefrontAddress}` : ''}
                      </option>
                    ))}
                  </select>
                  {locationsHint ? (
                    <p className="text-xs text-amber-700 dark:text-amber-400">{locationsHint}</p>
                  ) : null}
                </label>
              </div>

              {(selectedAccountLabel || selectedLocationLabel) && (
                <p className="text-xs text-muted-foreground">
                  {isKo ? '현재 선택' : 'Current selection'}: {selectedAccountLabel || '—'} /{' '}
                  {selectedLocationLabel || '—'}
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleSaveSelection()}
                  disabled={savingSelection || !selectedAccount || !selectedLocation}
                  className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-95 disabled:opacity-50"
                >
                  {savingSelection ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isKo ? '선택 저장' : 'Save selection'}
                </button>
                <a
                  href={connectUrl}
                  className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl border border-border bg-background text-sm font-medium hover:bg-muted/50"
                >
                  <Link2 className="h-4 w-4" aria-hidden />
                  {isKo ? '다시 연결' : 'Reconnect'}
                </a>
                <button
                  type="button"
                  onClick={() => void handleDisconnect()}
                  disabled={disconnecting}
                  className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl border border-danger/30 text-danger text-sm font-medium hover:bg-danger/5 disabled:opacity-50"
                >
                  {disconnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Unlink className="h-4 w-4" aria-hidden />
                  )}
                  {isKo ? '연결 해제' : 'Disconnect'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
            <p className="text-sm text-muted-foreground">
              {isKo
                ? 'Google Business Profile 관리 권한으로 연결합니다.'
                : 'Connect with Google Business Profile management access.'}
            </p>
            <a
              href={connectUrl}
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-95 shrink-0"
            >
              <Link2 className="h-4 w-4" aria-hidden />
              {isKo ? 'Google 연결' : 'Connect Google'}
            </a>
          </div>
        )}
        </div>
        ) : null}
      </section>
      ) : null}

      {isGoogleTab && status?.connected ? (
        <GoogleReviewsImportSection
          locale={locale}
          status={status}
          reviewStats={status.reviewStats ?? null}
          onRefresh={refreshAll}
          onMessage={notify}
        />
      ) : null}

      {!isGoogleTab && isOtaReviewSource(activeSource) ? (
        <OtaReviewsImportSection
          locale={locale}
          source={activeSource}
          onRefresh={refreshAll}
          onMessage={notify}
        />
      ) : null}

      <GoogleReviewsManageSection
        locale={locale}
        enabled={isGoogleTab ? Boolean(status?.connected) : true}
        reviewSource={activeSource}
        onMessage={notify}
        refreshKey={refreshKey}
        onReviewSourceChange={setActiveSource}
        onSourceReviewCount={handleSourceReviewCount}
      />
    </div>
  )
}
