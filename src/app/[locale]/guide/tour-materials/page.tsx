'use client'
import { BROWSER_AUTOFILL_OFF_PROPS } from '@/lib/browserAutofill'

import { useState, useCallback, useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { createClientSupabase } from '@/lib/supabase'
import {
  Search,
  FileText,
  Pause,
  CheckCircle2,
  DownloadCloud,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAudioPlayer } from '@/contexts/AudioPlayerContext'
import ReactCountryFlag from 'react-country-flag'
import { useOptimizedData } from '@/hooks/useOptimizedData'
import { useNarrationOfflineStatus } from '@/hooks/useNarrationOfflineStatus'
import GuideTodayNarrationPlayLog from '@/components/guide/GuideTodayNarrationPlayLog'
import {
  GUIDE_NARRATION_SNAPSHOT_KEY,
  resolveNarrationPlaybackSrc,
  syncGuideNarrationOffline,
  type GuideNarrationMaterial,
} from '@/lib/guideNarrationOffline'

const LANGUAGE_TAB_ORDER = ['en', 'ko', 'ja', 'zh'] as const

function normalizeNarrationLanguage(language: string | null | undefined): string {
  const raw = (language || '').trim().toLowerCase()
  if (!raw) return 'ko'
  if (raw.startsWith('en')) return 'en'
  if (raw.startsWith('ko') || raw === 'kr') return 'ko'
  if (raw.startsWith('ja')) return 'ja'
  if (raw.startsWith('zh') || raw === 'cn') return 'zh'
  return raw
}

function languageFlagCode(language: string): string {
  switch (language) {
    case 'ko':
      return 'KR'
    case 'en':
      return 'US'
    case 'ja':
      return 'JP'
    case 'zh':
      return 'CN'
    default:
      return 'US'
  }
}

function languageTabLabel(language: string): string {
  switch (language) {
    case 'en':
      return 'English'
    case 'ko':
      return '한국어'
    case 'ja':
      return '日本語'
    case 'zh':
      return '中文'
    default:
      return language.toUpperCase()
  }
}

function preferredLanguageFromLocale(locale: string): string {
  if (locale === 'en') return 'en'
  if (locale === 'ja') return 'ja'
  if (locale.startsWith('zh')) return 'zh'
  return 'ko'
}

function splitTitleLines(title: string): [string, string | null] {
  const trimmed = title.trim()
  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length <= 1) return [trimmed, null]
  if (words.length === 2) return [words[0] ?? trimmed, words[1] ?? null]
  let bestIndex = 1
  let bestScore = Number.POSITIVE_INFINITY
  for (let i = 1; i < words.length; i++) {
    const left = words.slice(0, i).join(' ')
    const right = words.slice(i).join(' ')
    const score = Math.abs(left.length - right.length)
    if (score < bestScore) {
      bestScore = score
      bestIndex = i
    }
  }
  return [words.slice(0, bestIndex).join(' '), words.slice(bestIndex).join(' ')]
}

