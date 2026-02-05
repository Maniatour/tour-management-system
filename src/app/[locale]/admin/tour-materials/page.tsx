'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import { createClientSupabase } from '@/lib/supabase'
import { Database } from '@/lib/database.types'
import { 
  Plus, 
  Upload, 
  FileText, 
  Volume2, 
  Video, 
  Image, 
  HelpCircle,
  Edit,
  Trash2,
  Eye,
  Download,
  Search,
  Filter,
  MapPin,
  Clock,
  Tag,
  Globe,
  Play,
  ChevronDown,
  ChevronUp,
  Pause
} from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'
import { useAudioPlayer } from '@/contexts/AudioPlayerContext'
// @ts-expect-error - sonner module type declarations not found
import { toast } from 'sonner'
import TourMaterialUploadModal from '@/components/TourMaterialUploadModal'
import TourMaterialEditModal from '@/components/TourMaterialEditModal'
import AudioPlayer from '@/components/AudioPlayer'
import GuideQuizModal from '@/components/GuideQuizModal'
import AttractionModal from '@/components/AttractionModal'

// 타입 정의 (데이터베이스에 없는 테이블들)
type TourAttraction = {
  id: string
  name_ko: string
  name_en: string
  description_ko?: string
  description_en?: string
  location?: string
  category?: string
  visit_duration?: number
  created_at: string
  updated_at: string
}

type TourMaterial = {
  id: string
  title: string
  description?: string
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  duration?: number
  language?: string
  attraction_id?: string
  category_id?: string
  created_at: string
  updated_at: string
}

type TourMaterialCategory = {
  id: string
  name_ko: string
  name_en: string
  icon?: string
  color?: string
  sort_order: number
  created_at: string
  updated_at: string
}

type GuideQuiz = {
  id: string
  title: string
  description?: string
  question: string
  answer: string
  difficulty?: string
  language?: string
  attraction_id?: string
  created_at: string
  updated_at: string
}

export default function TourMaterialsManagementPage() {
  const t = useTranslations('admin')
  const { user } = useAuth()
  const supabase = createClientSupabase()
  const { playTrack, currentTrack, isPlaying } = useAudioPlayer()
  
  const [activeTab, setActiveTab] = useState<'materials' | 'quizzes' | 'attractions'>('materials')
  const [materials, setMaterials] = useState<TourMaterial[]>([])
  const [quizzes, setQuizzes] = useState<GuideQuiz[]>([])
  const [attractions, setAttractions] = useState<TourAttraction[]>([])
  const [categories, setCategories] = useState<TourMaterialCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAttraction, setSelectedAttraction] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showQuizModal, setShowQuizModal] = useState(false)
  const [showAttractionModal, setShowAttractionModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState<TourMaterial | null>(null)
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

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

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'script': return <FileText className="w-5 h-5 text-blue-500" />
      case 'audio': return <Volume2 className="w-5 h-5 text-green-500" />
      case 'video': return <Video className="w-5 h-5 text-purple-500" />
      case 'image': return <Image className="w-5 h-5 text-orange-500" />
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

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-'
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
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
    const matchesAttraction = !selectedAttraction || material.attraction_id === selectedAttraction
    const matchesCategory = !selectedCategory || material.category_id === selectedCategory
    // 오디오 파일만 표시
    return matchesSearch && matchesAttraction && matchesCategory && material.file_type === 'audio'
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
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
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 py-2 sm:px-4 sm:py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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

        {/* 검색 및 필터 */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <select
                value={selectedAttraction}
                onChange={(e) => setSelectedAttraction(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">모든 관광지</option>
                {attractions.map(attraction => (
                  <option key={attraction.id} value={attraction.id}>
                    {attraction.name_ko}
                  </option>
                ))}
              </select>
              {activeTab === 'materials' && (
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">모든 카테고리</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name_ko}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
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
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    자료 업로드
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredMaterials.map(material => (
                    <div key={material.id}>
                      {/* 오디오 파일만 표시 */}
                      {material.file_type === 'audio' && (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                          {/* 아코디언 헤더 */}
                          <div 
                            className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => toggleAccordion(material.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2 flex-1 min-w-0">
                                {/* 플레이 버튼 */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    playTrack({
                                      src: getFileUrl(material.file_path),
                                      title: material.title,
                                      duration: material.duration || undefined
                                    })
                                  }}
                                  className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                                    currentTrack?.src === getFileUrl(material.file_path) && isPlaying
                                      ? 'bg-red-600 text-white hover:bg-red-700'
                                      : 'bg-blue-600 text-white hover:bg-blue-700'
                                  }`}
                                  title={currentTrack?.src === getFileUrl(material.file_path) && isPlaying ? '재생 중' : '재생'}
                                >
                                  {currentTrack?.src === getFileUrl(material.file_path) && isPlaying ? (
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
                                {/* 펼쳐보기 버튼 */}
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
                                {/* 기본 정보 */}
                                <div className="flex items-center space-x-3 text-xs text-gray-500">
                                  <span className="flex items-center space-x-1">
                                    <MapPin className="w-3 h-3" />
                                    <span className="truncate">{(material as TourMaterial & { tour_attractions?: { name_ko: string } }).tour_attractions?.name_ko || '관광지 없음'}</span>
                                  </span>
                                  <span className="flex items-center space-x-1">
                                    <Tag className="w-3 h-3" />
                                    <span className="truncate">{(material as TourMaterial & { tour_material_categories?: { name_ko: string } }).tour_material_categories?.name_ko || '카테고리 없음'}</span>
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
                                        className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                
                                {/* 관리 버튼들 */}
                                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100">
                                  <button 
                                    onClick={() => handleDownload(material)}
                                    className="flex items-center space-x-1 px-2 py-1 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                                  >
                                    <Download className="w-3 h-3" />
                                    <span>다운로드</span>
                                  </button>
                                  <button 
                                    onClick={() => handleEdit(material)}
                                    className="flex items-center space-x-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                                  >
                                    <Edit className="w-3 h-3" />
                                    <span>수정</span>
                                  </button>
                                  <button className="flex items-center space-x-1 px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors">
                                    <Trash2 className="w-3 h-3" />
                                    <span>삭제</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
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
                          <button className="p-2 text-gray-400 hover:text-blue-600">
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
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                              {attraction.category || '카테고리 없음'}
                            </span>
                            <span className="flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>{attraction.visit_duration || 0}분</span>
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button className="p-2 text-gray-400 hover:text-blue-600">
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
        material={selectedMaterial}
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
