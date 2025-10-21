'use client'

import React, { useState, useEffect } from 'react'
import { 
  Search, 
  MapPin,
  Clock,
  DollarSign,
  TreePine,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Navigation,
  Camera,
  Star,
  Info,
  X
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useOptimizedData } from '@/hooks/useOptimizedData'

// 타입 정의
interface Product {
  id: string
  name_ko: string
  name_en: string
  description: string | null
  category: string | null
  status: string | null
}

interface TourCourse {
  id: string
  product_id: string | null
  parent_id: string | null
  level: number
  path: string
  sort_order: number
  // 고객용 필드
  customer_name_ko: string | null
  customer_name_en: string | null
  customer_description_ko: string | null
  customer_description_en: string | null
  // 팀원용 필드
  team_name_ko: string | null
  team_name_en: string | null
  team_description_ko: string | null
  team_description_en: string | null
  internal_note: string | null
  // 기존 필드들
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
  distance: number | null
  difficulty_level: 'easy' | 'medium' | 'hard'
  max_participants: number
  min_participants: number
  price_adult: number | null
  price_child: number | null
  price_infant: number | null
  is_active: boolean
  created_at: string
  updated_at: string
  children?: TourCourse[]
  parent?: TourCourse
}

// 계층적 구조를 위한 함수들
const buildHierarchy = (courses: TourCourse[]): TourCourse[] => {
  const courseMap = new Map<string, TourCourse>()
  const rootCourses: TourCourse[] = []

  // 모든 코스를 맵에 저장
  courses.forEach(course => {
    courseMap.set(course.id, { ...course, children: [] })
  })

  // 계층 구조 구성
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

const searchFilteredCourses = (courses: TourCourse[], searchTerm: string, selectedProduct: string | null): TourCourse[] => {
  if (!searchTerm && !selectedProduct) return courses

  return courses.filter(course => {
    const matchesSearch = !searchTerm || 
      course.team_name_ko?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.team_name_en?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.customer_name_ko?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.customer_name_en?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.location?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesProduct = !selectedProduct || course.product_id === selectedProduct

    return matchesSearch && matchesProduct
  })
}

// 계층적 렌더링을 위한 컴포넌트
const TourCourseCard = ({ 
  course, 
  level = 0, 
  onViewDetails 
}: { 
  course: TourCourse
  level?: number
  onViewDetails: (course: TourCourse) => void
}) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const indentClass = level > 0 ? `ml-${level * 4}` : ''
  
  return (
    <div className={`bg-white rounded-lg shadow-sm border overflow-hidden ${indentClass}`}>
      {/* 내용 */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {course.children && course.children.length > 0 && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )}
                </button>
              )}
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {course.team_name_ko || course.name_ko}
                </h3>
                <p className="text-sm text-gray-600">
                  {course.team_name_en || course.name_en}
                </p>
                {course.customer_name_ko && (
                  <div className="mt-1">
                    <p className="text-xs text-gray-500">고객용: {course.customer_name_ko}</p>
                    {course.customer_name_en && (
                      <p className="text-xs text-gray-500">{course.customer_name_en}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 text-xs rounded-full ${
              course.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {course.is_active ? '활성' : '비활성'}
            </span>
            <button
              onClick={() => onViewDetails(course)}
              className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
              title="상세 보기"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 설명 */}
        {(course.team_description_ko || course.description_ko) && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {course.team_description_ko || course.description_ko}
          </p>
        )}

        {/* 위치 정보 */}
        {course.location && (
          <div className="flex items-center gap-1 text-sm text-gray-500 mb-2">
            <MapPin className="w-4 h-4" />
            <span className="truncate">{course.location}</span>
          </div>
        )}

        {/* 상세 정보 */}
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{course.duration_hours}시간</span>
          </div>
          <div className="flex items-center gap-1">
            <TreePine className="w-4 h-4" />
            <span>{course.min_participants}-{course.max_participants}명</span>
          </div>
        </div>

        {/* 난이도 */}
        <div className="mt-2">
          <span className={`text-xs px-2 py-1 rounded-full ${
            course.difficulty_level === 'easy' ? 'bg-green-100 text-green-800' :
            course.difficulty_level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {course.difficulty_level === 'easy' ? '쉬움' : 
             course.difficulty_level === 'medium' ? '보통' : '어려움'}
          </span>
        </div>

        {/* 하위 코스들 */}
        {course.children && course.children.length > 0 && isExpanded && (
          <div className="mt-4 space-y-2">
            {course.children.map((child) => (
              <TourCourseCard 
                key={child.id} 
                course={child} 
                level={level + 1}
                onViewDetails={onViewDetails}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function GuideTourCoursesPage() {
  // 최적화된 투어 코스 데이터 로딩
  const { data: tourCourses = [], loading: coursesLoading, refetch: refetchCourses } = useOptimizedData({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('tour_courses')
        .select(`
          *,
          photos:tour_course_photos(*),
          points:tour_course_points(*),
          category:tour_course_categories(*)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching tour courses:', error)
        return []
      }

      return data || []
    },
    cacheKey: 'guide-tour-courses',
    cacheTime: 5 * 60 * 1000 // 5분 캐시
  })

  // 최적화된 상품 데이터 로딩
  const { data: products = [], loading: productsLoading } = useOptimizedData({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name_ko, name_en, description, category, status')
        .eq('status', 'active')
        .order('name_ko', { ascending: true })

      if (error) {
        console.error('Error fetching products:', error)
        return []
      }

      return data || []
    },
    cacheKey: 'products',
    cacheTime: 10 * 60 * 1000 // 10분 캐시
  })

  // 상태 관리
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [selectedCourse, setSelectedCourse] = useState<TourCourse | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showInternalNotes, setShowInternalNotes] = useState(false)

  // 계층적 구조로 변환
  const hierarchicalCourses = buildHierarchy(tourCourses)
  
  // 필터링된 투어 코스 목록
  const filteredCourses = searchFilteredCourses(hierarchicalCourses, searchTerm, selectedProduct)

  // 상세 보기
  const handleViewDetails = (course: TourCourse) => {
    setSelectedCourse(course)
    setShowDetailsModal(true)
  }

  if (coursesLoading || productsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">투어 코스 정보</h1>
        <p className="text-gray-600">투어 코스 정보를 확인하세요</p>
      </div>

      {/* 필터 및 검색 */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상품</label>
            <select
              value={selectedProduct || ''}
              onChange={(e) => setSelectedProduct(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">전체 상품</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name_ko}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">검색</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="투어 코스명, 위치로 검색..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 투어 코스 목록 - 계층적 구조 */}
      <div className="space-y-4">
        {filteredCourses.length === 0 ? (
          <div className="text-center py-12">
            <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">투어 코스가 없습니다</h3>
            <p className="text-gray-500">선택한 조건에 맞는 투어 코스가 없습니다.</p>
          </div>
        ) : (
          filteredCourses.map((course) => (
            <TourCourseCard 
              key={course.id} 
              course={course}
              onViewDetails={handleViewDetails}
            />
          ))
        )}
      </div>

      {/* 상세 정보 모달 */}
      {showDetailsModal && selectedCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedCourse.team_name_ko || selectedCourse.name_ko}
                </h2>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* 기본 정보 */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">기본 정보</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="font-medium">팀원용 한국어명:</span> {selectedCourse.team_name_ko || selectedCourse.name_ko}
                    </div>
                    <div>
                      <span className="font-medium">팀원용 영어명:</span> {selectedCourse.team_name_en || selectedCourse.name_en}
                    </div>
                    {selectedCourse.customer_name_ko && (
                      <div>
                        <span className="font-medium">고객용 한국어명:</span> {selectedCourse.customer_name_ko}
                      </div>
                    )}
                    {selectedCourse.customer_name_en && (
                      <div>
                        <span className="font-medium">고객용 영어명:</span> {selectedCourse.customer_name_en}
                      </div>
                    )}
                    {selectedCourse.team_description_ko && (
                      <div>
                        <span className="font-medium">팀원용 설명:</span> {selectedCourse.team_description_ko}
                      </div>
                    )}
                    {selectedCourse.customer_description_ko && (
                      <div>
                        <span className="font-medium">고객용 설명:</span> {selectedCourse.customer_description_ko}
                      </div>
                    )}
                  </div>
                </div>

                {/* 위치 정보 */}
                {selectedCourse.location && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">위치 정보</h3>
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-4 h-4" />
                      <span>{selectedCourse.location}</span>
                    </div>
                  </div>
                )}

                {/* 상세 정보 */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">상세 정보</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span>소요시간: {selectedCourse.duration_hours}시간</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TreePine className="w-4 h-4 text-gray-500" />
                      <span>인원: {selectedCourse.min_participants}-{selectedCourse.max_participants}명</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">난이도:</span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        selectedCourse.difficulty_level === 'easy' ? 'bg-green-100 text-green-800' :
                        selectedCourse.difficulty_level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {selectedCourse.difficulty_level === 'easy' ? '쉬움' : 
                         selectedCourse.difficulty_level === 'medium' ? '보통' : '어려움'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">상태:</span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        selectedCourse.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedCourse.is_active ? '활성' : '비활성'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 가격 정보 */}
                {(selectedCourse.price_adult || selectedCourse.price_child || selectedCourse.price_infant) && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">가격 정보</h3>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      {selectedCourse.price_adult && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-gray-500" />
                          <span>성인: ${selectedCourse.price_adult}</span>
                        </div>
                      )}
                      {selectedCourse.price_child && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-gray-500" />
                          <span>아동: ${selectedCourse.price_child}</span>
                        </div>
                      )}
                      {selectedCourse.price_infant && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-gray-500" />
                          <span>유아: ${selectedCourse.price_infant}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 내부 노트 */}
                {selectedCourse.internal_note && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">내부 노트</h3>
                      <button
                        onClick={() => setShowInternalNotes(!showInternalNotes)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        {showInternalNotes ? (
                          <EyeOff className="w-4 h-4 text-gray-500" />
                        ) : (
                          <Eye className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                    </div>
                    {showInternalNotes && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-sm text-gray-700">{selectedCourse.internal_note}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
