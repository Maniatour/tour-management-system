'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Images, Loader2, RefreshCw, Camera } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import BulkCreateTourPhotoBuckets from '@/components/BulkCreateTourPhotoBuckets'
import AdminTourPhotoGroup from '@/components/admin/AdminTourPhotoGroup'
import AdminTourPhotoLightbox from '@/components/admin/AdminTourPhotoLightbox'
import {
  AdminTourPhotosPresetButton,
  AdminTourPhotosSearchField,
  AdminTourPhotosViewTab,
  daysAgoYmd,
  formatTourDateLabel,
  toYmd,
} from '@/components/admin/AdminTourPhotosGalleryControls'
import { useAuth } from '@/contexts/AuthContext'
import {
  readAdminTourPhotoFavorites,
  toggleAdminTourPhotoFavorite,
} from '@/lib/adminTourPhotoFavorites'
import {
  fetchAdminTourPhotoGallery,
  fetchAdminTourPhotoGalleryByPhotoIds,
  mergeAdminTourPhotoGroups,
  type AdminGalleryTourGroup,
} from '@/lib/adminTourPhotos'

type GalleryView = 'all' | 'favorites'

export default function AdminTourPhotosGallery() {
  const locale = useLocale()
  const router = useRouter()
  const t = useTranslations('adminTourPhotos')
  const { user } = useAuth()
  const userEmail = user?.email ?? ''
  const [fromDate, setFromDate] = useState(() => daysAgoYmd(30))
  const [toDate, setToDate] = useState(() => toYmd(new Date()))
  const [search, setSearch] = useState('')
  const [view, setView] = useState<GalleryView>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<AdminGalleryTourGroup[]>([])
  const [favoriteExtraGroups, setFavoriteExtraGroups] = useState<AdminGalleryTourGroup[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [bucketsOpen, setBucketsOpen] = useState(false)

  useEffect(() => {
    setFavoriteIds(new Set(readAdminTourPhotoFavorites(userEmail)))
  }, [userEmail])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchAdminTourPhotoGallery({ fromDate, toDate, locale })
      setGroups(result.groups)
      setExpandedIds(new Set())
      setLightboxIndex(null)
    } catch (err) {
      setGroups([])
      setError(err instanceof Error ? err.message : t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [fromDate, locale, toDate, t])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (view !== 'favorites' || favoriteIds.size === 0) {
      setFavoriteExtraGroups([])
      return
    }
    const loaded = new Set(groups.flatMap((group) => group.photos.map((photo) => photo.id)))
    const missing = Array.from(favoriteIds).filter((id) => !loaded.has(id))
    if (missing.length === 0) {
      setFavoriteExtraGroups([])
      return
    }
    let cancelled = false
    void fetchAdminTourPhotoGalleryByPhotoIds({ photoIds: missing, locale })
      .then((result) => {
        if (!cancelled) setFavoriteExtraGroups(result.groups)
      })
      .catch(() => {
        if (!cancelled) setFavoriteExtraGroups([])
      })
    return () => {
      cancelled = true
    }
  }, [favoriteIds, groups, locale, view])

  const visibleGroups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const source = view === 'favorites'
      ? mergeAdminTourPhotoGroups(groups, favoriteExtraGroups)
          .map((group) => ({
            ...group,
            photos: group.photos.filter((photo) => favoriteIds.has(photo.id)),
          }))
          .filter((group) => group.photos.length > 0)
      : groups
    if (!q) return source
    return source.filter((group) => {
      const haystack = [group.productName, group.guideName, group.assistantName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [favoriteExtraGroups, favoriteIds, groups, search, view])

  const flatPhotos = useMemo(
    () => visibleGroups.flatMap((group) => group.photos),
    [visibleGroups],
  )

  useEffect(() => {
    if (lightboxIndex === null) return
    if (flatPhotos.length === 0) {
      setLightboxIndex(null)
      return
    }
    if (!flatPhotos[lightboxIndex]) {
      setLightboxIndex(Math.min(lightboxIndex, flatPhotos.length - 1))
    }
  }, [flatPhotos, lightboxIndex])

  const filteredPhotoCount = visibleGroups.reduce((sum, group) => sum + group.photos.length, 0)
  const openTour = (tourId: string) => {
    router.push(`/${locale}/admin/tours/${tourId}#tour-photos`)
  }
  const toggleFavorite = (photoId: string) => {
    if (!userEmail) return
    setFavoriteIds(new Set(toggleAdminTourPhotoFavorite(userEmail, photoId)))
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-2 py-4 sm:px-4 sm:py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-sky-100 p-2">
            <Images className="h-6 w-6 text-sky-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{t('title')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
            {!loading && !error && (
              <p className="mt-1 text-sm text-gray-600">
                {t('resultSummary', { tours: visibleGroups.length, photos: filteredPhotoCount })}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setBucketsOpen(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-input bg-white px-4 text-sm font-medium hover:bg-accent"
          >
            <Camera className="h-4 w-4" />
            {t('btnBuckets')}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {t('btnRefresh')}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2">
          <AdminTourPhotosViewTab active={view === 'all'} onClick={() => setView('all')} label={t('tabAll')} />
          <AdminTourPhotosViewTab
            active={view === 'favorites'}
            onClick={() => setView('favorites')}
            label={`${t('tabFavorites')} (${favoriteIds.size})`}
            icon
          />
        </div>
        {view === 'all' ? (
          <>
            <div className="flex flex-wrap gap-2">
              <AdminTourPhotosPresetButton label={t('preset7')} onClick={() => { setFromDate(daysAgoYmd(7)); setToDate(toYmd(new Date())) }} />
              <AdminTourPhotosPresetButton label={t('preset30')} onClick={() => { setFromDate(daysAgoYmd(30)); setToDate(toYmd(new Date())) }} />
              <AdminTourPhotosPresetButton label={t('preset90')} onClick={() => { setFromDate(daysAgoYmd(90)); setToDate(toYmd(new Date())) }} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-sm font-medium text-gray-700">
                {t('dateFrom')}
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1" />
              </label>
              <label className="text-sm font-medium text-gray-700">
                {t('dateTo')}
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-1" />
              </label>
              <AdminTourPhotosSearchField value={search} onChange={setSearch} label={t('searchPlaceholder')} />
            </div>
          </>
        ) : (
          <AdminTourPhotosSearchField value={search} onChange={setSearch} label={t('searchPlaceholder')} />
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {loading && groups.length === 0 && view === 'all' ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('loading')}
        </div>
      ) : visibleGroups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {view === 'favorites' ? t('emptyFavorites') : t('empty')}
        </p>
      ) : (
        <div className="space-y-6">
          {visibleGroups.map((group) => (
            <AdminTourPhotoGroup
              key={group.tourId}
              group={group}
              dateLabel={formatTourDateLabel(group.tourDate, locale)}
              photoCountLabel={t('photoCount', { count: group.photos.length })}
              assignedPeopleLabel={t('assignedPeople', { count: group.assignedPeople })}
              guideLabel={t('guide')}
              assistantLabel={t('assistant')}
              noGuideLabel={t('noGuide')}
              openTourLabel={t('openTour')}
              showMoreLabel={t('showMore', { count: Math.max(group.photos.length - 12, 0) })}
              showLessLabel={t('showLess')}
              hiddenBadge={t('hiddenBadge')}
              favoriteAddLabel={t('favoriteAdd')}
              favoriteRemoveLabel={t('favoriteRemove')}
              favoriteIds={favoriteIds}
              expanded={expandedIds.has(group.tourId)}
              onToggleExpand={() => {
                setExpandedIds((prev) => {
                  const next = new Set(prev)
                  if (next.has(group.tourId)) next.delete(group.tourId)
                  else next.add(group.tourId)
                  return next
                })
              }}
              onOpenTour={() => openTour(group.tourId)}
              onSelectPhoto={(photoId) => {
                const idx = flatPhotos.findIndex((photo) => photo.id === photoId)
                if (idx >= 0) setLightboxIndex(idx)
              }}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
      )}

      {lightboxIndex !== null && flatPhotos[lightboxIndex] && (
        <AdminTourPhotoLightbox
          photos={flatPhotos}
          index={lightboxIndex}
          openTourLabel={t('openTour')}
          hiddenBadge={t('hiddenBadge')}
          closeLabel={t('close')}
          prevLabel={t('prev')}
          nextLabel={t('next')}
          favoriteAddLabel={t('favoriteAdd')}
          favoriteRemoveLabel={t('favoriteRemove')}
          isFavorite={favoriteIds.has(flatPhotos[lightboxIndex].id)}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
          onOpenTour={openTour}
          onToggleFavorite={toggleFavorite}
        />
      )}

      <Dialog open={bucketsOpen} onOpenChange={setBucketsOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('btnBuckets')}</DialogTitle>
          </DialogHeader>
          <BulkCreateTourPhotoBuckets />
        </DialogContent>
      </Dialog>
    </div>
  )
}
