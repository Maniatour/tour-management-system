'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  MapPin,
  Clock,
  Image as ImageIcon,
  Globe,
  Settings,
  Save,
  X,
  HelpCircle,
  BookOpen,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  GripVertical
} from 'lucide-react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { supabase } from '@/lib/supabase'
import { useOptimizedData } from '@/hooks/useOptimizedData'
import CategoryManagementModal from '@/components/CategoryManagementModal'
import LocationSearch from '@/components/LocationSearch'
import LocationPickerModal from '@/components/LocationPickerModal'
import TourCourseEditModal from '@/components/TourCourseEditModal'

// LocationData 타입 정의
interface LocationData {
  name: string
  address: string
  latitude: number
  longitude: number
  placeId: string
  googleMapsUrl: string
  rating?: number
  userRatingsTotal?: number
  types?: string[]
}

// 타입 정의 (계층적 구조로 업데이트)
interface TourCourseRow {
  id: string
  product_id: string | null
  parent_id: string | null
  level: number
  customer_name_ko: string | null
  customer_name_en: string | null
  customer_description_ko: string | null
  customer_description_en: string | null
  team_name_ko: string | null
  team_name_en: string | null
  team_description_ko: string | null
  team_description_en: string | null
  internal_note: string | null
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
  duration_hours: number
  difficulty_level: 'easy' | 'medium' | 'hard'
  price_adult: number | null
  price_child: number | null
  price_infant: number | null
  is_active: boolean
  created_at: string
  updated_at: string
  photos?: TourCoursePhoto[]
}

interface TourCourse extends TourCourseRow {
  children?: TourCourse[]
  parent?: TourCourse
}

interface TourCoursePhoto {
  id: string
  course_id: string
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  mime_type: string
  thumbnail_url?: string
  is_primary: boolean
  sort_order?: number
  uploaded_by?: string
  created_at: string
  updated_at: string
}

