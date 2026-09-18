'use client'
import { BROWSER_AUTOFILL_OFF_PROPS } from '@/lib/browserAutofill'

import { useState, useEffect, type ComponentProps } from 'react'
import { MapPin, Search, Check, X, Folder, FolderOpen, ChevronRight, ChevronDown, Edit, ArrowUp, ArrowDown, GripVertical } from 'lucide-react'
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import TourCourseEditModal from '@/components/TourCourseEditModal'
import ProductTourCourseReportRoleToggle from '@/components/product/ProductTourCourseReportRoleToggle'
import ProductTourCourseCustomerHint from '@/components/product/ProductTourCourseCustomerHint'
import { parseReportStopRole, type ReportStopRole } from '@/lib/tourReportStopRoles'
import PanelHeightResizeHandle, { clampPanelHeight } from '@/components/ui/PanelHeightResizeHandle'

const SELECTED_LIST_HEIGHT_KEY = 'kovegas.product-tour-courses.selected-list-height'
const DEFAULT_SELECTED_LIST_HEIGHT = 500

type TourCourse = Database['public']['Tables']['tour_courses']['Row'] & {
  parent?: TourCourse
  children?: TourCourse[]
}

interface TourCoursesTabProps {
  productId: string
  isNewProduct: boolean
}

