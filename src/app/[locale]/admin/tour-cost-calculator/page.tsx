'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Calculator, MapPin, Car, DollarSign, Settings, Plus, X, Route, Clock, Users, Edit2, Search, ChevronRight, ChevronDown, Folder, FolderOpen, GripVertical, ArrowUp, ArrowDown } from 'lucide-react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import TourCourseEditModal from '@/components/TourCourseEditModal'

// Google Maps 타입 정의
declare global {
  interface Window {
    google: typeof google
  }
}

type Product = Database['public']['Tables']['products']['Row']
type TourCourse = Database['public']['Tables']['tour_courses']['Row'] & {
  price_type?: string | null
  price_minivan?: number | null
  price_9seater?: number | null
  price_13seater?: number | null
}

type VehicleRentalSetting = {
  id: string
  vehicle_type: 'minivan' | '9seater' | '13seater'
  daily_rental_rate: number
  mpg: number
}

type SelectedCourse = TourCourse & {
  selected: boolean
}

type MarginType = 'default' | 'low_season' | 'high_season' | 'failed_recruitment'

const MARGIN_RATES: Record<MarginType, { min: number; max: number; default: number }> = {
  default: { min: 30, max: 30, default: 30 },
  low_season: { min: 20, max: 20, default: 20 },
  high_season: { min: 40, max: 40, default: 40 },
  failed_recruitment: { min: 10, max: 20, default: 15 }
}

const TIP_RATE = 0.15 // 15%

