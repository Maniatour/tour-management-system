'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { createClientSupabase } from '@/lib/supabase'
import { 
  Search,
  MapPin,
  Tag,
  Volume2,
  FileText,
  ChevronDown,
  ChevronUp,
  Music
} from 'lucide-react'
import { toast } from 'sonner'
import AudioPlayer from '@/components/AudioPlayer'
import ReactCountryFlag from 'react-country-flag'

type TourMaterial = {
  id: string
  title: string
  description: string | null
  attraction_id: string | null
  category_id: string | null
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  mime_type: string
  duration: number | null
  language: string | null
  tags: string[] | null
  is_active: boolean
  is_public: boolean
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  tour_attractions?: { name_ko: string; name_en: string } | null
  tour_material_categories?: { name_ko: string; name_en: string; icon: string; color: string } | null
}

export default function GuideTourMaterialsPage() {
  const t = useTranslations('guide')
  const supabase = createClientSupabase()
  
  const [materials, setMaterials] = useState<TourMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'script' | 'audio'>('audio')
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      
      // 투어 자료 로드 (스크립트와 오디오만)
      const { data: materialsData, error: materialsError } = await supabase
        .from('tour_materials')
        .select(`
          *,
          tour_attractions(name_ko, name_en),
          tour_material_categories(name_ko, name_en, icon, color)
        `)
        .in('file_type', ['script', 'audio'])
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (materialsError) throw materialsError
      setMaterials(materialsData || [])

    } catch (error) {
      console.error('데이터 로드 오류:', error)
      toast.error('데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'script': return <FileText className="w-5 h-5 text-blue-500" />
      case 'audio': return <Volume2 className="w-5 h-5 text-green-500" />
      default: return <FileText className="w-5 h-5 text-gray-500" />
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // 언어를 국기 아이콘으로 표시
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

  // 파일 URL 가져오기
  const getFileUrl = (filePath: string) => {
    const { data } = supabase.storage
      .from('tour-materials')
      .getPublicUrl(filePath)
    return data.publicUrl
  }

  // 아코디언 토글
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

  const filteredMaterials = materials.filter(material => {
    const matchesSearch = material.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         material.description?.toLowerCase().includes(searchTerm.toLowerCase())
    
    // 탭 필터링
    let matchesTab = true
    if (activeTab === 'script') {
      matchesTab = material.file_type === 'script'
    } else if (activeTab === 'audio') {
      matchesTab = material.file_type === 'audio'
    }
    
    return matchesSearch && matchesTab
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 헤더와 검색 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">{t('tourMaterialsTitle')}</h1>
          <div className="relative w-32">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('audio')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'audio'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              title={`${t('narrationAudio')} (${materials.filter(m => m.file_type === 'audio').length})`}
            >
              <Music className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveTab('script')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'script'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              title={`${t('guideScript')} (${materials.filter(m => m.file_type === 'script').length})`}
            >
              <FileText className="w-4 h-4" />
            </button>
          </nav>
        </div>

        {/* 컨텐츠 */}
        <div className="px-3 py-6">
          <div className="space-y-4">
            {filteredMaterials.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">{t('noTourMaterials')}</h3>
                <p className="text-gray-600">{t('noTourMaterials')}</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredMaterials.map(material => (
                  <div key={material.id}>
                    {/* 스크립트 파일인 경우 카드 표시 */}
                    {material.file_type === 'script' && (
                      <div className="border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                        {/* 아코디언 헤더 */}
                        <div 
                          className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => toggleAccordion(material.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              {getFileIcon(material.file_type)}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <h3 className="font-medium text-gray-900 text-sm truncate">{material.title}</h3>
                                  <ReactCountryFlag
                                    countryCode={getLanguageFlag(material.language)}
                                    svg
                                    style={{
                                      width: '20px',
                                      height: '15px',
                                      borderRadius: '2px'
                                    }}
                                  />
                                </div>
                                <div className="flex items-center space-x-3 mt-1 text-xs text-gray-500">
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
                        
                        {/* 아코디언 콘텐츠 */}
                        {expandedCards.has(material.id) && (
                          <div className="px-3 pb-3 border-t border-gray-100">
                            <div className="pt-3 space-y-2">
                              {material.description && (
                                <div>
                                  <h4 className="text-xs font-medium text-gray-700 mb-1">설명</h4>
                                  <p className="text-xs text-gray-600 leading-relaxed">{material.description}</p>
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="font-medium text-gray-700">파일명:</span>
                                  <span className="ml-1 text-gray-600">{material.file_name}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700">파일 타입:</span>
                                  <span className="ml-1 text-gray-600">{material.file_type}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700">언어:</span>
                                  <span className="ml-1">
                                    <ReactCountryFlag
                                      countryCode={getLanguageFlag(material.language)}
                                      svg
                                      style={{
                                        width: '16px',
                                        height: '12px',
                                        borderRadius: '2px'
                                      }}
                                    />
                                  </span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700">크기:</span>
                                  <span className="ml-1 text-gray-600">{formatFileSize(material.file_size)}</span>
                                </div>
                              </div>
                              {material.tags && material.tags.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-medium text-gray-700 mb-1">태그</h4>
                                  <div className="flex flex-wrap gap-1">
                                    {material.tags.map((tag, index) => (
                                      <span 
                                        key={index}
                                        className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* 오디오 파일인 경우 플레이어만 표시 */}
                    {material.file_type === 'audio' && (
                      <AudioPlayer
                        src={getFileUrl(material.file_path)}
                        title={material.title}
                        audioDuration={material.duration || undefined}
                        language={material.language}
                        attraction={material.tour_attractions?.name_ko || t('noAttraction')}
                        category={material.tour_material_categories?.name_ko || t('noCategory')}
                        fileSize={formatFileSize(material.file_size)}
                        className="max-w-full"
                        isExpanded={expandedCards.has(material.id)}
                        onToggleExpanded={() => toggleAccordion(material.id)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}