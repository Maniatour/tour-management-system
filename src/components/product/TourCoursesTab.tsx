'use client'

import React, { useState, useEffect } from 'react'
import { MapPin, Search, Check, X, Plus, Folder, FolderOpen, ChevronRight, ChevronDown, Edit } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface TourCourse {
  id: string
  name_ko: string
  name_en: string
  team_name_ko?: string
  team_name_en?: string
  customer_name_ko?: string
  customer_name_en?: string
  location?: string
  category?: string
  is_active: boolean
  parent_id?: string
  children?: TourCourse[]
  level?: number
}

interface TourCoursesTabProps {
  productId: string
  isNewProduct: boolean
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
          isSelected ? 'bg-blue-50 border-l-2 border-blue-500' : ''
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
          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
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
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingCourse, setEditingCourse] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState<{
    team_name_ko: string
    team_name_en: string
    customer_name_ko: string
    customer_name_en: string
    location: string
    category: string
  }>({
    team_name_ko: '',
    team_name_en: '',
    customer_name_ko: '',
    customer_name_en: '',
    location: '',
    category: ''
  })

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

  // 상품에 연결된 투어 코스 로드
  useEffect(() => {
    if (isNewProduct) return

    const loadProductTourCourses = async () => {
      try {
        const { data, error } = await supabase
          .from('product_tour_courses')
          .select('tour_course_id')
          .eq('product_id', productId)

        if (error) throw error

        const selectedIds = new Set(data?.map(item => item.tour_course_id) || [])
        setSelectedCourses(selectedIds)
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
  }

  // 투어 코스 편집 시작
  const handleStartEdit = (course: TourCourse) => {
    setEditingCourse(course.id)
    setEditFormData({
      team_name_ko: course.team_name_ko || course.name_ko || '',
      team_name_en: course.team_name_en || course.name_en || '',
      customer_name_ko: course.customer_name_ko || '',
      customer_name_en: course.customer_name_en || '',
      location: course.location || '',
      category: course.category || ''
    })
  }

  // 투어 코스 편집 취소
  const handleCancelEdit = () => {
    setEditingCourse(null)
    setEditFormData({
      team_name_ko: '',
      team_name_en: '',
      customer_name_ko: '',
      customer_name_en: '',
      location: '',
      category: ''
    })
  }

  // 투어 코스 편집 저장
  const handleSaveEdit = async (courseId: string) => {
    try {
      const { error } = await supabase
        .from('tour_courses')
        .update({
          team_name_ko: editFormData.team_name_ko,
          team_name_en: editFormData.team_name_en,
          customer_name_ko: editFormData.customer_name_ko,
          customer_name_en: editFormData.customer_name_en,
          location: editFormData.location,
          category: editFormData.category,
          // 기존 필드도 업데이트 (하위 호환성)
          name_ko: editFormData.team_name_ko,
          name_en: editFormData.team_name_en
        })
        .eq('id', courseId)

      if (error) throw error

      // 로컬 상태 업데이트
      setTourCourses(prev => prev.map(course => 
        course.id === courseId 
          ? {
              ...course,
              team_name_ko: editFormData.team_name_ko,
              team_name_en: editFormData.team_name_en,
              customer_name_ko: editFormData.customer_name_ko,
              customer_name_en: editFormData.customer_name_en,
              location: editFormData.location,
              category: editFormData.category,
              name_ko: editFormData.team_name_ko,
              name_en: editFormData.team_name_en
            }
          : course
      ))

      setEditingCourse(null)
      alert('투어 코스가 성공적으로 수정되었습니다.')
    } catch (error) {
      console.error('투어 코스 수정 오류:', error)
      alert('투어 코스 수정 중 오류가 발생했습니다.')
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

      // 새로운 연결 추가
      if (selectedCourses.size > 0) {
        const insertData = Array.from(selectedCourses).map(courseId => ({
          product_id: productId,
          tour_course_id: courseId
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
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">투어 코스 선택</h3>
        <p className="text-gray-600 mb-4">
          이 상품에 포함될 투어 코스를 선택하세요. 다중 선택이 가능합니다.
        </p>
      </div>

      {/* 선택된 코스 수 표시 및 액션 버튼 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-blue-800">
            선택된 투어 코스: {selectedCourses.size}개
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm"
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
            <span className="text-xs text-blue-600">
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
                <Folder className="w-4 h-4 text-blue-500" />
                투어 코스 목록
              </h4>
              
              {/* 검색 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="투어 코스 검색..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            </div>
            
            <div className="h-[500px] overflow-y-auto">
              {selectedCourses.size > 0 ? (
                <div className="p-4 space-y-3">
                  {Array.from(selectedCourses).map(courseId => {
                    const course = tourCourses.find(c => c.id === courseId)
                    if (!course) return null
                    
                    const isEditing = editingCourse === courseId
                    
                    return (
                      <div key={courseId} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        {isEditing ? (
                          // 편집 모드
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h5 className="text-sm font-medium text-gray-900">투어 코스 편집</h5>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleSaveEdit(courseId)}
                                  className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                                >
                                  저장
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                                >
                                  취소
                                </button>
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">팀원용 한국어 이름</label>
                                <input
                                  type="text"
                                  value={editFormData.team_name_ko}
                                  onChange={(e) => setEditFormData(prev => ({ ...prev, team_name_ko: e.target.value }))}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">팀원용 영어 이름</label>
                                <input
                                  type="text"
                                  value={editFormData.team_name_en}
                                  onChange={(e) => setEditFormData(prev => ({ ...prev, team_name_en: e.target.value }))}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">고객용 한국어 이름</label>
                                <input
                                  type="text"
                                  value={editFormData.customer_name_ko}
                                  onChange={(e) => setEditFormData(prev => ({ ...prev, customer_name_ko: e.target.value }))}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">고객용 영어 이름</label>
                                <input
                                  type="text"
                                  value={editFormData.customer_name_en}
                                  onChange={(e) => setEditFormData(prev => ({ ...prev, customer_name_en: e.target.value }))}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">위치</label>
                                <input
                                  type="text"
                                  value={editFormData.location}
                                  onChange={(e) => setEditFormData(prev => ({ ...prev, location: e.target.value }))}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">카테고리</label>
                                <input
                                  type="text"
                                  value={editFormData.category}
                                  onChange={(e) => setEditFormData(prev => ({ ...prev, category: e.target.value }))}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          // 보기 모드
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">
                                {course.team_name_ko || course.name_ko}
                              </div>
                              {course.team_name_en && course.team_name_en !== course.team_name_ko && (
                                <div className="text-xs text-gray-500 truncate">
                                  {course.team_name_en}
                                </div>
                              )}
                              {course.customer_name_ko && (
                                <div className="text-xs text-blue-600 truncate mt-1">
                                  고객용: {course.customer_name_ko}
                                </div>
                              )}
                              {course.customer_name_en && (
                                <div className="text-xs text-blue-500 truncate">
                                  고객용(EN): {course.customer_name_en}
                                </div>
                              )}
                              {course.location && (
                                <div className="text-xs text-gray-400 truncate flex items-center gap-1 mt-1">
                                  <MapPin className="w-3 h-3" />
                                  {course.location}
                                </div>
                              )}
                              {course.category && (
                                <div className="text-xs text-blue-600 mt-1">
                                  카테고리: {course.category}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleStartEdit(course)}
                                className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"
                                title="편집"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeselectCourse(courseId)}
                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                                title="선택 해제"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <Check className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="text-gray-500 text-sm">선택된 투어 코스가 없습니다</p>
                  <p className="text-xs text-gray-400">좌측 목록에서 투어 코스를 선택해주세요</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
