'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  Search, 
  Edit, 
  Trash2, 
  MapPin,
  Image as ImageIcon,
  Settings,
  X,
  HelpCircle,
  BookOpen,
  Plus,
  Copy,
  Star
} from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { useOptimizedData } from '@/hooks/useOptimizedData'
import CategoryManagementModal from '@/components/CategoryManagementModal'
import LocationPickerModal from '@/components/LocationPickerModal'
import TourCourseEditModal from '@/components/TourCourseEditModal'

// 타입 정의
interface TourCoursePhoto {
  id: string
  course_id: string
  photo_url: string
  photo_alt_ko?: string
  photo_alt_en?: string
  display_order?: number
  is_primary: boolean
  sort_order?: number
  thumbnail_url?: string
  uploaded_by?: string
  created_at: string
}

interface TourCourse {
  id: string
  name_ko: string
  name_en: string
  team_name_ko?: string | null
  team_name_en?: string | null
  customer_name_ko?: string | null
  customer_name_en?: string | null
  team_description_ko?: string | null
  team_description_en?: string | null
  customer_description_ko?: string | null
  customer_description_en?: string | null
  internal_note?: string | null
  location?: string | null
  category?: string | null
  category_id?: string | null
  point_name?: string | null
  start_latitude?: number | null
  start_longitude?: number | null
  end_latitude?: number | null
  end_longitude?: number | null
  duration_hours?: number | null
  distance?: number | null
  difficulty_level?: 'easy' | 'medium' | 'hard' | null
  price_adult?: number | null
  price_child?: number | null
  price_infant?: number | null
  price_type?: 'per_person' | 'per_vehicle' | 'none' | null
  is_active: boolean
  is_favorite?: boolean | null
  favorite_order?: number | null
  parent_id?: string | null
  children?: TourCourse[]
  parent?: TourCourse
  photos?: TourCoursePhoto[]
  // 추가 필드들 (데이터베이스에서 가져오는 필드들)
  product_id?: string | null
  level?: number | null
  description_ko?: string | null
  description_en?: string | null
  created_at?: string | null
  updated_at?: string | null
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

function getCourseDisplayName(course: TourCourse, locale: string): string {
  const en = course.team_name_en || course.name_en || ''
  const ko = course.team_name_ko || course.name_ko || ''
  return locale === 'en' ? (en || ko) : (ko || en)
}

function getCourseSecondaryName(course: TourCourse, locale: string): string | null {
  const en = course.team_name_en || course.name_en || ''
  const ko = course.team_name_ko || course.name_ko || ''
  if (locale === 'en') return ko && ko !== en ? ko : null
  return en && en !== ko ? en : null
}

function getCategoryDisplayName(
  categoryValue: string | null | undefined,
  categories: TourCourseCategory[] | undefined,
  locale: string
): string {
  if (!categoryValue) return ''
  const cat = Array.isArray(categories)
    ? categories.find((c) => c.name_ko === categoryValue || c.name_en === categoryValue)
    : null
  if (!cat) return categoryValue
  return locale === 'en' ? (cat.name_en || cat.name_ko) : (cat.name_ko || cat.name_en)
}

export default function TourCoursesPage() {
  const t = useTranslations('tourCourses')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [difficultyFilter, setDifficultyFilter] = useState('all')
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingCourse, setEditingCourse] = useState<TourCourse | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showMapModal, setShowMapModal] = useState(false)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<TourCourse | null>(null)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [coursePhotos, setCoursePhotos] = useState<TourCoursePhoto[]>([])
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // 데이터 로드
  const { 
    data: tourCourses, 
    loading, 
    error, 
    refetch: refetchCourses,
    invalidateCache: invalidateCoursesCache
  } = useOptimizedData<TourCourse[]>({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('tour_courses')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data || []
    },
    cacheKey: 'tour_courses'
  })

  const { 
    data: categories 
  } = useOptimizedData<TourCourseCategory[]>({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('tour_course_categories')
        .select('*')
        .order('sort_order', { ascending: true })
      
      if (error) throw error
      return data || []
    },
    cacheKey: 'tour_course_categories'
  })

  // 선택된 코스의 사진 가져오기
  useEffect(() => {
    const fetchCoursePhotos = async () => {
      if (!selectedCourse) {
        setCoursePhotos([])
        return
      }

      try {
        const { data, error } = await supabase
          .from('tour_course_photos')
          .select('*')
          .eq('course_id', selectedCourse.id)
          .order('sort_order', { ascending: true })

        if (error) {
          console.error('사진 가져오기 오류:', error)
          setCoursePhotos([])
        } else {
          setCoursePhotos(data || [])
        }
      } catch (error) {
        console.error('사진 가져오기 오류:', error)
        setCoursePhotos([])
      }
    }

    fetchCoursePhotos()
  }, [selectedCourse])

  // 편집 시작
  const startEdit = (course: TourCourse) => {
    setEditingCourse(course)
    setShowEditModal(true)
  }

  // 새 투어 코스 생성
  const createNewCourse = () => {
    const newCourse: TourCourse = {
      id: '', // 새 코스는 빈 ID로 시작
      name_ko: '',
      name_en: '',
      is_active: true,
      duration_hours: 0,
      difficulty_level: 'easy',
      product_id: null,
      level: 0,
      description_ko: null,
      description_en: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    setEditingCourse(newCourse)
    setShowEditModal(true)
  }

  // 트리 노드 토글
  const toggleNode = (nodeId: string) => {
    // 스크롤 위치 저장
    const scrollContainer = scrollContainerRef.current
    const scrollTop = scrollContainer?.scrollTop || 0
    
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
    
    // 다음 렌더링 후 스크롤 위치 복원
    setTimeout(() => {
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollTop
      }
    }, 0)
  }

  // 투어 코스 복사
  const copyCourse = (course: TourCourse) => {
    const copiedCourse: TourCourse = {
      ...course,
      id: '', // 새 코스는 빈 ID로 시작
      name_ko: `${course.team_name_ko || course.name_ko} ${t('copySuffix')}`,
      name_en: `${course.team_name_en || course.name_en} ${t('copySuffix')}`,
      team_name_ko: `${course.team_name_ko || course.name_ko} ${t('copySuffix')}`,
      team_name_en: `${course.team_name_en || course.name_en} ${t('copySuffix')}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    setEditingCourse(copiedCourse)
    setShowEditModal(true)
  }

  // 투어 코스 삭제
  const deleteCourse = async (course: TourCourse) => {
    if (!confirm(t('deleteConfirm', { name: getCourseDisplayName(course, locale) }))) return

    try {
      const { error } = await supabase
        .from('tour_courses')
        .delete()
        .eq('id', course.id)

      if (error) throw error

      invalidateCoursesCache()
      refetchCourses()
      if (selectedCourse?.id === course.id) {
        setSelectedCourse(null)
      }
    } catch (error) {
      console.error('Tour course delete error:', error)
      alert(t('deleteError'))
    }
  }

  // 즐겨찾기 토글
  const toggleFavorite = async (course: TourCourse, e: React.MouseEvent) => {
    e.stopPropagation()
    
    const newFavoriteStatus = !(course.is_favorite || false)
    
    try {
      let favoriteOrder: number | null = null
      
      if (newFavoriteStatus) {
        // 즐겨찾기 추가 시 순서 설정
        const { data: favorites } = await supabase
          .from('tour_courses')
          .select('favorite_order')
          .eq('is_favorite', true)
          .not('favorite_order', 'is', null)
          .order('favorite_order', { ascending: false })
          .limit(1)
        
        favoriteOrder = favorites && favorites.length > 0 
          ? ((favorites[0] as any)?.favorite_order || 0) + 1 
          : 0
      }
      
      const { error } = await supabase
        .from('tour_courses')
        .update({
          is_favorite: newFavoriteStatus,
          favorite_order: favoriteOrder
        } as any)
        .eq('id', course.id)

      if (error) throw error

      invalidateCoursesCache()
      refetchCourses()
      
      // 선택된 코스도 업데이트
      if (selectedCourse?.id === course.id) {
        setSelectedCourse({
          ...selectedCourse,
          is_favorite: newFavoriteStatus,
          favorite_order: favoriteOrder
        } as TourCourse)
      }
    } catch (error) {
      console.error('Favorite toggle error:', error)
      alert(t('favoriteError'))
    }
  }

  // 카테고리 선택 콜백
  const handleCategorySelect = () => {
    // 카테고리 선택 로직 (필요시 구현)
  }

  // 지도 위치 선택 콜백
  const handleMapLocationSelect = () => {
    // 지도 위치 선택 로직 (필요시 구현)
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
  const filteredCourses = Array.isArray(tourCourses) ? tourCourses.filter((course: TourCourse) => {
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
  }) : []

  const hierarchicalCourses = buildHierarchy(filteredCourses)

  // 카테고리별 색상 매핑 함수
  const getCategoryBadgeColor = (category: string | undefined): string => {
    if (!category) return 'bg-gray-100 text-gray-600'
    
    const categoryLower = category.toLowerCase()
    
    // 카테고리별 색상 매핑
    if (categoryLower.includes('시티') || categoryLower.includes('city')) {
      return 'bg-blue-100 text-blue-800'
    } else if (categoryLower.includes('어드벤처') || categoryLower.includes('adventure') || categoryLower.includes('액티비티') || categoryLower.includes('activity')) {
      return 'bg-orange-100 text-orange-800'
    } else if (categoryLower.includes('포인트') || categoryLower.includes('point')) {
      return 'bg-purple-100 text-purple-800'
    } else if (categoryLower.includes('숙박') || categoryLower.includes('hotel') || categoryLower.includes('accommodation')) {
      return 'bg-indigo-100 text-indigo-800'
    } else if (categoryLower.includes('식당') || categoryLower.includes('restaurant') || categoryLower.includes('음식')) {
      return 'bg-red-100 text-red-800'
    } else if (categoryLower.includes('쇼핑') || categoryLower.includes('shopping')) {
      return 'bg-pink-100 text-pink-800'
    } else if (categoryLower.includes('휴게') || categoryLower.includes('rest')) {
      return 'bg-yellow-100 text-yellow-800'
    } else {
      // 기본 색상 (카테고리가 매핑되지 않은 경우)
      return 'bg-green-100 text-green-800'
    }
  }

  // 트리 아이템 렌더링 컴포넌트
  const TreeItem = ({ course, level = 0 }: { course: TourCourse, level?: number }) => {
    const hasChildren = course.children && course.children.length > 0
    const isExpanded = expandedNodes.has(course.id)
    const indent = level * 20

    return (
      <div className="select-none">
        <div 
          className={`flex items-center justify-between p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 ${
            selectedCourse?.id === course.id ? 'bg-blue-50 border-blue-200' : ''
          }`}
          style={{ paddingLeft: `${indent + 8}px` }}
          onClick={() => setSelectedCourse(course)}
        >
          <div className="flex items-center gap-2 flex-1">
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleNode(course.id)
                }}
                className="p-1 hover:bg-gray-200 rounded"
              >
                {isExpanded ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            ) : (
              <div className="w-6" />
            )}
            
            <MapPin className="w-4 h-4 text-gray-400" />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-medium text-gray-900">
                  {getCourseDisplayName(course, locale)}
                </div>
                {/* 카테고리 뱃지 */}
                {course.category && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getCategoryBadgeColor(course.category)}`}>
                    {getCategoryDisplayName(course.category, categories ?? undefined, locale)}
                  </span>
                )}
                {/* 가격 설정 방식 뱃지 */}
                {course.price_type && course.price_type !== 'none' && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    course.price_type === 'per_person' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {course.price_type === 'per_person' ? t('pricePerPerson') : t('pricePerVehicle')}
                  </span>
                )}
                {(!course.price_type || course.price_type === 'none') && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                    {t('noPrice')}
                  </span>
                )}
                {/* 소요 시간 뱃지 */}
                {course.duration_hours !== null && course.duration_hours !== undefined && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    {t('minutes', { count: course.duration_hours })}
                  </span>
                )}
              </div>
              {getCourseSecondaryName(course, locale) && (
                <div className="text-sm text-gray-500">
                  {getCourseSecondaryName(course, locale)}
                </div>
              )}
              {course.location && (
                <div className="text-xs text-gray-400">
                  📍 {course.location}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => toggleFavorite(course, e)}
              className={`p-1 rounded ${
                course.is_favorite
                  ? 'text-yellow-500 hover:bg-yellow-50'
                  : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'
              }`}
              title={course.is_favorite ? t('favoriteRemove') : t('favoriteAdd')}
            >
              <Star className={`w-4 h-4 ${course.is_favorite ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                startEdit(course)
              }}
              className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"
              title={t('edit')}
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                copyCourse(course)
              }}
              className="p-1 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded"
              title={t('copy')}
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                deleteCourse(course)
              }}
              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
              title={t('delete')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div>
            {course.children!.map((child) => (
              <TreeItem key={child.id} course={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">{tCommon('loading')}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">{t('errorOccurred')}: {error.message}</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <div className="flex gap-2">
          <button
            onClick={createNewCourse}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            {t('addCourse')}
          </button>
          <button
            onClick={() => setShowHelpModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
          >
            <HelpCircle className="w-4 h-4" />
            {t('help')}
          </button>
          <button
            onClick={() => setShowCategoryModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Settings className="w-4 h-4" />
            {t('categoryManagement')}
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
                placeholder={t('searchPlaceholder')}
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
            <option value="all">{t('allCategories')}</option>
            {Array.isArray(categories) && categories.map((category: TourCourseCategory) => (
              <option key={category.id} value={category.name_ko}>
                {locale === 'en' ? (category.name_en || category.name_ko) : (category.name_ko || category.name_en)}
              </option>
            ))}
          </select>
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">{t('allDifficulties')}</option>
            <option value="easy">{t('difficulty.easy')}</option>
            <option value="medium">{t('difficulty.medium')}</option>
            <option value="hard">{t('difficulty.hard')}</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 좌측 트리 패널 */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{t('courseList')}</h2>
            </div>
            <div ref={scrollContainerRef} className="p-4 max-h-[800px] overflow-y-auto">
              {hierarchicalCourses.length > 0 ? (
                <div className="space-y-0">
                  {hierarchicalCourses.map((course) => (
                    <TreeItem key={course.id} course={course} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>{t('noCourses')}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 우측 상세 패널 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{t('detailInfo')}</h2>
            </div>
            <div className="p-4 max-h-[800px] overflow-y-auto">
              {selectedCourse ? (
                <div className="space-y-4">
                  {/* 기본 정보 */}
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">
                      {getCourseDisplayName(selectedCourse, locale)}
                    </h3>
                    {getCourseSecondaryName(selectedCourse, locale) && (
                      <p className="text-sm text-gray-500 mb-2">
                        {getCourseSecondaryName(selectedCourse, locale)}
                      </p>
                    )}
                    {selectedCourse.customer_name_ko && (
                      <p className="text-sm text-blue-600 mb-1">
                        {t('customerLabelKo')}: {selectedCourse.customer_name_ko}
                      </p>
                    )}
                    {selectedCourse.customer_name_en && (
                      <p className="text-sm text-blue-600">
                        {t('customerLabelEn')}: {selectedCourse.customer_name_en}
                      </p>
                    )}
                  </div>

                  {/* 위치 정보 */}
                  {selectedCourse.location && (
                    <div className="text-sm text-gray-600">
                      <MapPin className="w-4 h-4 inline mr-1" />
                      {selectedCourse.location}
                    </div>
                  )}
                  {selectedCourse.point_name && (
                    <div className="text-sm text-gray-600">
                      📍 {t('point')}: {selectedCourse.point_name}
                    </div>
                  )}

                  {/* 좌표 정보 */}
                  {(selectedCourse.start_latitude || selectedCourse.start_longitude) && (
                    <div className="text-sm text-gray-600">
                      <div>{t('startCoords')}: {selectedCourse.start_latitude}, {selectedCourse.start_longitude}</div>
                    </div>
                  )}
                  {(selectedCourse.end_latitude || selectedCourse.end_longitude) && (
                    <div className="text-sm text-gray-600">
                      <div>{t('endCoords')}: {selectedCourse.end_latitude}, {selectedCourse.end_longitude}</div>
                    </div>
                  )}

                  {/* 설명 정보 */}
                  {selectedCourse.team_description_ko && (
                    <div className="text-sm">
                      <div className="font-medium text-gray-700 mb-1">{t('teamDescKo')}</div>
                      <div className="text-gray-600 bg-gray-50 p-2 rounded text-xs">
                        {selectedCourse.team_description_ko}
                      </div>
                    </div>
                  )}
                  {selectedCourse.team_description_en && (
                    <div className="text-sm">
                      <div className="font-medium text-gray-700 mb-1">{t('teamDescEn')}</div>
                      <div className="text-gray-600 bg-gray-50 p-2 rounded text-xs">
                        {selectedCourse.team_description_en}
                      </div>
                    </div>
                  )}
                  {selectedCourse.customer_description_ko && (
                    <div className="text-sm">
                      <div className="font-medium text-gray-700 mb-1">{t('customerDescKo')}</div>
                      <div className="text-gray-600 bg-blue-50 p-2 rounded text-xs">
                        {selectedCourse.customer_description_ko}
                      </div>
                    </div>
                  )}
                  {selectedCourse.customer_description_en && (
                    <div className="text-sm">
                      <div className="font-medium text-gray-700 mb-1">{t('customerDescEn')}</div>
                      <div className="text-gray-600 bg-blue-50 p-2 rounded text-xs">
                        {selectedCourse.customer_description_en}
                      </div>
                    </div>
                  )}

                  {/* 사진 섹션 */}
                  <div className="text-sm">
                    <div className="font-medium text-gray-700 mb-2 flex items-center">
                      <ImageIcon className="w-4 h-4 mr-1" />
                      {t('photos')} ({t('photosCount', { count: coursePhotos.length })})
                    </div>
                    {coursePhotos.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {coursePhotos.map((photo) => (
                          <div key={photo.id} className="relative group">
                            <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                              <img
                                src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-course-photos/${photo.photo_url}`}
                                alt={photo.photo_alt_ko || photo.photo_alt_en || 'Tour course photo'}
                                className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                              />
                            </div>
                            
                            {/* 대표 사진 표시 */}
                            {photo.is_primary && (
                              <div className="absolute top-1 left-1 bg-yellow-500 text-white px-1 py-0.5 rounded text-xs font-medium">
                                대표
                              </div>
                            )}
                            
                            {/* 파일명 표시 */}
                            <div className="mt-1 text-xs text-gray-500 truncate">
                              {photo.photo_alt_ko || photo.photo_alt_en || 'Photo'}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-500 text-xs bg-gray-50 p-3 rounded text-center">
                        {t('noPhotos')}
                        <br />
                        {t('noPhotosHint')}
                      </div>
                    )}
                  </div>

                  {/* 상세 정보 */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">{t('duration')}:</span>
                      <span className="text-gray-600 ml-1">{t('minutes', { count: selectedCourse.duration_hours ?? 0 })}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">{t('difficultyLabel')}:</span>
                      <span className="text-gray-600 ml-1">
                        {selectedCourse.difficulty_level === 'easy' ? t('difficulty.easy') : 
                         selectedCourse.difficulty_level === 'medium' ? t('difficulty.medium') : t('difficulty.hard')}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">{t('categoryLabel')}:</span>
                      <span className="text-gray-600 ml-1">{getCategoryDisplayName(selectedCourse.category, categories ?? undefined, locale) || t('uncategorized')}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">{t('statusLabel')}:</span>
                      <span className={`ml-1 ${selectedCourse.is_active ? 'text-green-600' : 'text-red-600'}`}>
                        {selectedCourse.is_active ? t('active') : t('inactive')}
                      </span>
                    </div>
                  </div>

                  {/* 가격 정보 */}
                  {(selectedCourse.price_adult || selectedCourse.price_child || selectedCourse.price_infant) && (
                    <div className="text-sm">
                      <div className="font-medium text-gray-700 mb-1">{t('priceInfo')}</div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {selectedCourse.price_adult && (
                          <div className="bg-gray-50 p-2 rounded">
                            <div className="font-medium">{t('adult')}</div>
                            <div className="text-gray-600">${selectedCourse.price_adult}</div>
                          </div>
                        )}
                        {selectedCourse.price_child && (
                          <div className="bg-gray-50 p-2 rounded">
                            <div className="font-medium">{t('child')}</div>
                            <div className="text-gray-600">${selectedCourse.price_child}</div>
                          </div>
                        )}
                        {selectedCourse.price_infant && (
                          <div className="bg-gray-50 p-2 rounded">
                            <div className="font-medium">{t('infant')}</div>
                            <div className="text-gray-600">${selectedCourse.price_infant}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 내부 노트 */}
                  {selectedCourse.internal_note && (
                    <div className="text-sm">
                      <div className="font-medium text-gray-700 mb-1">{t('internalNote')}</div>
                      <div className="text-gray-600 bg-yellow-50 p-2 rounded text-xs border-l-4 border-yellow-400">
                        {selectedCourse.internal_note}
                      </div>
                    </div>
                  )}

                  {/* 액션 버튼 */}
                  <div className="flex gap-2 pt-2 border-t border-gray-200">
                    <button
                      onClick={() => startEdit(selectedCourse)}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      {t('edit')}
                    </button>
                    <button
                      onClick={() => copyCourse(selectedCourse)}
                      className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                    >
                      {t('copy')}
                    </button>
                    <button
                      onClick={() => deleteCourse(selectedCourse)}
                      className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                    >
                      {t('delete')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <ImageIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>{t('selectCourse')}</p>
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
          invalidateCoursesCache()
          refetchCourses()
          // 선택된 코스도 업데이트
          if (selectedCourse?.id === updatedCourse.id) {
            setSelectedCourse(updatedCourse)
          }
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
          currentLat={0}
          currentLng={0}
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
                  {t('helpTitle')}
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
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">{t('newFeatures')}</h3>
                  <ul className="space-y-2 text-blue-800">
                    <li>• {t('helpFeature1')}</li>
                    <li>• {t('helpFeature2')}</li>
                    <li>• {t('helpFeature3')}</li>
                    <li>• {t('helpFeature4')}</li>
                  </ul>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-green-900 mb-2">{t('usage')}</h3>
                  <ol className="space-y-2 text-green-800">
                    <li>1. {t('helpStep1')}</li>
                    <li>2. {t('helpStep2')}</li>
                    <li>3. {t('helpStep3')}</li>
                    <li>4. {t('helpStep4')}</li>
                    <li>5. {t('helpStep5')}</li>
                    <li>6. {t('helpStep6')}</li>
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