interface TourCourseCategory {
  id: string
  name_ko: string
  name_en: string
  description_ko?: string
  description_en?: string
  color: string
  icon: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function TourCoursesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [difficultyFilter, setDifficultyFilter] = useState('all')
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingCourse, setEditingCourse] = useState<TourCourse | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showMapModal, setShowMapModal] = useState(false)
  const [mapModalType, setMapModalType] = useState<'main' | 'start' | 'end'>('main')
  const [showHelpModal, setShowHelpModal] = useState(false)
  
  // 트리 관련 상태
  const [selectedCourse, setSelectedCourse] = useState<TourCourse | null>(null)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  // 데이터 로드
  const { 
    data: tourCourses, 
    loading, 
    error, 
    refetch: refetchCourses 
  } = useOptimizedData<TourCourse>('tour_courses', {
    select: '*',
    order: { column: 'created_at', ascending: false }
  })

  const { 
    data: categories 
  } = useOptimizedData<TourCourseCategory>('tour_course_categories', {
    select: '*',
    order: { column: 'sort_order', ascending: true }
  })

  // 편집 시작
  const startEdit = (course: TourCourse) => {
    setEditingCourse(course)
    setShowEditModal(true)
  }

  // 투어 코스 삭제
  const deleteCourse = async (course: TourCourse) => {
    if (!confirm(`"${course.team_name_ko || course.name_ko}" 투어 코스를 삭제하시겠습니까?`)) return

    try {
      const { error } = await supabase
        .from('tour_courses')
        .delete()
        .eq('id', course.id)

      if (error) throw error

      refetchCourses()
      if (selectedCourse?.id === course.id) {
        setSelectedCourse(null)
      }
    } catch (error) {
      console.error('투어 코스 삭제 오류:', error)
      alert('투어 코스 삭제 중 오류가 발생했습니다.')
    }
  }

  // 카테고리 선택 콜백
  const handleCategorySelect = (category: TourCourseCategory) => {
    // 카테고리 선택 로직 (필요시 구현)
  }

  // 위치 검색 콜백 함수들
  const handleMainLocationSelect = (location: LocationData) => {
    // 위치 선택 로직 (필요시 구현)
  }

  const handleStartLocationSelect = (location: LocationData) => {
    // 시작 위치 선택 로직 (필요시 구현)
  }

  const handleEndLocationSelect = (location: LocationData) => {
    // 종료 위치 선택 로직 (필요시 구현)
  }

  // 지도 위치 선택 콜백
  const handleMapLocationSelect = (lat: number, lng: number) => {
    // 지도 위치 선택 로직 (필요시 구현)
  }

  // 트리 노드 토글
  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
  }

  // 계층적 구조 빌드
  const buildHierarchy = (courses: TourCourse[]): TourCourse[] => {
    const courseMap = new Map<string, TourCourse>()
    const rootCourses: TourCourse[] = []

    courses.forEach(course => {
      courseMap.set(course.id, { ...course, children: [] })
    })

    courses.forEach(course => {
      const courseWithChildren = courseMap.get(course.id)!
      if (course.parent_id) {
        const parent = courseMap.get(course.parent_id)
        if (parent) {
          parent.children!.push(courseWithChildren)
          courseWithChildren.parent = parent
        }
      } else {
        rootCourses.push(courseWithChildren)
      }
    })

    return rootCourses
  }

  // 필터링된 코스 목록
  const filteredCourses = tourCourses?.filter(course => {
    const matchesSearch = !searchTerm || 
      course.team_name_ko?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.team_name_en?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.customer_name_ko?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.customer_name_en?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.name_ko.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.name_en.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesCategory = categoryFilter === 'all' || course.category === categoryFilter
    const matchesDifficulty = difficultyFilter === 'all' || course.difficulty_level === difficultyFilter

    return matchesSearch && matchesCategory && matchesDifficulty
  }) || []

  const hierarchicalCourses = buildHierarchy(filteredCourses)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">{t('loading')}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">오류가 발생했습니다: {error.message}</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">투어 코스 관리</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowHelpModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
          >
            <HelpCircle className="w-4 h-4" />
            도움말
          </button>
          <button
            onClick={() => setShowCategoryModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Settings className="w-4 h-4" />
            카테고리 관리
          </button>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="투어 코스 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">모든 카테고리</option>
            {categories?.map((category) => (
              <option key={category.id} value={category.name_ko}>
                {category.name_ko}
              </option>
            ))}
          </select>
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">모든 난이도</option>
            <option value="easy">쉬움</option>
            <option value="medium">보통</option>
            <option value="hard">어려움</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 좌측 트리 패널 */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">투어 코스 목록</h2>
            </div>
            <div className="p-4">
              {hierarchicalCourses.length > 0 ? (
                <div className="space-y-2">
                  {hierarchicalCourses.map((course) => (
                    <div key={course.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <div>
                            <div className="font-medium text-gray-900">
                              {course.team_name_ko || course.name_ko}
                            </div>
                            {course.team_name_en && course.team_name_en !== course.team_name_ko && (
                              <div className="text-sm text-gray-500">
                                {course.team_name_en}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEdit(course)}
                            className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"
                            title="편집"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteCourse(course)}
                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>투어 코스가 없습니다</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 우측 상세 패널 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">상세 정보</h2>
            </div>
            <div className="p-4">
              {selectedCourse ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {selectedCourse.team_name_ko || selectedCourse.name_ko}
                    </h3>
                    {selectedCourse.team_name_en && (
                      <p className="text-sm text-gray-500">
                        {selectedCourse.team_name_en}
                      </p>
                    )}
                  </div>
                  {selectedCourse.location && (
                    <div className="text-sm text-gray-600">
                      <MapPin className="w-4 h-4 inline mr-1" />
                      {selectedCourse.location}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(selectedCourse)}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      편집
                    </button>
                    <button
                      onClick={() => deleteCourse(selectedCourse)}
                      className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <ImageIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>투어 코스를 선택하세요</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 편집 모달 */}
      <TourCourseEditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        course={editingCourse}
        onSave={(updatedCourse) => {
          console.log('투어 코스 저장:', updatedCourse)
          setShowEditModal(false)
          refetchCourses()
        }}
      />

      {/* 카테고리 관리 모달 */}
      <CategoryManagementModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onCategorySelect={handleCategorySelect}
        selectedCategoryId=""
      />

      {/* 지도 선택 모달 */}
      {showMapModal && (
        <LocationPickerModal
          currentLat={undefined}
          currentLng={undefined}
          onLocationSelect={handleMapLocationSelect}
          onClose={() => setShowMapModal(false)}
        />
      )}

      {/* 업데이트 가이드 모달 */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <BookOpen className="w-6 h-6" />
                  투어 코스 관리 업데이트 가이드
                </h2>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">새로운 기능</h3>
                  <ul className="space-y-2 text-blue-800">
                    <li>• 통합된 편집 모달: 기본 정보와 사진 관리를 하나의 모달에서 처리</li>
                    <li>• 사진 업로드: 드래그 앤 드롭으로 쉽게 사진 업로드</li>
                    <li>• 대표 사진 설정: 여러 사진 중 대표 사진 선택 가능</li>
                    <li>• 계층적 구조: 부모-자식 관계로 투어 코스 구성</li>
                  </ul>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-green-900 mb-2">사용 방법</h3>
                  <ol className="space-y-2 text-green-800">
                    <li>1. 좌측 목록에서 편집하고 싶은 투어 코스의 편집 버튼 클릭</li>
                    <li>2. 기본 정보 탭에서 투어 코스의 기본 정보 수정</li>
                    <li>3. 사진 관리 탭으로 전환하여 사진 업로드 및 관리</li>
                    <li>4. 드래그 앤 드롭으로 사진 업로드 또는 파일 선택 버튼 클릭</li>
                    <li>5. 대표 사진 설정 및 불필요한 사진 삭제</li>
                    <li>6. 저장 버튼으로 모든 변경사항 저장</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
