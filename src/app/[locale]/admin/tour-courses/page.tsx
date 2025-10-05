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
import TourCoursePhotoUploadModal from '@/components/TourCoursePhotoUploadModal'
import LocationSearch from '@/components/LocationSearch'
import LocationPickerModal from '@/components/LocationPickerModal'

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
  description_ko?: string
  description_en?: string
  color: string
  icon: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}



interface TourCoursePhotoRow {
  id: string
  course_id: string
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  mime_type: string
  thumbnail_url?: string
  is_primary: boolean
  sort_order: number
  uploaded_by?: string
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



// 기존 인터페이스들을 새로운 타입으로 교체
type TourCourseCategory = TourCourseCategoryRow
type TourCoursePhoto = TourCoursePhotoRow
type TourCoursePoint = TourCoursePointRow


interface TourCourse extends Omit<TourCourseRow, 'category'> {
  photos?: TourCoursePhoto[]
  points?: TourCoursePoint[]
  category?: TourCourseCategory
  children?: TourCourse[]
  parent?: TourCourse
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

  // 각 레벨에서 자식들을 정렬하는 함수
  const sortChildren = (course: TourCourse) => {
    if (course.children && course.children.length > 0) {
      course.children.sort((a, b) => {
        const nameA = a.team_name_ko || a.name_ko || ''
        const nameB = b.team_name_ko || b.name_ko || ''
        return nameA.localeCompare(nameB, 'ko', { numeric: true })
      })
      // 재귀적으로 하위 자식들도 정렬
      course.children.forEach(child => sortChildren(child))
    }
  }

  // 모든 루트 코스와 그 하위 자식들을 정렬
  rootCourses.forEach(course => sortChildren(course))
  rootCourses.sort((a, b) => {
    const nameA = a.team_name_ko || a.name_ko || ''
    const nameB = b.team_name_ko || b.name_ko || ''
    return nameA.localeCompare(nameB, 'ko', { numeric: true })
  })

