'use client'
import { BROWSER_AUTOFILL_OFF_PROPS } from '@/lib/browserAutofill'

import { useState, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { createClientSupabase } from '@/lib/supabase'
import { 
  Search,
  MapPin,
  Tag,
  FileText,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  CheckCircle2,
  DownloadCloud
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

export default function GuideTourMaterialsPage() {
  const t = useTranslations('guide')
  const locale = useLocale()
  const supabase = createClientSupabase()
  const { playTrack, primeAudioForGesture, currentTrack, isPlaying } = useAudioPlayer()
  const narrationStatus = useNarrationOfflineStatus()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getLanguageFlag = (language: string | null) => {
    switch (language?.toLowerCase()) {
      case 'ko':
        return 'KR'
      case 'en':
        return 'US'
      case 'ja':
        return 'JP'
      case 'zh':
        return 'CN'
      default:
        return 'KR'
    }
  }

  const handlePlay = async (material: GuideNarrationMaterial) => {
    primeAudioForGesture()
    if (currentTrack?.id === material.id) {
    playTrack({
      id: material.id,
      src: currentTrack.src,
      title: material.title,
      filePath: material.file_path,
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
      ...(material.duration != null ? { duration: material.duration } : {}),
    })
  }

  const toggleAccordion = (materialId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev)
      if (newSet.has(materialId)) {
        newSet.delete(materialId)
      } else {
        newSet.add(materialId)
      }
      return newSet
    })
  }

  const filteredMaterials = (materials || []).filter(material => {
    const matchesSearch = material.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         material.description?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch && material.file_type === 'audio'
  })

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
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">{t('tourMaterialsTitle')}</h1>
          <div className="relative w-32">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input {...BROWSER_AUTOFILL_OFF_PROPS} type="search"
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
        <div className="px-3 py-6">
          <div className="space-y-4">
            {filteredMaterials.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">{t('noTourMaterials')}</h3>
                <p className="text-gray-600">{t('noTourMaterials')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMaterials.map(material => {
                  const isCurrent = currentTrack?.id === material.id
                  return (
                  <div key={material.id}>
                    {material.file_type === 'audio' && (
                      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                        <div 
                          className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => toggleAccordion(material.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void handlePlay(material)
                                }}
                                className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                                  isCurrent && isPlaying
                                    ? 'bg-red-600 text-white hover:bg-red-700'
                                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                }`}
                                title={isCurrent && isPlaying ? t('narrationPause') : t('narrationPlay')}
                              >
                                {isCurrent && isPlaying ? (
                                  <Pause className="w-4 h-4" />
                                ) : (
                                  <Play className="w-4 h-4" />
                                )}
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <h3 className="font-medium text-gray-900 text-sm truncate">{material.title}</h3>
                                  <ReactCountryFlag
                                    countryCode={getLanguageFlag(material.language)}
                                    svg
                                    style={{
                                      width: '16px',
                                      height: '12px',
                                      borderRadius: '2px'
                                    }}
                                  />
                                  {material.duration && (
                                    <span className="text-xs text-gray-500">
                                      {Math.floor(material.duration / 60)}:{(material.duration % 60).toString().padStart(2, '0')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="ml-2">
                              {expandedCards.has(material.id) ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {expandedCards.has(material.id) && (
                          <div className="px-3 pb-3 border-t border-gray-100">
                            <div className="pt-3 space-y-2">
                              <div className="flex items-center space-x-3 text-xs text-gray-500">
                                <span className="flex items-center space-x-1">
                                  <MapPin className="w-3 h-3" />
                                  <span className="truncate">{material.tour_attractions?.name_ko || t('noAttraction')}</span>
                                </span>
                                <span className="flex items-center space-x-1">
                                  <Tag className="w-3 h-3" />
                                  <span className="truncate">{material.tour_material_categories?.name_ko || t('noCategory')}</span>
                                </span>
                                <span>{formatFileSize(material.file_size)}</span>
                              </div>
                              
                              {material.description && (
                                <div>
                                  <p className="text-xs text-gray-600 leading-relaxed">{material.description}</p>
                                </div>
                              )}
                              
                              {material.tags && material.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {material.tags.map((tag, index) => (
                                    <span 
                                      key={index}
                                      className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )})}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
