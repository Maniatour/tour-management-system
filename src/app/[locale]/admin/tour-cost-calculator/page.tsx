'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { Calculator, Settings, Plus, X, Route, Clock, Search, GripVertical, ArrowUp, ArrowDown, Save, RefreshCw, FileText, Receipt, ExternalLink, Trash2, MapPin } from 'lucide-react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import TourCourseEditModal from '@/components/TourCourseEditModal'
import EstimateModal from '@/components/tour-cost-calculator/EstimateModal'
import CourseTreeItem from '@/components/tour-cost-calculator/CourseTreeItem'
import VehicleSettingsModal from '@/components/tour-cost-calculator/VehicleSettingsModal'
import SaveConfigModal from '@/components/tour-cost-calculator/SaveConfigModal'
import LoadConfigModal from '@/components/tour-cost-calculator/LoadConfigModal'
import TemplateSaveModal from '@/components/tour-cost-calculator/TemplateSaveModal'
import TemplateLoadModal from '@/components/tour-cost-calculator/TemplateLoadModal'
import DaySelectModal from '@/components/tour-cost-calculator/DaySelectModal'
import EntranceFeeDetailModal from '@/components/tour-cost-calculator/EntranceFeeDetailModal'
import InvoiceModal from '@/components/customer/InvoiceModal'
import type { VehicleRentalSetting } from '@/components/tour-cost-calculator/VehicleSettingsModal'

// Google Maps 타입 정의 - 다른 파일의 타입 선언과 충돌을 피하기 위해 any 사용

type Product = Database['public']['Tables']['products']['Row']
type TourCourse = Database['public']['Tables']['tour_courses']['Row'] & {
  price_type?: string | null
  price_minivan?: number | null
  price_9seater?: number | null
  price_13seater?: number | null
  children?: TourCourse[]
  parent?: TourCourse
  level?: number
  photos?: Array<{
    id: string
    photo_url: string | null
    thumbnail_url: string | null
    is_primary: boolean | null
  }> | null
}

type MarginType = 'default' | 'low_season' | 'high_season' | 'failed_recruitment'

const MARGIN_RATES: Record<MarginType, { min: number; max: number; default: number }> = {
  default: { min: 30, max: 30, default: 30 },
  low_season: { min: 20, max: 20, default: 20 },
  high_season: { min: 40, max: 40, default: 40 },
  failed_recruitment: { min: 10, max: 20, default: 15 }
}

const TIP_RATE = 0.15 // 15%