  return rootCourses
}

// 하위 관광지의 모든 사진을 수집하는 함수
const collectAllPhotos = (course: TourCourse): TourCoursePhoto[] => {
  const allPhotos: TourCoursePhoto[] = []
  
  // 현재 관광지의 사진 추가
  if (course.photos) {
    allPhotos.push(...course.photos)
  }
  
  // 하위 관광지의 사진 재귀적으로 수집
  if (course.children) {
    course.children.forEach(child => {
      allPhotos.push(...collectAllPhotos(child))
    })
  }
  
  return allPhotos
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


// 폴더 트리 아이템 컴포넌트
const TreeItem = ({ 
  course, 
  level = 0,
  expandedNodes,
  selectedCourseId,
  onToggle,
  onSelect,
  onEdit,
  onDelete,
  onPhotoModal,
  onMoveCourse
}: { 
  course: TourCourse
  level?: number
  expandedNodes: Set<string>
  selectedCourseId?: string | null
  onToggle: (id: string) => void
  onSelect: (course: TourCourse) => void
  onEdit: (course: TourCourse) => void
  onDelete: (id: string) => void
  onPhotoModal: (course: TourCourse) => void
  onMoveCourse: (draggedId: string, targetId: string) => void
}) => {
  const hasChildren = course.children && course.children.length > 0
  const isExpanded = expandedNodes.has(course.id)
  const isSelected = selectedCourseId === course.id
  const indentClass = level > 0 ? `ml-${level * 4}` : ''

  return (
    <Draggable draggableId={course.id} index={level}>
      {(provided, snapshot) => (
        <div ref={provided.innerRef} {...provided.draggableProps} className={`${indentClass}`}>
          <div 
            className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 group ${
              isSelected ? 'bg-blue-50 border-l-2 border-blue-500' : ''
            } ${snapshot.isDragging ? 'opacity-50 shadow-lg' : ''}`}
            onClick={() => onSelect(course)}
          >
            {/* 드래그 핸들 */}
            <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
              <GripVertical className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </div>
            
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
            
            {/* 폴더/파일 아이콘 */}
            <div className="flex items-center gap-1">
              {hasChildren ? (
                <Folder className="w-4 h-4 text-blue-500" />
              ) : (
                <MapPin className="w-4 h-4 text-gray-400" />
              )}
            </div>
            
            {/* 이름 */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {course.team_name_ko || course.name_ko}
              </div>
              {course.team_name_en && course.team_name_en !== course.team_name_ko && (
                <div className="text-xs text-gray-500 truncate">
                  {course.team_name_en}
                </div>
              )}
            </div>
            
            {/* 상태 표시 */}
            <div className="flex items-center gap-1">
              {!course.is_active && (
                <div className="w-2 h-2 bg-red-400 rounded-full" title="비활성"></div>
              )}
              
              {/* 액션 버튼들 */}
              <div className="flex items-center gap-1 opacity-0 hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onPhotoModal(course)
                  }}
                  className="p-1 hover:bg-gray-200 rounded"
                  title="사진 관리"
                >
                  <ImageIcon className="w-3 h-3 text-gray-500" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(course)
                  }}
                  className="p-1 hover:bg-gray-200 rounded"
                  title="편집"
                >
                  <Edit className="w-3 h-3 text-gray-500" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(course.id)
                  }}
                  className="p-1 hover:bg-gray-200 rounded"
                  title="삭제"
                >
                  <Trash2 className="w-3 h-3 text-red-500" />
                </button>
              </div>
            </div>
          </div>
          
          {/* 하위 항목들 */}
          {hasChildren && isExpanded && (
            <div className="ml-4">
              {course.children!.map((child) => (
                <TreeItem
                  key={child.id}
                  course={child}
                  level={level + 1}
                  expandedNodes={expandedNodes}
                  selectedCourseId={selectedCourseId}
                  onToggle={onToggle}
                  onSelect={onSelect}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onPhotoModal={onPhotoModal}
                  onMoveCourse={onMoveCourse}
                />
              ))}
            </div>
          )}
          
          {provided.placeholder}
        </div>
      )}
    </Draggable>
  )
}

// 부모 관광지들을 찾는 함수
const findParentHierarchy = (course: TourCourse, allCourses: TourCourse[]): TourCourse[] => {
  const parents: TourCourse[] = []
  let currentCourse = course
  
  while (currentCourse.parent_id) {
    const parent = allCourses.find(c => c.id === currentCourse.parent_id)
    if (parent) {
      parents.unshift(parent) // 맨 앞에 추가하여 순서 유지
      currentCourse = parent
    } else {
      break
    }
  }
  
  return parents
}

// 상세 정보 패널 컴포넌트
const DetailPanel = ({ 
  course, 
  onEdit, 
  onDelete, 
  onPhotoModal,
  allCourses = []
}: { 
  course: TourCourse | null
  onEdit: (course: TourCourse) => void
  onDelete: (id: string) => void
  onPhotoModal: (course: TourCourse) => void
  allCourses?: TourCourse[]
}) => {
  if (!course) {
    return (
      <div className="flex-1 bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Globe className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">관광지를 선택하세요</h3>
          <p className="text-gray-500">좌측 트리에서 관광지를 선택하면 상세 정보를 확인할 수 있습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-white rounded-lg shadow-sm border overflow-hidden">
      {/* 헤더 */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {course.team_name_ko || course.name_ko}
            </h1>
            {course.team_name_en && (
              <p className="text-lg text-gray-600 mb-4">
                {course.team_name_en}
              </p>
            )}
            
            {/* 부모 관광지 계층 */}
            {(() => {
              const parentHierarchy = findParentHierarchy(course, allCourses)
              if (parentHierarchy.length > 0) {
                return (
                  <div className="mt-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      {parentHierarchy.map((parent, index) => (
                        <React.Fragment key={parent.id}>
                          <span className="font-medium">
                            {parent.team_name_ko || parent.name_ko}
                          </span>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </React.Fragment>
                      ))}
                      <span className="font-bold text-gray-800">
                        {course.team_name_ko || course.name_ko}
                      </span>
                    </div>
                  </div>
                )
              }
              return null
            })()}
            
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 text-sm rounded-full ${
              course.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {course.is_active ? '활성' : '비활성'}
            </span>
            
            <button
              onClick={() => onPhotoModal(course)}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium"
            >
              <ImageIcon className="w-4 h-4 inline mr-1" />
              사진 관리
            </button>
            <button
              onClick={() => onEdit(course)}
              className="px-3 py-2 bg-blue-100 hover:bg-blue-200 rounded-lg text-sm font-medium text-blue-800"
            >
              <Edit className="w-4 h-4 inline mr-1" />
              편집
            </button>
            <button
              onClick={() => onDelete(course.id)}
              className="px-3 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-sm font-medium text-red-800"
            >
              <Trash2 className="w-4 h-4 inline mr-1" />
              삭제
            </button>
          </div>
        </div>
      </div>

      {/* 스크롤 가능한 컨텐츠 */}
      <div className="overflow-y-auto h-[calc(100%-120px)]">
        <div className="p-6">
          {/* 상세 정보 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* 기본 정보 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">기본 정보</h3>
              
              {/* 설명 */}
              {(course.team_description_ko || course.description_ko) && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">팀원용 설명</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                    {course.team_description_ko || course.description_ko}
                  </p>
                </div>
              )}
              
              {/* 고객용 설명 */}
              {(course.customer_description_ko || course.customer_description_en) && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">고객용 설명</h4>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    {course.customer_description_ko && (
                      <p className="text-sm text-blue-800 mb-2">{course.customer_description_ko}</p>
                    )}
                    {course.customer_description_en && (
                      <p className="text-sm text-blue-700">{course.customer_description_en}</p>
                    )}
                  </div>
                </div>
              )}
              
              {/* 내부 노트 */}
              {course.internal_note && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">내부 노트</h4>
                  <p className="text-sm text-gray-600 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                    {course.internal_note}
                  </p>
                </div>
              )}
            </div>

            {/* 위치 및 상세 정보 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">위치 및 상세 정보</h3>
              
              {/* 위치 */}
              {course.location && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-gray-700">위치</h4>
                    <p className="text-sm text-gray-600">{course.location}</p>
                  </div>
                </div>
              )}
              
              {/* 소요 시간 */}
              <div className="flex items-start gap-2">
                <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-gray-700">소요 시간</h4>
                  <p className="text-sm text-gray-600">{course.duration_hours}분</p>
                </div>
              </div>
              
              {/* 난이도 */}
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 mt-0.5"></div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700">난이도</h4>
                  <span className={`text-sm px-2 py-1 rounded-full ${
                    course.difficulty_level === 'easy' ? 'bg-green-100 text-green-800' :
                    course.difficulty_level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {DIFFICULTY_LEVELS.find(l => l.value === course.difficulty_level)?.label}
                  </span>
                </div>
              </div>
              
              {/* 카테고리 */}
              {course.category && (
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 mt-0.5"></div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700">카테고리</h4>
                    <p className="text-sm text-gray-600">
                      {typeof course.category === 'string' ? course.category : course.category.name_ko}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 하위 관광지 */}
          {course.children && course.children.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">하위 관광지</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {course.children.map((child) => (
                  <div key={child.id} className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-1">
                      {child.team_name_ko || child.name_ko}
                    </h4>
                    {child.team_name_en && (
                      <p className="text-sm text-gray-600 mb-2">{child.team_name_en}</p>
                    )}
                    {child.location && (
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {child.location}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 사진 갤러리 */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">사진 갤러리</h3>
            {(() => {
              const allPhotos = collectAllPhotos(course)
              if (allPhotos.length > 0) {
                return (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {allPhotos.map((photo: TourCoursePhoto) => (
                      <div 
                        key={photo.id}
                        className="relative group cursor-pointer"
                        onClick={() => {
                          // 이미지 확대 모달 열기
                          const modal = document.createElement('div')
                          modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50'
                          modal.innerHTML = `
                            <div class="relative max-w-4xl max-h-[90vh] p-4">
                              <button class="absolute top-2 right-2 text-white hover:text-gray-300 z-10" onclick="this.parentElement.parentElement.remove()">
                                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                              </button>
                              <img 
                                src="${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-course-photos/${photo.file_path}" 
                                alt="${photo.file_name}"
                                class="max-w-full max-h-full object-contain rounded-lg"
                              />
                            </div>
                          `
                          document.body.appendChild(modal)
                          modal.addEventListener('click', (e) => {
                            if (e.target === modal) {
                              document.body.removeChild(modal)
                            }
                          })
                        }}
                      >
                        <div className="aspect-[3/2] bg-gray-100 rounded-lg overflow-hidden">
                          <Image
                            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-course-photos/${photo.file_path}`}
                            alt={photo.file_name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        </div>
                        {photo.is_primary && (
                          <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                            대표
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <ImageIcon className="w-8 h-8 text-white" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              } else {
                return (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 mb-2">업로드된 사진이 없습니다</p>
                    <p className="text-sm text-gray-400">사진 관리 버튼을 클릭하여 사진을 업로드하세요</p>
                  </div>
                )
              }
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TourCoursesPage() {
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
        .order('created_at', { ascending: false }) as { data: TourCourse[] | null, error: unknown }

      if (error) {
        console.error('Error fetching tour courses:', error)
        return []
      }

      return data || []
    },
    cacheKey: 'tour-courses',
    cacheTime: 5 * 60 * 1000 // 5분 캐시
  })

  // 최적화된 상품 데이터 로딩 (현재 사용하지 않음)
  // const { data: products = [], loading: productsLoading } = useOptimizedData({
  //   fetchFn: async () => {
  //     const { data, error } = await supabase
  //       .from('products')
  //       .select('id, name_ko, name_en, description, category, status')
  //       .eq('status', 'active')
  //       .order('name_ko', { ascending: true })

  //     if (error) {
  //       console.error('Error fetching products:', error)
  //       return []
  //     }

  //     return data || []
  //   },
  //   cacheKey: 'products',
  //   cacheTime: 10 * 60 * 1000 // 10분 캐시
  // })

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
  // const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [difficultyFilter, setDifficultyFilter] = useState('all')
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [editingCourse, setEditingCourse] = useState<TourCourse | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showMapModal, setShowMapModal] = useState(false)
  const [mapModalType, setMapModalType] = useState<'main' | 'start' | 'end'>('main')
  const [showHelpModal, setShowHelpModal] = useState(false)
  
  // 트리 관련 상태
  const [selectedCourse, setSelectedCourse] = useState<TourCourse | null>(null)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
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

  // 계층적 구조로 변환
  const hierarchicalCourses = buildHierarchy(tourCourses || [])
  
  // 모든 노드를 기본적으로 확장하도록 설정 (한 번만 실행)
  React.useEffect(() => {
    if (tourCourses && tourCourses.length > 0 && expandedNodes.size === 0) {
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

  // 관광지 순서 변경 함수
  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return
    
    const sourceIndex = result.source.index
    const destIndex = result.destination.index
    
    if (sourceIndex === destIndex) return

    // 실제 순서 변경 로직 구현
    const items = Array.from(filteredCourses)
    const [reorderedItem] = items.splice(sourceIndex, 1)
    items.splice(destIndex, 0, reorderedItem)

    try {
      // Supabase에서 순서 업데이트
      const updatePromises = items.map((item, index) => 
        supabase
          .from('tour_courses')
          .update({ sort_order: index })
          .eq('id', item.id)
      )

      await Promise.all(updatePromises)
      
      // 데이터 새로고침
      window.location.reload()
    } catch (error) {
      console.error('순서 변경 오류:', error)
      alert('순서 변경에 실패했습니다.')
    }
  }
  
  
  // 필터링된 투어 코스 목록 (상품 필터 제거)
  const filteredCourses = hierarchicalCourses.filter(course => {
    const matchesSearch = !searchTerm || 
      course.team_name_ko?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.team_name_en?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.customer_name_ko?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.customer_name_en?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.location?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCategory = categoryFilter === 'all' || course.category_id === categoryFilter
    const matchesDifficulty = difficultyFilter === 'all' || course.difficulty_level === difficultyFilter

    return matchesSearch && matchesCategory && matchesDifficulty
  }).sort((a, b) => {
    // 한국어 이름으로 정렬 (한글 우선, 그 다음 영어)
    const nameA = a.team_name_ko || a.name_ko || ''
    const nameB = b.team_name_ko || b.name_ko || ''
    return nameA.localeCompare(nameB, 'ko', { numeric: true })
  })


  // 새 투어 코스 생성
  const createCourse = async () => {
    if (!formData.team_name_ko.trim() || !formData.team_name_en.trim()) {
      alert('팀원용 한국어와 영어 이름을 모두 입력해주세요.')
      return
    }

    try {
      // UUID 생성
      const courseId = crypto.randomUUID()
      
      const { error } = await supabase
        .from('tour_courses')
        .insert({
          id: courseId,
          product_id: null, // 상품과 분리
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
  }

  // 편집 시작
  const startEdit = (course: TourCourse) => {
    setFormData({
      parent_id: course.parent_id || '',
      customer_name_ko: course.customer_name_ko || '',
      customer_name_en: course.customer_name_en || '',
      customer_description_ko: course.customer_description_ko || '',
      customer_description_en: course.customer_description_en || '',
      team_name_ko: course.team_name_ko || course.name_ko,
      team_name_en: course.team_name_en || course.name_en,
      team_description_ko: course.team_description_ko || course.description_ko || '',
      team_description_en: course.team_description_en || course.description_en || '',
      internal_note: course.internal_note || '',
      name_ko: course.name_ko,
      name_en: course.name_en,
      description_ko: course.description_ko || '',
      description_en: course.description_en || '',
      category: typeof course.category === 'string' ? course.category : course.category?.name_ko || '',
      category_id: course.category_id || '',
      point_name: course.point_name || '',
      location: course.location || '',
      start_latitude: course.start_latitude?.toString() || '',
      start_longitude: course.start_longitude?.toString() || '',
      end_latitude: course.end_latitude?.toString() || '',
      end_longitude: course.end_longitude?.toString() || '',
      duration_hours: course.duration_hours,
      difficulty_level: course.difficulty_level,
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
  const handleMainLocationSelect = (location: LocationData) => {
    setFormData({
      ...formData,
      point_name: location.name,
      location: location.address,
      start_latitude: location.latitude.toString(),
      start_longitude: location.longitude.toString()
    })
  }

  const handleStartLocationSelect = (location: LocationData) => {
    setFormData({
      ...formData,
      start_latitude: location.latitude.toString(),
      start_longitude: location.longitude.toString()
    })
  }

  const handleEndLocationSelect = (location: LocationData) => {
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

  if (coursesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="h-screen flex flex-col">
      {/* 헤더 */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 p-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">투어 코스 관리</h1>
              <p className="text-gray-600 mt-1">폴더 트리 형식으로 관광지를 관리하세요</p>
            </div>
            <button
              onClick={() => setShowHelpModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              title="업데이트 내용 보기"
            >
              <BookOpen className="w-4 h-4" />
              업데이트 가이드
            </button>
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
        <div className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">검색</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="관광지명, 포인트, 위치로 검색..."
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
                  {(categories || []).map((category: TourCourseCategory) => (
                    <option key={category.id} value={category.id}>
                      {category.name_ko}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1">
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
              <button
                onClick={() => setShowCategoryModal(true)}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                title="카테고리 관리"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 레이아웃 - 좌측 트리 + 우측 상세 패널 */}
      <div className="flex h-[calc(100vh-200px)] gap-6">
        {/* 좌측 폴더 트리 */}
        <div className="w-1/3 bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Folder className="w-5 h-5 text-blue-500" />
              관광지 목록
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              좌측에서 관광지를 선택하면 우측에 상세 정보가 표시됩니다
            </p>
          </div>
          
          <div className="overflow-y-auto h-[calc(100%-80px)]">
            {filteredCourses.length > 0 ? (
              <Droppable droppableId="course-list">
                {(provided) => (
                  <div 
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="p-2"
                  >
                    {filteredCourses.map((course, index) => (
                      <TreeItem
                        key={course.id}
                        course={course}
                        level={0}
                        expandedNodes={expandedNodes}
                        selectedCourseId={selectedCourse?.id}
                        onToggle={toggleNode}
                        onSelect={setSelectedCourse}
                        onEdit={startEdit}
                        onDelete={deleteCourse}
                        onPhotoModal={openPhotoModal}
                        onMoveCourse={() => {}}
                      />
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <Globe className="w-16 h-16 text-gray-300 mb-4" />
                <p className="text-gray-500 mb-2">등록된 투어 코스가 없습니다</p>
                <p className="text-sm text-gray-400">새 투어 코스를 생성해보세요</p>
              </div>
            )}
          </div>
        </div>

        {/* 우측 상세 패널 */}
        <DetailPanel
          course={selectedCourse}
          onEdit={startEdit}
          onDelete={deleteCourse}
          onPhotoModal={openPhotoModal}
          allCourses={tourCourses}
        />
      </div>


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
                    {hierarchicalCourses.map((course) => (
                      <ParentSelectionTreeItem
                        key={course.id}
                        course={course}
                        level={0}
                        expandedNodes={expandedNodes}
                        selectedParentId={formData.parent_id}
                        currentCourseId={editingCourse?.id}
                        onToggle={toggleNode}
                        onSelect={(id) => setFormData({ ...formData, parent_id: id || '' })}
                      />
                    ))}
                  </div>
                  
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    한국어 이름 *
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
                    영어 이름 *
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
                        const selectedCategory = categories.find((cat: TourCourseCategory) => cat.id === e.target.value)
                        setFormData({ 
                          ...formData, 
                          category_id: e.target.value,
                          category: selectedCategory?.name_ko || ''
                        })
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">카테고리 선택</option>
                      {(categories || []).map((category: TourCourseCategory) => (
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
                {/* 주요 업데이트 내용 */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <HelpCircle className="w-5 h-5" />
                    주요 업데이트 내용
                  </h3>
                  <ul className="space-y-2 text-blue-800">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold">•</span>
                      <span><strong>계층적 구조:</strong> 관광지를 부모-자식 관계로 관리할 수 있습니다 (예: 그랜드캐년 → 사우스림 → 마더포인트)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold">•</span>
                      <span><strong>상품 분리:</strong> 관광지는 상품과 독립적으로 관리되며, 여러 상품에서 공유할 수 있습니다</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold">•</span>
                      <span><strong>고객/팀원 분리:</strong> 고객에게 보여지는 내용과 팀원용 내용을 분리하여 관리</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold">•</span>
                      <span><strong>Google Maps 통합:</strong> 위치 정보와 Google Maps 링크 저장</span>
                    </li>
                  </ul>
                </div>

                {/* 새로운 필드 설명 */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-green-900 mb-3">새로운 필드 설명</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold text-green-800 mb-2">고객용 필드</h4>
                      <ul className="space-y-1 text-green-700 text-sm">
                        <li>• <strong>고객용 한국어 이름:</strong> 고객에게 표시되는 한국어 이름</li>
                        <li>• <strong>고객용 영어 이름:</strong> 고객에게 표시되는 영어 이름</li>
                        <li>• <strong>고객용 한국어 설명:</strong> 고객에게 표시되는 한국어 설명</li>
                        <li>• <strong>고객용 영어 설명:</strong> 고객에게 표시되는 영어 설명</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-green-800 mb-2">팀원용 필드</h4>
                      <ul className="space-y-1 text-green-700 text-sm">
                        <li>• <strong>한국어 이름:</strong> 가이드/관리자용 한국어 이름 (계층 구조의 각 레벨)</li>
                        <li>• <strong>영어 이름:</strong> 가이드/관리자용 영어 이름 (계층 구조의 각 레벨)</li>
                        <li>• <strong>한국어 설명:</strong> 가이드/관리자용 한국어 설명</li>
                        <li>• <strong>영어 설명:</strong> 가이드/관리자용 영어 설명</li>
                        <li>• <strong>내부 노트:</strong> 관리자만 볼 수 있는 내부 메모</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* 계층 구조 사용법 */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-purple-900 mb-3">계층 구조 사용법</h3>
                  <div className="space-y-4 text-purple-800">
                    <div className="bg-white rounded-lg p-3 border border-purple-200">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">1</span>
                        1단계: 최상위 관광지 생성
                      </h4>
                      <div className="ml-8 space-y-2">
                        <p className="text-sm"><strong>예시:</strong> &quot;그랜드캐년&quot;</p>
                        <div className="bg-gray-50 p-2 rounded text-xs">
                          <p><strong>부모 관광지:</strong> &quot;최상위 관광지 (부모 없음)&quot; 선택</p>
                          <p><strong>한국어 이름:</strong> &quot;그랜드캐년&quot;</p>
                          <p><strong>영어 이름:</strong> &quot;Grand Canyon&quot;</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-3 border border-purple-200">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">2</span>
                        2단계: 하위 관광지 생성
                      </h4>
                      <div className="ml-8 space-y-2">
                        <p className="text-sm"><strong>예시:</strong> &quot;사우스림&quot;</p>
                        <div className="bg-gray-50 p-2 rounded text-xs">
                          <p><strong>부모 관광지:</strong> &quot;📍 그랜드캐년&quot; 선택</p>
                          <p><strong>한국어 이름:</strong> &quot;사우스림&quot;</p>
                          <p><strong>영어 이름:</strong> &quot;South Rim&quot;</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-3 border border-purple-200">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <span className="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">3</span>
                        3단계: 세부 포인트 생성
                      </h4>
                      <div className="ml-8 space-y-2">
                        <p className="text-sm"><strong>예시:</strong> &quot;마더포인트&quot;</p>
                        <div className="bg-gray-50 p-2 rounded text-xs">
                          <p><strong>부모 관광지:</strong> &quot;  📍 사우스림&quot; 선택 (들여쓰기로 하위 표시)</p>
                          <p><strong>한국어 이름:</strong> &quot;마더포인트&quot;</p>
                          <p><strong>영어 이름:</strong> &quot;Mather Point&quot;</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <h5 className="font-semibold text-yellow-800 mb-2">💡 실제 사용 팁</h5>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      <li>• 부모 관광지 드롭다운에서 들여쓰기(📍)로 계층 구조를 시각적으로 확인할 수 있습니다</li>
                      <li>• 관광지는 상품과 독립적으로 관리되며 여러 상품에서 공유할 수 있습니다</li>
                      <li>• 생성 후에는 카드 형태로 계층 구조가 표시됩니다</li>
                      <li>• &quot;사우스림&quot; 검색 시 사우스림과 그 하위인 마더포인트, 리판포인트 등이 모두 표시됩니다</li>
                    </ul>
                  </div>
                </div>

                {/* 위치 정보 관리 */}
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-orange-900 mb-3">위치 정보 관리</h3>
                  <ul className="space-y-2 text-orange-800">
                    <li className="flex items-start gap-2">
                      <span className="text-orange-600 font-bold">•</span>
                      <span><strong>메인 위치:</strong> 관광지의 주요 위치 (위치 검색 또는 지도에서 선택 가능)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-orange-600 font-bold">•</span>
                      <span><strong>시작점/종료점:</strong> 투어 코스의 시작과 끝 지점 (선택사항)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-orange-600 font-bold">•</span>
                      <span><strong>Google Maps 연동:</strong> 저장된 위치 정보로 Google Maps 링크 자동 생성</span>
                    </li>
                  </ul>
                </div>

                {/* 사용 팁 */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">사용 팁</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start gap-2">
                      <span className="text-gray-500 font-bold">💡</span>
                      <span>관광지는 상품과 독립적으로 관리되며, 여러 상품에서 같은 관광지를 공유할 수 있습니다</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-500 font-bold">💡</span>
                      <span>계층적 구조로 인해 카드 형태로 표시되며, 하위 코스는 들여쓰기되어 표시됩니다</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-500 font-bold">💡</span>
                      <span>고객용과 팀원용 내용을 다르게 설정하여 고객에게는 친화적인 설명, 팀원에게는 상세한 정보를 제공할 수 있습니다</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-500 font-bold">💡</span>
                      <span>사진 업로드 기능으로 각 관광지의 대표 이미지를 설정할 수 있습니다</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </DragDropContext>
  )
}