// 트리 아이템 컴포넌트
const CourseTreeItem = ({ 
  course, 
  level = 0,
  expandedNodes,
  selectedCourses,
  onToggle,
  onSelect,
  onDeselect,
  onEdit
}: { 
  course: TourCourse
  level?: number
  expandedNodes: Set<string>
  selectedCourses: Set<string>
  onToggle: (id: string) => void
  onSelect: (course: TourCourse) => void
  onDeselect: (courseId: string) => void
  onEdit: (course: TourCourse) => void
}) => {
  const hasChildren = course.children && course.children.length > 0
  const isExpanded = expandedNodes.has(course.id)
  const isSelected = selectedCourses.has(course.id)
  
  const hasPrice = course.price_type === 'per_vehicle'
    ? (course.price_minivan || course.price_9seater || course.price_13seater)
    : (course.price_adult || course.price_child || course.price_infant)
  
  const getPriceDisplay = () => {
    if (course.price_type === 'per_vehicle') {
      const prices = []
      if (course.price_minivan) prices.push(`미니밴: $${course.price_minivan}`)
      if (course.price_9seater) prices.push(`9인승: $${course.price_9seater}`)
      if (course.price_13seater) prices.push(`13인승: $${course.price_13seater}`)
      return prices.length > 0 ? prices.join(' / ') : null
    } else {
      const prices = []
      if (course.price_adult) prices.push(`성인: $${course.price_adult}`)
      if (course.price_child) prices.push(`아동: $${course.price_child}`)
      if (course.price_infant) prices.push(`유아: $${course.price_infant}`)
      return prices.length > 0 ? prices.join(' / ') : null
    }
  }

  const priceDisplay = getPriceDisplay()

  return (
    <div>
      <div 
        className={`flex items-center gap-1.5 px-2 py-1 border rounded hover:bg-gray-50 ${
          isSelected ? 'bg-blue-50 border-blue-500' : 'border-gray-200'
        }`}
        style={{ marginLeft: `${level * 12}px` }}
      >
        {/* 확장/축소 버튼 */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggle(course.id)
            }}
            className="w-3.5 h-3.5 flex items-center justify-center text-gray-500 hover:text-gray-700 flex-shrink-0"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
        ) : (
          <div className="w-3.5 h-3.5 flex-shrink-0"></div>
        )}
        
        {/* 체크박스 */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation()
            if (isSelected) {
              onDeselect(course.id)
            } else {
              onSelect(course)
            }
          }}
          className="w-3.5 h-3.5 text-blue-600 rounded cursor-pointer flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        />
        
        {/* 폴더/파일 아이콘 */}
        <div className="flex items-center flex-shrink-0">
          {hasChildren ? (
            isExpanded ? (
              <FolderOpen className="w-3 h-3 text-blue-500" />
            ) : (
              <Folder className="w-3 h-3 text-blue-500" />
            )
          ) : (
            <MapPin className="w-3 h-3 text-gray-400" />
          )}
        </div>
        
        {/* 이름 및 정보 */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <div className="text-xs font-medium truncate">{course.name_ko || course.name_en}</div>
            {/* 위치 정보 아이콘 */}
            {(course.location || course.start_latitude || course.google_maps_url) ? (
              <MapPin className="w-3 h-3 text-green-500 flex-shrink-0" title="위치 정보 있음" />
            ) : (
              <MapPin className="w-3 h-3 text-gray-300 flex-shrink-0" title="위치 정보 없음" />
            )}
            {course.location && (
              <span className="text-xs text-gray-400 truncate">{course.location}</span>
            )}
            {priceDisplay ? (
              <span className="text-xs text-green-600 font-medium whitespace-nowrap">
                • {priceDisplay}
              </span>
            ) : (
              <span className="text-xs text-red-500 whitespace-nowrap">• 입장료 미설정</span>
            )}
          </div>
          
          {/* 편집 버튼 (하나만) */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(course)
            }}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
            title="투어 코스 편집"
          >
            <Edit2 className="w-3 h-3" />
          </button>
        </div>
      </div>
      
      {/* 하위 항목들 */}
      {hasChildren && isExpanded && (
        <div className="mt-1 space-y-1">
          {course.children!.map((child) => (
            <CourseTreeItem
              key={child.id}
              course={child}
              level={level + 1}
              expandedNodes={expandedNodes}
              selectedCourses={selectedCourses}
              onToggle={onToggle}
              onSelect={onSelect}
              onDeselect={onDeselect}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function TourCostCalculatorPage() {
  const t = useTranslations('common')
  
  // 기본 상태
  const [tourType, setTourType] = useState<'product' | 'custom'>('product')
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [products, setProducts] = useState<Product[]>([])
  const [tourCourses, setTourCourses] = useState<TourCourse[]>([])
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set())
  const [participantCount, setParticipantCount] = useState<number>(1)
  const [vehicleType, setVehicleType] = useState<'minivan' | '9seater' | '13seater'>('minivan')
  const [vehicleSettings, setVehicleSettings] = useState<VehicleRentalSetting[]>([])
  const [showVehicleSettingsModal, setShowVehicleSettingsModal] = useState(false)
  const [editingVehicleType, setEditingVehicleType] = useState<'minivan' | '9seater' | '13seater' | null>(null)
  const [gasPrice, setGasPrice] = useState<number>(0)
  const [mileage, setMileage] = useState<number | null>(null)
  const [travelTime, setTravelTime] = useState<number | null>(null) // 이동 시간 (시간 단위)
  const [totalHours, setTotalHours] = useState<number>(0)
  const [guideHourlyRate, setGuideHourlyRate] = useState<number>(0)
  const [guideFee, setGuideFee] = useState<number | null>(null)
  const [marginType, setMarginType] = useState<MarginType>('default')
  const [customMarginRate, setCustomMarginRate] = useState<number>(30)
  const [showCourseEditModal, setShowCourseEditModal] = useState(false)
  const [editingCourse, setEditingCourse] = useState<TourCourse | null>(null)
  const [courseSearchTerm, setCourseSearchTerm] = useState<string>('')
  const [expandedCourseNodes, setExpandedCourseNodes] = useState<Set<string>>(new Set())
  const [selectedCoursesOrder, setSelectedCoursesOrder] = useState<string[]>([])
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false)
  const [savedConfigurations, setSavedConfigurations] = useState<Array<{ name: string; selectedCourses: string[]; order: string[] }>>([])
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveConfigName, setSaveConfigName] = useState('')
  const [showLoadModal, setShowLoadModal] = useState(false)

  // 데이터 로드
  useEffect(() => {
    loadProducts()
    loadVehicleSettings()
  }, [])

  // 상품별 투어 코스 로드
  useEffect(() => {
    if (tourType === 'product' && selectedProductId) {
      // 모든 투어 코스를 불러오고, 선택된 상품의 코스를 미리 선택
      loadAllTourCourses()
      loadProductSelectedCourses(selectedProductId)
    } else if (tourType === 'custom') {
      loadAllTourCourses()
      // 맞춤 투어로 전환 시 선택 초기화
      setSelectedCourses(new Set())
    }
  }, [tourType, selectedProductId])

  // 참가 인원에 따라 차량 타입 자동 선택
  useEffect(() => {
    if (participantCount >= 1 && participantCount <= 5) {
      setVehicleType('minivan')
    } else if (participantCount >= 6 && participantCount <= 9) {
      setVehicleType('9seater')
    } else if (participantCount >= 10) {
      setVehicleType('13seater')
    }
  }, [participantCount])

  // 선택된 코스 순서 동기화 (가장 하위 포인트만 표시)
  useEffect(() => {
    const selectedArray = Array.from(selectedCourses)
    
    if (selectedArray.length === 0) {
      setSelectedCoursesOrder([])
      return
    }

    // 선택된 코스의 자식 중 선택된 것이 있는지 확인
    const hasSelectedChild = (courseId: string): boolean => {
      const course = tourCourses.find(c => c.id === courseId)
      if (!course) return false
      
      // 직접 자식 확인
      const directChildren = tourCourses.filter(c => c.parent_id === courseId)
      const hasDirectSelectedChild = directChildren.some(child => selectedCourses.has(child.id))
      if (hasDirectSelectedChild) return true
      
      // 간접 자식 확인 (재귀)
      return directChildren.some(child => hasSelectedChild(child.id))
    }

    // 가장 하위 포인트만 필터링 (자식이 선택되어 있지 않은 항목만)
    const leafCourses = selectedArray.filter(courseId => {
      return !hasSelectedChild(courseId)
    })

    // 부모-자식 관계를 고려하여 정렬
    const sortedCourses = leafCourses.sort((a, b) => {
      const courseA = tourCourses.find(c => c.id === a)
      const courseB = tourCourses.find(c => c.id === b)
      
      if (!courseA || !courseB) return 0
      
      // 같은 부모를 가진 경우 기존 순서 유지
      if (courseA.parent_id === courseB.parent_id) {
        return 0
      }
      
      return 0
    })

    // 기존 순서에서 유지할 수 있는 것들은 유지하고, 새로 추가된 것들은 뒤에 추가
    setSelectedCoursesOrder(prev => {
      const newOrder = prev.filter(id => leafCourses.includes(id))
      const newItems = sortedCourses.filter(id => !prev.includes(id))
      return [...newOrder, ...newItems]
    })
  }, [selectedCourses, tourCourses])

  // 모든 상위 부모를 찾는 함수
  const getAllParentIds = (courseId: string, visited = new Set<string>()): string[] => {
    if (visited.has(courseId)) return [] // 순환 참조 방지
    visited.add(courseId)
    
    const course = tourCourses.find(c => c.id === courseId)
    if (!course || !course.parent_id) return []
    
    const parents = [course.parent_id]
    const grandParents = getAllParentIds(course.parent_id, visited)
    return [...parents, ...grandParents]
  }

  // 선택된 코스의 모든 하위 자식을 찾는 함수
  const getAllChildIds = (courseId: string): string[] => {
    const children: string[] = []
    const findChildren = (parentId: string) => {
      const directChildren = tourCourses.filter(c => c.parent_id === parentId)
      directChildren.forEach(child => {
        children.push(child.id)
        findChildren(child.id) // 재귀적으로 모든 하위 자식 찾기
      })
    }
    findChildren(courseId)
    return children
  }

  // 드래그 앤 드롭 핸들러 (가장 하위 포인트만 이동)
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return

    const items = Array.from(selectedCoursesOrder)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    setSelectedCoursesOrder(items)
  }

  // 순서 변경 함수 (위/아래 버튼용) - 가장 하위 포인트만 이동
  const moveCourse = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...selectedCoursesOrder]
    if (direction === 'up' && index > 0) {
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]
    } else if (direction === 'down' && index < newOrder.length - 1) {
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
    }
    setSelectedCoursesOrder(newOrder)
  }

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'active')
        .order('name_ko', { ascending: true })

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('상품 로드 오류:', error)
    }
  }

  const loadAllTourCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('tour_courses')
        .select('*')
        .eq('is_active', true)
        .order('name_ko', { ascending: true })

      if (error) throw error
      setTourCourses(data || [])
    } catch (error) {
      console.error('투어 코스 로드 오류:', error)
    }
  }

  // 상품에 연결된 투어 코스 ID 목록 가져오기 (선택 상태 설정용)
  const loadProductSelectedCourses = async (productId: string) => {
    try {
      const { data, error } = await supabase
        .from('product_tour_courses')
        .select('tour_course_id')
        .eq('product_id', productId)

      if (error) throw error

      const selectedIds = new Set(data?.map(item => item.tour_course_id) || [])
      setSelectedCourses(selectedIds)
    } catch (error) {
      console.error('상품 투어 코스 선택 상태 로드 오류:', error)
    }
  }

  const loadVehicleSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicle_rental_settings')
        .select('*')
        .order('vehicle_type', { ascending: true })

      if (error) throw error
      setVehicleSettings(data || [])
    } catch (error) {
      console.error('차량 설정 로드 오류:', error)
    }
  }

  // 계층적 구조 빌드 함수
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

  // 필터링된 투어 코스 목록 (평면)
  const filteredTourCoursesFlat = useMemo(() => {
    if (!courseSearchTerm) return tourCourses
    
    const searchLower = courseSearchTerm.toLowerCase()
    return tourCourses.filter(course => 
      course.name_ko?.toLowerCase().includes(searchLower) ||
      course.name_en?.toLowerCase().includes(searchLower) ||
      course.location?.toLowerCase().includes(searchLower)
    )
  }, [tourCourses, courseSearchTerm])

  // 계층적 구조로 변환
  const hierarchicalCourses = useMemo(() => {
    const coursesToUse = courseSearchTerm ? filteredTourCoursesFlat : tourCourses
    return buildHierarchy(coursesToUse)
  }, [tourCourses, filteredTourCoursesFlat, courseSearchTerm])

  // 기본적으로 모든 노드는 축소된 상태로 시작 (확장 버튼을 눌러야만 보임)

  // 트리 노드 토글 함수
  const toggleCourseNode = (nodeId: string) => {
    const newExpanded = new Set(expandedCourseNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedCourseNodes(newExpanded)
  }

  // 입장료 계산
  const entranceFees = useMemo(() => {
    let total = 0
    // 모든 투어 코스에서 선택된 것들 찾기 (평면 리스트에서)
    const selected = tourCourses.filter(course => selectedCourses.has(course.id))

    selected.forEach(course => {
      if (course.price_type === 'per_vehicle') {
        // 차량별 가격
        if (vehicleType === 'minivan' && course.price_minivan) {
          total += course.price_minivan
        } else if (vehicleType === '9seater' && course.price_9seater) {
          total += course.price_9seater
        } else if (vehicleType === '13seater' && course.price_13seater) {
          total += course.price_13seater
        }
      } else {
        // 인원별 가격 (기본)
        if (course.price_adult) {
          total += course.price_adult * participantCount
        }
        // 아동/유아 가격은 별도 입력 필요하므로 여기서는 성인 기준만 계산
      }
    })

    return total
  }, [selectedCourses, tourCourses, vehicleType, participantCount])

  // 차량 렌트비
  const vehicleRentalCost = useMemo(() => {
    const setting = vehicleSettings.find(s => s.vehicle_type === vehicleType)
    return setting?.daily_rental_rate || 0
  }, [vehicleSettings, vehicleType])

  // 주유비 계산
  const fuelCost = useMemo(() => {
    if (!mileage || mileage <= 0) return 0
    const setting = vehicleSettings.find(s => s.vehicle_type === vehicleType)
    if (!setting || !setting.mpg || setting.mpg <= 0) return 0
    const gallons = mileage / setting.mpg
    return gallons * gasPrice
  }, [mileage, vehicleSettings, vehicleType, gasPrice])

  // 가이드비 계산
  const calculatedGuideFee = useMemo(() => {
    if (guideFee !== null) return guideFee
    return totalHours * guideHourlyRate
  }, [guideFee, totalHours, guideHourlyRate])

  // 총 실비
  const totalCost = useMemo(() => {
    return entranceFees + vehicleRentalCost + fuelCost + calculatedGuideFee
  }, [entranceFees, vehicleRentalCost, fuelCost, calculatedGuideFee])

  // 팁 계산
  const tipAmount = useMemo(() => {
    return totalCost * TIP_RATE
  }, [totalCost])

  // 마진율
  const marginRate = useMemo(() => {
    if (marginType === 'failed_recruitment') {
      return customMarginRate
    }
    return MARGIN_RATES[marginType].default
  }, [marginType, customMarginRate])

  // 판매가 (팁 제외)
  const sellingPrice = useMemo(() => {
    return totalCost / (1 - marginRate / 100)
  }, [totalCost, marginRate])

  // 팁 포함 판매가
  const sellingPriceWithTip = useMemo(() => {
    return sellingPrice + tipAmount
  }, [sellingPrice, tipAmount])

  // 마진 금액
  const marginAmount = useMemo(() => {
    return sellingPrice - totalCost
  }, [sellingPrice, totalCost])

  // 차량 설정 저장
  const saveVehicleSetting = async (type: 'minivan' | '9seater' | '13seater', dailyRate: number, mpg: number) => {
    try {
      const { error } = await supabase
        .from('vehicle_rental_settings')
        .upsert({
          vehicle_type: type,
          daily_rental_rate: dailyRate,
          mpg: mpg
        }, {
          onConflict: 'vehicle_type'
        })

      if (error) throw error
      await loadVehicleSettings()
      setShowVehicleSettingsModal(false)
      setEditingVehicleType(null)
    } catch (error) {
      console.error('차량 설정 저장 오류:', error)
      alert('차량 설정 저장 중 오류가 발생했습니다.')
    }
  }

  // 총 소요시간 자동 계산 (투어 코스 duration_hours 합산)
  useEffect(() => {
    if (selectedCourses.size > 0) {
      const selected = tourCourses.filter(course => selectedCourses.has(course.id))
      const totalDuration = selected.reduce((sum, course) => sum + (course.duration_hours || 0), 0)
      if (totalDuration > 0) {
        setTotalHours(totalDuration)
      }
    }
  }, [selectedCourses, tourCourses])

  // 경로 계산 (구글맵) - 선택된 순서대로, 마지막에서 첫 번째로 돌아오는 순환 경로
  const calculateRoute = async () => {
    setIsCalculatingRoute(true)
    
    try {
      // 선택된 순서대로 코스 가져오기
      const selected = selectedCoursesOrder
        .map(courseId => tourCourses.find(c => c.id === courseId))
        .filter(Boolean) as TourCourse[]
      
      const coursesWithLocation = selected.filter(course => 
        (course.start_latitude && course.start_longitude) || course.google_maps_url
      )

      if (coursesWithLocation.length < 2) {
        alert('경로를 계산하려면 최소 2개 이상의 투어 코스가 필요하며, 각 코스에 위치 정보가 있어야 합니다.')
        setIsCalculatingRoute(false)
        return
      }

      // 구글맵 Directions API를 사용한 경로 계산
      if (typeof window === 'undefined' || !window.google || !window.google.maps) {
        alert('Google Maps API가 로드되지 않았습니다. 페이지를 새로고침해주세요.')
        setIsCalculatingRoute(false)
        return
      }

      const waypoints = coursesWithLocation.map(course => {
        if (course.start_latitude && course.start_longitude) {
          return {
            lat: course.start_latitude,
            lng: course.start_longitude
          }
        }
        return null
      }).filter(Boolean) as { lat: number; lng: number }[]

      if (waypoints.length < 2) {
        alert('위치 정보가 충분하지 않습니다. 각 투어 코스에 위도/경도 정보가 필요합니다.')
        setIsCalculatingRoute(false)
        return
      }

      const service = new window.google.maps.DirectionsService()
      
      // 순환 경로: 첫 번째 지점에서 시작해서 마지막 지점까지 가고, 다시 첫 번째 지점으로 돌아옴
      const origin = waypoints[0]
      const destination = waypoints[0] // 첫 번째 지점으로 돌아옴
      const intermediateWaypoints = waypoints.slice(1).map(wp => ({ location: wp }))

      const request: google.maps.DirectionsRequest = {
        origin: origin,
        destination: destination,
        waypoints: intermediateWaypoints,
        travelMode: window.google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false // 순서를 유지하기 위해 최적화 비활성화
      }

      service.route(request, (result, status) => {
        setIsCalculatingRoute(false)
        
        if (status === 'OK' && result && result.routes && result.routes.length > 0) {
          let totalDistance = 0
          let totalDuration = 0

          result.routes[0].legs.forEach(leg => {
            if (leg.distance) {
              totalDistance += leg.distance.value / 1609.34 // 미터를 마일로 변환
            }
            if (leg.duration) {
              totalDuration += leg.duration.value / 3600 // 초를 시간으로 변환
            }
          })

          setMileage(Math.round(totalDistance * 10) / 10)
          // 이동 시간 저장 (시간 단위)
          setTravelTime(Math.round(totalDuration * 10) / 10)
          // 경로 계산 시 이동 시간도 업데이트 (기존 duration_hours 합산에 이동 시간 추가)
          const courseDuration = selected.reduce((sum, course) => sum + (course.duration_hours || 0), 0)
          setTotalHours(Math.round((courseDuration + totalDuration) * 10) / 10)
          
          console.log('경로 계산 완료:', {
            totalDistance: Math.round(totalDistance * 10) / 10,
            totalDuration: Math.round(totalDuration * 10) / 10,
            waypoints: waypoints.length
          })
        } else {
          console.error('경로 계산 실패:', status, result)
          let errorMessage = '경로 계산에 실패했습니다.'
          if (status === 'ZERO_RESULTS') {
            errorMessage = '경로를 찾을 수 없습니다. 위치 정보를 확인해주세요.'
          } else if (status === 'NOT_FOUND') {
            errorMessage = '출발지 또는 목적지를 찾을 수 없습니다.'
          } else if (status === 'REQUEST_DENIED') {
            errorMessage = 'Google Maps API 요청이 거부되었습니다. API 키를 확인해주세요.'
          }
          alert(`${errorMessage}\n마일리지를 수동으로 입력해주세요.`)
        }
      })
    } catch (error) {
      setIsCalculatingRoute(false)
      console.error('경로 계산 오류:', error)
      alert('경로 계산 중 오류가 발생했습니다. 마일리지를 수동으로 입력해주세요.')
    }
  }

  // 저장된 템플릿 불러오기
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 새로운 키로 먼저 시도
      let saved = localStorage.getItem('tour_cost_calculator_templates')
      
      // 기존 키로 마이그레이션 (하위 호환성)
      if (!saved) {
        const oldSaved = localStorage.getItem('tour_cost_calculator_configs')
        if (oldSaved) {
          saved = oldSaved
          localStorage.setItem('tour_cost_calculator_templates', saved)
          localStorage.removeItem('tour_cost_calculator_configs')
        }
      }
      
      if (saved) {
        try {
          const configs = JSON.parse(saved)
          setSavedConfigurations(configs)
        } catch (error) {
          console.error('저장된 템플릿 불러오기 실패:', error)
        }
      }
    }
  }, [])

  // 템플릿 저장
  const saveConfiguration = () => {
    if (!saveConfigName.trim()) {
      alert('템플릿 제목을 입력해주세요.')
      return
    }

    // 중복 이름 확인
    const duplicateIndex = savedConfigurations.findIndex(c => c.name === saveConfigName.trim())
    if (duplicateIndex !== -1) {
      if (!confirm(`"${saveConfigName.trim()}" 템플릿이 이미 존재합니다. 덮어쓰시겠습니까?`)) {
        return
      }
      // 덮어쓰기
      const updatedConfigs = [...savedConfigurations]
      updatedConfigs[duplicateIndex] = {
        name: saveConfigName.trim(),
        selectedCourses: Array.from(selectedCourses),
        order: selectedCoursesOrder,
        savedAt: new Date().toISOString()
      }
      setSavedConfigurations(updatedConfigs)
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('tour_cost_calculator_templates', JSON.stringify(updatedConfigs))
      }
    } else {
      // 새로 저장
      const config = {
        name: saveConfigName.trim(),
        selectedCourses: Array.from(selectedCourses),
        order: selectedCoursesOrder,
        savedAt: new Date().toISOString()
      }

      const updatedConfigs = [...savedConfigurations, config]
      setSavedConfigurations(updatedConfigs)
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('tour_cost_calculator_templates', JSON.stringify(updatedConfigs))
      }
    }

    setSaveConfigName('')
    setShowSaveModal(false)
    alert('템플릿이 저장되었습니다.')
  }

  // 템플릿 불러오기
  const loadConfiguration = (config: { name: string; selectedCourses: string[]; order: string[] }) => {
    setSelectedCourses(new Set(config.selectedCourses))
    setSelectedCoursesOrder(config.order)
    setShowLoadModal(false)
    alert(`"${config.name}" 템플릿을 불러왔습니다.`)
  }

  // 템플릿 삭제
  const deleteConfiguration = (index: number) => {
    const configName = savedConfigurations[index].name
    if (confirm(`"${configName}" 템플릿을 삭제하시겠습니까?`)) {
      const updatedConfigs = savedConfigurations.filter((_, i) => i !== index)
      setSavedConfigurations(updatedConfigs)
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('tour_cost_calculator_templates', JSON.stringify(updatedConfigs))
      }
      alert('템플릿이 삭제되었습니다.')
    }
  }

  // Google Maps API 로드
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.google) {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      if (apiKey) {
        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&loading=async`
        script.async = true
        script.defer = true
        document.head.appendChild(script)
      }
    }
  }, [])

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Calculator className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">투어 비용 계산기</h1>
        </div>
        <p className="text-gray-600">단독/맞춤 투어의 스케줄 및 비용을 계산합니다.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 입력 섹션 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 투어 타입 선택 */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4">1. 투어 타입 선택</h2>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setTourType('product')
                  setSelectedCourses(new Set())
                }}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                  tourType === 'product'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                투어 상품 선택
              </button>
              <button
                onClick={() => {
                  setTourType('custom')
                  setSelectedProductId('')
                  setSelectedCourses(new Set())
                }}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                  tourType === 'custom'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                맞춤 투어
              </button>
            </div>

            {tourType === 'product' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  투어 상품
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">상품을 선택하세요</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name_ko || product.name_en}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 투어 코스 선택 */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">2. 투어 코스 선택</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowLoadModal(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  disabled={savedConfigurations.length === 0}
                  title="저장된 템플릿 불러오기"
                >
                  <Search className="w-4 h-4" />
                  템플릿 불러오기
                </button>
                <button
                  onClick={() => {
                    if (selectedCourses.size === 0) {
                      alert('저장할 투어 코스가 없습니다.')
                      return
                    }
                    setShowSaveModal(true)
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                  disabled={selectedCourses.size === 0}
                  title="현재 선택된 코스를 템플릿으로 저장"
                >
                  <Settings className="w-4 h-4" />
                  템플릿 저장
                </button>
                <button
                  onClick={() => {
                    setEditingCourse(null)
                    setShowCourseEditModal(true)
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  새로 추가
                </button>
              </div>
            </div>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="투어 코스 검색..."
                  value={courseSearchTerm}
                  onChange={(e) => setCourseSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {hierarchicalCourses.length > 0 ? (
                hierarchicalCourses.map((course) => (
                  <CourseTreeItem
                    key={course.id}
                    course={course}
                    level={0}
                    expandedNodes={expandedCourseNodes}
                    selectedCourses={selectedCourses}
                    onToggle={toggleCourseNode}
                    onSelect={(course) => {
                      const newSet = new Set(selectedCourses)
                      newSet.add(course.id)
                      
                      // 하위 포인트를 선택하면 모든 상위 부모도 자동 선택
                      const parentIds = getAllParentIds(course.id)
                      parentIds.forEach(parentId => {
                        newSet.add(parentId)
                      })
                      
                      setSelectedCourses(newSet)
                    }}
                    onDeselect={(courseId) => {
                      const newSet = new Set(selectedCourses)
                      newSet.delete(courseId)
                      
                      // 상위 카테고리를 해제하면 하위 자식들도 모두 해제
                      const childIds = getAllChildIds(courseId)
                      childIds.forEach(childId => {
                        newSet.delete(childId)
                      })
                      
                      setSelectedCourses(newSet)
                    }}
                    onEdit={(course) => {
                      setEditingCourse(course)
                      setShowCourseEditModal(true)
                    }}
                  />
                ))
              ) : (
                <div className="text-center text-gray-500 py-8">
                  {tourType === 'product' && !selectedProductId
                    ? '상품을 선택해주세요'
                    : courseSearchTerm
                    ? '검색 결과가 없습니다'
                    : '투어 코스가 없습니다'}
                </div>
              )}
            </div>
          </div>

          {/* 선택된 투어 코스 순서 */}
          {selectedCourses.size > 0 && selectedCoursesOrder.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-semibold mb-4">선택된 투어 코스 순서</h2>
              <p className="text-sm text-gray-500 mb-4">드래그하거나 위/아래 버튼으로 순서를 조정하세요</p>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="selected-courses">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-2"
                    >
                      {selectedCoursesOrder.map((courseId, index) => {
                        const course = tourCourses.find(c => c.id === courseId)
                        if (!course) return null

                        // 부모 경로를 찾는 함수
                        const getParentPath = (courseId: string, visited = new Set<string>()): string[] => {
                          if (visited.has(courseId)) return [] // 순환 참조 방지
                          visited.add(courseId)
                          
                          const currentCourse = tourCourses.find(c => c.id === courseId)
                          if (!currentCourse || !currentCourse.parent_id) return []
                          
                          // 부모가 선택되어 있는지 확인
                          if (selectedCourses.has(currentCourse.parent_id)) {
                            const parent = tourCourses.find(c => c.id === currentCourse.parent_id)
                            if (parent) {
                              const parentPath = getParentPath(currentCourse.parent_id, visited)
                              return [...parentPath, currentCourse.parent_id]
                            }
                          }
                          return []
                        }

                        // 부모 경로 가져오기
                        const parentIds = getParentPath(courseId)
                        const parentNames = parentIds.map(id => {
                          const parentCourse = tourCourses.find(c => c.id === id)
                          return parentCourse ? (parentCourse.name_ko || parentCourse.name_en) : ''
                        }).filter(Boolean)
                        
                        // 전체 경로 텍스트 생성
                        const fullPath = [...parentNames, course.name_ko || course.name_en].join(' > ')

                        return (
                          <Draggable key={courseId} draggableId={courseId} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`flex items-center gap-2 p-2 border rounded-lg bg-white cursor-move ${
                                  snapshot.isDragging ? 'shadow-lg border-blue-500 opacity-50' : 'border-gray-200 hover:border-gray-300'
                                }`}
                                style={provided.draggableProps.style}
                              >
                                {/* 드래그 핸들 */}
                                <div
                                  className="text-gray-400 hover:text-gray-600 flex-shrink-0 pointer-events-none"
                                >
                                  <GripVertical className="w-4 h-4" />
                                </div>

                                {/* 순서 번호 */}
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-semibold text-xs">
                                  {index + 1}
                                </div>

                                {/* 코스 정보 */}
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate" title={fullPath}>
                                    {fullPath}
                                  </div>
                                  {course.location && (
                                    <div className="text-xs text-gray-500 truncate">
                                      {course.location}
                                    </div>
                                  )}
                                </div>

                                {/* 위/아래 버튼 */}
                                <div 
                                  className="flex flex-col gap-0.5"
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      moveCourse(index, 'up')
                                    }}
                                    onMouseDown={(e) => {
                                      e.stopPropagation()
                                      e.preventDefault()
                                    }}
                                    disabled={index === 0}
                                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                    title="위로 이동"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      moveCourse(index, 'down')
                                    }}
                                    onMouseDown={(e) => {
                                      e.stopPropagation()
                                      e.preventDefault()
                                    }}
                                    disabled={index === selectedCoursesOrder.length - 1}
                                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                    title="아래로 이동"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                </div>

                                {/* 제거 버튼 */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const newSet = new Set(selectedCourses)
                                    newSet.delete(courseId)
                                    setSelectedCourses(newSet)
                                  }}
                                  onMouseDown={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                  }}
                                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                  title="제거"
                                >
                                  <X className="w-4 h-4" />
                                </button>
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
            </div>
          )}

          {/* 경로 및 마일리지 */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4">3. 경로 및 마일리지</h2>
            <div className="flex gap-4">
              <button
                onClick={calculateRoute}
                disabled={selectedCourses.size < 2 || isCalculatingRoute || selectedCoursesOrder.length < 2}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isCalculatingRoute ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    계산 중...
                  </>
                ) : (
                  <>
                    <Route className="w-4 h-4" />
                    경로 자동 계산
                  </>
                )}
              </button>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  마일리지 (마일)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={mileage || ''}
                  onChange={(e) => setMileage(e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="직접 입력 또는 자동 계산"
                />
              </div>
            </div>
            {travelTime !== null && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">이동 시간 총합:</span>
                  <span className="text-sm font-semibold text-blue-700">
                    {travelTime.toFixed(1)} 시간
                  </span>
                  {travelTime >= 1 && (
                    <span className="text-xs text-blue-600">
                      ({Math.floor(travelTime)}시간 {Math.round((travelTime % 1) * 60)}분)
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 인원 및 차량 정보 */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4">4. 인원 및 차량 정보</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  참가 인원
                </label>
                <input
                  type="number"
                  min="1"
                  value={participantCount}
                  onChange={(e) => setParticipantCount(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  차량 타입
                  <span className="ml-2 text-xs text-gray-500 font-normal">
                    (인원에 따라 자동 선택)
                  </span>
                </label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value as 'minivan' | '9seater' | '13seater')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="minivan">미니밴 (1~5인)</option>
                  <option value="9seater">9인승 (6~9인)</option>
                  <option value="13seater">13인승 (10인 이상)</option>
                </select>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  계산된 주유비
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-medium text-gray-900">
                  ${fuelCost.toFixed(2)}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  차량: {vehicleType === 'minivan' ? '미니밴' : vehicleType === '9seater' ? '9인승' : '13인승'} | 
                  MPG: {vehicleSettings.find(s => s.vehicle_type === vehicleType)?.mpg || 0} | 
                  마일리지: {mileage || 0} 마일
                </div>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => setShowVehicleSettingsModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
                >
                  <Settings className="w-4 h-4" />
                  차량 렌트비 설정
                </button>
              </div>
            </div>
          </div>

          {/* 가이드비 */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4">5. 가이드비</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  총 소요 시간 (시간)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={totalHours}
                  onChange={(e) => setTotalHours(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  시급 (USD/시간)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={guideHourlyRate}
                  onChange={(e) => setGuideHourlyRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                또는 가이드비 직접 입력 (USD)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={guideFee || ''}
                onChange={(e) => setGuideFee(e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="직접 입력 시 시급 계산 무시"
              />
            </div>
            <div className="mt-2 text-sm text-gray-500">
              계산된 가이드비: ${calculatedGuideFee.toFixed(2)}
            </div>
          </div>

          {/* 마진율 설정 */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4">6. 마진율 설정</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  마진율 타입
                </label>
                <select
                  value={marginType}
                  onChange={(e) => {
                    setMarginType(e.target.value as MarginType)
                    if (e.target.value !== 'failed_recruitment') {
                      setCustomMarginRate(MARGIN_RATES[e.target.value as MarginType].default)
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="default">기본 (30%)</option>
                  <option value="low_season">비수기 (20%)</option>
                  <option value="high_season">성수기 (40%)</option>
                  <option value="failed_recruitment">동행모집 실패 (10-20%)</option>
                </select>
              </div>
              {marginType === 'failed_recruitment' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    마진율 (10-20%)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="20"
                    step="0.1"
                    value={customMarginRate}
                    onChange={(e) => setCustomMarginRate(parseFloat(e.target.value) || 15)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 오른쪽: 계산 결과 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border p-6 sticky top-6">
            <h2 className="text-xl font-semibold mb-4">비용 계산 결과</h2>
            
            <div className="space-y-4">
              <div className="border-b pb-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">입장료 합계</span>
                  <span className="font-medium">${entranceFees.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">차량 렌트비</span>
                  <span className="font-medium">${vehicleRentalCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">주유비</span>
                  <span className="font-medium">${fuelCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">가이드비</span>
                  <span className="font-medium">${calculatedGuideFee.toFixed(2)}</span>
                </div>
              </div>

              <div className="border-b pb-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>총 실비</span>
                  <span className="text-blue-600">${totalCost.toFixed(2)}</span>
                </div>
              </div>

              <div className="border-b pb-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">마진율</span>
                  <span className="font-medium">{marginRate}%</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">판매가 (팁 제외)</span>
                  <span className="font-medium">${sellingPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">팁 (15%)</span>
                  <span className="font-medium">${tipAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>팁 포함 판매가</span>
                  <span className="text-green-600">${sellingPriceWithTip.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-lg font-bold">
                  <span>마진</span>
                  <span className="text-purple-600">${marginAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 템플릿 저장 모달 */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-semibold mb-4">템플릿 저장</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                템플릿 제목 *
              </label>
              <input
                type="text"
                value={saveConfigName}
                onChange={(e) => setSaveConfigName(e.target.value)}
                placeholder="예: 그랜드캐년 투어, 라스베가스 시내 투어"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    saveConfiguration()
                  }
                }}
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                템플릿 제목을 입력하여 현재 선택된 투어 코스와 순서를 저장합니다.
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="text-sm text-blue-900">
                <div className="font-medium mb-1">저장할 내용:</div>
                <div className="text-blue-700">
                  • 선택된 코스: <span className="font-semibold">{selectedCourses.size}개</span>
                </div>
                <div className="text-blue-700">
                  • 순서: <span className="font-semibold">{selectedCoursesOrder.length}개</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveConfiguration}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                템플릿 저장
              </button>
              <button
                onClick={() => {
                  setShowSaveModal(false)
                  setSaveConfigName('')
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 템플릿 불러오기 모달 */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-semibold mb-4">템플릿 불러오기</h3>
            {savedConfigurations.length === 0 ? (
              <div className="text-center py-8">
                <Settings className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">저장된 템플릿이 없습니다.</p>
                <p className="text-sm text-gray-400 mt-2">
                  템플릿 저장 버튼을 눌러 템플릿을 만들어보세요.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
                {savedConfigurations.map((config, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{config.name}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        코스 {config.selectedCourses.length}개 • 순서 {config.order.length}개
                      </div>
                      {config.savedAt && (
                        <div className="text-xs text-gray-400 mt-1">
                          {new Date(config.savedAt).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 ml-3">
                      <button
                        onClick={() => loadConfiguration(config)}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap"
                        title="템플릿 불러오기"
                      >
                        불러오기
                      </button>
                      <button
                        onClick={() => deleteConfiguration(index)}
                        className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm whitespace-nowrap"
                        title="템플릿 삭제"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowLoadModal(false)}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 차량 렌트비 설정 모달 */}
      {showVehicleSettingsModal && (
        <VehicleSettingsModal
          isOpen={showVehicleSettingsModal}
          onClose={() => {
            setShowVehicleSettingsModal(false)
            setEditingVehicleType(null)
          }}
          vehicleSettings={vehicleSettings}
          onSave={saveVehicleSetting}
          gasPrice={gasPrice}
          onGasPriceChange={setGasPrice}
        />
      )}

      {/* 투어 코스 수정 모달 */}
      <TourCourseEditModal
        isOpen={showCourseEditModal}
        onClose={() => {
          setShowCourseEditModal(false)
          setEditingCourse(null)
        }}
        course={editingCourse}
        onSave={async (updatedCourse) => {
          // 투어 코스 목록 새로고침
          await loadAllTourCourses()
          // 상품 선택 모드인 경우 선택 상태도 다시 로드
          if (tourType === 'product' && selectedProductId) {
            await loadProductSelectedCourses(selectedProductId)
          }
          setShowCourseEditModal(false)
          setEditingCourse(null)
        }}
      />
    </div>
  )
}

// 차량 렌트비 설정 모달 컴포넌트
function VehicleSettingsModal({
  isOpen,
  onClose,
  vehicleSettings,
  onSave,
  gasPrice,
  onGasPriceChange
}: {
  isOpen: boolean
  onClose: () => void
  vehicleSettings: VehicleRentalSetting[]
  onSave: (type: 'minivan' | '9seater' | '13seater', dailyRate: number, mpg: number) => Promise<void>
  gasPrice: number
  onGasPriceChange: (price: number) => void
}) {
  const [editingType, setEditingType] = useState<'minivan' | '9seater' | '13seater' | null>(null)
  const [dailyRate, setDailyRate] = useState<number>(0)
  const [mpg, setMpg] = useState<number>(0)

  useEffect(() => {
    if (editingType) {
      const setting = vehicleSettings.find(s => s.vehicle_type === editingType)
      if (setting) {
        setDailyRate(setting.daily_rental_rate)
        setMpg(setting.mpg)
      } else {
        setDailyRate(0)
        setMpg(0)
      }
    }
  }, [editingType, vehicleSettings])

  if (!isOpen) return null

  const vehicleTypes: Array<{ type: 'minivan' | '9seater' | '13seater'; label: string }> = [
    { type: 'minivan', label: '미니밴' },
    { type: '9seater', label: '9인승' },
    { type: '13seater', label: '13인승' }
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">차량 렌트비 설정</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          {/* 현재 기름값 입력 */}
          <div className="border rounded-lg p-4 bg-blue-50">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              현재 기름값 (갤런당 USD)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={gasPrice}
              onChange={(e) => onGasPriceChange(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
          </div>

          {vehicleTypes.map(({ type, label }) => {
            const setting = vehicleSettings.find(s => s.vehicle_type === type)
            const isEditing = editingType === type

            return (
              <div key={type} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{label}</h4>
                  {!isEditing && (
                    <button
                      onClick={() => setEditingType(type)}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      편집
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        일일 평균 렌트비 (USD)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={dailyRate}
                        onChange={(e) => setDailyRate(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        MPG (Miles Per Gallon)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={mpg}
                        onChange={(e) => setMpg(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onSave(type, dailyRate, mpg)}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => {
                          setEditingType(null)
                          const setting = vehicleSettings.find(s => s.vehicle_type === type)
                          if (setting) {
                            setDailyRate(setting.daily_rental_rate)
                            setMpg(setting.mpg)
                          }
                        }}
                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-600">
                    <div>일일 렌트비: ${setting?.daily_rental_rate.toFixed(2) || '0.00'}</div>
                    <div>MPG: {setting?.mpg.toFixed(2) || '0.00'}</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
