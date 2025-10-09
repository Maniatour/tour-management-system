'use client'

import React, { useState, useEffect } from 'react'
import { 
  X, 
  Globe, 
  MapPin, 
  Clock, 
  Settings,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface TourCourse {
  id: string
  name_ko: string
  name_en: string
  team_name_ko?: string
  team_name_en?: string
  customer_name_ko?: string
  customer_name_en?: string
  team_description_ko?: string
  team_description_en?: string
  customer_description_ko?: string
  customer_description_en?: string
  internal_note?: string
  location?: string
  category?: string
  category_id?: string
  point_name?: string
  start_latitude?: number
  start_longitude?: number
  end_latitude?: number
  end_longitude?: number
  duration_hours?: number
  difficulty_level?: 'easy' | 'medium' | 'hard'
  price_adult?: number
  price_child?: number
  price_infant?: number
  is_active: boolean
  parent_id?: string
  children?: TourCourse[]
  level?: number
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

interface TourCourseEditModalProps {
  isOpen: boolean
  onClose: () => void
  course: TourCourse | null
  onSave: (course: TourCourse) => void
}

const DIFFICULTY_LEVELS = [
  { value: 'easy', label: '쉬움', color: 'text-green-600' },
  { value: 'medium', label: '보통', color: 'text-yellow-600' },
  { value: 'hard', label: '어려움', color: 'text-red-600' }
]

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

  // 레벨 계산 함수
  const calculateLevels = (course: TourCourse, level: number = 0) => {
    course.level = level
    if (course.children) {
      course.children.forEach(child => calculateLevels(child, level + 1))
    }
  }

  // 모든 루트 코스에 대해 레벨 계산
  rootCourses.forEach(course => calculateLevels(course, 0))

  return rootCourses
}

// 부모 관광지 선택용 트리 아이템 컴포넌트
const ParentSelectionTreeItem = ({ 
  course, 
  level = 0,
  expandedNodes,
  selectedParentId,
  currentCourseId,
  onToggle,
  onSelect
}: { 
  course: TourCourse
  level?: number
  expandedNodes: Set<string>
  selectedParentId?: string | null
  currentCourseId?: string | null
  onToggle: (id: string) => void
  onSelect: (id: string | null) => void
}) => {
  const hasChildren = course.children && course.children.length > 0
  const isExpanded = expandedNodes.has(course.id)
  const isSelected = selectedParentId === course.id
  const isCurrentCourse = currentCourseId === course.id
  const indentClass = level > 0 ? `ml-${level * 4}` : ''
  
  return (
    <div className={`${indentClass}`}>
      <div 
        className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 ${
          isSelected ? 'bg-blue-50 border-l-2 border-blue-500' : ''
        } ${isCurrentCourse ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => {
          if (!isCurrentCourse) {
            onSelect(course.id)
          }
        }}
      >
        {/* 확장/축소 버튼 */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggle(course.id)
            }}
            className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-700"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
        ) : (
          <div className="w-4 h-4"></div>
        )}
        
        {/* 라디오 버튼 */}
        <input
          type="radio"
          name="parent_course"
          value={course.id}
          checked={isSelected}
          onChange={() => {
            if (!isCurrentCourse) {
              onSelect(course.id)
            }
          }}
          disabled={isCurrentCourse}
          className="w-4 h-4 text-blue-600"
        />
        
        {/* 폴더/파일 아이콘 */}
        <div className="flex items-center gap-1">
          {hasChildren ? (
            isExpanded ? (
              <FolderOpen className="w-4 h-4 text-blue-500" />
            ) : (
              <Folder className="w-4 h-4 text-blue-500" />
            )
          ) : (
            <MapPin className="w-4 h-4 text-gray-400" />
          )}
        </div>
        
        {/* 이름 */}
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium truncate ${isCurrentCourse ? 'text-gray-400' : 'text-gray-900'}`}>
            {course.team_name_ko || course.name_ko}
            {isCurrentCourse && ' (현재 관광지)'}
          </div>
          {course.team_name_en && course.team_name_en !== course.team_name_ko && (
            <div className={`text-xs truncate ${isCurrentCourse ? 'text-gray-300' : 'text-gray-500'}`}>
              {course.team_name_en}
            </div>
          )}
        </div>
      </div>
      
      {/* 하위 항목들 */}
      {hasChildren && isExpanded && (
        <div className="ml-4">
          {course.children!.map((child) => (
            <ParentSelectionTreeItem
              key={child.id}
              course={child}
              level={level + 1}
              expandedNodes={expandedNodes}
              selectedParentId={selectedParentId}
              currentCourseId={currentCourseId}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function TourCourseEditModal({ isOpen, onClose, course, onSave }: TourCourseEditModalProps) {
  const [formData, setFormData] = useState({
    parent_id: '',
    customer_name_ko: '',
    customer_name_en: '',
    customer_description_ko: '',
    customer_description_en: '',
    team_name_ko: '',
    team_name_en: '',
    team_description_ko: '',
    team_description_en: '',
    internal_note: '',
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
    duration_hours: 60,
    difficulty_level: 'easy' as 'easy' | 'medium' | 'hard',
    price_adult: 0,
    price_child: 0,
    price_infant: 0,
    is_active: true
  })

  const [tourCourses, setTourCourses] = useState<TourCourse[]>([])
  const [categories, setCategories] = useState<TourCourseCategory[]>([])
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  // 투어 코스 데이터 로드
  useEffect(() => {
    const loadTourCourses = async () => {
      try {
        const { data, error } = await supabase
          .from('tour_courses')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })

        if (error) throw error
        setTourCourses(data || [])
      } catch (error) {
        console.error('투어 코스 로드 오류:', error)
      }
    }

    const loadCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('tour_course_categories')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })

        if (error) throw error
        setCategories(data || [])
      } catch (error) {
        console.error('카테고리 로드 오류:', error)
      }
    }

    if (isOpen) {
      loadTourCourses()
      loadCategories()
    }
  }, [isOpen])

  // 코스 데이터로 폼 초기화
  useEffect(() => {
    if (course) {
      setFormData({
        parent_id: course.parent_id || '',
        customer_name_ko: course.customer_name_ko || '',
        customer_name_en: course.customer_name_en || '',
        customer_description_ko: course.customer_description_ko || '',
        customer_description_en: course.customer_description_en || '',
        team_name_ko: course.team_name_ko || course.name_ko || '',
        team_name_en: course.team_name_en || course.name_en || '',
        team_description_ko: course.team_description_ko || '',
        team_description_en: course.team_description_en || '',
        internal_note: course.internal_note || '',
        name_ko: course.name_ko || '',
        name_en: course.name_en || '',
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
        duration_hours: course.duration_hours || 60,
        difficulty_level: course.difficulty_level || 'easy',
        price_adult: course.price_adult || 0,
        price_child: course.price_child || 0,
        price_infant: course.price_infant || 0,
        is_active: course.is_active
      })
    }
  }, [course])

  // 모든 노드를 기본적으로 확장
  useEffect(() => {
    if (tourCourses.length > 0 && expandedNodes.size === 0) {
      const courses = buildHierarchy(tourCourses)
      const allNodeIds = new Set<string>()
      const collectAllNodeIds = (courseList: TourCourse[]) => {
        courseList.forEach(course => {
          allNodeIds.add(course.id)
          if (course.children && course.children.length > 0) {
            collectAllNodeIds(course.children)
          }
        })
      }
      collectAllNodeIds(courses)
      setExpandedNodes(allNodeIds)
    }
  }, [tourCourses, expandedNodes.size])

  // 트리 노드 토글 함수
  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
  }

  // 투어 코스 수정
  const handleSave = async () => {
    if (!course) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('tour_courses')
        .update({
          parent_id: formData.parent_id || null,
          customer_name_ko: formData.customer_name_ko || null,
          customer_name_en: formData.customer_name_en || null,
          customer_description_ko: formData.customer_description_ko || null,
          customer_description_en: formData.customer_description_en || null,
          team_name_ko: formData.team_name_ko,
          team_name_en: formData.team_name_en,
          team_description_ko: formData.team_description_ko || null,
          team_description_en: formData.team_description_en || null,
          internal_note: formData.internal_note || null,
          // 기존 필드들 (하위 호환성)
          name_ko: formData.team_name_ko,
          name_en: formData.team_name_en,
          description_ko: formData.team_description_ko || null,
          description_en: formData.team_description_en || null,
          category: formData.category || '기타',
          category_id: formData.category_id || null,
          point_name: formData.point_name || null,
          location: formData.location || null,
          start_latitude: formData.start_latitude ? parseFloat(formData.start_latitude) : null,
          start_longitude: formData.start_longitude ? parseFloat(formData.start_longitude) : null,
          end_latitude: formData.end_latitude ? parseFloat(formData.end_latitude) : null,
          end_longitude: formData.end_longitude ? parseFloat(formData.end_longitude) : null,
          duration_hours: formData.duration_hours,
          difficulty_level: formData.difficulty_level,
          price_adult: formData.price_adult || null,
          price_child: formData.price_child || null,
          price_infant: formData.price_infant || null,
          is_active: formData.is_active
        })
        .eq('id', course.id)

      if (error) throw error

      // 업데이트된 코스 정보를 부모에게 전달
      const updatedCourse = {
        ...course,
        parent_id: formData.parent_id || null,
        customer_name_ko: formData.customer_name_ko || null,
        customer_name_en: formData.customer_name_en || null,
        customer_description_ko: formData.customer_description_ko || null,
        customer_description_en: formData.customer_description_en || null,
        team_name_ko: formData.team_name_ko,
        team_name_en: formData.team_name_en,
        team_description_ko: formData.team_description_ko || null,
        team_description_en: formData.team_description_en || null,
        internal_note: formData.internal_note || null,
        name_ko: formData.team_name_ko,
        name_en: formData.team_name_en,
        description_ko: formData.team_description_ko || null,
        description_en: formData.team_description_en || null,
        category: formData.category || '기타',
        category_id: formData.category_id || null,
        point_name: formData.point_name || null,
        location: formData.location || null,
        start_latitude: formData.start_latitude ? parseFloat(formData.start_latitude) : null,
        start_longitude: formData.start_longitude ? parseFloat(formData.start_longitude) : null,
        end_latitude: formData.end_latitude ? parseFloat(formData.end_latitude) : null,
        end_longitude: formData.end_longitude ? parseFloat(formData.end_longitude) : null,
        duration_hours: formData.duration_hours,
        difficulty_level: formData.difficulty_level,
        price_adult: formData.price_adult || null,
        price_child: formData.price_child || null,
        price_infant: formData.price_infant || null,
        is_active: formData.is_active
      }

      onSave(updatedCourse)
      onClose()
    } catch (error) {
      console.error('투어 코스 수정 오류:', error)
      alert('투어 코스 수정 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const hierarchicalCourses = buildHierarchy(tourCourses)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            투어 코스 수정
          </h2>
          <button
            onClick={onClose}
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
                부모 관광지 (계층 구조)
              </label>
              
              {/* 최상위 옵션 */}
              <div className="mb-3">
                <label className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="parent_course"
                    value=""
                    checked={!formData.parent_id}
                    onChange={() => setFormData({ ...formData, parent_id: '' })}
                    className="w-4 h-4 text-blue-600"
                  />
                  <Globe className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium text-gray-900">최상위 관광지 (부모 없음)</span>
                </label>
              </div>
              
              {/* 트리 선택 인터페이스 */}
              <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                {hierarchicalCourses.map((courseItem) => (
                  <ParentSelectionTreeItem
                    key={courseItem.id}
                    course={courseItem}
                    level={0}
                    expandedNodes={expandedNodes}
                    selectedParentId={formData.parent_id}
                    currentCourseId={course?.id}
                    onToggle={toggleNode}
                    onSelect={(id) => setFormData({ ...formData, parent_id: id || '' })}
                  />
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                팀원용 한국어 이름 *
              </label>
              <input
                type="text"
                value={formData.team_name_ko}
                onChange={(e) => setFormData({ ...formData, team_name_ko: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="예: 그랜드캐년, 사우스림, 마더포인트"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                팀원용 영어 이름 *
              </label>
              <input
                type="text"
                value={formData.team_name_en}
                onChange={(e) => setFormData({ ...formData, team_name_en: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="예: Grand Canyon, South Rim, Mather Point"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                고객용 한국어 이름
              </label>
              <input
                type="text"
                value={formData.customer_name_ko}
                onChange={(e) => setFormData({ ...formData, customer_name_ko: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="고객에게 표시될 한국어 이름"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                고객용 영어 이름
              </label>
              <input
                type="text"
                value={formData.customer_name_en}
                onChange={(e) => setFormData({ ...formData, customer_name_en: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="고객에게 표시될 영어 이름"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                팀원용 한국어 설명
              </label>
              <textarea
                value={formData.team_description_ko}
                onChange={(e) => setFormData({ ...formData, team_description_ko: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="팀원용 한국어 설명"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                팀원용 영어 설명
              </label>
              <textarea
                value={formData.team_description_en}
                onChange={(e) => setFormData({ ...formData, team_description_en: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="팀원용 영어 설명"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                고객용 한국어 설명
              </label>
              <textarea
                value={formData.customer_description_ko}
                onChange={(e) => setFormData({ ...formData, customer_description_ko: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="고객에게 표시될 한국어 설명"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                고객용 영어 설명
              </label>
              <textarea
                value={formData.customer_description_en}
                onChange={(e) => setFormData({ ...formData, customer_description_en: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="고객에게 표시될 영어 설명"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                내부 노트
              </label>
              <textarea
                value={formData.internal_note}
                onChange={(e) => setFormData({ ...formData, internal_note: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="관리자만 볼 수 있는 내부 노트"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                카테고리
              </label>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">카테고리 선택</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name_ko}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 위치 및 상세 정보 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">위치 및 상세 정보</h3>
            
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
                포인트 이름
              </label>
              <input
                type="text"
                value={formData.point_name}
                onChange={(e) => setFormData({ ...formData, point_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="예: 마더포인트"
              />
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
                  onChange={(e) => setFormData({ ...formData, difficulty_level: e.target.value as 'easy' | 'medium' | 'hard' })}
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
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '저장 중...' : '저장'}
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}