function isTourPointCategoryLabel(category: string | null | undefined): boolean {
  const value = (category || '').trim().toLowerCase()
  return value.includes('투어 포인트') || value.includes('tour point')
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

// 트리 아이템 컴포넌트
const TreeItem = ({ 
  course, 
  level = 0,
  expandedNodes,
  selectedCourses,
  onToggle,
  onSelect,
  onDeselect
}: { 
  course: TourCourse
  level?: number
  expandedNodes: Set<string>
  selectedCourses: Set<string>
  onToggle: (id: string) => void
  onSelect: (course: TourCourse) => void
  onDeselect: (courseId: string) => void
}) => {
  const hasChildren = course.children && course.children.length > 0
  const isExpanded = expandedNodes.has(course.id)
  const isSelected = selectedCourses.has(course.id)
  const indentClass = level > 0 ? `ml-${level * 4}` : ''

  return (
    <div className={`${indentClass}`}>
      <div 
        className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 group ${
          isSelected ? 'bg-primary/5 border-l-2 border-primary' : ''
        }`}
        onClick={() => {
          if (isSelected) {
            onDeselect(course.id)
          } else {
            onSelect(course)
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
        
        {/* 체크박스 */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {
            if (isSelected) {
              onDeselect(course.id)
            } else {
              onSelect(course)
            }
          }}
          className="w-4 h-4 text-primary rounded focus:ring-ring"
        />
        
        {/* 폴더/파일 아이콘 */}
        <div className="flex items-center gap-1">
          {hasChildren ? (
            isExpanded ? (
              <FolderOpen className="w-4 h-4 text-primary" />
            ) : (
              <Folder className="w-4 h-4 text-primary" />
            )
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
          {course.location && (
            <div className="text-xs text-gray-400 truncate flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {course.location}
            </div>
          )}
        </div>
        
        {/* 상태 표시 */}
        <div className="flex items-center gap-1">
          {!course.is_active && (
            <div className="w-2 h-2 bg-red-400 rounded-full" title="비활성"></div>
          )}
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
              selectedCourses={selectedCourses}
              onToggle={onToggle}
              onSelect={onSelect}
              onDeselect={onDeselect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function TourCoursesTab({ productId, isNewProduct }: TourCoursesTabProps) {
  const [tourCourses, setTourCourses] = useState<TourCourse[]>([])
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set())
  const [selectedCoursesOrder, setSelectedCoursesOrder] = useState<string[]>([])
  const [reportStopRoles, setReportStopRoles] = useState<Record<string, ReportStopRole>>({})
  const [selectedListHeight, setSelectedListHeight] = useState(DEFAULT_SELECTED_LIST_HEIGHT)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [modalCourse, setModalCourse] = useState<TourCourse | null>(null)

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
      } finally {
        setLoading(false)
      }
    }

    loadTourCourses()
  }, [])

  useEffect(() => {
    try {
      const stored = Number(localStorage.getItem(SELECTED_LIST_HEIGHT_KEY))
      if (Number.isFinite(stored) && stored > 0) {
        setSelectedListHeight(clampPanelHeight(stored))
      }
    } catch {
      // ignore
    }
  }, [])

  const handleSelectedListHeightChange = (next: number) => {
    const height = clampPanelHeight(next)
    setSelectedListHeight(height)
    try {
      localStorage.setItem(SELECTED_LIST_HEIGHT_KEY, String(height))
    } catch {
      // ignore
    }
  }

  // 상품에 연결된 투어 코스 로드
  useEffect(() => {
    if (isNewProduct) return

    const loadProductTourCourses = async () => {
      try {
        let { data, error } = await supabase
          .from('product_tour_courses')
          .select('tour_course_id, order, report_stop_role')
          .eq('product_id', productId)
          .order('order', { ascending: true })

        if (error) {
          const fallback = await supabase
            .from('product_tour_courses')
            .select('tour_course_id, order')
            .eq('product_id', productId)
            .order('order', { ascending: true })
          if (fallback.error) throw error
          data = fallback.data as typeof data
          error = null
        }

        if (error) throw error

        const selectedIds = new Set(data?.map(item => item.tour_course_id) || [])
        const order = data?.map(item => item.tour_course_id) || []
        const roles: Record<string, ReportStopRole> = {}
        for (const item of data ?? []) {
          const role = parseReportStopRole(
            (item as { report_stop_role?: unknown }).report_stop_role
          )
          if (role) roles[item.tour_course_id] = role
        }
        setSelectedCourses(selectedIds)
        setSelectedCoursesOrder(order)
        setReportStopRoles(roles)
      } catch (error) {
        console.error('상품 투어 코스 로드 오류:', error)
      }
    }

    loadProductTourCourses()
  }, [productId, isNewProduct])

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

  // 선택된 코스 순서 동기화
  useEffect(() => {
    const selectedArray = Array.from(selectedCourses)
    
    if (selectedArray.length === 0) {
      setSelectedCoursesOrder([])
      return
    }

    // 기존 순서에서 유지할 수 있는 것들은 유지하고, 새로 추가된 것들은 뒤에 추가
    setSelectedCoursesOrder(prev => {
      const newOrder = prev.filter(id => selectedCourses.has(id))
      const newItems = selectedArray.filter(id => !prev.includes(id))
      return [...newOrder, ...newItems]
    })
  }, [selectedCourses])

  // 투어 코스 선택
  const handleSelectCourse = (course: TourCourse) => {
    const newSelected = new Set(selectedCourses)
    newSelected.add(course.id)
    setSelectedCourses(newSelected)
  }

  // 투어 코스 선택 해제
  const handleDeselectCourse = (courseId: string) => {
    const newSelected = new Set(selectedCourses)
    newSelected.delete(courseId)
    setSelectedCourses(newSelected)
    setSelectedCoursesOrder(prev => prev.filter(id => id !== courseId))
    setReportStopRoles(prev => {
      if (!(courseId in prev)) return prev
      const next = { ...prev }
      delete next[courseId]
      return next
    })
  }

  // 전체 선택/해제
  const handleSelectAll = () => {
    const courses = buildHierarchy(tourCourses)
    const allIds = new Set<string>()
    const collectAllIds = (courseList: TourCourse[]) => {
      courseList.forEach(course => {
        allIds.add(course.id)
        if (course.children && course.children.length > 0) {
          collectAllIds(course.children)
        }
      })
    }
    collectAllIds(courses)
    setSelectedCourses(allIds)
  }

  const handleDeselectAll = () => {
    setSelectedCourses(new Set())
    setSelectedCoursesOrder([])
    setReportStopRoles({})
  }

  const handleReportStopRoleChange = (courseId: string, role: ReportStopRole | null) => {
    setReportStopRoles((prev) => {
      if (!role) {
        if (!(courseId in prev)) return prev
        const next = { ...prev }
        delete next[courseId]
        return next
      }
      if (prev[courseId] === role) return prev
      return { ...prev, [courseId]: role }
    })
  }

  // 순서 변경 함수들
  const moveCourseUp = (index: number) => {
    if (index === 0) return
    const newOrder = [...selectedCoursesOrder]
    const temp = newOrder[index]
    newOrder[index] = newOrder[index - 1]
    newOrder[index - 1] = temp
    setSelectedCoursesOrder(newOrder)
  }

  const moveCourseDown = (index: number) => {
    if (index === selectedCoursesOrder.length - 1) return
    const newOrder = [...selectedCoursesOrder]
    const temp = newOrder[index]
    newOrder[index] = newOrder[index + 1]
    newOrder[index + 1] = temp
    setSelectedCoursesOrder(newOrder)
  }

  const handleSelectedCoursesDragEnd = (result: DropResult) => {
    if (!result.destination) return
    if (result.destination.index === result.source.index) return
    const next = [...selectedCoursesOrder]
    const [moved] = next.splice(result.source.index, 1)
    if (!moved) return
    next.splice(result.destination.index, 0, moved)
    setSelectedCoursesOrder(next)
  }

  // 투어 코스 편집 모달 열기
  const handleOpenEditModal = (course: TourCourse) => {
    setModalCourse(course)
    setShowEditModal(true)
  }

  // 투어 코스 편집 모달 닫기
  const handleCloseEditModal = () => {
    setShowEditModal(false)
    setModalCourse(null)
  }

  // 투어 코스 편집 저장
  const handleSaveCourse = async (updatedCourse: TourCourse) => {
    // 데이터베이스에서 최신 데이터 다시 로드하여 계층 구조 반영
    try {
      const { data, error } = await supabase
        .from('tour_courses')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error

      if (data) {
        setTourCourses(data)
      }
    } catch (error) {
      console.error('투어 코스 목록 새로고침 오류:', error)
      // 오류 발생 시 로컬 상태만 업데이트
      setTourCourses(prev => prev.map(course => 
        course.id === updatedCourse.id ? updatedCourse : course
      ))
    }
    
    // 선택된 코스 목록도 업데이트
    if (selectedCourses.has(updatedCourse.id)) {
      // 선택된 코스가 업데이트된 경우, 선택 상태는 유지
    }
  }

  // 선택된 투어 코스 저장
  const handleSave = async () => {
    if (isNewProduct) {
      alert('상품을 먼저 저장한 후 투어 코스를 선택할 수 있습니다.')
      return
    }

    setSaving(true)
    try {
      // 기존 연결 삭제
      const { error: deleteError } = await supabase
        .from('product_tour_courses')
        .delete()
        .eq('product_id', productId)

      if (deleteError) throw deleteError

      // 새로운 연결 추가 (순서 정보 포함)
      if (selectedCoursesOrder.length > 0) {
        const insertData = selectedCoursesOrder.map((courseId, index) => ({
          product_id: productId,
          tour_course_id: courseId,
          order: index,
          report_stop_role: reportStopRoles[courseId] ?? null,
        }))

        const { error: insertError } = await supabase
          .from('product_tour_courses')
          .insert(insertData)

        if (insertError) throw insertError
      }

      alert('투어 코스가 성공적으로 저장되었습니다.')
    } catch (error) {
      console.error('투어 코스 저장 오류:', error)
      alert('투어 코스 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 필터링된 투어 코스 목록
  const filteredCourses = buildHierarchy(tourCourses).filter(course => {
    const matchesSearch = !searchTerm || 
      course.team_name_ko?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.team_name_en?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.customer_name_ko?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.customer_name_en?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.location?.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesSearch
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">투어 코스 선택</h3>
        <p className="text-gray-600 mb-4">
          이 상품에 포함될 투어 코스를 선택하세요. 다중 선택이 가능합니다.
          가이드 리포트용 필수·대체 포인트는 오른쪽 목록에서 따로 지정합니다. 대체 포인트는 고객 코스에는 보이지 않습니다.
        </p>
      </div>

      {/* 선택된 코스 수 표시 및 액션 버튼 */}
      <div className="bg-muted/50 border border-border rounded-lg p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-primary">
            선택된 투어 코스: {selectedCourses.size}개
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className="px-3 py-1 bg-primary/10 text-primary rounded-lg hover:bg-blue-200 text-sm"
            >
              전체 선택
            </button>
            <button
              onClick={handleDeselectAll}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
            >
              전체 해제
            </button>
            <button
              onClick={handleSave}
              disabled={saving || isNewProduct}
              className="px-4 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
          {isNewProduct && (
            <span className="text-xs text-primary">
              상품 저장 후 투어 코스를 선택할 수 있습니다
            </span>
          )}
        </div>
      </div>

      {/* 메인 레이아웃 - 좌측 목록, 우측 선택된 코스 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 좌측: 투어 코스 목록 */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2 mb-3">
                <Folder className="w-4 h-4 text-primary" />
                투어 코스 목록
              </h4>
              
              {/* 검색 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input {...BROWSER_AUTOFILL_OFF_PROPS} type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="투어 코스 검색..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="h-[500px] overflow-y-auto">
              {filteredCourses.length > 0 ? (
                <div className="p-2">
                  {filteredCourses.map((course) => (
                    <TreeItem
                      key={course.id}
                      course={course}
                      level={0}
                      expandedNodes={expandedNodes}
                      selectedCourses={selectedCourses}
                      onToggle={toggleNode}
                      onSelect={handleSelectCourse}
                      onDeselect={handleDeselectCourse}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <MapPin className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="text-gray-500 text-sm">등록된 투어 코스가 없습니다</p>
                  <p className="text-xs text-gray-400">투어 코스 관리에서 먼저 코스를 등록해주세요</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 우측: 선택된 투어 코스 */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                선택된 투어 코스 ({selectedCourses.size}개)
              </h4>
              <p className="mt-1 text-xs text-muted-foreground">
                필수 {Object.values(reportStopRoles).filter((role) => role === 'required').length} ·
                대체 {Object.values(reportStopRoles).filter((role) => role === 'alternate').length}
                {' '}· 드래그해서 순서를 바꿀 수 있습니다.
              </p>
            </div>
            
            <div className="overflow-y-auto" style={{ height: selectedListHeight }}>
              {selectedCoursesOrder.length > 0 ? (
                <DragDropContext onDragEnd={handleSelectedCoursesDragEnd}>
                  <Droppable droppableId="selected-tour-courses">
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="flex flex-col gap-3 p-4"
                      >
                        {selectedCoursesOrder.map((courseId, index) => {
                          const course = tourCourses.find((c) => c.id === courseId)
                          return (
                            <Draggable key={courseId} draggableId={courseId} index={index}>
                              {(dragProvided, snapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  style={dragProvided.draggableProps.style as React.CSSProperties | undefined}
                                  className={`rounded-lg border border-gray-200 bg-gray-50 p-3 ${
                                    snapshot.isDragging ? 'shadow-lg ring-2 ring-primary/30' : ''
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex min-w-0 flex-1 items-start gap-2">
                                      <div
                                        className="flex shrink-0 cursor-grab items-center gap-1 pt-0.5 text-gray-400 active:cursor-grabbing"
                                        {...dragProvided.dragHandleProps}
                                        aria-label="드래그해서 순서 변경"
                                        title="드래그해서 순서 변경"
                                      >
                                        <GripVertical className="h-4 w-4" aria-hidden />
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                          {index + 1}
                                        </div>
                                      </div>

                                      <div className="min-w-0 flex-1">
                                        <div className="flex min-w-0 items-center gap-1.5">
                                          <div className="truncate text-sm font-medium text-gray-900">
                                            {course?.team_name_ko || course?.name_ko || courseId}
                                          </div>
                                          {isTourPointCategoryLabel(course?.category) && (
                                            <span className="shrink-0 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold leading-none text-white shadow-sm">
                                              투어 포인트
                                            </span>
                                          )}
                                          <ProductTourCourseCustomerHint
                                            customerNameKo={course?.customer_name_ko ?? null}
                                            customerNameEn={course?.customer_name_en ?? null}
                                          />
                                        </div>
                                        {course?.team_name_en && course.team_name_en !== course.team_name_ko && (
                                          <div className="truncate text-xs text-gray-500">
                                            {course.team_name_en}
                                          </div>
                                        )}
                                        {course?.location && (
                                          <div className="mt-1 flex items-center gap-1 truncate text-xs text-gray-400">
                                            <MapPin className="h-3 w-3" />
                                            {course.location}
                                          </div>
                                        )}
                                        <ProductTourCourseReportRoleToggle
                                          value={reportStopRoles[courseId] ?? null}
                                          onChange={(role) => handleReportStopRoleChange(courseId, role)}
                                        />
                                      </div>
                                    </div>

                                    <div className="flex shrink-0 items-center gap-1">
                                      <div className="mr-1 flex flex-col gap-1">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            moveCourseUp(index)
                                          }}
                                          disabled={index === 0}
                                          className="rounded p-1 text-gray-400 hover:bg-muted/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
                                          title="위로 이동"
                                        >
                                          <ArrowUp className="h-3 w-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            moveCourseDown(index)
                                          }}
                                          disabled={index === selectedCoursesOrder.length - 1}
                                          className="rounded p-1 text-gray-400 hover:bg-muted/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
                                          title="아래로 이동"
                                        >
                                          <ArrowDown className="h-3 w-3" />
                                        </button>
                                      </div>

                                      {course ? (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenEditModal(course)}
                                          className="rounded p-1 text-gray-400 hover:bg-muted/50 hover:text-primary"
                                          title="편집"
                                        >
                                          <Edit className="h-4 w-4" />
                                        </button>
                                      ) : null}
                                      <button
                                        type="button"
                                        onClick={() => handleDeselectCourse(courseId)}
                                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                                        title="선택 해제"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          )
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <Check className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="text-gray-500 text-sm">선택된 투어 코스가 없습니다</p>
                  <p className="text-xs text-gray-400">좌측 목록에서 투어 코스를 선택해주세요</p>
                </div>
              )}
            </div>
            <PanelHeightResizeHandle
              height={selectedListHeight}
              onHeightChange={handleSelectedListHeightChange}
              label="선택된 투어 코스 목록 높이 조절"
            />
          </div>
        </div>
      </div>

      {/* 투어 코스 편집 모달 */}
      <TourCourseEditModal
        isOpen={showEditModal}
        onClose={handleCloseEditModal}
        course={modalCourse as ComponentProps<typeof TourCourseEditModal>['course']}
        onSave={handleSaveCourse as unknown as ComponentProps<typeof TourCourseEditModal>['onSave']}
      />
    </div>
  )
}