function formatDurationClock(duration: number | null | undefined): string | null {
  if (duration == null || duration <= 0) return null
  const minutes = Math.floor(duration / 60)
  const seconds = Math.round(duration % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const NARRATION_TILE_COLORS = [
  '#2563EB',
  '#0F766E',
  '#C2410C',
  '#7C3AED',
  '#BE123C',
  '#0369A1',
  '#B45309',
  '#15803D',
  '#DB2777',
  '#1D4ED8',
  '#0E7490',
  '#9A3412',
  '#6D28D9',
  '#B91C1C',
  '#3F6212',
  '#4338CA',
] as const

export default function GuideTourMaterialsPage() {
  const t = useTranslations('guide')
  const locale = useLocale()
  const supabase = createClientSupabase()
  const { playTrack, primeAudioForGesture, currentTrack, isPlaying } = useAudioPlayer()
  const narrationStatus = useNarrationOfflineStatus()

  const [searchTerm, setSearchTerm] = useState('')
  const [langTab, setLangTab] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const { data, error } = await supabase
      .from('tour_materials')
      .select(`
        *,
        tour_attractions(name_ko, name_en),
        tour_material_categories(name_ko, name_en, icon, color)
      `)
      .eq('file_type', 'audio')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    const materials = (data || []) as GuideNarrationMaterial[]
    void syncGuideNarrationOffline()
    return materials
  }, [supabase])

  const { data: materials, loading } = useOptimizedData<GuideNarrationMaterial[]>({
    fetchFn: loadData,
    cacheKey: GUIDE_NARRATION_SNAPSHOT_KEY,
    offlineGuideCache: true,
    defaultToEmptyArray: true,
  })

  const handlePlay = async (material: GuideNarrationMaterial) => {
    primeAudioForGesture()
    if (currentTrack?.id === material.id) {
      playTrack({
        id: material.id,
        src: currentTrack.src,
        title: material.title,
        filePath: material.file_path,
        fileName: material.file_name,
        language: material.language ?? null,
        ...(material.duration != null ? { duration: material.duration } : {}),
      })
      return
    }

    const src = await resolveNarrationPlaybackSrc(material.file_path)
    if (!src) {
      toast.error(t('narrationOfflineUnavailable'))
      return
    }

    playTrack({
      id: material.id,
      src,
      title: material.title,
      filePath: material.file_path,
      fileName: material.file_name,
      language: material.language ?? null,
      ...(material.duration != null ? { duration: material.duration } : {}),
    })
  }

  const languageTabs = useMemo(() => {
    const counts = new Map<string, number>()
    for (const material of materials || []) {
      if (material.file_type !== 'audio') continue
      const code = normalizeNarrationLanguage(material.language)
      counts.set(code, (counts.get(code) || 0) + 1)
    }
    const known = LANGUAGE_TAB_ORDER.filter((code) => counts.has(code))
    const extra = [...counts.keys()].filter((code) => !(LANGUAGE_TAB_ORDER as readonly string[]).includes(code))
    extra.sort()
    return [...known, ...extra].map((code) => ({
      code,
      count: counts.get(code) || 0,
      label: languageTabLabel(code),
      flag: languageFlagCode(code),
    }))
  }, [materials])

  const preferredLang = preferredLanguageFromLocale(locale)
  const activeLang =
    langTab && languageTabs.some((tab) => tab.code === langTab)
      ? langTab
      : (languageTabs.find((tab) => tab.code === preferredLang)?.code ?? languageTabs[0]?.code ?? 'en')

  const filteredMaterials = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return (materials || []).filter((material) => {
      if (material.file_type !== 'audio') return false
      if (normalizeNarrationLanguage(material.language) !== activeLang) return false
      if (!query) return true
      return (
        material.title.toLowerCase().includes(query) ||
        Boolean(material.description?.toLowerCase().includes(query))
      )
    })
  }, [materials, activeLang, searchTerm])

  const handleSelectLang = (code: string) => {
    setLangTab(code)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">{t('chatLoading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-0 lg:space-y-4">
      <div className="bg-white rounded-none shadow-none border-b border-gray-200 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold text-gray-900">{t('tourMaterialsTitle')}</h1>
          <div className="relative w-32 shrink-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              {...BROWSER_AUTOFILL_OFF_PROPS}
              type="search"
              placeholder={t('searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>
        </div>
        {narrationStatus.total > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
            {narrationStatus.status === 'ready' ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" aria-hidden />
            ) : (
              <DownloadCloud className="h-3.5 w-3.5 text-primary" aria-hidden />
            )}
            <span>
              {narrationStatus.status === 'ready'
                ? t('narrationOfflineReady')
                : narrationStatus.status === 'syncing'
                  ? t('narrationOfflineSyncing', {
                      cached: narrationStatus.cached,
                      total: narrationStatus.total,
                    })
                  : t('narrationOfflinePartial')}
            </span>
          </p>
        )}
        <GuideTodayNarrationPlayLog locale={locale === 'en' ? 'en' : 'ko'} />
      </div>

      <div className="bg-white rounded-none shadow-none">
        <div className="px-3 py-4 sm:px-4 sm:py-6">
          <div className="mx-auto max-w-md">
          {languageTabs.length > 0 && (
            <div
              className="mb-4 flex justify-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="tablist"
              aria-label={t('narrationLanguageTabs')}
            >
              {languageTabs.map((tab) => {
                const active = tab.code === activeLang
                return (
                  <button
                    key={tab.code}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={tab.label}
                    onClick={() => handleSelectLang(tab.code)}
                    className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      active
                        ? 'border-primary bg-primary shadow-sm'
                        : 'border-border/60 bg-muted/50 hover:bg-muted'
                    }`}
                  >
                    <ReactCountryFlag
                      countryCode={tab.flag}
                      svg
                      style={{ width: '22px', height: '16px', borderRadius: '3px' }}
                    />
                  </button>
                )
              })}
            </div>
          )}

          {filteredMaterials.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">{t('noTourMaterials')}</h3>
              <p className="text-gray-600">{t('noTourMaterials')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 pb-28 sm:gap-3">
              {filteredMaterials.map((material, index) => {
                const isCurrent = currentTrack?.id === material.id
                const playing = isCurrent && isPlaying
                const [line1, line2] = splitTitleLines(material.title)
                const duration = formatDurationClock(material.duration)
                const tileColor =
                  NARRATION_TILE_COLORS[index % NARRATION_TILE_COLORS.length] ?? NARRATION_TILE_COLORS[0]
                return (
                  <button
                    key={material.id}
                    type="button"
                    onClick={() => void handlePlay(material)}
                    aria-pressed={playing}
                    aria-label={`${playing ? t('narrationPause') : t('narrationPlay')}: ${material.title}`}
                    style={{
                      backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(0,0,0,0.18) 100%)',
                      backgroundColor: tileColor,
                    }}
                    className={`relative flex aspect-square w-full touch-manipulation select-none flex-col items-center justify-center overflow-hidden rounded-2xl border px-1.5 text-white shadow-sm transition duration-200 ease-out active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      playing
                        ? 'border-white ring-2 ring-red-500 ring-offset-2 ring-offset-white shadow-md'
                        : isCurrent
                          ? 'border-white/80 ring-2 ring-white ring-offset-2 ring-offset-white shadow-md'
                          : 'border-white/10 hover:brightness-110'
                    }`}
                  >
                    {playing ? (
                      <span className="pointer-events-none absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/25">
                        <Pause className="h-3 w-3" />
                      </span>
                    ) : null}
                    <span className="flex min-h-0 w-full flex-col items-center justify-center text-center">
                      <span className="max-w-full break-words text-[12px] font-semibold leading-[1.15] tracking-tight min-[400px]:text-[13px] sm:text-sm">
                        {line1}
                      </span>
                      {line2 ? (
                        <span className="max-w-full break-words text-[12px] font-semibold leading-[1.15] tracking-tight min-[400px]:text-[13px] sm:text-sm">
                          {line2}
                        </span>
                      ) : null}
                    </span>
                    {duration ? (
                      <span className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[10px] font-medium tabular-nums opacity-80">
                        {duration}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
