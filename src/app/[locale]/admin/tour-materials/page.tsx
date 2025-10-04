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
  Grid3X3,
  List,
  Filter,
  MapPin,
  Clock,
  Tag,
  Globe,
  Play
} from 'lucide-react'
import { toast } from 'sonner'
import TourMaterialUploadModal from '@/components/TourMaterialUploadModal'
import TourMaterialEditModal from '@/components/TourMaterialEditModal'
import AudioPlayer from '@/components/AudioPlayer'
import GuideQuizModal from '@/components/GuideQuizModal'
import AttractionModal from '@/components/AttractionModal'

type TourAttraction = Database['public']['Tables']['tour_attractions']['Row']
type TourMaterial = Database['public']['Tables']['tour_materials']['Row']
type TourMaterialCategory = Database['public']['Tables']['tour_material_categories']['Row']
type GuideQuiz = Database['public']['Tables']['guide_quizzes']['Row']

export default function TourMaterialsManagementPage() {
  const t = useTranslations('admin')
  const { user } = useAuth()
  const supabase = createClientSupabase()
  
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
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid')
  const [expandedAudio, setExpandedAudio] = useState<Set<string>>(new Set())

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

  const toggleAudioAccordion = (materialId: string) => {
    const newExpanded = new Set(expandedAudio)
    if (newExpanded.has(materialId)) {
      newExpanded.delete(materialId)
    } else {
      newExpanded.add(materialId)
    }
    setExpandedAudio(newExpanded)
  }

  // 수정 완료 후 데이터 새로고침
  const handleEditSuccess = () => {
    loadData()
  }

  const filteredMaterials = materials.filter(material => {
    const matchesSearch = material.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         material.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesAttraction = !selectedAttraction || material.attraction_id === selectedAttraction
    const matchesCategory = !selectedCategory || material.category_id === selectedCategory
    return matchesSearch && matchesAttraction && matchesCategory
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
      {/* 헤더 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">투어 자료 관리</h1>
            <p className="text-gray-600 mt-1">가이드가 사용할 투어 자료들을 관리합니다</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowUploadModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
            >
              <Upload className="w-4 h-4" />
              <span>자료 업로드</span>
            </button>
            <button
              onClick={() => setShowQuizModal(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>퀴즈 추가</span>
            </button>
            <button
              onClick={() => setShowAttractionModal(true)}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center space-x-2"
            >
              <MapPin className="w-4 h-4" />
              <span>관광지 추가</span>
            </button>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('materials')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'materials'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              투어 자료 ({materials.length})
            </button>
            <button
              onClick={() => setActiveTab('quizzes')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'quizzes'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              가이드 퀴즈 ({quizzes.length})
            </button>
            <button
              onClick={() => setActiveTab('attractions')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'attractions'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              관광지 관리 ({attractions.length})
            </button>
          </nav>
        </div>

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
            <div className="flex items-center gap-4">
              {/* 뷰 모드 토글 */}
              <div className="flex border rounded">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                  title="그리드 보기"
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                  title="리스트 보기"
                >
                  <List className="w-4 h-4" />
                </button>
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
                viewMode === 'grid' ? (
                  /* 그리드 뷰 - 5열 */
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredMaterials.map(material => (
                      material.file_type === 'audio' ? (
                        /* 오디오 파일인 경우 플레이어만 표시 (외부 박스 없음) */
                        <AudioPlayer
                          key={material.id}
                          src={getFileUrl(material.file_path)}
                          title={material.title}
                          audioDuration={material.duration || undefined}
                          language={material.language}
                          attraction={(material as any).tour_attractions?.name_ko || '관광지 없음'}
                          category={(material as any).tour_material_categories?.name_ko || '카테고리 없음'}
                          fileSize={formatFileSize(material.file_size)}
                          className="w-full"
                          isExpanded={expandedAudio.has(material.id)}
                          onToggleExpanded={() => toggleAudioAccordion(material.id)}
                        />
                      ) : (
                        /* 비오디오 파일인 경우 기존 카드 형태 */
                        <div key={material.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
                          /* 비오디오 파일인 경우 기존 카드 형태 */
                          <>
                            {/* 파일 아이콘과 제목 */}
                            <div className="flex items-start space-x-3 mb-3">
                              <div className="flex-shrink-0">
                                {getFileIcon(material.file_type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-gray-900 text-sm truncate" title={material.title}>
                                  {material.title}
                                </h3>
                                {material.description && (
                                  <p className="text-xs text-gray-600 mt-1 line-clamp-2" title={material.description}>
                                    {material.description}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* 메타 정보 */}
                            <div className="space-y-2 text-xs text-gray-500">
                              <div className="flex items-center space-x-1">
                                <MapPin className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{(material as any).tour_attractions?.name_ko || '관광지 없음'}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Tag className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{(material as any).tour_material_categories?.name_ko || '카테고리 없음'}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>{formatFileSize(material.file_size)}</span>
                                <span className="flex items-center space-x-1">
                                  <Globe className="w-3 h-3" />
                                  <span>{material.language?.toUpperCase() || 'KO'}</span>
                                </span>
                              </div>
                              {material.duration && (
                                <div className="flex items-center space-x-1">
                                  <Clock className="w-3 h-3" />
                                  <span>{formatDuration(material.duration)}</span>
                                </div>
                              )}
                            </div>

                            {/* 액션 버튼들 */}
                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                              <div className="flex items-center space-x-1">
                                <button 
                                  className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                                  title="보기"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => handleDownload(material)}
                                  className="p-1.5 text-gray-400 hover:text-green-600 transition-colors"
                                  title="다운로드"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="flex items-center space-x-1">
                                <button 
                                  onClick={() => handleEdit(material)}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                                  title="편집"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                                  title="삭제"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </>
                        </div>
                      )
                    ))}
                  </div>
                ) : (
                  /* 리스트 뷰 */
                  <div className="space-y-4">
                    {filteredMaterials.map(material => (
                      material.file_type === 'audio' ? (
                        /* 오디오 파일인 경우 플레이어만 표시 (외부 박스 없음) */
                        <AudioPlayer
                          key={material.id}
                          src={getFileUrl(material.file_path)}
                          title={material.title}
                          audioDuration={material.duration || undefined}
                          language={material.language}
                          attraction={(material as any).tour_attractions?.name_ko || '관광지 없음'}
                          category={(material as any).tour_material_categories?.name_ko || '카테고리 없음'}
                          fileSize={formatFileSize(material.file_size)}
                          className="w-full"
                          isExpanded={expandedAudio.has(material.id)}
                          onToggleExpanded={() => toggleAudioAccordion(material.id)}
                        />
                      ) : (
                        /* 비오디오 파일인 경우 기존 리스트 형태 */
                        <div key={material.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                          /* 비오디오 파일인 경우 기존 리스트 형태 */
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3 flex-1">
                              {getFileIcon(material.file_type)}
                              <div className="flex-1">
                                <h3 className="font-medium text-gray-900">{material.title}</h3>
                                {material.description && (
                                  <p className="text-sm text-gray-600 mt-1">{material.description}</p>
                                )}
                                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                                  <span className="flex items-center space-x-1">
                                    <MapPin className="w-3 h-3" />
                                    <span>{(material as any).tour_attractions?.name_ko || '관광지 없음'}</span>
                                  </span>
                                  <span className="flex items-center space-x-1">
                                    <Tag className="w-3 h-3" />
                                    <span>{(material as any).tour_material_categories?.name_ko || '카테고리 없음'}</span>
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
                              <button className="p-2 text-gray-400 hover:text-blue-600">
                                <Eye className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDownload(material)}
                                className="p-2 text-gray-400 hover:text-green-600"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleEdit(material)}
                                className="p-2 text-gray-400 hover:text-blue-600"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button className="p-2 text-gray-400 hover:text-red-600">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                )
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
                              <span>{(quiz as any).tour_attractions?.name_ko || '관광지 없음'}</span>
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
