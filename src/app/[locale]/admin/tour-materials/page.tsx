'use client'
import { BROWSER_AUTOFILL_OFF_PROPS } from '@/lib/browserAutofill'

import { useState, useEffect, useMemo, type SetStateAction } from 'react'
import { createClientSupabase } from '@/lib/supabase'
import { 
  Plus, 
  Upload, 
  FileText, 
  HelpCircle,
  Edit,
  Trash2,
  Download,
  Search,
  MapPin,
  Clock,
  Globe,
} from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'
import { useAudioPlayer } from '@/contexts/AudioPlayerContext'
import { toast } from 'sonner'
import TourMaterialUploadModal from '@/components/TourMaterialUploadModal'
import TourMaterialEditModal from '@/components/TourMaterialEditModal'
import GuideQuizModal from '@/components/GuideQuizModal'
import AttractionModal from '@/components/AttractionModal'
import { TourNarrationPlayTile } from '@/components/tour/TourNarrationPlayTile'
import { useRoutePersistedState } from '@/hooks/useRoutePersistedState'
import type { Database } from '@/lib/database.types'

const UNCATEGORIZED_CATEGORY_ID = '__uncategorized__'

type DbTourMaterial = Database['public']['Tables']['tour_materials']['Row']

// 타입 정의 (데이터베이스에 없는 테이블들)
type TourAttraction = {
  id: string
  name_ko: string
  name_en: string
  description_ko?: string | null
  description_en?: string | null
  location?: string | null
  category?: string | null
  visit_duration?: number | null
  created_at: string | null
  updated_at: string | null
}

type TourMaterial = {
  id: string
  title: string
  description?: string | null
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  duration?: number | null
  language?: string | null
  attraction_id?: string | null
  category_id?: string | null
  tags?: string[] | null
  created_at: string | null
  updated_at: string | null
}

type TourMaterialCategory = {
  id: string
  name_ko: string
  name_en: string
  icon?: string | null
  color?: string | null
  sort_order: number | null
  created_at: string | null
  updated_at: string | null
}

type GuideQuiz = {
  id: string
  title: string
  description?: string | null
  question: string
  answer?: string
  correct_answer?: number
  difficulty?: string | null
  language?: string | null
  attraction_id?: string | null
  created_at: string | null
  updated_at: string | null
}

