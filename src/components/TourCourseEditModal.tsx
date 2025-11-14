'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { 
  X, 
  Globe, 
  MapPin, 
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Upload,
  Image as ImageIcon,
  Trash2,
  Star
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

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
  difficulty_level?: 'easy' | 'medium' | 'hard'
  price_adult?: number | null
  price_child?: number | null
  price_infant?: number | null
  is_active: boolean
  parent_id?: string | null
  children?: TourCourse[]
  level?: number
  parent?: TourCourse
  description_ko?: string | null
  description_en?: string | null
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

interface TourCourseEditModalProps {
  isOpen: boolean
  onClose: () => void
  course: TourCourse | null
  onSave: (course: TourCourse) => void
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
  selectedParentId?: string | null | undefined
  currentCourseId?: string | null | undefined
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
    distance: 0,
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
  const [activeTab, setActiveTab] = useState<'basic' | 'photos'>('basic')
  const [photos, setPhotos] = useState<TourCoursePhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 투어 코스 데이터 로드
  useEffect(() => {
    const loadTourCourses = async () => {
      try {
        // 부모 선택을 위해 모든 투어 코스를 가져옴 (is_active 필터 제거)
        const { data, error } = await supabase
          .from('tour_courses')
          .select('*')
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

    const loadPhotos = async () => {
      if (!course?.id) return
      
      try {
        const { data, error } = await supabase
          .from('tour_course_photos')
          .select('*')
          .eq('course_id', course.id)
          .order('created_at', { ascending: true })

        if (error) {
          throw error
        }

        setPhotos(data || [])
      } catch (error) {
        console.error('사진 로드 오류:', error)
        // 오류가 발생해도 빈 배열로 설정하여 UI가 깨지지 않도록 함
        setPhotos([])
      }
    }

    if (isOpen) {
      loadTourCourses()
      loadCategories()
      loadPhotos()
    }
  }, [isOpen, course?.id])

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
        distance: course.distance || 0,
        difficulty_level: course.difficulty_level || 'easy',
        price_adult: course.price_adult || 0,
        price_child: course.price_child || 0,
        price_infant: course.price_infant || 0,
        is_active: course.is_active
      })
    }
  }, [course])

  // 모든 노드를 기본적으로 확장 (한 번만 실행)
  useEffect(() => {
    if (tourCourses.length > 0 && expandedNodes.size === 0) {
      const allNodeIds = new Set<string>()
      const collectAllNodeIds = (courseList: TourCourse[]) => {
        courseList.forEach(course => {
          allNodeIds.add(course.id)
          if (course.children && course.children.length > 0) {
            collectAllNodeIds(course.children)
          }
        })
      }
      collectAllNodeIds(tourCourses)
      setExpandedNodes(allNodeIds)
    }
  }, [tourCourses, expandedNodes.size]) // 필요한 의존성 모두 포함

  // 트리 노드 토글 함수를 useCallback으로 최적화
  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const newExpanded = new Set(prev)
      if (newExpanded.has(nodeId)) {
        newExpanded.delete(nodeId)
      } else {
        newExpanded.add(nodeId)
      }
      return newExpanded
    })
  }, [])

  // 폼 데이터 업데이트 함수들을 useCallback으로 최적화
  const updateFormData = useCallback((updates: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }, [])

  // 사진 업로드 처리
  const handleFileUpload = async (files: FileList) => {
    if (!files.length || !course?.id) return

    setUploading(true)
    
    const uploadPromises = Array.from(files).map(async (file) => {
      try {
        // 파일 크기 체크 (10MB 제한)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`파일 ${file.name}이 너무 큽니다. (최대 10MB)`)
        }

        // 파일 타입 체크
        if (!file.type.startsWith('image/')) {
          throw new Error(`파일 ${file.name}은 이미지 파일이 아닙니다.`)
        }

        // 고유한 파일명 생성
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `tour-courses/${course.id}/${fileName}`


        // Supabase Storage에 업로드
        const { error: uploadError } = await supabase.storage
          .from('tour-course-photos')
          .upload(filePath, file)

        if (uploadError) {
          console.error('Storage 업로드 오류:', uploadError)
          throw uploadError
        }


        // 데이터베이스에 메타데이터 저장
        const { data, error: insertError } = await (supabase as any)
          .from('tour_course_photos')
          .insert({
            id: crypto.randomUUID(),
            course_id: course.id,
            photo_url: filePath,
            photo_alt_ko: file.name,
            photo_alt_en: file.name,
            display_order: 0,
            is_primary: false,
            sort_order: 0,
            uploaded_by: (await supabase.auth.getUser()).data.user?.email || 'unknown'
          })
          .select()
          .single()

        if (insertError) {
          console.error('데이터베이스 저장 오류:', insertError)
          throw insertError
        }

        return data
      } catch (error) {
        console.error('파일 업로드 오류:', file.name, error)
        alert(`파일 ${file.name} 업로드 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`)
        return null
      }
    })

    const results = await Promise.all(uploadPromises)
    const uploadedPhotos = results.filter((photo) => photo !== null) as TourCoursePhoto[]
    if (uploadedPhotos.length > 0) {
      setPhotos(prev => [...prev, ...uploadedPhotos])
    }

    setUploading(false)
  }

  // 사진 삭제
  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('이 사진을 삭제하시겠습니까?')) return

    try {
      const photo = photos.find(p => p.id === photoId)
      if (!photo) {
        console.error('삭제할 사진을 찾을 수 없습니다:', photoId)
        return
      }


      // Storage에서 파일 삭제
      const { error: storageError } = await supabase.storage
        .from('tour-course-photos')
        .remove([photo.photo_url])

      if (storageError) {
        console.error('Storage 삭제 오류:', storageError)
        throw storageError
      }

      // 데이터베이스에서 레코드 삭제
      const { error: deleteError } = await supabase
        .from('tour_course_photos')
        .delete()
        .eq('id', photoId)

      if (deleteError) {
        console.error('데이터베이스 삭제 오류:', deleteError)
        throw deleteError
      }

      setPhotos(prev => prev.filter(p => p.id !== photoId))
    } catch (error) {
      console.error('사진 삭제 오류:', error)
      alert(`사진 삭제 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // 대표 사진 설정
  const handleSetPrimary = async (photoId: string) => {
    try {

      // 기존 대표 사진 해제
      const { error: unsetError } = await (supabase as any)
        .from('tour_course_photos')
        .update({ is_primary: false })
        .eq('course_id', course?.id || '')

      if (unsetError) {
        console.error('기존 대표 사진 해제 오류:', unsetError)
        throw unsetError
      }

      // 새로운 대표 사진 설정
      const { error } = await (supabase as any)
        .from('tour_course_photos')
        .update({ is_primary: true })
        .eq('id', photoId)

      if (error) {
        console.error('대표 사진 설정 오류:', error)
        throw error
      }

      setPhotos(prev => prev.map(photo => ({
        ...photo,
        is_primary: photo.id === photoId
      })))
    } catch (error) {
      console.error('대표 사진 설정 오류:', error)
      alert(`대표 사진 설정 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // 드래그 앤 드롭 핸들러
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files)
    }
  }

  // 투어 코스 저장 (생성 또는 수정)
  const handleSave = async () => {
    if (!course) return

    // 필수 필드 검증
    if (!formData.team_name_ko.trim()) {
      alert('팀원용 한국어 이름을 입력해주세요.')
      return
    }

    setLoading(true)
    try {
      const courseData = {
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
        distance: formData.distance || null,
        difficulty_level: formData.difficulty_level,
        price_adult: formData.price_adult || null,
        price_child: formData.price_child || null,
        price_infant: formData.price_infant || null,
        is_active: formData.is_active
      }

      let result
      let savedCourse: TourCourse

      if (course.id && course.id !== '') {
        // 기존 코스 수정
        const { data, error } = await (supabase as any)
          .from('tour_courses')
          .update(courseData)
          .eq('id', course.id)
          .select()
          .single()

        if (error) throw error
        result = data
        savedCourse = { ...course, ...result }
      } else {
        // 새 코스 생성
        const { data, error } = await (supabase as any)
          .from('tour_courses')
          .insert({
            ...courseData,
            id: crypto.randomUUID() // UUID 자동 생성
          })
          .select()
          .single()

        if (error) throw error
        result = data
        savedCourse = { ...course, ...result }
      }

      // 저장 후 투어 코스 목록 다시 로드하여 계층 구조 반영
      // 부모 선택을 위해 모든 투어 코스를 가져옴 (is_active 필터 제거)
      try {
        const { data: refreshedData, error: refreshError } = await supabase
          .from('tour_courses')
          .select('*')
          .order('created_at', { ascending: false })

        if (!refreshError && refreshedData) {
          setTourCourses(refreshedData)
        }
      } catch (refreshError) {
        console.error('투어 코스 목록 새로고침 오류:', refreshError)
      }

      onSave(savedCourse)
      onClose()
    } catch (error) {
      console.error('투어 코스 저장 오류:', error)
      alert('투어 코스 저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 계층적 구조를 useMemo로 최적화
  const hierarchicalCourses = useMemo(() => {
    return buildHierarchy(tourCourses)
  }, [tourCourses])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-7xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {course?.id && course.id !== '' ? '투어 코스 수정' : '새 투어 코스 추가'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex space-x-1 mb-6">
          <button
            onClick={() => setActiveTab('basic')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'basic'
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            기본 정보
          </button>
          <button
            onClick={() => setActiveTab('photos')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'photos'
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            사진 관리
          </button>
        </div>

        {/* 탭 컨텐츠 */}
        {activeTab === 'basic' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 기본 정보 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">계층 구조</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                부모 관광지 선택
              </label>
              
              {/* 최상위 옵션 */}
              <div className="mb-3">
                <label className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="parent_course"
                    value=""
                    checked={!formData.parent_id}
                    onChange={() => updateFormData({ parent_id: '' })}
                    className="w-4 h-4 text-blue-600"
                  />
                  <Globe className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium text-gray-900">최상위 관광지</span>
                </label>
              </div>
              
              {/* 트리 선택 인터페이스 */}
              <div className="border border-gray-200 rounded-lg max-h-[600px] overflow-y-auto">
                {hierarchicalCourses.map((courseItem) => (
                  <ParentSelectionTreeItem
                    key={courseItem.id}
                    course={courseItem}
                    level={0}
                    expandedNodes={expandedNodes}
                    selectedParentId={formData.parent_id}
                    currentCourseId={course?.id}
                    onToggle={toggleNode}
                    onSelect={(id) => updateFormData({ parent_id: id || '' })}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 가운데: 이름 및 설명 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">이름 및 설명</h3>
            
            {/* 팀원용 이름 */}
            <div>
              <h4 className="text-md font-medium text-gray-800 mb-3">팀원용 이름 *</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    한국어 이름
                  </label>
                  <input
                    type="text"
                    value={formData.team_name_ko}
                    onChange={(e) => updateFormData({ team_name_ko: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="예: 그랜드캐년, 사우스림, 마더포인트"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    영어 이름
                  </label>
                  <input
                    type="text"
                    value={formData.team_name_en}
                    onChange={(e) => updateFormData({ team_name_en: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="예: Grand Canyon, South Rim, Mather Point"
                  />
                </div>
              </div>
            </div>

            {/* 고객용 이름 */}
            <div>
              <h4 className="text-md font-medium text-gray-800 mb-3">고객용 이름</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    한국어 이름
                  </label>
                  <input
                    type="text"
                    value={formData.customer_name_ko}
                    onChange={(e) => updateFormData({ customer_name_ko: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="고객에게 표시될 한국어 이름"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    영어 이름
                  </label>
                  <input
                    type="text"
                    value={formData.customer_name_en}
                    onChange={(e) => updateFormData({ customer_name_en: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="고객에게 표시될 영어 이름"
                  />
                </div>
              </div>
            </div>

            {/* 팀원용 설명 */}
            <div>
              <h4 className="text-md font-medium text-gray-800 mb-3">팀원용 설명</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    한국어 설명
                  </label>
                  <textarea
                    value={formData.team_description_ko}
                    onChange={(e) => updateFormData({ team_description_ko: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="팀원용 한국어 설명"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    영어 설명
                  </label>
                  <textarea
                    value={formData.team_description_en}
                    onChange={(e) => updateFormData({ team_description_en: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="팀원용 영어 설명"
                  />
                </div>
              </div>
            </div>

            {/* 고객용 설명 */}
            <div>
              <h4 className="text-md font-medium text-gray-800 mb-3">고객용 설명</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    한국어 설명
                  </label>
                  <textarea
                    value={formData.customer_description_ko}
                    onChange={(e) => updateFormData({ customer_description_ko: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="고객에게 표시될 한국어 설명"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    영어 설명
                  </label>
                  <textarea
                    value={formData.customer_description_en}
                    onChange={(e) => updateFormData({ customer_description_en: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="고객에게 표시될 영어 설명"
                  />
                </div>
              </div>
            </div>

            {/* 내부 노트 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                내부 노트
              </label>
              <textarea
                value={formData.internal_note}
                onChange={(e) => updateFormData({ internal_note: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="관리자만 볼 수 있는 내부 노트"
              />
            </div>
          </div>

          {/* 오른쪽: 위치 및 상세 정보 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">위치 및 상세 정보</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                위치 정보
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => updateFormData({ location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="예: 그랜드캐년 국립공원, 애리조나"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                포인트 이름
              </label>
              <input
                type="text"
                value={formData.point_name}
                onChange={(e) => updateFormData({ point_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="예: 마더포인트, 야바파이 포인트"
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
                  onChange={(e) => updateFormData({ start_latitude: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="36.1069"
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
                  onChange={(e) => updateFormData({ start_longitude: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="-112.1129"
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
                  onChange={(e) => updateFormData({ end_latitude: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="36.1069"
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
                  onChange={(e) => updateFormData({ end_longitude: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="-112.1129"
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
                  value={formData.duration_hours}
                  onChange={(e) => updateFormData({ duration_hours: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="60"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  거리 (km)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.distance}
                  onChange={(e) => updateFormData({ distance: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="5.2"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                난이도
              </label>
              <select
                value={formData.difficulty_level}
                onChange={(e) => updateFormData({ difficulty_level: e.target.value as 'easy' | 'medium' | 'hard' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="easy">쉬움</option>
                <option value="medium">보통</option>
                <option value="hard">어려움</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                카테고리
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => {
                  const selectedCategory = categories.find(cat => cat.id === e.target.value)
                  updateFormData({ 
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

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  성인 가격
                </label>
                <input
                  type="number"
                  value={formData.price_adult}
                  onChange={(e) => updateFormData({ price_adult: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  어린이 가격
                </label>
                <input
                  type="number"
                  value={formData.price_child}
                  onChange={(e) => updateFormData({ price_child: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  유아 가격
                </label>
                <input
                  type="number"
                  value={formData.price_infant}
                  onChange={(e) => updateFormData({ price_infant: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => updateFormData({ is_active: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label className="ml-2 text-sm font-medium text-gray-700">
                활성화
              </label>
            </div>
          </div>
        </div>
        )}

        {/* 사진 관리 탭 */}
        {activeTab === 'photos' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">사진 관리</h3>
            
            {(!course?.id || course.id === '') && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 text-sm">
                  투어 코스를 먼저 저장한 후 사진을 업로드할 수 있습니다.
                </p>
              </div>
            )}
            
            {/* 업로드 영역 */}
            {course?.id && course.id !== '' && (
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">
                  사진을 드래그하여 업로드하거나 클릭하여 선택하세요
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  JPG, PNG, GIF 파일 (최대 10MB)
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploading ? '업로드 중...' : '파일 선택'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                  className="hidden"
                />
              </div>
            )}

            {/* 사진 목록 */}
            {photos.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                      <img
                        src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-course-photos/${photo.photo_url}`}
                        alt={photo.photo_alt_ko || photo.photo_alt_en || 'Tour course photo'}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    
                    {/* 대표 사진 표시 */}
                    {photo.is_primary && (
                      <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded text-xs font-medium">
                        대표
                      </div>
                    )}
                    
                    {/* 액션 버튼들 */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex gap-2">
                        {!photo.is_primary && (
                          <button
                            onClick={() => handleSetPrimary(photo.id)}
                            className="p-2 bg-yellow-500 text-white rounded-full hover:bg-yellow-600"
                            title="대표 사진으로 설정"
                          >
                            <Star className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeletePhoto(photo.id)}
                          className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    {/* 파일 정보 */}
                    <div className="mt-2 text-xs text-gray-500 truncate">
                      {photo.photo_alt_ko || photo.photo_alt_en || 'Photo'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {photos.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <ImageIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>업로드된 사진이 없습니다</p>
              </div>
            )}
          </div>
        )}

        {/* 버튼 */}
        <div className="flex gap-2 mt-6">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '저장 중...' : (course?.id && course.id !== '' ? '수정' : '추가')}
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
