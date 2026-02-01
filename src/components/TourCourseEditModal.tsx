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
  Star,
  Search
} from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { supabase } from '@/lib/supabase'
import LocationPickerModal from './LocationPickerModal'

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
  price_type?: 'per_person' | 'per_vehicle' | 'none' | null
  price_adult?: number | null
  price_child?: number | null
  price_infant?: number | null
  price_minivan?: number | null
  price_9seater?: number | null
  price_13seater?: number | null
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

function getCourseDisplayName(course: TourCourse, locale: string): string {
  const en = course.team_name_en || course.name_en || ''
  const ko = course.team_name_ko || course.name_ko || ''
  return locale === 'en' ? (en || ko) : (ko || en)
}

// 부모 관광지 선택용 트리 아이템 컴포넌트
const ParentSelectionTreeItem = ({ 
  course, 
  level = 0,
  expandedNodes,
  selectedParentId,
  currentCourseId,
  currentCourseLabel,
  locale = 'ko',
  onToggle,
  onSelect
}: { 
  course: TourCourse
  level?: number
  expandedNodes: Set<string>
  selectedParentId?: string | null | undefined
  currentCourseId?: string | null | undefined
  currentCourseLabel?: string
  locale?: string
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
            {getCourseDisplayName(course, locale || 'ko')}
            {isCurrentCourse && currentCourseLabel ? ` ${currentCourseLabel}` : ''}
          </div>
          {locale === 'en' ? (course.team_name_ko && course.team_name_ko !== course.team_name_en && (
            <div className={`text-xs truncate ${isCurrentCourse ? 'text-gray-300' : 'text-gray-500'}`}>
              {course.team_name_ko}
            </div>
          )) : (course.team_name_en && course.team_name_en !== course.team_name_ko && (
            <div className={`text-xs truncate ${isCurrentCourse ? 'text-gray-300' : 'text-gray-500'}`}>
              {course.team_name_en}
            </div>
          ))}
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
                    currentCourseLabel={currentCourseLabel}
                    locale={locale}
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
  const t = useTranslations('tourCourses.editModal')
  const locale = useLocale()

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
    price_type: 'none' as 'per_person' | 'per_vehicle' | 'none',
    price_adult: 0,
    price_child: 0,
    price_infant: 0,
    price_minivan: 0,
    price_9seater: 0,
    price_13seater: 0,
    is_active: true
  })

  const [tourCourses, setTourCourses] = useState<TourCourse[]>([])
  const [categories, setCategories] = useState<TourCourseCategory[]>([])
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  // 탭 제거 - 사진 관리는 위치 및 상세 정보 하단에 표시
  const [photos, setPhotos] = useState<TourCoursePhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [locationPickerType, setLocationPickerType] = useState<'start' | 'end' | 'single'>('single')

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
        duration_hours: course.duration_hours !== null && course.duration_hours !== undefined ? course.duration_hours : 60,
        distance: course.distance || 0,
        difficulty_level: course.difficulty_level || 'easy',
        price_type: course.price_type === null ? 'none' : (course.price_type || 'per_person'),
        price_adult: course.price_adult || 0,
        price_child: course.price_child || 0,
        price_infant: course.price_infant || 0,
        price_minivan: course.price_minivan || 0,
        price_9seater: course.price_9seater || 0,
        price_13seater: course.price_13seater || 0,
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
          throw new Error(t('fileTooLarge', { name: file.name }))
        }

        // 파일 타입 체크
        if (!file.type.startsWith('image/')) {
          throw new Error(t('fileNotImage', { name: file.name }))
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
        alert(t('uploadError', { name: file.name, message: error instanceof Error ? error.message : 'Unknown error' }))
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
    if (!confirm(t('confirmDeletePhoto'))) return

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
      alert(t('deletePhotoError', { message: error instanceof Error ? error.message : 'Unknown error' }))
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
      alert(t('requiredTeamNameKo'))
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
        category: formData.category || (locale === 'en' ? 'Other' : '기타'),
        category_id: formData.category_id || null,
        point_name: formData.point_name || null,
        location: formData.location || null,
        start_latitude: formData.start_latitude ? parseFloat(formData.start_latitude) : null,
        start_longitude: formData.start_longitude ? parseFloat(formData.start_longitude) : null,
        end_latitude: formData.end_latitude ? parseFloat(formData.end_latitude) : null,
        end_longitude: formData.end_longitude ? parseFloat(formData.end_longitude) : null,
        duration_hours: formData.duration_hours !== null && formData.duration_hours !== undefined ? formData.duration_hours : null,
        distance: formData.distance || null,
        difficulty_level: formData.difficulty_level,
        price_type: formData.price_type === 'none' ? null : formData.price_type,
        price_adult: formData.price_type === 'per_person' ? (formData.price_adult || null) : null,
        price_child: formData.price_type === 'per_person' ? (formData.price_child || null) : null,
        price_infant: formData.price_type === 'per_person' ? (formData.price_infant || null) : null,
        price_minivan: formData.price_type === 'per_vehicle' ? (formData.price_minivan || null) : null,
        price_9seater: formData.price_type === 'per_vehicle' ? (formData.price_9seater || null) : null,
        price_13seater: formData.price_type === 'per_vehicle' ? (formData.price_13seater || null) : null,
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
      alert(t('saveError'))
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
            {course?.id && course.id !== '' ? t('titleEdit') : t('titleAdd')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 기본 정보 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 기본 정보 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">{t('hierarchy')}</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('selectParent')}
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
                  <span className="text-sm font-medium text-gray-900">{t('topLevel')}</span>
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
                    currentCourseLabel={t('currentCourse') as string}
                    locale={locale}
                    onToggle={toggleNode}
                    onSelect={(id) => updateFormData({ parent_id: id || '' })}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 가운데: 이름 및 설명 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">{t('nameAndDescription')}</h3>
            
            {/* 팀원용 박스 */}
            <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
              <h4 className="text-md font-medium text-gray-800 mb-4">{t('forTeam')}</h4>
              
              {/* 팀원용 이름 */}
              <div className="mb-4">
                <h5 className="text-sm font-medium text-gray-700 mb-2">{t('name')}</h5>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {t('nameKo')}
                    </label>
                    <input
                      type="text"
                      value={formData.team_name_ko}
                      onChange={(e) => updateFormData({ team_name_ko: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={t('placeholderTeamNameKo')}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {t('nameEn')}
                    </label>
                    <input
                      type="text"
                      value={formData.team_name_en}
                      onChange={(e) => updateFormData({ team_name_en: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={t('placeholderTeamNameEn')}
                    />
                  </div>
                </div>
              </div>

              {/* 팀원용 설명 */}
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">{t('description')}</h5>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {t('descKo')}
                    </label>
                    <textarea
                      value={formData.team_description_ko}
                      onChange={(e) => updateFormData({ team_description_ko: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                      placeholder={t('placeholderTeamDescKo')}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {t('descEn')}
                    </label>
                    <textarea
                      value={formData.team_description_en}
                      onChange={(e) => updateFormData({ team_description_en: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                      placeholder={t('placeholderTeamDescEn')}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 고객용 박스 */}
            <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
              <h4 className="text-md font-medium text-gray-800 mb-4">{t('forCustomer')}</h4>
              
              {/* 고객용 이름 */}
              <div className="mb-4">
                <h5 className="text-sm font-medium text-gray-700 mb-2">{t('name')}</h5>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {t('nameKo')}
                    </label>
                    <input
                      type="text"
                      value={formData.customer_name_ko}
                      onChange={(e) => updateFormData({ customer_name_ko: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={t('placeholderCustomerNameKo')}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {t('nameEn')}
                    </label>
                    <input
                      type="text"
                      value={formData.customer_name_en}
                      onChange={(e) => updateFormData({ customer_name_en: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={t('placeholderCustomerNameEn')}
                    />
                  </div>
                </div>
              </div>

              {/* 고객용 설명 */}
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">{t('description')}</h5>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {t('descKo')}
                    </label>
                    <textarea
                      value={formData.customer_description_ko}
                      onChange={(e) => updateFormData({ customer_description_ko: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                      placeholder={t('placeholderCustomerDescKo')}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {t('descEn')}
                    </label>
                    <textarea
                      value={formData.customer_description_en}
                      onChange={(e) => updateFormData({ customer_description_en: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                      placeholder={t('placeholderCustomerDescEn')}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 내부 노트 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('internalNote')}
              </label>
              <textarea
                value={formData.internal_note}
                onChange={(e) => updateFormData({ internal_note: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder={t('placeholderInternalNote')}
              />
            </div>
          </div>

          {/* 오른쪽: 위치 및 상세 정보 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">{t('locationAndDetails')}</h3>
            
            {/* 카테고리 선택 (위치 좌표 위에 배치) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('category')}
              </label>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {categories.map((category) => {
                  const isSelected = formData.category_id === category.id
                  const displayName = locale === 'en' ? (category.name_en || category.name_ko) : (category.name_ko || category.name_en)
                  const shortName = displayName
                    .replace(/ tour$/i, '')
                    .replace(/adventure tour/i, locale === 'en' ? 'Adventure' : '어드벤처')
                    .replace(/tour point/i, locale === 'en' ? 'Point' : '포인트')
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        updateFormData({ 
                          category_id: category.id,
                          category: category.name_ko || ''
                        })
                        if (category.name_ko !== '어드벤처 투어' && category.name_en !== 'Adventure Tour') {
                          if (formData.start_latitude && formData.start_longitude) {
                            updateFormData({
                              end_latitude: formData.start_latitude,
                              end_longitude: formData.start_longitude
                            })
                          }
                        }
                      }}
                      className={`px-3 py-1.5 text-sm rounded-lg border-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                      }`}
                    >
                      {shortName}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 카테고리가 액티비티(어드벤처 투어)인 경우만 시작점/종료점 분리 */}
            {(() => {
              const selectedCategory = categories.find(cat => cat.id === formData.category_id)
              // 액티비티 카테고리 확인 (한글/영문 모두 체크)
              const isActivity = selectedCategory?.name_ko?.toLowerCase().includes('액티비티') || 
                                selectedCategory?.name_ko === '어드벤처 투어' || 
                                selectedCategory?.name_en?.toLowerCase().includes('activity') ||
                                selectedCategory?.name_en === 'Adventure Tour'
              
              if (isActivity) {
                // 액티비티: 시작점과 종료점 분리
                return (
                  <>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          {t('startLocation')}
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setLocationPickerType('start')
                            setShowLocationPicker(true)
                          }}
                          className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center justify-center"
                          title={t('selectOnMap')}
                        >
                          <Search className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="any"
                          value={formData.start_latitude}
                          onChange={(e) => {
                            const value = e.target.value
                            updateFormData({ 
                              start_latitude: value,
                              ...(value === '' && formData.start_longitude === '' ? { location: '' } : {})
                            })
                          }}
                          className="w-32 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder={t('latitude')}
                        />
                        <input
                          type="number"
                          step="any"
                          value={formData.start_longitude}
                          onChange={(e) => {
                            const value = e.target.value
                            updateFormData({ 
                              start_longitude: value,
                              ...(value === '' && formData.start_latitude === '' ? { location: '' } : {})
                            })
                          }}
                          className="w-32 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder={t('longitude')}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          {t('endLocation')}
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setLocationPickerType('end')
                            setShowLocationPicker(true)
                          }}
                          className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center justify-center"
                          title={t('selectOnMap')}
                        >
                          <Search className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="any"
                          value={formData.end_latitude}
                          onChange={(e) => {
                            const value = e.target.value
                            updateFormData({ 
                              end_latitude: value,
                              ...(value === '' && formData.end_longitude === '' ? { location: '' } : {})
                            })
                          }}
                          className="w-32 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder={t('latitude')}
                        />
                        <input
                          type="number"
                          step="any"
                          value={formData.end_longitude}
                          onChange={(e) => {
                            const value = e.target.value
                            updateFormData({ 
                              end_longitude: value,
                              ...(value === '' && formData.end_latitude === '' ? { location: '' } : {})
                            })
                          }}
                          className="w-32 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder={t('longitude')}
                        />
                      </div>
                    </div>
                  </>
                )
              } else {
                return (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        {t('locationCoords')}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setLocationPickerType('single')
                          setShowLocationPicker(true)
                        }}
                        className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center justify-center"
                        title={t('selectOnMap')}
                      >
                        <Search className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="any"
                        value={formData.start_latitude}
                        onChange={(e) => {
                          const lat = e.target.value
                          const shouldClearLocation = lat === '' && formData.start_longitude === ''
                          updateFormData({ 
                            start_latitude: lat,
                            end_latitude: lat, // 시작과 종료를 동일하게 설정
                            ...(shouldClearLocation ? { location: '' } : {})
                          })
                        }}
                        className="w-32 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={t('latitude')}
                      />
                      <input
                        type="number"
                        step="any"
                        value={formData.start_longitude}
                        onChange={(e) => {
                          const lng = e.target.value
                          const shouldClearLocation = lng === '' && formData.start_latitude === ''
                          updateFormData({ 
                            start_longitude: lng,
                            end_longitude: lng,
                            ...(shouldClearLocation ? { location: '' } : {})
                          })
                        }}
                        className="w-32 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={t('longitude')}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('sameStartEnd')}
                    </p>
                  </div>
                )
              }
            })()}

            {/* 소요 시간 (항상 표시) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('durationMinutes')}
              </label>
              <input
                type="number"
                value={formData.duration_hours}
                onChange={(e) => updateFormData({ duration_hours: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="60"
              />
            </div>

            {/* 거리 (액티비티 카테고리일 때만 표시) */}
            {(() => {
              const selectedCategory = categories.find(cat => cat.id === formData.category_id)
              const isActivity = selectedCategory?.name_ko?.toLowerCase().includes('액티비티') || 
                                selectedCategory?.name_ko === '어드벤처 투어' || 
                                selectedCategory?.name_en?.toLowerCase().includes('activity') ||
                                selectedCategory?.name_en === 'Adventure Tour'
              
              if (isActivity) {
                return (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('distanceMile')}
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
                )
              }
              return null
            })()}

            {/* 난이도 (액티비티 카테고리일 때만 표시) */}
            {(() => {
              const selectedCategory = categories.find(cat => cat.id === formData.category_id)
              const isActivity = selectedCategory?.name_ko?.toLowerCase().includes('액티비티') || 
                                selectedCategory?.name_ko === '어드벤처 투어' || 
                                selectedCategory?.name_en?.toLowerCase().includes('activity') ||
                                selectedCategory?.name_en === 'Adventure Tour'
              
              if (isActivity) {
                return (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('difficulty')}
                    </label>
                    <select
                      value={formData.difficulty_level}
                      onChange={(e) => updateFormData({ difficulty_level: e.target.value as 'easy' | 'medium' | 'hard' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="easy">{t('difficultyEasy')}</option>
                      <option value="medium">{t('difficultyMedium')}</option>
                      <option value="hard">{t('difficultyHard')}</option>
                    </select>
                  </div>
                )
              }
              return null
            })()}

            {/* 가격 설정 방식 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('priceType')}
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="price_type"
                    value="none"
                    checked={formData.price_type === 'none'}
                    onChange={(e) => updateFormData({ price_type: e.target.value as 'per_person' | 'per_vehicle' | 'none' })}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{t('noPrice')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="price_type"
                    value="per_person"
                    checked={formData.price_type === 'per_person'}
                    onChange={(e) => updateFormData({ price_type: e.target.value as 'per_person' | 'per_vehicle' | 'none' })}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{t('perPerson')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="price_type"
                    value="per_vehicle"
                    checked={formData.price_type === 'per_vehicle'}
                    onChange={(e) => updateFormData({ price_type: e.target.value as 'per_person' | 'per_vehicle' | 'none' })}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{t('perVehicle')}</span>
                </label>
              </div>
            </div>

            {/* 인원별 가격 입력 */}
            {formData.price_type === 'per_person' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admissionPerPerson')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {t('adultPrice')}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price_adult}
                      onChange={(e) => updateFormData({ price_adult: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {t('childPrice')}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price_child}
                      onChange={(e) => updateFormData({ price_child: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      유아 가격
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price_infant}
                      onChange={(e) => updateFormData({ price_infant: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 차량별 가격 입력 */}
            {formData.price_type === 'per_vehicle' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admissionPerVehicle')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {t('minivan')}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price_minivan}
                      onChange={(e) => updateFormData({ price_minivan: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      9인승
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price_9seater}
                      onChange={(e) => updateFormData({ price_9seater: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {t('seater13')}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price_13seater}
                      onChange={(e) => updateFormData({ price_13seater: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => updateFormData({ is_active: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label className="ml-2 text-sm font-medium text-gray-700">
                {t('active')}
              </label>
            </div>

            {/* 사진 관리 */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('photoManagement')}</h3>
              
              {(!course?.id || course.id === '') && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800 text-sm">
                    {t('saveFirstToUpload')}
                  </p>
                </div>
              )}
              
              {/* 업로드 영역 */}
              {course?.id && course.id !== '' && (
                <div
                  className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                    dragActive
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <div className="flex items-center justify-center gap-3">
                    <Upload className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-600 mb-1">
                        {t('dragOrClick')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t('fileTypes')}
                      </p>
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                    >
                      {uploading ? t('uploading') : t('selectFile')}
                    </button>
                  </div>
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
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
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
                          {t('primary')}
                        </div>
                      )}
                      
                      {/* 액션 버튼들 */}
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="flex gap-2">
                          {!photo.is_primary && (
                            <button
                              onClick={() => handleSetPrimary(photo.id)}
                              className="p-2 bg-yellow-500 text-white rounded-full hover:bg-yellow-600"
                              title={t('setPrimary')}
                            >
                              <Star className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeletePhoto(photo.id)}
                            className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                            title={t('delete')}
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

              {photos.length === 0 && course?.id && course.id !== '' && (
                <div className="text-center py-8 text-gray-500">
                  <ImageIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>{t('noPhotos')}</p>
                </div>
              )}
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
            {loading ? t('saving') : (course?.id && course.id !== '' ? t('edit') : t('add'))}
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
          >
            {t('cancel')}
          </button>
        </div>
      </div>

      {/* 위치 선택 모달 */}
      {showLocationPicker && (() => {
        let currentLat: number | undefined
        let currentLng: number | undefined

        if (locationPickerType === 'start') {
          currentLat = formData.start_latitude ? parseFloat(formData.start_latitude) : undefined
          currentLng = formData.start_longitude ? parseFloat(formData.start_longitude) : undefined
        } else if (locationPickerType === 'end') {
          currentLat = formData.end_latitude ? parseFloat(formData.end_latitude) : undefined
          currentLng = formData.end_longitude ? parseFloat(formData.end_longitude) : undefined
        } else {
          currentLat = formData.start_latitude ? parseFloat(formData.start_latitude) : undefined
          currentLng = formData.start_longitude ? parseFloat(formData.start_longitude) : undefined
        }

        return (
          <LocationPickerModal
            {...(currentLat !== undefined ? { currentLat } : {})}
            {...(currentLng !== undefined ? { currentLng } : {})}
            onLocationSelect={(lat, lng, address) => {
              if (locationPickerType === 'start') {
                updateFormData({
                  start_latitude: lat.toString(),
                  start_longitude: lng.toString()
                })
              } else if (locationPickerType === 'end') {
                updateFormData({
                  end_latitude: lat.toString(),
                  end_longitude: lng.toString()
                })
              } else {
                // single: 시작과 종료를 동일하게 설정
                updateFormData({
                  start_latitude: lat.toString(),
                  start_longitude: lng.toString(),
                  end_latitude: lat.toString(),
                  end_longitude: lng.toString()
                })
              }
              if (address && !formData.location) {
                updateFormData({ location: address })
              }
              setShowLocationPicker(false)
            }}
            onClose={() => setShowLocationPicker(false)}
          />
        )
      })()}
    </div>
  )
}