export default function TourMaterialsManagementPage() {
  const supabase = createClientSupabase()
  const { playTrack, currentTrack, isPlaying } = useAudioPlayer()
  
  const TOUR_MATERIALS_UI_DEFAULT = {
    activeTab: 'materials' as 'materials' | 'quizzes' | 'attractions',
    searchTerm: '',
    selectedAttraction: '',
    selectedCategory: '',
  }
  const [tmUi, setTmUi] = useRoutePersistedState('tour-materials', TOUR_MATERIALS_UI_DEFAULT)
  const { activeTab, searchTerm, selectedAttraction, selectedCategory } = tmUi
  const setSearchTerm = (v: SetStateAction<string>) =>
    setTmUi((u) => ({ ...u, searchTerm: typeof v === 'function' ? (v as (s: string) => string)(u.searchTerm) : v }))
  const setSelectedCategory = (v: string) => setTmUi((u) => ({ ...u, selectedCategory: v }))
  const [materials, setMaterials] = useState<TourMaterial[]>([])
  const [quizzes, setQuizzes] = useState<GuideQuiz[]>([])
  const [attractions, setAttractions] = useState<TourAttraction[]>([])
  const [categories, setCategories] = useState<TourMaterialCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showQuizModal, setShowQuizModal] = useState(false)
  const [showAttractionModal, setShowAttractionModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState<TourMaterial | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // 투어 자료 로드 (오디오만)
      const { data: materialsData, error: materialsError } = await supabase
        .from('tour_materials')
        .select(`
          *,
          tour_attractions(name_ko, name_en),
          tour_material_categories(name_ko, name_en, icon, color)
        `)
        .eq('file_type', 'audio')
        .order('created_at', { ascending: false })

      if (materialsError) throw materialsError
      setMaterials(materialsData || [])

      // 퀴즈 로드
      const { data: quizzesData, error: quizzesError } = await supabase
        .from('guide_quizzes')
        .select(`
          *,
          tour_attractions(name_ko, name_en)
        `)
        .order('created_at', { ascending: false })

      if (quizzesError) throw quizzesError
      setQuizzes(quizzesData || [])

      // 관광지 로드
      const { data: attractionsData, error: attractionsError } = await supabase
        .from('tour_attractions')
        .select('*')
        .order('name_ko')

      if (attractionsError) throw attractionsError
      setAttractions(attractionsData || [])

      // 카테고리 로드
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('tour_material_categories')
        .select('*')
        .order('sort_order')

      if (categoriesError) throw categoriesError
      setCategories(categoriesData || [])

    } catch (error) {
      console.error('데이터 로드 오류:', error)
      toast.error('데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 언어를 국기 아이콘으로 표시
  const getLanguageFlag = (language: string | null | undefined) => {
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

  // 파일 다운로드
  const handleDownload = async (material: TourMaterial) => {
    try {
      const { data, error } = await supabase.storage
        .from('tour-materials')
        .download(material.file_path)

      if (error) throw error

      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = material.file_name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('다운로드 오류:', error)
      toast.error('파일 다운로드 중 오류가 발생했습니다.')
    }
  }

  // 수정 모달 열기
  const handleEdit = (material: TourMaterial) => {
    setSelectedMaterial(material)
    setShowEditModal(true)
  }

  // 수정 완료 후 데이터 새로고침
  const handleEditSuccess = () => {
    loadData()
  }

  const audioMaterials = useMemo(
    () => materials.filter((material) => material.file_type === 'audio'),
    [materials]
  )

  const categoryTabs = useMemo(() => {
    const tabs = [
      { id: '', label: '전체', count: audioMaterials.length },
      ...categories.map((category) => ({
        id: category.id,
        label: category.name_ko,
        count: audioMaterials.filter((material) => material.category_id === category.id).length,
      })),
    ]
    const uncategorizedCount = audioMaterials.filter((material) => !material.category_id).length
    if (uncategorizedCount > 0) {
      tabs.push({ id: UNCATEGORIZED_CATEGORY_ID, label: '미분류', count: uncategorizedCount })
    }
    return tabs
  }, [audioMaterials, categories])

  const activeCategoryId = categoryTabs.some((tab) => tab.id === selectedCategory)
    ? selectedCategory
    : ''

  const filteredMaterials = audioMaterials.filter((material) => {
    const matchesSearch =
      material.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      Boolean(material.description?.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesCategory =
      !activeCategoryId ||
      (activeCategoryId === UNCATEGORIZED_CATEGORY_ID
        ? !material.category_id
        : material.category_id === activeCategoryId)
    return matchesSearch && matchesCategory
  })

  const filteredQuizzes = quizzes.filter(quiz => {
    const matchesSearch = quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         quiz.question.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesAttraction = !selectedAttraction || quiz.attraction_id === selectedAttraction
    return matchesSearch && matchesAttraction
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 - 모바일: 버튼 컴팩트 */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900">투어 자료 관리</h1>
            <p className="text-gray-600 mt-0.5 sm:mt-1 text-xs sm:text-sm hidden sm:block">가이드가 사용할 투어 자료들을 관리합니다</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3 flex-shrink-0">
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 py-2 sm:px-4 sm:py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              title="자료 업로드"
            >
              <Upload className="w-4 h-4 flex-shrink-0" />
              <span className="sm:hidden">자료</span>
              <span className="hidden sm:inline">자료 업로드</span>
            </button>
            <button
              onClick={() => setShowQuizModal(true)}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 py-2 sm:px-4 sm:py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
              title="퀴즈 추가"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span className="sm:hidden">퀴즈</span>
              <span className="hidden sm:inline">퀴즈 추가</span>
            </button>
            <button
              onClick={() => setShowAttractionModal(true)}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 py-2 sm:px-4 sm:py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              title="관광지 추가"
            >
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="sm:hidden">관광지</span>
              <span className="hidden sm:inline">관광지 추가</span>
            </button>
          </div>
        </div>
      </div>

      {/* 오디오 자료만 표시 */}
      <div className="bg-white rounded-lg shadow">

        {/* 검색 및 카테고리 탭 */}
        <div className="p-4 sm:p-6 border-b border-gray-200 space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input {...BROWSER_AUTOFILL_OFF_PROPS} type="search"
              placeholder="검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>
          {activeTab === 'materials' && categoryTabs.length > 0 && (
            <div
              className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="tablist"
              aria-label="투어 자료 카테고리"
            >
              {categoryTabs.map((tab) => {
                const active = tab.id === activeCategoryId
                return (
                  <button
                    key={tab.id || 'all'}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedCategory(tab.id)}
                    className={`inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      active
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                        : 'border-border/60 bg-muted/50 text-gray-700 hover:bg-muted'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={active ? 'text-primary-foreground/80' : 'text-gray-500'}>
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* 컨텐츠 */}
        <div className="p-6">
          {activeTab === 'materials' && (
            <div className="space-y-4">
              {filteredMaterials.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">투어 자료가 없습니다</h3>
                  <p className="text-gray-600 mb-4">새로운 투어 자료를 업로드해보세요.</p>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90"
                  >
                    자료 업로드
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
                  {filteredMaterials.map((material, index) => {
                    const src = getFileUrl(material.file_path)
                    const isCurrent = currentTrack?.id === material.id || currentTrack?.src === src
                    const playing = isCurrent && isPlaying
                    return (
                      <div key={material.id} className="min-w-0">
                        <TourNarrationPlayTile
                          title={material.title}
                          duration={material.duration}
                          colorIndex={index}
                          playing={playing}
                          isCurrent={isCurrent}
                          ariaLabel={`${playing ? '일시정지' : '재생'}: ${material.title}`}
                          onClick={() => {
                            playTrack({
                              id: material.id,
                              src,
                              title: material.title,
                              filePath: material.file_path,
                              fileName: material.file_name,
                              language: material.language ?? null,
                              ...(typeof material.duration === 'number'
                                ? { duration: material.duration }
                                : {}),
                            })
                          }}
                          topLeft={
                            <ReactCountryFlag
                              countryCode={getLanguageFlag(material.language)}
                              svg
                              style={{ width: '18px', height: '13px', borderRadius: '2px' }}
                            />
                          }
                        />
                        <div className="mt-1.5 flex items-center justify-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => void handleDownload(material)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-green-600 hover:bg-green-50"
                            title="다운로드"
                            aria-label={`${material.title} 다운로드`}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEdit(material)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-primary hover:bg-muted/50"
                            title="수정"
                            aria-label={`${material.title} 수정`}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                            title="삭제"
                            aria-label={`${material.title} 삭제`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'quizzes' && (
            <div className="space-y-4">
              {filteredQuizzes.length === 0 ? (
                <div className="text-center py-12">
                  <HelpCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">퀴즈가 없습니다</h3>
                  <p className="text-gray-600 mb-4">새로운 가이드 퀴즈를 추가해보세요.</p>
                  <button
                    onClick={() => setShowQuizModal(true)}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  >
                    퀴즈 추가
                  </button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredQuizzes.map(quiz => (
                    <div key={quiz.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{quiz.title}</h3>
                          {quiz.description && (
                            <p className="text-sm text-gray-600 mt-1">{quiz.description}</p>
                          )}
                          <p className="text-sm text-gray-700 mt-2">{quiz.question}</p>
                          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                            <span className="flex items-center space-x-1">
                              <MapPin className="w-3 h-3" />
                              <span>{(quiz as GuideQuiz & { tour_attractions?: { name_ko: string } }).tour_attractions?.name_ko || '관광지 없음'}</span>
                            </span>
                            <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                              {quiz.difficulty || 'medium'}
                            </span>
                            <span className="flex items-center space-x-1">
                              <Globe className="w-3 h-3" />
                              <span>{quiz.language?.toUpperCase() || 'KO'}</span>
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button className="p-2 text-gray-400 hover:text-primary">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'attractions' && (
            <div className="space-y-4">
              {attractions.length === 0 ? (
                <div className="text-center py-12">
                  <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">관광지가 없습니다</h3>
                  <p className="text-gray-600 mb-4">새로운 관광지를 추가해보세요.</p>
                  <button
                    onClick={() => setShowAttractionModal(true)}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
                  >
                    관광지 추가
                  </button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {attractions.map(attraction => (
                    <div key={attraction.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{attraction.name_ko}</h3>
                          <p className="text-sm text-gray-600">{attraction.name_en}</p>
                          {attraction.description_ko && (
                            <p className="text-sm text-gray-700 mt-2">{attraction.description_ko}</p>
                          )}
                          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                            <span className="flex items-center space-x-1">
                              <MapPin className="w-3 h-3" />
                              <span>{attraction.location || '위치 정보 없음'}</span>
                            </span>
                            <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs">
                              {attraction.category || '카테고리 없음'}
                            </span>
                            <span className="flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>{attraction.visit_duration || 0}분</span>
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button className="p-2 text-gray-400 hover:text-primary">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 업로드 모달 */}
      <TourMaterialUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={loadData}
      />

      {/* 수정 모달 */}
      <TourMaterialEditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        material={selectedMaterial as DbTourMaterial | null}
        onSuccess={handleEditSuccess}
      />

      {/* 퀴즈 모달 */}
      <GuideQuizModal
        isOpen={showQuizModal}
        onClose={() => setShowQuizModal(false)}
        onSuccess={loadData}
      />

      {/* 관광지 모달 */}
      <AttractionModal
        isOpen={showAttractionModal}
        onClose={() => setShowAttractionModal(false)}
        onSuccess={loadData}
      />
    </div>
  )
}
