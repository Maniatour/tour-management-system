'use client'

import React, { useState } from 'react'
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  MapPin,
  Clock,
  Users,
  Image as ImageIcon,
  Globe,
  Settings,
  FileText,
  Navigation,
  Save,
  X,
  ExternalLink
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useOptimizedData } from '@/hooks/useOptimizedData'
import CategoryManagementModal from '@/components/CategoryManagementModal'
import TourCoursePhotoUploadModal from '@/components/TourCoursePhotoUploadModal'
import LocationSearch from '@/components/LocationSearch'
import LocationPickerModal from '@/components/LocationPickerModal'
// 타입 정의 (실제 데이터베이스 스키마에 맞춤)
interface TourCourseRow {
  id: string
  name_ko: string
  name_en: string
  description_ko: string | null
  description_en: string | null
  category: string
  category_id: string | null
  point_name: string | null
  location: string | null
  start_latitude: number | null
  start_longitude: number | null
  end_latitude: number | null
  end_longitude: number | null
  internal_note: string | null
  duration_hours: number
  difficulty_level: 'easy' | 'medium' | 'hard'
  max_participants: number
  min_participants: number
  price_adult: number | null
  price_child: number | null
  price_infant: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface TourCourseCategoryRow {
  id: string
  name_ko: string
  name_en: string
  description_ko: string | null
  description_en: string | null
  color: string
  icon: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

interface TourCourseMapRow {
  id: string
  course_id: string | null
  map_type: string
  map_data: any | null
  map_url: string | null
  created_at: string
}

interface TourCoursePhotoRow {
  id: string
  course_id: string
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  mime_type: string
  thumbnail_url: string | null
  is_primary: boolean
  sort_order: number
  uploaded_by: string | null
  created_at: string
  updated_at: string
}

interface TourCoursePointRow {
  id: string
  course_id: string
  point_name: string
  location: string | null
  latitude: number | null
  longitude: number | null
  description_ko: string | null
  description_en: string | null
  visit_duration: number | null
  sort_order: number
  is_active: boolean
  google_maps_url: string | null
  place_id: string | null
  created_at: string
  updated_at: string
}

type TourCourseInsert = Omit<TourCourseRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
}

type TourCourseUpdate = Partial<TourCourseInsert>

// 기존 인터페이스들을 새로운 타입으로 교체
type TourCourseCategory = TourCourseCategoryRow
type TourCoursePhoto = TourCoursePhotoRow
type TourCoursePoint = TourCoursePointRow

interface TourCourse extends TourCourseRow {
  photos?: TourCoursePhoto[]
  points?: TourCoursePoint[]
  category?: TourCourseCategory
}

const DIFFICULTY_LEVELS = [
  { value: 'easy', label: '쉬움', color: 'text-green-600' },
  { value: 'medium', label: '보통', color: 'text-yellow-600' },
  { value: 'hard', label: '어려움', color: 'text-red-600' }
]

export default function TourCoursesPage() {
  // 최적화된 투어 코스 데이터 로딩
  const { data: tourCourses = [], loading, refetch: refetchCourses } = useOptimizedData({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('tour_courses')
        .select(`
          *,
          photos:tour_course_photos(*),
          points:tour_course_points(*),
          category:tour_course_categories(*)
        `)
        .order('created_at', { ascending: false }) as { data: TourCourse[] | null, error: any }

      if (error) {
        console.error('Error fetching tour courses:', error)
        return []
      }

      return data || []
    },
    cacheKey: 'tour-courses',
    cacheTime: 5 * 60 * 1000 // 5분 캐시
  })