export default function TourCostCalculatorPage() {
  const locale = useLocale()
  const t = useTranslations('tourCostCalculator')
  const searchParams = useSearchParams()
  
  // 기본 상태
  const [tourType, setTourType] = useState<'product' | 'custom' | 'charter_guide'>('product')
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [products, setProducts] = useState<Product[]>([])
  const [tourCourses, setTourCourses] = useState<TourCourse[]>([])
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set())
  const [participantCount, setParticipantCount] = useState<number>(1)
  const [vehicleType, setVehicleType] = useState<string>('minivan')
  const [vehicleSettings, setVehicleSettings] = useState<VehicleRentalSetting[]>([])
  const [showVehicleSettingsModal, setShowVehicleSettingsModal] = useState(false)
  const [_editingVehicleType, setEditingVehicleType] = useState<'minivan' | '9seater' | '13seater' | null>(null)
  const [gasPrice, setGasPrice] = useState<number>(4.00)
  const [manualFuelCost, setManualFuelCost] = useState<number | null>(null)
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
  type CourseScheduleItem = {
    id: string
    day?: string
    time?: string
    duration?: number // 분 단위
  }

  const [selectedCoursesOrder, setSelectedCoursesOrder] = useState<CourseScheduleItem[]>([])
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false)
  const [travelTimes, setTravelTimes] = useState<number[]>([]) // 각 구간별 이동 시간 (초 단위)
  const [map, setMap] = useState<any>(null)
  const [directionsRenderer, setDirectionsRenderer] = useState<any>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<any[]>([])
  
  type Template = {
    id?: string
    name: string
    selectedCourses: string[]
    order: CourseScheduleItem[]
    savedAt?: string
    created_at?: string
    updated_at?: string
  }
  
  const [savedConfigurations, setSavedConfigurations] = useState<Template[]>([])
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveConfigName, setSaveConfigName] = useState('')
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [showDaySelectModal, setShowDaySelectModal] = useState(false)
  const [editingDayIndex, setEditingDayIndex] = useState<number | null>(null)
  const [showEntranceFeeDetailModal, setShowEntranceFeeDetailModal] = useState(false)
  const [showEstimateModal, setShowEstimateModal] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [tourCourseDescription, setTourCourseDescription] = useState('')
  const [scheduleDescription, setScheduleDescription] = useState('')
  const [estimateCustomer, setEstimateCustomer] = useState<{ id?: string; name: string; email: string; phone?: string | null } | null>(null)
  
  // 고객 정보 및 설정 저장
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string; email: string; phone: string | null } | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [allCustomers, setAllCustomers] = useState<Array<{id: string, name: string, email: string, phone: string | null}>>([])
  const [savedConfigs, setSavedConfigs] = useState<Array<{id: string, name: string, customer_id: string | null, created_at: string}>>([])
  const [showSaveConfigModal, setShowSaveConfigModal] = useState(false)
  const [showLoadConfigModal, setShowLoadConfigModal] = useState(false)
  const [configName, setConfigName] = useState('')
  const [currentConfigId, setCurrentConfigId] = useState<string | null>(null)
  const [pendingConfigRestore, setPendingConfigRestore] = useState<{
    selectedCourses: string[]
    courseOrder: CourseScheduleItem[]
  } | null>(null)
  const customerSearchRef = useRef<HTMLDivElement>(null)
  
  // 고객 문서 목록 상태
  const [customerDocuments, setCustomerDocuments] = useState<{invoices: any[], estimates: any[]}>({ invoices: [], estimates: [] })
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  
  // 기타 금액 타입
  type OtherExpense = {
    id: string
    name: string
    amount: number
  }
  const [otherExpenses, setOtherExpenses] = useState<OtherExpense[]>([])
  
  // 호텔 숙박인지 확인하는 함수
  const isHotelAccommodation = (course: TourCourse | undefined): boolean => {
    if (!course) return false
    const category = course.category?.toLowerCase() || ''
    const name = (course.name_ko || course.name_en || '').toLowerCase()
    return category.includes('숙박') || 
           category.includes('hotel') || 
           category.includes('accommodation') ||
           name.includes('호텔') ||
           name.includes('hotel') ||
           name.includes('숙박')
  }

  // 입장료 상세 내역
  type EntranceFeeDetail = {
    courseName: string
    priceType: string
    unitPrice: number
    quantity: number
    total: number
  }
  
  const entranceFeeDetails = useMemo(() => {
    const details: EntranceFeeDetail[] = []
    // 호텔 숙박 제외
    const selected = tourCourses.filter(course => selectedCourses.has(course.id) && !isHotelAccommodation(course))
    
    selected.forEach(course => {
      if (course.price_type === 'per_vehicle') {
        let price = 0
        let priceType = ''
        if (vehicleType === 'minivan' && course.price_minivan) {
          price = course.price_minivan
          priceType = '미니밴'
        } else if (vehicleType === '9seater' && course.price_9seater) {
          price = course.price_9seater
          priceType = '9인승'
        } else if (vehicleType === '13seater' && course.price_13seater) {
          price = course.price_13seater
          priceType = '13인승'
        }
        if (price > 0) {
          details.push({
            courseName: course.name_ko || course.name_en,
            priceType: `차량별 (${priceType})`,
            unitPrice: price,
            quantity: 1,
            total: price
          })
        }
      } else {
        // 인원별 가격
        if (course.price_adult) {
          details.push({
            courseName: course.name_ko || course.name_en,
            priceType: '인원별 (성인)',
            unitPrice: course.price_adult,
            quantity: participantCount,
            total: course.price_adult * participantCount
          })
        }
        // 아동/유아 가격은 별도 입력 필요하므로 여기서는 성인 기준만 계산
      }
    })
    
    return details
  }, [selectedCourses, tourCourses, vehicleType, participantCount])

  // 호텔 숙박비 상세 내역
  const hotelAccommodationDetails = useMemo(() => {
    const details: EntranceFeeDetail[] = []
    // 호텔 숙박만
    const selected = tourCourses.filter(course => selectedCourses.has(course.id) && isHotelAccommodation(course))
    
    selected.forEach(course => {
      if (course.price_type === 'per_vehicle') {
        let price = 0
        let priceType = ''
        if (vehicleType === 'minivan' && course.price_minivan) {
          price = course.price_minivan
          priceType = '미니밴'
        } else if (vehicleType === '9seater' && course.price_9seater) {
          price = course.price_9seater
          priceType = '9인승'
        } else if (vehicleType === '13seater' && course.price_13seater) {
          price = course.price_13seater
          priceType = '13인승'
        }
        if (price > 0) {
          details.push({
            courseName: course.name_ko || course.name_en,
            priceType: `차량별 (${priceType})`,
            unitPrice: price,
            quantity: 1,
            total: price
          })
        }
      } else {
        // 인원별 가격
        if (course.price_adult) {
          details.push({
            courseName: course.name_ko || course.name_en,
            priceType: '인원별 (성인)',
            unitPrice: course.price_adult,
            quantity: participantCount,
            total: course.price_adult * participantCount
          })
        }
      }
    })
    
    return details
  }, [selectedCourses, tourCourses, vehicleType, participantCount])

  // 데이터 로드
  useEffect(() => {
    loadProducts()
    loadVehicleSettings()
  }, [])

  // 차량 목록 변경 시 선택값이 목록에 없으면 첫 번째로 맞춤
  useEffect(() => {
    if (vehicleSettings.length > 0 && !vehicleSettings.some(s => s.vehicle_type === vehicleType)) {
      setVehicleType(vehicleSettings[0].vehicle_type)
    }
  }, [vehicleSettings, vehicleType])

  // 상품별 투어 코스 로드
  useEffect(() => {
    if (tourType === 'product' && selectedProductId) {
      // 모든 투어 코스를 불러오고, 선택된 상품의 코스를 미리 선택
      loadAllTourCourses()
      loadProductSelectedCourses(selectedProductId)
    } else if (tourType === 'custom' || tourType === 'charter_guide') {
      loadAllTourCourses()
      // 맞춤 투어/차량 대절 전담 가이드로 전환 시 선택 초기화
      if (tourType === 'custom') setSelectedCourses(new Set())
    }
  }, [tourType, selectedProductId])

  // 설정 복원: 코스 데이터가 로드된 후 선택된 코스와 순서 복원
  useEffect(() => {
    if (pendingConfigRestore && tourCourses.length > 0) {
      // 코스 데이터가 로드된 후에만 복원
      // selectedCourses를 먼저 설정
      setSelectedCourses(new Set(pendingConfigRestore.selectedCourses))
      
      // courseOrder를 즉시 복원 (동기화 useEffect가 pendingConfigRestore를 체크하므로 실행되지 않음)
      setSelectedCoursesOrder(pendingConfigRestore.courseOrder)
      
      // 복원 완료 후 pendingConfigRestore 초기화 (다음 렌더링 사이클에서)
      setTimeout(() => {
        setPendingConfigRestore(null)
      }, 100)
    }
  }, [pendingConfigRestore, tourCourses])

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
    // 설정 복원 중이면 동기화하지 않음
    if (pendingConfigRestore) return
    
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
      // 혹시라도 prev에 문자열이 섞여있을 경우를 대비해 정규화
      const normalizedPrev = prev.map((item: any) => {
        if (typeof item === 'string') {
          const course = tourCourses.find(c => c.id === item)
          return {
            id: item,
            duration: course?.duration_hours || 0, // 분 단위
            day: '',
            time: ''
          }
        }
        return item
      })

      const newOrder = normalizedPrev.filter(item => leafCourses.includes(item.id))
      const newItems = sortedCourses
        .filter(id => !normalizedPrev.some(item => item.id === id))
        .map(id => {
          const course = tourCourses.find(c => c.id === id)
          return {
            id,
            duration: course?.duration_hours || 0, // 분 단위
            day: '',
            time: ''
          }
        })
      const finalOrder = [...newOrder, ...newItems]
      
      // 선택된 코드가 없으면 지도 경로 초기화
      if (finalOrder.length === 0 && directionsRenderer) {
        directionsRenderer.setDirections({ routes: [] } as any)
      }
      
      return finalOrder
    })
  }, [selectedCourses, tourCourses, directionsRenderer, pendingConfigRestore])

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

  // 일정 항목 정보 업데이트 함수
  const updateScheduleItem = (index: number, updates: Partial<CourseScheduleItem>) => {
    setSelectedCoursesOrder(prev => {
      const newOrder = [...prev]
      newOrder[index] = { ...newOrder[index], ...updates }
      return newOrder
    })
  }

  // 일정 시간 자동 계산 함수
  const autoCalculateTimes = () => {
    if (selectedCoursesOrder.length === 0) return
    
    // travelTimes가 없으면 경로부터 계산하도록 유도
    if (travelTimes.length === 0) {
      alert(t('alertNeedRouteFirst'))
      return
    }

    setSelectedCoursesOrder(prev => {
      // 딥 카피를 위해 새로운 객체들로 구성된 배열 생성
      const newOrder = prev.map(item => ({ ...item }))
      
      // 첫 번째 항목의 일차 설정 (없으면 1일)
      if (!newOrder[0].day) {
        newOrder[0].day = '1일'
      }
      
      let currentDay = 1
      
      for (let i = 1; i < newOrder.length; i++) {
        const prevItem = newOrder[i-1]
        const currentItem = newOrder[i]
        const prevCourse = tourCourses.find(c => c.id === prevItem.id)
        
        // 이전 코스가 호텔 숙박인지 확인
        if (isHotelAccommodation(prevCourse)) {
          // 호텔 숙박 다음은 다음날
          currentDay++
          currentItem.day = `${currentDay}일`
          
          // 다음날 시작 시간이 입력되어 있으면 그 시간부터 계산
          if (currentItem.time) {
            // 사용자가 입력한 시간을 기준으로 계산
            continue
          }
          // 다음날 시작 시간이 없으면 계산하지 않음 (사용자가 입력해야 함)
          continue
        }
        
        // 호텔 숙박 전까지는 같은 일차
        if (!currentItem.day) {
          currentItem.day = `${currentDay}일`
        } else {
          // 일차에서 숫자 추출
          const dayMatch = currentItem.day.match(/(\d+)일/)
          if (dayMatch) {
            currentDay = parseInt(dayMatch[1])
          }
        }
        
        // 같은 날짜인 경우에만 자동 계산
        const isSameDay = !prevItem.day || !currentItem.day || prevItem.day === currentItem.day
        
        if (isSameDay && prevItem.time) {
          const [hours, minutes] = prevItem.time.split(':').map(Number)
          let totalMinutes = hours * 60 + minutes
          
          // 이전 코스 소요시간 추가
          totalMinutes += prevItem.duration || 0
          
          // 이동 시간 추가 (초 -> 분)
          const travelTimeSec = travelTimes[i-1] || 0
          totalMinutes += travelTimeSec / 60
          
          // 10분 단위로 올림
          totalMinutes = Math.ceil(totalMinutes / 10) * 10
          
          const newHours = Math.floor(totalMinutes / 60) % 24
          const newMins = totalMinutes % 60
          currentItem.time = `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`
        } else if (isSameDay && !prevItem.time) {
          // 이전 항목에 시간이 없으면 계산하지 않음
          continue
        }
      }
      return newOrder
    })
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
      
      // 사진 정보 가져오기
      const courseIds = (data || []).map(c => c.id)
      if (courseIds.length > 0) {
        const { data: photosData } = await supabase
          .from('tour_course_photos')
          .select('id, course_id, photo_url, thumbnail_url, is_primary')
          .in('course_id', courseIds)
          .order('is_primary', { ascending: false })
          .order('sort_order', { ascending: true })

        // 코스별로 사진 그룹화
        const photosByCourse = new Map<string, Array<{
          id: string
          photo_url: string | null
          thumbnail_url: string | null
          is_primary: boolean | null
        }>>()
        
        photosData?.forEach(photo => {
          if (photo.course_id) {
            if (!photosByCourse.has(photo.course_id)) {
              photosByCourse.set(photo.course_id, [])
            }
            photosByCourse.get(photo.course_id)?.push({
              id: photo.id,
              photo_url: photo.photo_url,
              thumbnail_url: photo.thumbnail_url,
              is_primary: photo.is_primary
            })
          }
        })

        // 코스에 사진 정보 추가
        const coursesWithPhotos = (data || []).map(course => ({
          ...course,
          photos: photosByCourse.get(course.id) || null
        }))
        
        setTourCourses(coursesWithPhotos as TourCourse[])
      } else {
        setTourCourses((data || []) as TourCourse[])
      }
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

      const selectedIds = new Set(data?.map((item: any) => item.tour_course_id) ?? [])
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
      setVehicleSettings((data || []).map(item => ({
        id: item.id,
        vehicle_type: item.vehicle_type,
        display_name: (item as { display_name?: string | null }).display_name ?? null,
        daily_rental_rate: item.daily_rental_rate,
        mpg: item.mpg
      })))
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
        course.children.forEach((child: TourCourse) => calculateLevels(child, level + 1))
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

  // 일정 일수 계산
  const numberOfDays = useMemo(() => {
    if (selectedCoursesOrder.length === 0) return 1
    const days = selectedCoursesOrder
      .map(item => {
        if (!item.day) return 0
        const match = item.day.match(/(\d+)일/)
        return match ? parseInt(match[1]) : 0
      })
      .filter(day => day > 0)
    return days.length > 0 ? Math.max(...days) : 1
  }, [selectedCoursesOrder])

  // 호텔 숙박비 계산 (호텔 숙박 + 가이드 숙박비)
  const hotelAccommodationCost = useMemo(() => {
    let total = 0
    const selected = tourCourses.filter(course => selectedCourses.has(course.id) && isHotelAccommodation(course))

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
      }
    })

    // 가이드 숙박비 추가 (1박당 $100)
    // 1박2일 = 1박, 2박3일 = 2박
    const guideAccommodationCost = numberOfDays > 1 ? (numberOfDays - 1) * 100 : 0
    total += guideAccommodationCost

    return total
  }, [selectedCourses, tourCourses, vehicleType, participantCount, numberOfDays])

  // 입장료 계산 (호텔 숙박 제외)
  const entranceFees = useMemo(() => {
    let total = 0
    // 모든 투어 코스에서 선택된 것들 찾기 (평면 리스트에서)
    const selected = tourCourses.filter(course => selectedCourses.has(course.id) && !isHotelAccommodation(course))

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

  // 차량 렌트비 (일수에 따라 계산)
  const vehicleRentalCost = useMemo(() => {
    const setting = vehicleSettings.find(s => s.vehicle_type === vehicleType)
    const dailyRate = setting?.daily_rental_rate || 0
    return dailyRate * numberOfDays
  }, [vehicleSettings, vehicleType, numberOfDays])

  // 주유비 계산
  const fuelCost = useMemo(() => {
    if (!mileage || mileage <= 0) return 0
    const setting = vehicleSettings.find(s => s.vehicle_type === vehicleType)
    if (!setting || !setting.mpg || setting.mpg <= 0) return 0
    const gallons = mileage / setting.mpg
    return gallons * gasPrice
  }, [mileage, vehicleSettings, vehicleType, gasPrice])

  // 주유비: 직접 입력이 있으면 사용, 없으면 계산값을 기본값으로 사용
  const effectiveFuelCost = useMemo(() => manualFuelCost !== null ? manualFuelCost : fuelCost, [manualFuelCost, fuelCost])

  // 가이드비 계산
  const calculatedGuideFee = useMemo(() => {
    if (guideFee !== null) return guideFee
    return totalHours * guideHourlyRate
  }, [guideFee, totalHours, guideHourlyRate])

  // 기타 금액 합계
  const otherExpensesTotal = useMemo(() => {
    return otherExpenses.reduce((sum, expense) => sum + expense.amount, 0)
  }, [otherExpenses])

  // 총 실비 (기타 금액 제외)
  const totalCost = useMemo(() => {
    return entranceFees + hotelAccommodationCost + vehicleRentalCost + effectiveFuelCost + calculatedGuideFee
  }, [entranceFees, hotelAccommodationCost, vehicleRentalCost, effectiveFuelCost, calculatedGuideFee])

  // 마진율
  const marginRate = useMemo(() => {
    if (marginType === 'failed_recruitment') {
      return customMarginRate
    }
    return MARGIN_RATES[marginType].default
  }, [marginType, customMarginRate])

  // 판매가 (팁 제외, 기타 금액 제외)
  const sellingPrice = useMemo(() => {
    return totalCost / (1 - marginRate / 100)
  }, [totalCost, marginRate])

  // 추가 비용 (기타 금액, 마진율 적용 안함)
  const additionalCost = useMemo(() => {
    return otherExpensesTotal
  }, [otherExpensesTotal])

  // 팁 계산 전 총액 (판매가 + 추가비용)
  const totalBeforeTip = useMemo(() => {
    return sellingPrice + additionalCost
  }, [sellingPrice, additionalCost])

  // 팁 계산 (판매가 + 추가비용 기준)
  const tipAmount = useMemo(() => {
    return totalBeforeTip * TIP_RATE
  }, [totalBeforeTip])

  // 팁 포함 판매가
  const sellingPriceWithTip = useMemo(() => {
    return totalBeforeTip + tipAmount
  }, [totalBeforeTip, tipAmount])

  // 마진 금액
  const marginAmount = useMemo(() => {
    return sellingPrice - totalCost
  }, [sellingPrice, totalCost])

  // 고객 목록 가져오기
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        let customers: Array<{id: string, name: string, email: string | null, phone: string | null}> = []
        let from = 0
        const batchSize = 1000
        let hasMore = true

        while (hasMore) {
          const { data, error } = await supabase
            .from('customers')
            .select('id, name, email, phone')
            .order('created_at', { ascending: false })
            .range(from, from + batchSize - 1)

          if (error) {
            console.error('고객 목록 조회 오류:', error)
            break
          }

          if (data && data.length > 0) {
            customers = [...customers, ...data]
            from += batchSize
            hasMore = data.length === batchSize
          } else {
            hasMore = false
          }
        }

        setAllCustomers(customers.filter((c): c is {id: string, name: string, email: string, phone: string | null} => c.email !== null))
      } catch (error) {
        console.error('고객 목록 조회 오류:', error)
      }
    }

    fetchCustomers()
  }, [])

  // 저장된 설정 목록 가져오기
  const loadSavedConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('tour_cost_calculator_configs')
        .select('id, name, customer_id, created_at')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      const validConfigs = (data || []).map(item => ({
        ...item,
        created_at: item.created_at || new Date().toISOString()
      })) as Array<{id: string, name: string, customer_id: string | null, created_at: string}>
      setSavedConfigs(validConfigs)
    } catch (error) {
      console.error('저장된 설정 목록 로드 오류:', error)
    }
  }

  // URL 파라미터에서 config_id를 받아서 자동으로 불러오기
  useEffect(() => {
    const configId = searchParams.get('config_id')
    if (configId && allCustomers.length > 0) {
      loadConfiguration(configId)
      // URL에서 파라미터 제거 (한 번만 실행되도록)
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        url.searchParams.delete('config_id')
        window.history.replaceState({}, '', url.toString())
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // 설정 저장
  const saveConfiguration = async (editingConfigId?: string) => {
    if (!configName.trim()) {
      alert(locale === 'ko' ? '설정 이름을 입력해주세요.' : 'Please enter a configuration name.')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const configData = {
        customer_id: selectedCustomer?.id || null,
        name: configName.trim(),
        tour_type: tourType,
        selected_product_id: selectedProductId || null,
        selected_courses: Array.from(selectedCourses),
        course_order: selectedCoursesOrder,
        participant_count: participantCount,
        vehicle_type: vehicleType,
        gas_price: gasPrice,
        mileage: mileage || null,
        travel_time: travelTime || null,
        guide_hourly_rate: guideHourlyRate,
        guide_fee: guideFee || null,
        margin_type: marginType,
        custom_margin_rate: customMarginRate,
        other_expenses: otherExpenses,
        updated_by: user?.id || null
      }

      if (editingConfigId) {
        // 기존 설정 덮어쓰기
        const { error } = await (supabase as any)
          .from('tour_cost_calculator_configs')
          .update(configData)
          .eq('id', editingConfigId)

        if (error) throw error
        alert(t('alertConfigUpdated'))
      } else {
        // 새 설정 추가
        const { error } = await supabase
          .from('tour_cost_calculator_configs')
          .insert({
            ...configData,
            created_by: user?.id || null
          } as Database['public']['Tables']['tour_cost_calculator_configs']['Insert'])

        if (error) throw error
        alert(locale === 'ko' ? '설정이 저장되었습니다.' : 'Configuration saved.')
      }

      setShowSaveConfigModal(false)
      setConfigName('')
      await loadSavedConfigs()
    } catch (error) {
      console.error('설정 저장 오류:', error)
      alert(t('alertErrorSavingConfig'))
    }
  }

  // 설정 불러오기
  const loadConfiguration = async (configId: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from('tour_cost_calculator_configs')
        .select('*')
        .eq('id', configId)
        .single()

      if (error) throw error
      if (!data) return

      // 타입 단언을 통해 config 변수 타입 명시
      type ConfigRow = {
        tour_type?: string
        selected_product_id?: string | null
        selected_courses?: string[]
        course_order?: any[]
        participant_count?: number
        vehicle_type?: string
        gas_price?: number
        mileage?: number | null
        travel_time?: number | null
        guide_hourly_rate?: number
        guide_fee?: number | null
        margin_type?: string
        custom_margin_rate?: number
        other_expenses?: any[]
        customer_id?: string | null
      }
      const config = data as ConfigRow

      // 투어 타입과 상품 ID 먼저 설정
      if (config.tour_type) setTourType(config.tour_type as 'product' | 'custom' | 'charter_guide')
      
      // 코스 데이터를 먼저 로드
      await loadAllTourCourses()
      
      // 상품 ID 설정 (이것이 useEffect를 트리거하여 loadProductSelectedCourses를 호출함)
      // 하지만 우리는 저장된 selectedCourses를 사용해야 하므로, 나중에 복원할 예정
      if (data.selected_product_id) {
        setSelectedProductId(data.selected_product_id)
        // useEffect가 완료될 때까지 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      // 코스 선택 및 순서를 나중에 복원하기 위해 저장
      if (data.selected_courses && Array.isArray(data.selected_courses) && 
          data.course_order && Array.isArray(data.course_order)) {
        setPendingConfigRestore({
          selectedCourses: data.selected_courses,
          courseOrder: data.course_order
        })
      } else {
        // course_order가 없으면 selectedCourses만 복원
        if (data.selected_courses && Array.isArray(data.selected_courses)) {
          setSelectedCourses(new Set(data.selected_courses))
        }
        if (data.course_order && Array.isArray(data.course_order)) {
          setSelectedCoursesOrder(data.course_order)
        }
      }
      
      // 나머지 설정 복원
      if (data.participant_count) setParticipantCount(data.participant_count)
      if (data.vehicle_type) setVehicleType(data.vehicle_type as 'minivan' | '9seater' | '13seater')
      if (data.gas_price) setGasPrice(Number(data.gas_price))
      if (data.mileage) setMileage(Number(data.mileage))
      if (data.travel_time) setTravelTime(Number(data.travel_time))
      if (data.guide_hourly_rate) setGuideHourlyRate(Number(data.guide_hourly_rate))
      if (data.guide_fee) setGuideFee(Number(data.guide_fee))
      if (data.margin_type) setMarginType(data.margin_type as MarginType)
      if (data.custom_margin_rate) setCustomMarginRate(Number(data.custom_margin_rate))
      if (data.other_expenses && Array.isArray(data.other_expenses)) {
        setOtherExpenses(data.other_expenses)
      }

      // 고객 정보 복원
      if (data.customer_id) {
        const customer = allCustomers.find(c => c.id === data.customer_id)
        if (customer) {
          setSelectedCustomer(customer)
          setCustomerSearch(customer.name)
          setEstimateCustomer(customer)
        }
      }

      // 현재 설정 ID 저장
      setCurrentConfigId(configId)

      setShowLoadConfigModal(false)
      alert(t('alertConfigLoaded'))
    } catch (error) {
      console.error('설정 불러오기 오류:', error)
      alert(t('alertErrorLoadingConfig'))
    }
  }

  // 외부 클릭 시 고객 검색 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // 컴포넌트 마운트 시 저장된 설정 목록 로드
  useEffect(() => {
    loadSavedConfigs()
  }, [])

  // 고객 문서 목록 가져오기
  const fetchCustomerDocuments = async () => {
    if (!selectedCustomer?.id) {
      setCustomerDocuments({ invoices: [], estimates: [] })
      return
    }

    setLoadingDocuments(true)
    try {
      const [invoicesResult, estimatesResult] = await Promise.all([
        supabase
          .from('invoices')
          .select('*')
          .eq('customer_id', selectedCustomer.id)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('estimates')
          .select('*')
          .eq('customer_id', selectedCustomer.id)
          .order('created_at', { ascending: false })
          .limit(10)
      ])

      setCustomerDocuments({
        invoices: invoicesResult.data || [],
        estimates: estimatesResult.data || []
      })
    } catch (error) {
      console.error('문서 로드 오류:', error)
      setCustomerDocuments({ invoices: [], estimates: [] })
    } finally {
      setLoadingDocuments(false)
    }
  }

  useEffect(() => {
    fetchCustomerDocuments()
  }, [selectedCustomer?.id])

  // 인보이스 삭제 함수
  const handleDeleteInvoice = async (invoiceId: string, pdfFilePath: string | null) => {
    if (!confirm(t('alertConfirmDeleteInvoice'))) {
      return
    }

    try {
      // Storage에서 PDF 파일 삭제
      if (pdfFilePath) {
        try {
          const { error: storageError } = await supabase.storage
            .from('customer-documents')
            .remove([pdfFilePath])

          if (storageError) {
            console.error('PDF 파일 삭제 오류:', storageError)
            // Storage 삭제 실패해도 DB 삭제는 계속 진행
          }
        } catch (storageError) {
          console.error('PDF 파일 삭제 중 오류:', storageError)
        }
      }

      // invoices 테이블에서 삭제
      const { error: deleteError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId)

      if (deleteError) {
        console.error('인보이스 삭제 오류:', deleteError)
        alert(t('alertErrorDeletingInvoice'))
        return
      }

      // 문서 목록 새로고침
      const [invoicesResult, estimatesResult] = await Promise.all([
        supabase
          .from('invoices')
          .select('*')
          .eq('customer_id', selectedCustomer!.id)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('estimates')
          .select('*')
          .eq('customer_id', selectedCustomer!.id)
          .order('created_at', { ascending: false })
          .limit(10)
      ])

      setCustomerDocuments({
        invoices: invoicesResult.data || [],
        estimates: estimatesResult.data || []
      })

      alert(t('alertInvoiceDeleted'))
    } catch (error) {
      console.error('인보이스 삭제 중 오류:', error)
      alert(t('alertErrorDeletingInvoice'))
    }
  }

  // Estimate 삭제 함수
  const handleDeleteEstimate = async (estimateId: string, pdfFilePath: string | null) => {
    if (!confirm(t('alertConfirmDeleteEstimate'))) {
      return
    }

    try {
      // Storage에서 PDF 파일 삭제
      if (pdfFilePath) {
        try {
          const { error: storageError } = await supabase.storage
            .from('customer-documents')
            .remove([pdfFilePath])

          if (storageError) {
            console.error('PDF 파일 삭제 오류:', storageError)
            // Storage 삭제 실패해도 DB 삭제는 계속 진행
          }
        } catch (storageError) {
          console.error('PDF 파일 삭제 중 오류:', storageError)
        }
      }

      // estimates 테이블에서 삭제
      const { error: deleteError } = await supabase
        .from('estimates')
        .delete()
        .eq('id', estimateId)

      if (deleteError) {
        console.error('Estimate 삭제 오류:', deleteError)
        alert(t('alertErrorDeletingEstimate'))
        return
      }

      // 문서 목록 새로고침
      const [invoicesResult, estimatesResult] = await Promise.all([
        supabase
          .from('invoices')
          .select('*')
          .eq('customer_id', selectedCustomer!.id)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('estimates')
          .select('*')
          .eq('customer_id', selectedCustomer!.id)
          .order('created_at', { ascending: false })
          .limit(10)
      ])

      setCustomerDocuments({
        invoices: invoicesResult.data || [],
        estimates: estimatesResult.data || []
      })

      alert(t('alertEstimateDeleted'))
    } catch (error) {
      console.error('Estimate 삭제 중 오류:', error)
      alert(locale === 'ko' ? 'Estimate 삭제 중 오류가 발생했습니다.' : 'Error deleting estimate.')
    }
  }

  // 차량 설정 저장
  const saveVehicleSetting = async (type: string, dailyRate: number, mpg: number) => {
    try {
      const { error } = await supabase
        .from('vehicle_rental_settings')
        .upsert({
          vehicle_type: type,
          daily_rental_rate: dailyRate,
          mpg: mpg
        } as Database['public']['Tables']['vehicle_rental_settings']['Insert'], {
          onConflict: 'vehicle_type'
        })

      if (error) throw error
      await loadVehicleSettings()
      setShowVehicleSettingsModal(false)
      setEditingVehicleType(null)
    } catch (error) {
      console.error('차량 설정 저장 오류:', error)
      alert(t('alertErrorSavingVehicle'))
    }
  }

  // 차량 추가 (커스텀 차량)
  const addVehicleSetting = async (displayName: string, dailyRate: number, mpg: number) => {
    try {
      const slug = displayName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || 'custom'
      let vehicleTypeKey = slug
      let n = 1
      while (vehicleSettings.some(s => s.vehicle_type === vehicleTypeKey)) {
        vehicleTypeKey = `${slug}_${n++}`
      }
      const row = {
        vehicle_type: vehicleTypeKey,
        daily_rental_rate: dailyRate,
        mpg,
        display_name: displayName.trim()
      }
      const { error } = await supabase
        .from('vehicle_rental_settings')
        .insert(row as Database['public']['Tables']['vehicle_rental_settings']['Insert'])

      if (error) throw error
      await loadVehicleSettings()
    } catch (error) {
      console.error('차량 추가 오류:', error)
      alert(locale === 'ko' ? '차량 추가 중 오류가 발생했습니다.' : 'Error adding vehicle.')
    }
  }

  // 총 소요시간 자동 계산 (일정 항목의 duration 합산 + 이동 시간)
  useEffect(() => {
    const courseDurationHours = selectedCoursesOrder.reduce((sum, item) => sum + (item.duration || 0), 0) / 60
    const travelTimeHours = travelTime || 0
    setTotalHours(Math.round((courseDurationHours + travelTimeHours) * 10) / 10)
  }, [selectedCoursesOrder, travelTime])

  // 경로 계산 (구글맵) - 선택된 순서대로, 마지막에서 첫 번째로 돌아오는 순환 경로
  const calculateRoute = async () => {
    setIsCalculatingRoute(true)
    
    try {
      // 선택된 순서대로 코스 가져오기
      const selected = selectedCoursesOrder
        .map(item => tourCourses.find(c => c.id === item.id))
        .filter(Boolean) as TourCourse[]
      
      const coursesWithLocation = selected.filter(course => 
        (course.start_latitude && course.start_longitude)
      )

      if (coursesWithLocation.length < 2) {
        alert(t('alertNeedTwoCourses'))
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

      const service = new (window.google.maps as any).DirectionsService()
      
      // 순환 경로: 첫 번째 지점에서 시작해서 마지막 지점까지 가고, 다시 첫 번째 지점으로 돌아옴
      const origin = waypoints[0]
      const destination = waypoints[0] // 첫 번째 지점으로 돌아옴
      const intermediateWaypoints = waypoints.slice(1).map(wp => ({ location: wp }))

      const request: any = {
        origin: origin,
        destination: destination,
        waypoints: intermediateWaypoints,
        travelMode: (window.google.maps as any).TravelMode.DRIVING,
        optimizeWaypoints: false // 순서를 유지하기 위해 최적화 비활성화
      }

          service.route(request, (result: any, status: string) => {
            setIsCalculatingRoute(false)
            
            if (status === 'OK' && result && result.routes && result.routes.length > 0) {
              // 지도에 경로 표시
              if (directionsRenderer) {
                directionsRenderer.setDirections(result)
              }
    
              let totalDistance = 0
              let totalDuration = 0
              const legDurations: number[] = []
    
              result.routes[0].legs.forEach((leg: any) => {
                if (leg.distance) {
                  totalDistance += leg.distance.value / 1609.34 // 미터를 마일로 변환
                }
                if (leg.duration) {
                  totalDuration += leg.duration.value / 3600 // 초를 시간으로 변환
                  legDurations.push(leg.duration.value) // 초 단위 저장
                }
              })
    
              setTravelTimes(legDurations)
              // 마일리지에 5% 추가
              const mileageWithBuffer = totalDistance * 1.05
              setMileage(Math.round(mileageWithBuffer * 10) / 10)
              // 이동 시간 저장 (시간 단위)
              setTravelTime(Math.round(totalDuration * 10) / 10)
              
              // 경로 계산 시 이동 시간도 업데이트 (기존 duration 합산에 이동 시간 추가)
              const courseDurationHours = selectedCoursesOrder.reduce((sum, item) => sum + (item.duration || 0), 0) / 60
              setTotalHours(Math.round((courseDurationHours + totalDuration) * 10) / 10)
          
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
          alert(`${errorMessage}\n${t('alertEnterMileageManually')}`)
        }
      })
    } catch (error) {
      setIsCalculatingRoute(false)
      console.error('경로 계산 오류:', error)
      alert(t('alertErrorRouteCalc'))
    }
  }

  // 저장된 템플릿 불러오기 (데이터베이스에서)
  useEffect(() => {
    loadTemplates()
  }, [])

  // 템플릿 목록 불러오기
  const loadTemplates = async () => {
    setLoadingTemplates(true)
    try {
      const { data, error } = await (supabase as any)
        .from('tour_cost_calculator_templates')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      const templates: Template[] = (data || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        selectedCourses: t.selected_courses || [],
        order: t.course_order || [],
        savedAt: t.created_at,
        created_at: t.created_at,
        updated_at: t.updated_at
      }))

      setSavedConfigurations(templates)
    } catch (error) {
      console.error('템플릿 불러오기 실패:', error)
      alert('템플릿을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoadingTemplates(false)
    }
  }

  // 템플릿 저장 (데이터베이스에)
  const saveTemplate = async () => {
    if (!saveConfigName.trim()) {
      alert(t('alertEnterTemplateTitle'))
      return
    }

    try {
      if (editingTemplate && editingTemplate.id) {
        // 수정 모드
        const { error } = await (supabase as any)
          .from('tour_cost_calculator_templates')
          .update({
            name: saveConfigName.trim(),
            selected_courses: Array.from(selectedCourses),
            course_order: selectedCoursesOrder,
            updated_by: (await supabase.auth.getUser()).data.user?.id
          })
          .eq('id', editingTemplate.id)

        if (error) throw error
        alert('템플릿이 수정되었습니다.')
      } else {
        // 새로 저장
        const { data: { user } } = await supabase.auth.getUser()
        
        const { error } = await (supabase as any)
          .from('tour_cost_calculator_templates')
          .insert({
            name: saveConfigName.trim(),
            selected_courses: Array.from(selectedCourses),
            course_order: selectedCoursesOrder,
            created_by: user?.id
          })

        if (error) throw error
        alert(t('alertTemplateSaved'))
      }

      setSaveConfigName('')
      setEditingTemplate(null)
      setShowSaveModal(false)
      await loadTemplates()
    } catch (error: any) {
      console.error('템플릿 저장 실패:', error)
      alert(t('alertErrorSavingTemplate', { message: error.message }))
    }
  }

  // 템플릿 불러오기
  const loadTemplate = (template: Template) => {
    const selectedCoursesSet = new Set(template.selectedCourses)
    setSelectedCourses(selectedCoursesSet)
    
    // 선택된 코스들의 모든 부모 노드를 찾아서 확장
    const parentIdsToExpand = new Set<string>()
    template.selectedCourses.forEach(courseId => {
      const parentIds = getAllParentIds(courseId)
      parentIds.forEach(parentId => parentIdsToExpand.add(parentId))
    })
    
    // 기존 확장된 노드에 부모 노드들 추가
    setExpandedCourseNodes(prev => {
      const newExpanded = new Set(prev)
      parentIdsToExpand.forEach(id => newExpanded.add(id))
      return newExpanded
    })
    
    // 구버전 데이터(단순 ID 배열)인 경우 객체 배열로 변환
    const normalizedOrder = template.order.map((item: any) => {
      if (typeof item === 'string') {
        const course = tourCourses.find(c => c.id === item)
        return {
          id: item,
          duration: course?.duration_hours || 0,
          day: '',
          time: ''
        }
      }
      return item
    })
    
    setSelectedCoursesOrder(normalizedOrder)
    setShowLoadModal(false)
    alert(`"${template.name}" 템플릿을 불러왔습니다.`)
  }

  // 템플릿 수정 모드로 열기
  const editTemplate = (template: Template) => {
    setEditingTemplate(template)
    setSaveConfigName(template.name)
    setSelectedCourses(new Set(template.selectedCourses))
    
    // 구버전 데이터(단순 ID 배열)인 경우 객체 배열로 변환
    const normalizedOrder = template.order.map((item: any) => {
      if (typeof item === 'string') {
        const course = tourCourses.find(c => c.id === item)
        return {
          id: item,
          duration: course?.duration_hours || 0,
          day: '',
          time: ''
        }
      }
      return item
    })
    
    setSelectedCoursesOrder(normalizedOrder)
    setShowLoadModal(false)
    setShowSaveModal(true)
  }

  // 템플릿 삭제
  const deleteConfiguration = async (template: Template) => {
    if (!template.id) {
      alert('삭제할 수 없는 템플릿입니다.')
      return
    }

    if (!confirm(t('alertConfirmDeleteTemplate', { name: template.name }))) {
      return
    }

    try {
      const { error } = await supabase
        .from('tour_cost_calculator_templates')
        .delete()
        .eq('id', template.id)

      if (error) throw error

      alert('템플릿이 삭제되었습니다.')
      await loadTemplates()
    } catch (error: any) {
      console.error('템플릿 삭제 실패:', error)
      alert(t('alertErrorDeletingTemplate', { message: error.message }))
    }
  }

  // Google Maps API 로드 및 지도 초기화
  useEffect(() => {
    let isInitialized = false

    const initializeMap = () => {
      if (isInitialized || !mapRef.current || !window.google || !window.google.maps) return

      // 필수 생성자가 로드되었는지 확인
      if (!window.google.maps.Map) {
        setTimeout(initializeMap, 100)
        return
      }

      try {
        const mapOptions: any = {
          center: { lat: 36.1699, lng: -115.1398 }, // 라스베가스
          zoom: 8,
          mapTypeId: 'roadmap'
        }

        const newMap = new window.google.maps.Map(mapRef.current, mapOptions)
        setMap(newMap)
        isInitialized = true
      } catch (error) {
        console.error('Google Maps 초기화 중 오류 발생:', error)
      }
    }

    if (typeof window !== 'undefined') {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      if (!apiKey || apiKey === 'undefined') return

      if (window.google && window.google.maps && window.google.maps.Map) {
        initializeMap()
      } else {
        const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
        if (existingScript) {
          const checkGoogle = () => {
            if (window.google && window.google.maps && window.google.maps.Map) {
              initializeMap()
            } else {
              setTimeout(checkGoogle, 100)
            }
          }
          checkGoogle()
        } else {
          const script = document.createElement('script')
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&loading=async`
          script.async = true
          script.defer = true
          script.onload = initializeMap
          document.head.appendChild(script)
        }
      }
    }
  }, [])

  // DirectionsRenderer 초기화
  useEffect(() => {
    if (!map || !window.google || !window.google.maps) return
    if (!(window.google.maps as any).DirectionsRenderer) return

    const renderer = new (window.google.maps as any).DirectionsRenderer({
      map: map,
      suppressMarkers: true, // 마커 관련 에러 방지를 위해 true로 설정
      polylineOptions: {
        strokeColor: '#3B82F6',
        strokeWeight: 5,
        strokeOpacity: 0.8
      }
    })

    setDirectionsRenderer(renderer)

    return () => {
      renderer.setMap(null)
    }
  }, [map])

  // 선택된 코스들에 실시간 마커 표시
  useEffect(() => {
    if (!map || !window.google || !window.google.maps) return undefined

    // 기존 마커 제거
    if (markersRef.current) {
      markersRef.current.forEach(marker => marker.setMap(null))
      markersRef.current = []
    }

    // 좌표가 있는 유효한 코스들만 필터링
    const selected = selectedCoursesOrder
      .map(item => tourCourses.find(c => c.id === item.id))
      .filter((c): c is TourCourse => 
        !!c && c.start_latitude !== null && c.start_latitude !== undefined &&
        c.start_longitude !== null && c.start_longitude !== undefined
      )

    if (selected.length === 0) {
      if (selectedCoursesOrder.length === 0) {
        map.setCenter({ lat: 36.1699, lng: -115.1398 })
        map.setZoom(8)
      }
      return undefined
    }

    const bounds = new (window.google.maps as any).LatLngBounds()

    selected.forEach((course, index) => {
      const lat = typeof course.start_latitude === 'string' ? parseFloat(course.start_latitude) : Number(course.start_latitude)
      const lng = typeof course.start_longitude === 'string' ? parseFloat(course.start_longitude) : Number(course.start_longitude)
      
      if (isNaN(lat) || isNaN(lng)) return

      const position = { lat, lng }
      const marker = new (window.google.maps as any).Marker({
        position,
        map,
        label: {
          text: (index + 1).toString(),
          color: 'white',
          fontWeight: 'bold',
          fontSize: '14px'
        },
        title: course.name_ko || course.name_en || '',
        zIndex: 9999, // 경로 선보다 위에 표시
        optimized: false // 렌더링 보장
      })
      
      markersRef.current.push(marker)
      bounds.extend(position)
    })

    // 모든 마커가 보이도록 지도 범위 조정
    // DirectionsRenderer와 충돌을 피하기 위해 약간의 지연 후 실행
    const timer = setTimeout(() => {
      map.fitBounds(bounds)
      if (selected.length === 1) {
        map.setZoom(15)
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [map, selectedCoursesOrder, tourCourses])

  // Estimate 모달을 위한 코스 데이터 준비
  const estimateCourses = useMemo(() => {
    return selectedCoursesOrder.map(item => {
      const course = tourCourses.find(c => c.id === item.id)
      return {
        courseId: item.id,
        courseName: course ? (course.name_ko || course.name_en || '') : '',
        day: item.day || '',
        time: item.time || '',
        duration: item.duration !== undefined ? item.duration : null
      }
    })
  }, [selectedCoursesOrder, tourCourses])

  // Estimate 모달을 위한 코스 데이터 (사진 포함)
  const tourCoursesWithPhotos = useMemo(() => {
    return tourCourses
  }, [tourCourses])

  return (
    <div className="container mx-auto px-4 py-3 max-w-7xl">
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <Calculator className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">{t('title')}</h1>
        </div>
        <p className="text-sm text-gray-600">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 입력 섹션 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 투어 타입 선택 */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4">{t('section1Title')}</h2>
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
                {t('selectProduct')}
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
              <button
                onClick={() => {
                  setTourType('charter_guide')
                  setSelectedProductId('')
                  setSelectedCourses(new Set())
                }}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                  tourType === 'charter_guide'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                차량 대절 전담 가이드
              </button>
            </div>

            {tourType === 'product' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('tourProduct')}
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">상품을 선택하세요</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name || product.name_en}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 투어 코스 선택 */}
          {(tourType === 'product' && selectedProductId) || tourType === 'custom' || tourType === 'charter_guide' ? (
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
                  {t('loadTemplate')}
                </button>
                <button
                  onClick={() => {
                    if (selectedCourses.size === 0) {
                      alert('저장할 투어 코스가 없습니다.')
                      return
                    }
                    setEditingTemplate(null)
                    setSaveConfigName('')
                    setShowSaveModal(true)
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                  disabled={selectedCourses.size === 0}
                  title={t('saveTemplateTitle')}
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
                  {t('addNew')}
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
                      setEditingCourse(course as any)
                      setShowCourseEditModal(true)
                    }}
                  />
                ))
              ) : (
                <div className="text-center text-gray-500 py-8">
                  {tourType === 'product' && !selectedProductId
                    ? t('selectProductFirst')
                    : courseSearchTerm
                    ? t('noSearchResults')
                    : t('noCourses')}
                </div>
              )}
            </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="text-center text-gray-500 py-8">
                <p className="text-lg font-medium mb-2">{t('selectTourType')}</p>
                <p className="text-sm">{t('selectProductOrCustom')}</p>
              </div>
            </div>
          )}

          {/* 선택된 투어 코스 순서 */}
          {((tourType === 'product' && selectedProductId) || tourType === 'custom' || tourType === 'charter_guide') && selectedCourses.size > 0 && selectedCoursesOrder.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-lg font-semibold">선택된 투어 코스 순서</h2>
                  <p className="text-xs text-gray-500">드래그하거나 위/아래 버튼으로 순서를 조정하세요</p>
                </div>
                <button
                  onClick={autoCalculateTimes}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors text-xs font-medium"
                  title={t('autoScheduleTitle')}
                >
                  <Clock className="w-3.5 h-3.5" />
                  일정 시간 자동 완성
                </button>
              </div>

              {/* 헤더 추가 */}
              <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 border-x border-t rounded-t-lg text-[10px] font-bold text-gray-500">
                <div className="w-4 flex-shrink-0" /> {/* 핸들 공간 */}
                <div className="w-5 flex-shrink-0 text-center">#</div>
                <div className="w-16 flex-shrink-0 text-center">{t('day')}</div>
                <div className="w-20 flex-shrink-0 text-center">{t('startTime')}</div>
                <div className="w-16 flex-shrink-0 text-center">{t('durationMin')}</div>
                <div className="flex-1">{t('courseTitle')}</div>
                <div className="w-16 flex-shrink-0" /> {/* 버튼 공간 */}
              </div>

              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="selected-courses">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-0 border-x border-b rounded-b-lg overflow-hidden"
                    >
                      {selectedCoursesOrder.map((item, index) => {
                        const courseId = item.id
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
                                className={`flex items-center gap-2 py-1 px-2 border-t first:border-t-0 bg-white cursor-move ${
                                  snapshot.isDragging ? 'shadow-lg border-blue-500 z-50 opacity-100' : 'border-gray-100 hover:bg-gray-50'
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
                                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-semibold text-[10px]">
                                  {index + 1}
                                </div>

                                {/* 날짜/시간/소요시간 입력칸 */}
                                <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setEditingDayIndex(index)
                                      setShowDaySelectModal(true)
                                    }}
                                    className="w-16 px-1.5 py-0.5 text-[10px] border border-gray-200 rounded focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none text-center bg-white hover:bg-gray-50 transition-colors"
                                  >
                                    {item.day || t('day')}
                                  </button>
                                  <input
                                    type="time"
                                    step="60"
                                    value={item.time || ''}
                                    onChange={(e) => updateScheduleItem(index, { time: e.target.value })}
                                    className="w-20 px-1 py-0.5 text-[10px] border border-gray-200 rounded focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none"
                                  />
                                  <div className="flex items-center gap-0.5">
                                    <input
                                      type="number"
                                      step="10"
                                      placeholder="분"
                                      value={item.duration ?? 0}
                                      onChange={(e) => updateScheduleItem(index, { duration: parseInt(e.target.value) || 0 })}
                                      className="w-12 px-1 py-0.5 text-[10px] border border-gray-200 rounded text-right focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none"
                                    />
                                    <span className="text-[10px] text-gray-400">m</span>
                                  </div>
                                </div>

                                {/* 코스 제목 */}
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium truncate text-gray-700" title={fullPath}>
                                    {fullPath}
                                  </div>
                                </div>

                                {/* 위/아래 버튼 */}
                                <div 
                                  className="flex flex-row items-center gap-0.5"
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="flex flex-col -space-y-1 mr-1">
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
                                      className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
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
                                      className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                      title={t('moveDown')}
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
                                    className="p-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                    title={t('remove')}
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
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
            </div>
          )}

          {/* 경로 및 마일리지 */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4">{t('section3Title')}</h2>
            
            {/* 구글맵 표시 섹션 */}
            <div className="mb-6 h-[400px] w-full rounded-lg border border-gray-200 overflow-hidden relative bg-gray-50">
              <div ref={mapRef} className="w-full h-full" />
              {!map && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p>지도를 불러오는 중...</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <button
                onClick={calculateRoute}
                disabled={selectedCourses.size < 2 || isCalculatingRoute || selectedCoursesOrder.length < 2}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isCalculatingRoute ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    {t('calculating')}
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
                  {t('mileageMiles')}
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
                  <span className="text-sm font-medium text-blue-900">{t('travelTimeTotal')}</span>
                  <span className="text-sm font-semibold text-blue-700">
                    {travelTime.toFixed(1)} {t('hours')}
                  </span>
                  {travelTime >= 1 && (
                    <span className="text-xs text-blue-600">
                      ({t('hoursMinutes', { h: Math.floor(travelTime), m: Math.round((travelTime % 1) * 60) })})
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 투어 코스 설명 */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mt-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              {t('tourCourseDescription')}
            </h2>
            <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50">
              {(() => {
                // 선택된 코스 ID 목록과 순서 유지
                const courseOrderMap = new Map<string, number>()
                selectedCoursesOrder.forEach((c, index) => {
                  courseOrderMap.set(c.id, index)
                })
                
                // 카테고리가 "포인트"인 코스만 필터링
                const pointCourses = tourCourses.filter(course => {
                  const category = course.category?.toLowerCase() || ''
                  return courseOrderMap.has(course.id) && 
                         (category.includes('포인트') || category.includes('point'))
                })

                // 이름과 설명이 모두 있는 코스만 필터링
                const validCourses = pointCourses.filter(course => {
                  const isEnglish = locale === 'en'
                  const courseName = isEnglish 
                    ? (course.customer_name_en || course.customer_name_ko || '')
                    : (course.customer_name_ko || course.customer_name_en || '')
                  const courseDescription = isEnglish
                    ? (course.customer_description_en || course.customer_description_ko || '')
                    : (course.customer_description_ko || course.customer_description_en || '')
                  
                  // 이름 또는 설명 중 하나라도 있으면 포함
                  return courseName.trim() !== '' || courseDescription.trim() !== ''
                })

                // 스케줄 순서대로 정렬
                validCourses.sort((a, b) => {
                  const orderA = courseOrderMap.get(a.id) ?? Infinity
                  const orderB = courseOrderMap.get(b.id) ?? Infinity
                  return orderA - orderB
                })

                if (validCourses.length === 0) {
                  return (
                    <p className="text-sm text-gray-500 text-center py-4">
                      {t('noPointCourses')}
                    </p>
                  )
                }

                return validCourses.map((course) => {
                  const isEnglish = locale === 'en'
                  
                  // 모든 부모 이름을 계층적으로 가져오기
                  const getFullPath = (currentCourse: TourCourse): string[] => {
                    const path: string[] = []
                    let current: TourCourse | undefined = currentCourse
                    const visited = new Set<string>() // 순환 참조 방지
                    
                    while (current && !visited.has(current.id)) {
                      visited.add(current.id)
                      const courseName = isEnglish 
                        ? (current.customer_name_en || current.customer_name_ko || current.name_en || current.name_ko || '')
                        : (current.customer_name_ko || current.customer_name_en || current.name_ko || current.name_en || '')
                      
                      if (courseName.trim()) {
                        path.unshift(courseName)
                      }
                      
                      if (!current || !current.parent_id) {
                        break
                      }
                      
                      const parentId: string = current.parent_id
                      const parent: TourCourse | undefined = tourCourses.find((c: TourCourse) => c.id === parentId)
                      if (parent) {
                        current = parent
                      } else {
                        break
                      }
                    }
                    
                    return path
                  }
                  
                  // 전체 경로 가져오기
                  const pathNames = getFullPath(course)
                  const fullCourseName = pathNames.join(' > ')
                  
                  const courseDescription = isEnglish
                    ? (course.customer_description_en || course.customer_description_ko || '')
                    : (course.customer_description_ko || course.customer_description_en || '')

                  // 사진 URL 가져오기 (대표 사진 우선, 없으면 첫 번째 사진)
                  const primaryPhoto = course.photos?.find(p => p.is_primary) || course.photos?.[0]
                  const photoUrl = primaryPhoto?.photo_url || primaryPhoto?.thumbnail_url || null
                  
                  // 사진 URL이 상대 경로인 경우 절대 경로로 변환
                  let fullPhotoUrl = photoUrl
                  if (photoUrl && !photoUrl.startsWith('http')) {
                    fullPhotoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-course-photos/${photoUrl}`
                  }

                  return (
                    <div key={course.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex gap-4 items-start">
                        {/* 왼쪽: 사진 */}
                        {fullPhotoUrl && (
                          <div className="flex-shrink-0 w-48">
                            <img 
                              src={fullPhotoUrl} 
                              alt={fullCourseName || 'Course image'} 
                              className="w-full h-36 object-cover rounded-lg border border-gray-200"
                            />
                          </div>
                        )}
                        {/* 오른쪽: 제목과 설명 */}
                        <div className="flex-1 min-w-0">
                          {fullCourseName.trim() !== '' && (
                            <div className="font-semibold text-gray-900 mb-2">
                              {fullCourseName}
                            </div>
                          )}
                          {courseDescription && courseDescription.trim() !== '' && (
                            <div className="text-sm text-gray-700 whitespace-pre-wrap">
                              {courseDescription}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        </div>

        {/* 오른쪽: 계산 결과 */}
        <div className="lg:col-span-1">
          {/* 기본 정보 */}
          <div className="bg-white rounded-lg shadow-sm border p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">4. 기본 정보</h2>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-700 whitespace-nowrap">
                  {t('marginRate')}
                </label>
                <select
                  value={marginType}
                  onChange={(e) => {
                    setMarginType(e.target.value as MarginType)
                    if (e.target.value !== 'failed_recruitment') {
                      setCustomMarginRate(MARGIN_RATES[e.target.value as MarginType].default)
                    }
                  }}
                  className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="default">{t('defaultMargin')}</option>
                  <option value="low_season">{t('lowSeason')}</option>
                  <option value="high_season">{t('highSeason')}</option>
                  <option value="failed_recruitment">{t('failedRecruitment')}</option>
                </select>
                {marginType === 'failed_recruitment' && (
                  <input
                    type="number"
                    min="10"
                    max="20"
                    step="0.1"
                    value={customMarginRate}
                    onChange={(e) => setCustomMarginRate(parseFloat(e.target.value) || 15)}
                    className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="10-20"
                  />
                )}
              </div>
            </div>
            
            <div className="space-y-4">
              {/* 고객 정보 */}
              <div>
                <h3 className="text-sm font-medium text-gray-800 mb-2">고객 정보</h3>
                <div className="relative" ref={customerSearchRef}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {t('customerSearch')}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value)
                        setShowCustomerDropdown(true)
                        if (e.target.value === '') {
                          setSelectedCustomer(null)
                          setEstimateCustomer(null)
                        }
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder={t('searchByNameOrEmail')}
                    />
                    {customerSearch && (
                      <button
                        onClick={() => {
                          setCustomerSearch('')
                          setSelectedCustomer(null)
                          setEstimateCustomer(null)
                          setShowCustomerDropdown(false)
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {showCustomerDropdown && customerSearch && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {allCustomers
                        .filter(customer => 
                          (customer.name || '').toLowerCase().includes(customerSearch.toLowerCase()) ||
                          (customer.email || '').toLowerCase().includes(customerSearch.toLowerCase())
                        )
                        .slice(0, 10)
                        .map(customer => (
                          <div
                            key={customer.id}
                            onClick={() => {
                              setSelectedCustomer(customer)
                              setEstimateCustomer(customer)
                              setCustomerSearch(customer.name)
                              setShowCustomerDropdown(false)
                            }}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium text-sm">{customer.name}</div>
                            <div className="text-xs text-gray-500">{customer.email}</div>
                            {customer.phone && (
                              <div className="text-xs text-gray-400">{customer.phone}</div>
                            )}
                          </div>
                        ))}
                      {allCustomers.filter(customer => 
                        (customer.name || '').toLowerCase().includes(customerSearch.toLowerCase()) ||
                        (customer.email || '').toLowerCase().includes(customerSearch.toLowerCase())
                      ).length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-500">
                          {t('noSearchResultsShort')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 인원 및 차량 정보 */}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {t('participants')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={participantCount}
                    onChange={(e) => setParticipantCount(parseInt(e.target.value) || 1)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {t('vehicleType')}
                    <span className="ml-1 text-[10px] text-gray-500 font-normal">
                      {t('vehicleTypeAuto')}
                    </span>
                  </label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {vehicleSettings.map((s) => (
                      <option key={s.id || s.vehicle_type} value={s.vehicle_type}>
                        {s.display_name?.trim() || (s.vehicle_type === 'minivan' ? t('minivan') : s.vehicle_type === '9seater' ? t('seater9') : s.vehicle_type === '13seater' ? t('seater13') : s.vehicle_type)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {t('calculatedFuel')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={manualFuelCost !== null ? manualFuelCost : fuelCost}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === '') setManualFuelCost(null)
                      else setManualFuelCost(parseFloat(v) ?? 0)
                    }}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => setShowVehicleSettingsModal(true)}
                    className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors border border-blue-200"
                  >
                    <Settings className="w-3 h-3" />
                    차량 설정
                  </button>
                </div>
              </div>
              <div className="text-[10px] text-gray-500 -mt-2">
                {t('vehicleMileage', { type: vehicleSettings.find(s => s.vehicle_type === vehicleType)?.display_name?.trim() || (vehicleType === 'minivan' ? t('minivan') : vehicleType === '9seater' ? t('seater9') : vehicleType === '13seater' ? t('seater13') : vehicleType), mpg: vehicleSettings.find(s => s.vehicle_type === vehicleType)?.mpg || 0, miles: mileage || 0 })}
              </div>

              {/* 가이드비 */}
              <div className="pt-3 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-800 mb-2">{t('guideFee')}</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      총 소요 시간 (시간)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={totalHours}
                      onChange={(e) => setTotalHours(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {t('hourlyRate')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={guideHourlyRate}
                      onChange={(e) => setGuideHourlyRate(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      또는 직접 입력 (USD)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={guideFee || ''}
                      onChange={(e) => setGuideFee(e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="직접 입력"
                    />
                  </div>
                </div>
                <div className="mt-1.5 text-xs text-gray-500">
                  {t('calculatedGuideFee', { amount: calculatedGuideFee.toFixed(2) })}
                </div>
              </div>


              {/* 기타 금액 */}
              <div className="pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-800">{t('otherExpenses')}</h3>
                  <button
                    onClick={() => {
                      setOtherExpenses([...otherExpenses, { id: crypto.randomUUID(), name: '', amount: 0 }])
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    추가
                  </button>
                </div>
                {otherExpenses.length > 0 && (
                  <div className="space-y-1.5">
                    {otherExpenses.map((expense, index) => (
                      <div key={expense.id} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={expense.name}
                          onChange={(e) => {
                            const updated = [...otherExpenses]
                            updated[index].name = e.target.value
                            setOtherExpenses(updated)
                          }}
                          placeholder="항목명"
                          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={expense.amount || ''}
                          onChange={(e) => {
                            const updated = [...otherExpenses]
                            updated[index].amount = parseFloat(e.target.value) || 0
                            setOtherExpenses(updated)
                          }}
                          placeholder={t('amount')}
                          className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                          onClick={() => {
                            setOtherExpenses(otherExpenses.filter((_, i) => i !== index))
                          }}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="삭제"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {otherExpensesTotal > 0 && (
                      <div className="mt-2 text-xs font-medium text-gray-700">
                        {t('otherExpensesTotal', { amount: otherExpensesTotal.toFixed(2) })}
                      </div>
                    )}
                  </div>
                )}
                {otherExpenses.length === 0 && (
                  <p className="text-xs text-gray-500">기타 금액이 없습니다. 추가 버튼을 눌러 항목을 추가하세요.</p>
                )}
              </div>
            </div>
          </div>

          {/* 비용 계산 결과 */}
          <div className="bg-white rounded-lg shadow-sm border p-6 sticky top-20">
            <h2 className="text-lg font-semibold mb-3">{t('costResultTitle')}</h2>
            
            <div className="space-y-4">
              <div className="border-b pb-4">
                <div className="flex justify-between mb-2">
                  <button
                    onClick={() => setShowEntranceFeeDetailModal(true)}
                    className="text-gray-600 hover:text-blue-600 hover:underline cursor-pointer text-left"
                  >
                    {t('entranceFeesTotal')}
                  </button>
                  <span className="font-medium">${entranceFees.toFixed(2)}</span>
                </div>
                {hotelAccommodationCost > 0 && (
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">호텔 숙박비</span>
                    <span className="font-medium">${hotelAccommodationCost.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">{t('vehicleRental')} {numberOfDays > 1 && `(${numberOfDays})`}</span>
                  <span className="font-medium">${vehicleRentalCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">주유비</span>
                  <span className="font-medium">${effectiveFuelCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">{t('guideFee')}</span>
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
                  <span className="text-gray-600">{t('marginRateLabel')}</span>
                  <span className="font-medium">{marginRate}%</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">{t('sellingPriceExclTip')}</span>
                  <span className="font-medium">${sellingPrice.toFixed(2)}</span>
                </div>
                {otherExpenses.length > 0 && (
                  <>
                    {otherExpenses.map((expense) => (
                      expense.amount > 0 && (
                        <div key={expense.id} className="flex justify-between mb-1 ml-4">
                          <span className="text-gray-600 text-sm">
                            + 추가비용 ({expense.name || '항목명 없음'})
                          </span>
                          <span className="font-medium text-sm">+${expense.amount.toFixed(2)}</span>
                        </div>
                      )
                    ))}
                    <div className="flex justify-between mb-2 mt-2 pt-2 border-t border-gray-200">
                      <span className="text-gray-700 font-medium">{t('totalLabel')}</span>
                      <span className="font-semibold">${totalBeforeTip.toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">팁 (15%)</span>
                  <span className="font-medium">${tipAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>{t('sellingPriceWithTip')}</span>
                  <span className="text-green-600">${sellingPriceWithTip.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-lg font-bold">
                  <span>마진</span>
                  <span className="text-purple-600">${marginAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* 고객 문서 목록 */}
              {selectedCustomer && (
                <div className="mt-6 pt-6 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      {t('customerDocuments')}
                    </h3>
                    <button
                      onClick={fetchCustomerDocuments}
                      disabled={loadingDocuments}
                      className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={locale === 'ko' ? '새로고침' : 'Refresh'}
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingDocuments ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  {loadingDocuments ? (
                    <div className="text-center py-4 text-gray-500 text-xs border border-gray-200 rounded-lg bg-gray-50">
                      {t('loading')}
                    </div>
                  ) : customerDocuments.invoices.length === 0 && customerDocuments.estimates.length === 0 ? (
                    <div className="text-center py-4 text-gray-500 text-xs border border-gray-200 rounded-lg bg-gray-50">
                      {locale === 'ko' ? '저장된 문서가 없습니다.' : 'No saved documents.'}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* 인보이스 섹션 */}
                      {customerDocuments.invoices.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-700 mb-2">
                            {t('invoices')} ({customerDocuments.invoices.length})
                          </h4>
                          <div className="space-y-1.5">
                            {customerDocuments.invoices.map((invoice) => (
                              <div
                                key={invoice.id}
                                className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 text-xs"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-900 truncate">{invoice.invoice_number}</p>
                                  <p className="text-gray-500">
                                    {new Date(invoice.invoice_date).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US')}
                                  </p>
                                  {invoice.created_at && (
                                    <p className="text-gray-400 text-[10px]">
                                      {new Date(invoice.created_at).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-blue-600">
                                    ${parseFloat(invoice.total || 0).toFixed(2)}
                                  </span>
                                  {invoice.pdf_url && (
                                    <a
                                      href={invoice.pdf_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1 text-blue-600 hover:text-blue-700"
                                      title={t('viewPdf')}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDeleteInvoice(invoice.id, invoice.pdf_file_path)
                                    }}
                                    className="p-1 text-red-600 hover:text-red-700"
                                    title={locale === 'ko' ? '삭제' : 'Delete'}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Estimate 섹션 */}
                      {customerDocuments.estimates.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-700 mb-2">
                            {t('estimates')} ({customerDocuments.estimates.length})
                          </h4>
                          <div className="space-y-1.5">
                            {customerDocuments.estimates.map((estimate) => (
                              <div
                                key={estimate.id}
                                className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 text-xs"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-900 truncate">{estimate.estimate_number}</p>
                                  <p className="text-gray-500">
                                    {new Date(estimate.estimate_date).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US')}
                                  </p>
                                  {estimate.created_at && (
                                    <p className="text-gray-400 text-[10px]">
                                      {new Date(estimate.created_at).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {estimate.pdf_url && (
                                    <a
                                      href={estimate.pdf_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1 text-blue-600 hover:text-blue-700"
                                      title={t('viewPdf')}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDeleteEstimate(estimate.id, estimate.pdf_file_path)
                                    }}
                                    className="p-1 text-red-600 hover:text-red-700"
                                    title={locale === 'ko' ? '삭제' : 'Delete'}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Estimate / Invoice 및 설정 저장/불러오기 버튼 */}
              <div className="mt-6 pt-6 border-t space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setShowEstimateModal(true)}
                    disabled={tourType !== 'charter_guide' && selectedCoursesOrder.length === 0}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FileText className="w-5 h-5" />
                    <span>Estimate</span>
                  </button>
                  <button
                    onClick={() => {
                      if (!selectedCustomer) {
                        alert(t('alertSelectCustomer'))
                        return
                      }
                      setShowInvoiceModal(true)
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                  >
                    <Receipt className="w-5 h-5" />
                    <span>Invoice</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      if (!selectedCustomer) {
                        alert(t('alertSelectCustomer'))
                        return
                      }
                      setConfigName('')
                      setShowSaveConfigModal(true)
                    }}
                    disabled={!selectedCustomer || selectedCoursesOrder.length === 0}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <Save className="w-4 h-4" />
                    <span>설정 저장</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowLoadConfigModal(true)
                    }}
                    disabled={savedConfigs.length === 0}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <Search className="w-4 h-4" />
                    <span>{t('loadConfig')}</span>
                  </button>
                </div>
              </div>
          </div>
        </div>
      </div>

      {/* Invoice 모달 (재사용) */}
      {showInvoiceModal && selectedCustomer && (
        <InvoiceModal
          customer={{
            id: selectedCustomer.id,
            name: selectedCustomer.name,
            email: selectedCustomer.email,
            phone: selectedCustomer.phone,
            channel_id: (selectedCustomer as { channel_id?: string | null }).channel_id ?? null
          }}
          products={products.map((p) => ({
            id: p.id,
            name_ko: p.name_ko ?? null,
            name_en: p.name_en ?? null,
            base_price: p.base_price ?? null,
            adult_base_price: p.adult_base_price ?? null,
            child_base_price: p.child_base_price ?? null,
            infant_base_price: p.infant_base_price ?? null
          }))}
          onClose={() => {
            setShowInvoiceModal(false)
            if (selectedCustomer) fetchCustomerDocuments()
          }}
          locale={locale as 'ko' | 'en'}
        />
      )}

      {/* Estimate 모달 */}
      {showEstimateModal && (
        <EstimateModal
          customer={estimateCustomer}
          courses={estimateCourses}
          tourCourses={tourCoursesWithPhotos as any}
          isCharterGuide={tourType === 'charter_guide'}
          mileage={mileage}
          locale={locale}
          tourCourseDescription={tourCourseDescription}
          scheduleDescription={scheduleDescription}
          totalCost={totalCost}
          entranceFees={entranceFees}
          hotelAccommodationCost={hotelAccommodationCost}
          vehicleRentalCost={vehicleRentalCost}
          fuelCost={effectiveFuelCost}
          guideFee={calculatedGuideFee}
          otherExpenses={otherExpenses}
          otherExpensesTotal={otherExpensesTotal}
          participantCount={participantCount}
          vehicleType={vehicleType}
          vehicleTypeLabel={vehicleSettings.find(s => s.vehicle_type === vehicleType)?.display_name?.trim() || (vehicleType === 'minivan' ? '미니밴' : vehicleType === '9seater' ? '9인승' : vehicleType === '13seater' ? '13인승' : vehicleType)}
          numberOfDays={numberOfDays}
          sellingPrice={sellingPrice}
          additionalCost={additionalCost}
          totalBeforeTip={totalBeforeTip}
          tipAmount={tipAmount}
          sellingPriceWithTip={sellingPriceWithTip}
          configId={currentConfigId}
          onClose={() => setShowEstimateModal(false)}
          onTourCourseDescriptionChange={setTourCourseDescription}
          onScheduleDescriptionChange={setScheduleDescription}
        />
      )}

      {/* 설정 저장 모달 */}
      <SaveConfigModal
        isOpen={showSaveConfigModal}
        configName={configName}
        onConfigNameChange={setConfigName}
        selectedCustomer={selectedCustomer}
        savedConfigs={savedConfigs}
        allCustomers={allCustomers}
        onSave={saveConfiguration}
        onClose={() => {
          setConfigName('')
          setShowSaveConfigModal(false)
        }}
        locale={locale}
      />

      {/* 설정 불러오기 모달 */}
      <LoadConfigModal
        isOpen={showLoadConfigModal}
        savedConfigs={savedConfigs}
        allCustomers={allCustomers}
        onLoad={loadConfiguration}
        onClose={() => setShowLoadConfigModal(false)}
        locale={locale}
      />

      {/* 템플릿 저장/수정 모달 */}
      <TemplateSaveModal
        isOpen={showSaveModal}
        editingTemplate={editingTemplate}
        saveConfigName={saveConfigName}
        onSaveConfigNameChange={setSaveConfigName}
        savedConfigurations={savedConfigurations}
        selectedCoursesCount={selectedCourses.size}
        selectedCoursesOrderCount={selectedCoursesOrder.length}
        onSelectTemplate={(template) => {
          if (template) {
            setEditingTemplate(template)
            setSaveConfigName(template.name)
          } else {
            setEditingTemplate(null)
            setSaveConfigName('')
          }
        }}
        onSave={saveTemplate}
        onClose={() => {
          setShowSaveModal(false)
          setSaveConfigName('')
          setEditingTemplate(null)
        }}
        locale={locale}
      />

      {/* 템플릿 불러오기 모달 */}
      <TemplateLoadModal
        isOpen={showLoadModal}
        loadingTemplates={loadingTemplates}
        savedConfigurations={savedConfigurations}
        onLoad={loadTemplate}
        onEdit={editTemplate}
        onDelete={deleteConfiguration}
        onRefresh={loadTemplates}
        onClose={() => setShowLoadModal(false)}
        locale={locale}
      />

      {/* 차량 렌트비 설정 모달 */}
      <VehicleSettingsModal
        isOpen={showVehicleSettingsModal}
        onClose={() => {
          setShowVehicleSettingsModal(false)
          setEditingVehicleType(null)
        }}
        vehicleSettings={vehicleSettings}
        onSave={saveVehicleSetting}
        onAddVehicle={addVehicleSetting}
        gasPrice={gasPrice}
        onGasPriceChange={setGasPrice}
      />

      {/* 투어 코스 수정 모달 */}
      <TourCourseEditModal
        isOpen={showCourseEditModal}
        onClose={() => {
          setShowCourseEditModal(false)
          setEditingCourse(null)
        }}
        course={editingCourse as any}
        onSave={async () => {
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

      {/* 일차 선택 모달 */}
      <DaySelectModal
        isOpen={showDaySelectModal}
        editingDayIndex={editingDayIndex}
        onSelectDay={(dayIndex, day) => {
          updateScheduleItem(dayIndex, { day })
          setShowDaySelectModal(false)
          setEditingDayIndex(null)
        }}
        onClearDay={(dayIndex) => {
          updateScheduleItem(dayIndex, { day: '' })
          setShowDaySelectModal(false)
          setEditingDayIndex(null)
        }}
        onClose={() => {
          setShowDaySelectModal(false)
          setEditingDayIndex(null)
        }}
        locale={locale}
      />

      {/* 입장료 상세 내역 모달 */}
      <EntranceFeeDetailModal
        isOpen={showEntranceFeeDetailModal}
        entranceFeeDetails={entranceFeeDetails}
        hotelAccommodationDetails={hotelAccommodationDetails}
        entranceFees={entranceFees}
        hotelAccommodationCost={hotelAccommodationCost}
        numberOfDays={numberOfDays}
        onClose={() => setShowEntranceFeeDetailModal(false)}
        locale={locale}
      />
      </div>
    </div>
  )
}

