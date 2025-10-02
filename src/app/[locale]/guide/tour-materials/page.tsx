'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import { createClientSupabase } from '@/lib/supabase'
import { Database } from '@/lib/database.types'
import { 
  FileText, 
  Volume2, 
  Video, 
  Image, 
  HelpCircle,
  Play,
  Pause,
  Download,
  Search,
  MapPin,
  Clock,
  Tag,
  Globe,
  ChevronDown,
  ChevronRight,
  BookOpen
} from 'lucide-react'
import { toast } from 'sonner'

type TourAttraction = Database['public']['Tables']['tour_attractions']['Row']
type TourMaterial = Database['public']['Tables']['tour_materials']['Row']
type TourMaterialCategory = Database['public']['Tables']['tour_material_categories']['Row']
type GuideQuiz = Database['public']['Tables']['guide_quizzes']['Row']

interface MaterialWithDetails extends TourMaterial {
  tour_attractions?: { name_ko: string; name_en: string }
  tour_material_categories?: { name_ko: string; name_en: string; icon: string; color: string }
}

interface QuizWithDetails extends GuideQuiz {
  tour_attractions?: { name_ko: string; name_en: string }
}

export default function GuideTourMaterialsPage() {
  const t = useTranslations('guide')
  const { user } = useAuth()
  const supabase = createClientSupabase()
  
  const [materials, setMaterials] = useState<MaterialWithDetails[]>([])
  const [quizzes, setQuizzes] = useState<QuizWithDetails[]>([])
  const [attractions, setAttractions] = useState<TourAttraction[]>([])
  const [categories, setCategories] = useState<TourMaterialCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAttraction, setSelectedAttraction] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [expandedAttractions, setExpandedAttractions] = useState<Set<string>>(new Set())
  const [playingAudio, setPlayingAudio] = useState<string | null>(null)
  const [playingVideo, setPlayingVideo] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // 투어 자료 로드
      const { data: materialsData, error: materialsError } = await supabase
        .from('tour_materials')
        .select(`
          *,
          tour_attractions(name_ko, name_en),
          tour_material_categories(name_ko, name_en, icon, color)
        `)
        .eq('is_active', true)
        .eq('is_public', true)
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
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (quizzesError) throw quizzesError
      setQuizzes(quizzesData || [])

      // 관광지 로드
      const { data: attractionsData, error: attractionsError } = await supabase
        .from('tour_attractions')
        .select('*')
        .eq('is_active', true)
        .order('name_ko')

      if (attractionsError) throw attractionsError
      setAttractions(attractionsData || [])

      // 카테고리 로드
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('tour_material_categories')
        .select('*')
        .eq('is_active', true)
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

  const getFileIcon = (fileType: string, color?: string) => {
    const iconClass = `w-5 h-5 ${color ? `text-[${color}]` : 'text-gray-500'}`
    switch (fileType) {
      case 'script': return <FileText className={iconClass} />
      case 'audio': return <Volume2 className={iconClass} />
      case 'video': return <Video className={iconClass} />
      case 'image': return <Image className={iconClass} />
      default: return <FileText className={iconClass} />
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

  const toggleAttractionExpansion = (attractionId: string) => {
    const newExpanded = new Set(expandedAttractions)
    if (newExpanded.has(attractionId)) {
      newExpanded.delete(attractionId)
    } else {
      newExpanded.add(attractionId)
    }
    setExpandedAttractions(newExpanded)
  }

  const handleAudioPlay = (materialId: string) => {
    if (playingAudio === materialId) {
      setPlayingAudio(null)
    } else {
      setPlayingAudio(materialId)
      setPlayingVideo(null)
    }
  }

  const handleVideoPlay = (materialId: string) => {
    if (playingVideo === materialId) {
      setPlayingVideo(null)
    } else {
      setPlayingVideo(materialId)
      setPlayingAudio(null)
    }
  }

  const handleDownload = async (material: MaterialWithDetails) => {
    try {
      // 실제 파일 다운로드 로직 구현
      const link = document.createElement('a')
      link.href = material.file_path
      link.download = material.file_name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('파일 다운로드가 시작되었습니다.')
    } catch (error) {
      console.error('다운로드 오류:', error)
      toast.error('파일 다운로드 중 오류가 발생했습니다.')
    }
  }

  // 관광지별로 자료 그룹화
  const materialsByAttraction = materials.reduce((acc, material) => {
    const attractionId = material.attraction_id || 'no-attraction'
    if (!acc[attractionId]) {
      acc[attractionId] = []
    }
    acc[attractionId].push(material)
    return acc
  }, {} as Record<string, MaterialWithDetails[]>)

  // 관광지별로 퀴즈 그룹화
  const quizzesByAttraction = quizzes.reduce((acc, quiz) => {
    const attractionId = quiz.attraction_id || 'no-attraction'
    if (!acc[attractionId]) {
      acc[attractionId] = []
    }
    acc[attractionId].push(quiz)
    return acc
  }, {} as Record<string, QuizWithDetails[]>)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">투어 자료를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
        <div className="flex items-center space-x-3 mb-2">
          <BookOpen className="w-8 h-8" />
          <h1 className="text-2xl font-bold">투어 자료</h1>
        </div>
        <p className="text-blue-100">가이드가 사용할 수 있는 투어 자료들을 확인하세요</p>
      </div>

      {/* 검색 및 필터 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="자료 검색..."
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
          </div>
        </div>
      </div>

      {/* 관광지별 자료 목록 */}
      <div className="space-y-4">
        {attractions.map(attraction => {
          const attractionMaterials = materialsByAttraction[attraction.id] || []
          const attractionQuizzes = quizzesByAttraction[attraction.id] || []
          const isExpanded = expandedAttractions.has(attraction.id)
          
          // 필터링 적용
          const filteredMaterials = attractionMaterials.filter(material => {
            const matchesSearch = material.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                 material.description?.toLowerCase().includes(searchTerm.toLowerCase())
            const matchesCategory = !selectedCategory || material.category_id === selectedCategory
            return matchesSearch && matchesCategory
          })

          const filteredQuizzes = attractionQuizzes.filter(quiz => {
            const matchesSearch = quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                 quiz.question.toLowerCase().includes(searchTerm.toLowerCase())
            return matchesSearch
          })

          // 선택된 관광지 필터가 있으면 해당 관광지만 표시
          if (selectedAttraction && selectedAttraction !== attraction.id) {
            return null
          }

          // 자료나 퀴즈가 없으면 표시하지 않음
          if (filteredMaterials.length === 0 && filteredQuizzes.length === 0) {
            return null
          }

          return (
            <div key={attraction.id} className="bg-white rounded-lg shadow">
              {/* 관광지 헤더 */}
              <div 
                className="p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleAttractionExpansion(attraction.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                    <MapPin className="w-5 h-5 text-blue-500" />
                    <div>
                      <h3 className="font-semibold text-gray-900">{attraction.name_ko}</h3>
                      <p className="text-sm text-gray-600">{attraction.name_en}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span className="flex items-center space-x-1">
                      <FileText className="w-4 h-4" />
                      <span>{filteredMaterials.length}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <HelpCircle className="w-4 h-4" />
                      <span>{filteredQuizzes.length}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* 자료 목록 */}
              {isExpanded && (
                <div className="p-4 space-y-4">
                  {/* 투어 자료 */}
                  {filteredMaterials.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3 flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span>투어 자료</span>
                      </h4>
                      <div className="grid gap-3">
                        {filteredMaterials.map(material => (
                          <div key={material.id} className="border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start space-x-3 flex-1">
                                {getFileIcon(material.file_type, material.tour_material_categories?.color)}
                                <div className="flex-1">
                                  <h5 className="font-medium text-gray-900">{material.title}</h5>
                                  {material.description && (
                                    <p className="text-sm text-gray-600 mt-1">{material.description}</p>
                                  )}
                                  <div className="flex items-center space-x-3 mt-2 text-xs text-gray-500">
                                    <span className="flex items-center space-x-1">
                                      <Tag className="w-3 h-3" />
                                      <span>{material.tour_material_categories?.name_ko || '카테고리 없음'}</span>
                                    </span>
                                    <span>{formatFileSize(material.file_size)}</span>
                                    {material.duration && (
                                      <span className="flex items-center space-x-1">
                                        <Clock className="w-3 h-3" />
                                        <span>{formatDuration(material.duration)}</span>
                                      </span>
                                    )}
                                    <span className="flex items-center space-x-1">
                                      <Globe className="w-3 h-3" />
                                      <span>{material.language?.toUpperCase() || 'KO'}</span>
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                {material.file_type === 'audio' && (
                                  <button
                                    onClick={() => handleAudioPlay(material.id)}
                                    className="p-2 text-gray-400 hover:text-green-600"
                                  >
                                    {playingAudio === material.id ? (
                                      <Pause className="w-4 h-4" />
                                    ) : (
                                      <Play className="w-4 h-4" />
                                    )}
                                  </button>
                                )}
                                {material.file_type === 'video' && (
                                  <button
                                    onClick={() => handleVideoPlay(material.id)}
                                    className="p-2 text-gray-400 hover:text-purple-600"
                                  >
                                    {playingVideo === material.id ? (
                                      <Pause className="w-4 h-4" />
                                    ) : (
                                      <Play className="w-4 h-4" />
                                    )}
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDownload(material)}
                                  className="p-2 text-gray-400 hover:text-blue-600"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 가이드 퀴즈 */}
                  {filteredQuizzes.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3 flex items-center space-x-2">
                        <HelpCircle className="w-4 h-4 text-green-500" />
                        <span>가이드 퀴즈</span>
                      </h4>
                      <div className="grid gap-3">
                        {filteredQuizzes.map(quiz => (
                          <div key={quiz.id} className="border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h5 className="font-medium text-gray-900">{quiz.title}</h5>
                                {quiz.description && (
                                  <p className="text-sm text-gray-600 mt-1">{quiz.description}</p>
                                )}
                                <p className="text-sm text-gray-700 mt-2">{quiz.question}</p>
                                <div className="flex items-center space-x-3 mt-2 text-xs text-gray-500">
                                  <span className="px-2 py-1 bg-gray-100 rounded">
                                    {quiz.difficulty || 'medium'}
                                  </span>
                                  <span className="flex items-center space-x-1">
                                    <Globe className="w-3 h-3" />
                                    <span>{quiz.language?.toUpperCase() || 'KO'}</span>
                                  </span>
                                </div>
                              </div>
                              <button className="p-2 text-gray-400 hover:text-green-600">
                                <Play className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 자료가 없는 경우 */}
      {attractions.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">투어 자료가 없습니다</h3>
          <p className="text-gray-600">관리자에게 투어 자료 업로드를 요청해주세요.</p>
        </div>
      )}
    </div>
  )
}