  // 최적화된 카테고리 데이터 로딩
  const { data: categories = [] } = useOptimizedData({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('tour_course_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (error) {
        console.error('Error fetching categories:', error)
        return []
      }

      return data || []
    },
    cacheKey: 'tour-course-categories',
    cacheTime: 10 * 60 * 1000 // 10분 캐시
  })

  // 상태 관리
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [difficultyFilter, setDifficultyFilter] = useState('all')
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<TourCourse | null>(null)
  const [editingCourse, setEditingCourse] = useState<TourCourse | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showMapModal, setShowMapModal] = useState(false)
  const [mapModalType, setMapModalType] = useState<'main' | 'start' | 'end'>('main')
  const [formData, setFormData] = useState({
    name_ko: '',
    name_en: '',
    description_ko: '',
    description_en: '',
    category: '',
    category_id: '',
    point_name: '',
    location: '',
    start_latitude: '',
    start_longitude: '',
    end_latitude: '',
    end_longitude: '',
    internal_note: '',
    duration_hours: 60,
    difficulty_level: 'easy' as const,
    max_participants: 20,
    min_participants: 1,
    price_adult: 0,
    price_child: 0,
    price_infant: 0,
    is_active: true
  })

  // 필터링된 투어 코스 목록
  const filteredCourses = (tourCourses || []).filter(course => {
    const matchesSearch = course.name_ko.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.point_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.location?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCategory = categoryFilter === 'all' || course.category_id === categoryFilter
    const matchesDifficulty = difficultyFilter === 'all' || course.difficulty_level === difficultyFilter

    return matchesSearch && matchesCategory && matchesDifficulty
  })

  // 새 투어 코스 생성
  const createCourse = async () => {
    if (!formData.name_ko.trim() || !formData.name_en.trim()) {
      alert('한국어와 영어 이름을 모두 입력해주세요.')
      return
    }

    try {
      // UUID 생성
      const courseId = crypto.randomUUID()
      
      const { error } = await supabase
        .from('tour_courses')
        .insert({
          id: courseId,
          name_ko: formData.name_ko,
          name_en: formData.name_en,
          description_ko: formData.description_ko || null,
          description_en: formData.description_en || null,
          category: formData.category || '기타',
          category_id: formData.category_id || null,
          point_name: formData.point_name || null,
          location: formData.location || null,
          start_latitude: formData.start_latitude ? parseFloat(formData.start_latitude) : null,
          start_longitude: formData.start_longitude ? parseFloat(formData.start_longitude) : null,
          end_latitude: formData.end_latitude ? parseFloat(formData.end_latitude) : null,
          end_longitude: formData.end_longitude ? parseFloat(formData.end_longitude) : null,
          internal_note: formData.internal_note || null,
          duration_hours: formData.duration_hours,
          difficulty_level: formData.difficulty_level,
          max_participants: formData.max_participants,
          min_participants: formData.min_participants,
          price_adult: formData.price_adult || null,
          price_child: formData.price_child || null,
          price_infant: formData.price_infant || null,
          is_active: formData.is_active
        })

      if (error) throw error

      await refetchCourses()
      resetForm()
      setShowEditModal(false)
    } catch (error) {
      console.error('투어 코스 생성 오류:', error)
      alert('투어 코스 생성 중 오류가 발생했습니다.')
    }
  }

  // 투어 코스 수정
  const updateCourse = async () => {
    if (!editingCourse) return

    try {
      const { error } = await supabase
        .from('tour_courses')
        .update({
          name_ko: formData.name_ko,
          name_en: formData.name_en,
          description_ko: formData.description_ko || null,
          description_en: formData.description_en || null,
          category: formData.category || '기타',
          category_id: formData.category_id || null,
          point_name: formData.point_name || null,
          location: formData.location || null,
          start_latitude: formData.start_latitude ? parseFloat(formData.start_latitude) : null,
          start_longitude: formData.start_longitude ? parseFloat(formData.start_longitude) : null,
          end_latitude: formData.end_latitude ? parseFloat(formData.end_latitude) : null,
          end_longitude: formData.end_longitude ? parseFloat(formData.end_longitude) : null,
          internal_note: formData.internal_note || null,
          duration_hours: formData.duration_hours,
          difficulty_level: formData.difficulty_level,
          max_participants: formData.max_participants,
          min_participants: formData.min_participants,
          price_adult: formData.price_adult || null,
          price_child: formData.price_child || null,
          price_infant: formData.price_infant || null,
          is_active: formData.is_active
        })
        .eq('id', editingCourse.id)

      if (error) throw error

      await refetchCourses()
      resetForm()
      setShowEditModal(false)
      setEditingCourse(null)
    } catch (error) {
      console.error('투어 코스 수정 오류:', error)
      alert('투어 코스 수정 중 오류가 발생했습니다.')
    }
  }

  // 투어 코스 삭제
  const deleteCourse = async (courseId: string) => {
    if (!confirm('이 투어 코스를 삭제하시겠습니까?')) return

    try {
      const { error } = await supabase
        .from('tour_courses')
        .delete()
        .eq('id', courseId)

      if (error) throw error

      await refetchCourses()
    } catch (error) {
      console.error('투어 코스 삭제 오류:', error)
      alert('투어 코스 삭제 중 오류가 발생했습니다.')
    }
  }

  // 폼 초기화
  const resetForm = () => {
    setFormData({
      name_ko: '',
      name_en: '',
      description_ko: '',
      description_en: '',
      category: '',
      category_id: '',
      point_name: '',
      location: '',
      start_latitude: '',
      start_longitude: '',
      end_latitude: '',
      end_longitude: '',
      internal_note: '',
      duration_hours: 60,
      difficulty_level: 'easy',
      max_participants: 20,
      min_participants: 1,
      price_adult: 0,
      price_child: 0,
      price_infant: 0,
      is_active: true
    })
  }

  // 편집 시작
  const startEdit = (course: TourCourse) => {
    setFormData({
      name_ko: course.name_ko,
      name_en: course.name_en,
      description_ko: course.description_ko || '',
      description_en: course.description_en || '',
      category: course.category || '',
      category_id: course.category_id || '',
      point_name: course.point_name || '',
      location: course.location || '',
      start_latitude: course.start_latitude?.toString() || '',
      start_longitude: course.start_longitude?.toString() || '',
      end_latitude: course.end_latitude?.toString() || '',
      end_longitude: course.end_longitude?.toString() || '',
      internal_note: course.internal_note || '',
      duration_hours: course.duration_hours,
      difficulty_level: course.difficulty_level,
      max_participants: course.max_participants,
      min_participants: course.min_participants,
      price_adult: course.price_adult || 0,
      price_child: course.price_child || 0,
      price_infant: course.price_infant || 0,
      is_active: course.is_active
    })
    setEditingCourse(course)
    setShowEditModal(true)
  }

  // 새 투어 코스 생성 시작
  const startCreate = () => {
    resetForm()
    setEditingCourse(null)
    setShowEditModal(true)
  }

  // 사진 관리 모달 열기
  const openPhotoModal = (course: TourCourse) => {
    setSelectedCourse(course)
    setShowPhotoModal(true)
  }

  // 사진 업데이트 콜백
  const handlePhotosUpdate = (photos: TourCoursePhoto[]) => {
    if (selectedCourse) {
      const updatedCourse = { ...selectedCourse, photos }
      setSelectedCourse(updatedCourse)
    }
    refetchCourses()
  }

  // 카테고리 선택 콜백
  const handleCategorySelect = (category: TourCourseCategory) => {
    setFormData({ 
      ...formData, 
      category_id: category.id,
      category: category.name_ko
    })
    setShowCategoryModal(false)
  }

  // 위치 검색 콜백 함수들
  const handleMainLocationSelect = (location: any) => {
    setFormData({
      ...formData,
      point_name: location.name,
      location: location.address
    })
  }

  const handleStartLocationSelect = (location: any) => {
    setFormData({
      ...formData,
      start_latitude: location.latitude.toString(),
      start_longitude: location.longitude.toString()
    })
  }

  const handleEndLocationSelect = (location: any) => {
    setFormData({
      ...formData,
      end_latitude: location.latitude.toString(),
      end_longitude: location.longitude.toString()
    })
  }

  // 지도 모달에서 위치 선택 핸들러
  const handleMapLocationSelect = (lat: number, lng: number, address?: string) => {
    if (mapModalType === 'main') {
      setFormData({
        ...formData,
        point_name: address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        location: address || ''
      })
    } else if (mapModalType === 'start') {
      setFormData({
        ...formData,
        start_latitude: lat.toString(),
        start_longitude: lng.toString()
      })
    } else if (mapModalType === 'end') {
      setFormData({
        ...formData,
        end_latitude: lat.toString(),
        end_longitude: lng.toString()
      })
    }
    setShowMapModal(false)
  }

  // 지도 모달 열기
  const openMapModal = (type: 'main' | 'start' | 'end') => {
    setMapModalType(type)
    setShowMapModal(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">투어 코스 관리</h1>
          <p className="text-gray-600 mt-1">투어 코스를 생성하고 관리하세요</p>
        </div>
        <button
          onClick={startCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          새 투어 코스
        </button>
      </div>

      {/* 필터 및 검색 */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">검색</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="투어 코스명, 포인트, 위치로 검색..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">전체 카테고리</option>
                {(categories || []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name_ko}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">난이도</label>
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">전체 난이도</option>
              {DIFFICULTY_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => setShowCategoryModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 w-full"
            >
              <Settings className="w-4 h-4" />
              카테고리 관리
            </button>
          </div>
        </div>
      </div>

      {/* 투어 코스 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCourses.map((course) => (
          <div key={course.id} className="bg-white rounded-lg shadow-sm border overflow-hidden">
            {/* 대표 사진 */}
            <div className="aspect-video bg-gray-100 relative">
              {course.photos && course.photos.length > 0 ? (
                <img
                  src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-course-photos/${
                    course.photos.find((p: any) => p.is_primary)?.file_path || course.photos[0].file_path
                  }`}
                  alt={course.name_ko}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="w-16 h-16 text-gray-300" />
                </div>
              )}
              
              {/* 액션 버튼들 */}
              <div className="absolute top-2 right-2 flex gap-2">
                <button
                  onClick={() => openPhotoModal(course)}
                  className="p-2 bg-white bg-opacity-80 rounded-full hover:bg-opacity-100"
                  title="사진 관리"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => startEdit(course)}
                  className="p-2 bg-white bg-opacity-80 rounded-full hover:bg-opacity-100"
                  title="수정"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteCourse(course.id)}
                  className="p-2 bg-white bg-opacity-80 rounded-full hover:bg-opacity-100 text-red-600"
                  title="삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* 카테고리 태그 */}
              {course.category && (
                <div className="absolute top-2 left-2">
                  <span 
                    className="px-2 py-1 text-xs font-medium text-white rounded-full"
                    style={{ backgroundColor: course.category?.color || '#3B82F6' }}
                  >
                    {course.category?.name_ko || course.category}
                  </span>
                </div>
              )}
            </div>

            {/* 투어 코스 정보 */}
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{course.name_ko}</h3>
              <p className="text-sm text-gray-600 mb-2">{course.name_en}</p>
              
              {/* 포인트 정보 */}
              {course.point_name && (
                <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
                  <MapPin className="w-4 h-4" />
                  <span>{course.point_name}</span>
                </div>
              )}

              {/* 위치 정보 */}
              {course.location && (
                <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
                  <Navigation className="w-4 h-4" />
                  <span className="truncate">{course.location}</span>
                </div>
              )}

              {/* 좌표 정보 */}
              {(course.start_latitude && course.start_longitude) && (
                <div className="text-xs text-gray-500 mb-2">
                  시작: {course.start_latitude.toFixed(6)}, {course.start_longitude.toFixed(6)}
                </div>
              )}

              {/* 투어 정보 */}
              <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{course.duration_hours}분</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{course.min_participants}-{course.max_participants}명</span>
                </div>
                <span className={`font-medium ${DIFFICULTY_LEVELS.find(l => l.value === course.difficulty_level)?.color}`}>
                  {DIFFICULTY_LEVELS.find(l => l.value === course.difficulty_level)?.label}
                </span>
              </div>

              {/* 가격 정보 */}
              {course.price_adult && (
                <div className="text-sm text-gray-600">
                  성인: ${course.price_adult}
                  {course.price_child && ` | 어린이: $${course.price_child}`}
                  {course.price_infant && ` | 유아: $${course.price_infant}`}
                </div>
              )}

              {/* 인터널 노트 표시 */}
              {course.internal_note && (
                <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                  <FileText className="w-3 h-3 inline mr-1" />
                  내부 노트: {course.internal_note.substring(0, 50)}
                  {course.internal_note.length > 50 && '...'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 투어 코스가 없을 때 */}
      {filteredCourses.length === 0 && (
        <div className="text-center py-12">
          <Globe className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">등록된 투어 코스가 없습니다.</p>
        </div>
      )}

      {/* 편집 모달 */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingCourse ? '투어 코스 수정' : '새 투어 코스 생성'}
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 기본 정보 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">기본 정보</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    한국어 이름 *
                  </label>
                  <input
                    type="text"
                    value={formData.name_ko}
                    onChange={(e) => setFormData({ ...formData, name_ko: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="예: 그랜드 캐니언 투어"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    영어 이름 *
                  </label>
                  <input
                    type="text"
                    value={formData.name_en}
                    onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="예: Grand Canyon Tour"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    한국어 설명
                  </label>
                  <textarea
                    value={formData.description_ko}
                    onChange={(e) => setFormData({ ...formData, description_ko: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="투어 코스 설명을 입력하세요"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    영어 설명
                  </label>
                  <textarea
                    value={formData.description_en}
                    onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Tour course description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    카테고리
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formData.category_id}
                      onChange={(e) => {
                        const selectedCategory = categories.find(cat => cat.id === e.target.value)
                        setFormData({ 
                          ...formData, 
                          category_id: e.target.value,
                          category: selectedCategory?.name_ko || ''
                        })
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">카테고리 선택</option>
                      {(categories || []).map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name_ko}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setShowCategoryModal(true)}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 위치 정보 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">위치 정보</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    메인 위치 검색
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <LocationSearch
                        onLocationSelect={handleMainLocationSelect}
                        placeholder="메인 위치를 검색하세요..."
                        className="mb-2"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => openMapModal('main')}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 whitespace-nowrap"
                      title="지도에서 위치 선택"
                    >
                      <MapPin className="w-4 h-4" />
                      지도
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    포인트 이름
                  </label>
                  <input
                    type="text"
                    value={formData.point_name}
                    onChange={(e) => setFormData({ ...formData, point_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="예: Grand Canyon, South Rim Mather Point"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    위치 정보
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="예: 3V6R+MW Grand Canyon Village, Arizona"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    시작점 위치 검색
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <LocationSearch
                        onLocationSelect={handleStartLocationSelect}
                        placeholder="시작점 위치를 검색하세요..."
                        className="mb-2"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => openMapModal('start')}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 whitespace-nowrap"
                      title="지도에서 시작점 선택"
                    >
                      <MapPin className="w-4 h-4" />
                      지도
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    종료점 위치 검색
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <LocationSearch
                        onLocationSelect={handleEndLocationSelect}
                        placeholder="종료점 위치를 검색하세요..."
                        className="mb-2"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => openMapModal('end')}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 whitespace-nowrap"
                      title="지도에서 종료점 선택"
                    >
                      <MapPin className="w-4 h-4" />
                      지도
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      시작 위도
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.start_latitude}
                      onChange={(e) => setFormData({ ...formData, start_latitude: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="36.06178095340507"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      시작 경도
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.start_longitude}
                      onChange={(e) => setFormData({ ...formData, start_longitude: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="-112.10771422003565"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      종료 위도
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.end_latitude}
                      onChange={(e) => setFormData({ ...formData, end_latitude: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="36.06178095340507"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      종료 경도
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.end_longitude}
                      onChange={(e) => setFormData({ ...formData, end_longitude: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="-112.10771422003565"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    인터널 노트
                  </label>
                  <textarea
                    value={formData.internal_note}
                    onChange={(e) => setFormData({ ...formData, internal_note: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="관리자만 볼 수 있는 내부 노트를 입력하세요"
                  />
                </div>
              </div>

              {/* 투어 설정 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">투어 설정</h3>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      소요 시간 (분)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.duration_hours}
                      onChange={(e) => setFormData({ ...formData, duration_hours: parseInt(e.target.value) || 60 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      난이도
                    </label>
                    <select
                      value={formData.difficulty_level}
                      onChange={(e) => setFormData({ ...formData, difficulty_level: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {DIFFICULTY_LEVELS.map((level) => (
                        <option key={level.value} value={level.value}>
                          {level.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      최소 인원
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.min_participants}
                      onChange={(e) => setFormData({ ...formData, min_participants: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      최대 인원
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.max_participants}
                      onChange={(e) => setFormData({ ...formData, max_participants: parseInt(e.target.value) || 20 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* 가격 정보 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">가격 정보</h3>
                
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      성인 가격 ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.price_adult}
                      onChange={(e) => setFormData({ ...formData, price_adult: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      어린이 가격 ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.price_child}
                      onChange={(e) => setFormData({ ...formData, price_child: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      유아 가격 ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.price_infant}
                      onChange={(e) => setFormData({ ...formData, price_infant: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="mr-2"
                  />
                  <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                    활성 상태
                  </label>
                </div>
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex gap-2 mt-6">
              <button
                onClick={editingCourse ? updateCourse : createCourse}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Save className="w-4 h-4" />
                {editingCourse ? '수정' : '생성'}
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                <X className="w-4 h-4" />
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 카테고리 관리 모달 */}
      <CategoryManagementModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onCategorySelect={handleCategorySelect}
        selectedCategoryId={formData.category_id}
      />

      {/* 사진 업로드 모달 */}
      <TourCoursePhotoUploadModal
        isOpen={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        courseId={selectedCourse?.id || ''}
        existingPhotos={selectedCourse?.photos || []}
        onPhotosUpdate={handlePhotosUpdate}
      />

      {/* 지도 선택 모달 */}
      {showMapModal && (
        <LocationPickerModal
          currentLat={mapModalType === 'main' ? 
            (formData.location ? undefined : undefined) : 
            mapModalType === 'start' ? 
              (formData.start_latitude ? parseFloat(formData.start_latitude) : undefined) :
              (formData.end_latitude ? parseFloat(formData.end_latitude) : undefined)
          }
          currentLng={mapModalType === 'main' ? 
            (formData.location ? undefined : undefined) : 
            mapModalType === 'start' ? 
              (formData.start_longitude ? parseFloat(formData.start_longitude) : undefined) :
              (formData.end_longitude ? parseFloat(formData.end_longitude) : undefined)
          }
          onLocationSelect={handleMapLocationSelect}
          onClose={() => setShowMapModal(false)}
        />
      )}
    </div>
  )
}