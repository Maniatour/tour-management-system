'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useLocale } from 'next-intl'
import { Calculator, Plus, X, Route, Clock, Search, GripVertical, ArrowUp, ArrowDown, FileText, MapPin, User, Mail, Phone, Star } from 'lucide-react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import EstimateModal from '@/components/tour-cost-calculator/EstimateModal'
import VehicleSettingsModal from '@/components/tour-cost-calculator/VehicleSettingsModal'
import DaySelectModal from '@/components/tour-cost-calculator/DaySelectModal'
import EntranceFeeDetailModal from '@/components/tour-cost-calculator/EntranceFeeDetailModal'
import type { VehicleRentalSetting } from '@/components/tour-cost-calculator/VehicleSettingsModal'
import { markdownToHtml } from '@/components/LightRichEditor'

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

type MarginType = 'default' | 'low_season' | 'high_season'

const MARGIN_RATES: Record<MarginType, { min: number; max: number; default: number }> = {
  default: { min: 30, max: 30, default: 30 },
  low_season: { min: 20, max: 20, default: 20 },
  high_season: { min: 40, max: 40, default: 40 }
}

const TIP_RATE = 0.15 // 15%

export default function CustomTourPage() {
  const locale = useLocale()
  const isEnglish = locale === 'en'
  
  // 기본 상태
  const [tourCourses, setTourCourses] = useState<TourCourse[]>([])
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set())
  const [participantCount, setParticipantCount] = useState<number>(1)
  const [vehicleType, setVehicleType] = useState<'minivan' | '9seater' | '13seater'>('minivan')
  const [vehicleSettings, setVehicleSettings] = useState<VehicleRentalSetting[]>([])
  const [showVehicleSettingsModal, setShowVehicleSettingsModal] = useState(false)
  const [gasPrice, setGasPrice] = useState<number>(4.00)
  const [mileage, setMileage] = useState<number | null>(null)
  const [travelTime, setTravelTime] = useState<number | null>(null)
  const [guideHourlyRate] = useState<number>(50) // 기본 가이드 시급 $50/시간
  const [guideFee] = useState<number | null>(null) // 자동 계산만 사용
  const [marginType, setMarginType] = useState<MarginType>('default')
  const [courseSearchTerm, setCourseSearchTerm] = useState<string>('')
  const [expandedCourseNodes, setExpandedCourseNodes] = useState<Set<string>>(new Set())
  
  type CourseScheduleItem = {
    id: string
    day?: string
    time?: string
    duration?: number
  }

  const [selectedCoursesOrder, setSelectedCoursesOrder] = useState<CourseScheduleItem[]>([])
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false)
  const [travelTimes, setTravelTimes] = useState<number[]>([])
  const [map, setMap] = useState<any>(null)
  const [directionsRenderer, setDirectionsRenderer] = useState<any>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<any[]>([])
  
  // 고객 정보
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  
  // 기타 금액
  type OtherExpense = {
    id: string
    name: string
    amount: number
  }
  const [otherExpenses, setOtherExpenses] = useState<OtherExpense[]>([])
  
  const [showEstimateModal, setShowEstimateModal] = useState(false)
  const [tourCourseDescription, setTourCourseDescription] = useState('')
  const [scheduleDescription, setScheduleDescription] = useState('')
  const [showDaySelectModal, setShowDaySelectModal] = useState(false)
  const [editingDayIndex, setEditingDayIndex] = useState<number | null>(null)
  const [showEntranceFeeDetailModal, setShowEntranceFeeDetailModal] = useState(false)

  // 호텔 숙박인지 확인
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

  // 호텔 숙박비 상세 내역
  const hotelAccommodationDetails = useMemo(() => {
    const details: EntranceFeeDetail[] = []
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
    loadAllTourCourses()
    loadVehicleSettings()
  }, [])

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

  // 선택된 코스 순서 동기화
  useEffect(() => {
    const selectedArray = Array.from(selectedCourses)
    
    if (selectedArray.length === 0) {
      setSelectedCoursesOrder([])
      return
    }

    const hasSelectedChild = (courseId: string): boolean => {
      const course = tourCourses.find(c => c.id === courseId)
      if (!course) return false
      const directChildren = tourCourses.filter(c => c.parent_id === courseId)
      const hasDirectSelectedChild = directChildren.some(child => selectedCourses.has(child.id))
      if (hasDirectSelectedChild) return true
      return directChildren.some(child => hasSelectedChild(child.id))
    }

    const leafCourses = selectedArray.filter(courseId => {
      return !hasSelectedChild(courseId)
    })

    setSelectedCoursesOrder(prev => {
      const normalizedPrev = prev.map((item: any) => {
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

      const newOrder = normalizedPrev.filter(item => leafCourses.includes(item.id))
      const newItems = leafCourses
        .filter(id => !normalizedPrev.some(item => item.id === id))
        .map(id => {
          const course = tourCourses.find(c => c.id === id)
          return {
            id,
            duration: course?.duration_hours || 0,
            day: '',
            time: ''
          }
        })
      return [...newOrder, ...newItems]
    })
  }, [selectedCourses, tourCourses])

  const loadAllTourCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('tour_courses')
        .select('*')
        .eq('is_active', true)
        .order('name_ko', { ascending: true })

      if (error) throw error
      
      const courseIds = (data || []).map(c => c.id)
      if (courseIds.length > 0) {
        const { data: photosData } = await supabase
          .from('tour_course_photos')
          .select('id, course_id, photo_url, thumbnail_url, is_primary')
          .in('course_id', courseIds)
          .order('is_primary', { ascending: false })
          .order('sort_order', { ascending: true })

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

    const calculateLevels = (course: TourCourse, level: number = 0) => {
      course.level = level
      if (course.children) {
        course.children.forEach((child: TourCourse) => calculateLevels(child, level + 1))
      }
    }

    rootCourses.forEach(course => calculateLevels(course, 0))
    return rootCourses
  }

  const filteredTourCoursesFlat = useMemo(() => {
    if (!courseSearchTerm) return tourCourses
    
    const searchLower = courseSearchTerm.toLowerCase()
    return tourCourses.filter(course => 
      course.name_ko?.toLowerCase().includes(searchLower) ||
      course.name_en?.toLowerCase().includes(searchLower) ||
      course.location?.toLowerCase().includes(searchLower)
    )
  }, [tourCourses, courseSearchTerm])

  const hierarchicalCourses = useMemo(() => {
    const coursesToUse = courseSearchTerm ? filteredTourCoursesFlat : tourCourses
    return buildHierarchy(coursesToUse)
  }, [tourCourses, filteredTourCoursesFlat, courseSearchTerm])

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

  // 호텔 숙박비 계산
  const hotelAccommodationCost = useMemo(() => {
    let total = 0
    const selected = tourCourses.filter(course => selectedCourses.has(course.id) && isHotelAccommodation(course))

    selected.forEach(course => {
      if (course.price_type === 'per_vehicle') {
        if (vehicleType === 'minivan' && course.price_minivan) {
          total += course.price_minivan
        } else if (vehicleType === '9seater' && course.price_9seater) {
          total += course.price_9seater
        } else if (vehicleType === '13seater' && course.price_13seater) {
          total += course.price_13seater
        }
      } else {
        if (course.price_adult) {
          total += course.price_adult * participantCount
        }
      }
    })

    const guideAccommodationCost = numberOfDays > 1 ? (numberOfDays - 1) * 100 : 0
    total += guideAccommodationCost

    return total
  }, [selectedCourses, tourCourses, vehicleType, participantCount, numberOfDays])

  // 입장료 계산
  const entranceFees = useMemo(() => {
    let total = 0
    const selected = tourCourses.filter(course => selectedCourses.has(course.id) && !isHotelAccommodation(course))

    selected.forEach(course => {
      if (course.price_type === 'per_vehicle') {
        if (vehicleType === 'minivan' && course.price_minivan) {
          total += course.price_minivan
        } else if (vehicleType === '9seater' && course.price_9seater) {
          total += course.price_9seater
        } else if (vehicleType === '13seater' && course.price_13seater) {
          total += course.price_13seater
        }
      } else {
        if (course.price_adult) {
          total += course.price_adult * participantCount
        }
      }
    })

    return total
  }, [selectedCourses, tourCourses, vehicleType, participantCount])

  // 차량 렌트비
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

  // 총 소요 시간 자동 계산 (선택된 코스들의 duration 합산 + 이동 시간)
  const totalHours = useMemo(() => {
    let hours = 0
    
    // 선택된 코스들의 duration 합산 (분 단위를 시간으로 변환)
    selectedCoursesOrder.forEach(item => {
      if (item.duration) {
        hours += item.duration / 60 // 분을 시간으로 변환
      }
    })
    
    // 이동 시간 추가
    if (travelTime !== null && travelTime > 0) {
      hours += travelTime
    }
    
    return hours
  }, [selectedCoursesOrder, travelTime])

  // 가이드비 자동 계산
  const calculatedGuideFee = useMemo(() => {
    return totalHours * guideHourlyRate
  }, [totalHours, guideHourlyRate])

  // 기타 금액 합계
  const otherExpensesTotal = useMemo(() => {
    return otherExpenses.reduce((sum, expense) => sum + expense.amount, 0)
  }, [otherExpenses])

  // 총 실비
  const totalCost = useMemo(() => {
    return entranceFees + hotelAccommodationCost + vehicleRentalCost + fuelCost + calculatedGuideFee
  }, [entranceFees, hotelAccommodationCost, vehicleRentalCost, fuelCost, calculatedGuideFee])

  // 마진율
  const marginRate = useMemo(() => {
    return MARGIN_RATES[marginType].default
  }, [marginType])

  // 판매가
  const sellingPrice = useMemo(() => {
    return totalCost / (1 - marginRate / 100)
  }, [totalCost, marginRate])

  // 추가 비용
  const additionalCost = useMemo(() => {
    return otherExpensesTotal
  }, [otherExpensesTotal])

  // 팁 계산 전 총액
  const totalBeforeTip = useMemo(() => {
    return sellingPrice + additionalCost
  }, [sellingPrice, additionalCost])

  // 팁 계산
  const tipAmount = useMemo(() => {
    return totalBeforeTip * TIP_RATE
  }, [totalBeforeTip])

  // 팁 포함 판매가
  const sellingPriceWithTip = useMemo(() => {
    return totalBeforeTip + tipAmount
  }, [totalBeforeTip, tipAmount])

  // 일정 항목 정보 업데이트
  const updateScheduleItem = (index: number, updates: Partial<CourseScheduleItem>) => {
    setSelectedCoursesOrder(prev => {
      const newOrder = [...prev]
      newOrder[index] = { ...newOrder[index], ...updates }
      return newOrder
    })
  }

  // 드래그 앤 드롭 핸들러
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return
    const items = Array.from(selectedCoursesOrder)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)
    setSelectedCoursesOrder(items)
  }

  // 순서 변경 함수
  const moveCourse = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...selectedCoursesOrder]
    if (direction === 'up' && index > 0) {
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]
    } else if (direction === 'down' && index < newOrder.length - 1) {
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
    }
    setSelectedCoursesOrder(newOrder)
  }

  // Google Maps 초기화
  useEffect(() => {
    let isInitialized = false
    let timeoutId: NodeJS.Timeout | null = null

    const initializeMap = () => {
      if (isInitialized || !mapRef.current || !window.google || !window.google.maps) {
        if (!mapRef.current && !isInitialized) {
          timeoutId = setTimeout(initializeMap, 100)
        }
        return
      }

      if (!window.google.maps.Map) {
        timeoutId = setTimeout(initializeMap, 100)
        return
      }

      try {
        const mapOptions: any = {
          center: { lat: 36.1699, lng: -115.1398 },
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

      const checkMapRef = () => {
        if (mapRef.current) {
          if (window.google && window.google.maps && window.google.maps.Map) {
            initializeMap()
          } else {
            const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
            if (existingScript) {
              const checkGoogle = () => {
                if (window.google && window.google.maps && window.google.maps.Map) {
                  initializeMap()
                } else {
                  timeoutId = setTimeout(checkGoogle, 100)
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
        } else {
          timeoutId = setTimeout(checkMapRef, 100)
        }
      }

      checkMapRef()
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [])

  // DirectionsRenderer 초기화
  useEffect(() => {
    if (!map || !window.google || !window.google.maps) return
    if (!(window.google.maps as any).DirectionsRenderer) return

    const renderer = new (window.google.maps as any).DirectionsRenderer({
      map: map,
      suppressMarkers: true,
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

  // 경로 계산
  const calculateRoute = async () => {
    if (selectedCoursesOrder.length < 2) {
      alert(isEnglish ? 'Please select at least 2 courses.' : '최소 2개 이상의 코스를 선택해주세요.')
      return
    }

    setIsCalculatingRoute(true)

    try {
      if (!map || !window.google || !window.google.maps) {
        alert(isEnglish ? 'Map is not loaded yet.' : '지도가 아직 로드되지 않았습니다.')
        setIsCalculatingRoute(false)
        return
      }

      const directionsService = new window.google.maps.DirectionsService()
      const waypoints = selectedCoursesOrder.slice(1, -1).map(item => {
        const course = tourCourses.find(c => c.id === item.id)
        return {
          location: course?.location || '',
          stopover: true
        }
      }).filter(wp => wp.location)

      const origin = tourCourses.find(c => c.id === selectedCoursesOrder[0].id)?.location || ''
      const destination = tourCourses.find(c => c.id === selectedCoursesOrder[selectedCoursesOrder.length - 1].id)?.location || ''

      if (!origin || !destination) {
        alert(isEnglish ? 'Some courses are missing location information.' : '일부 코스에 위치 정보가 없습니다.')
        setIsCalculatingRoute(false)
        return
      }

      const request: any = {
        origin,
        destination,
        waypoints: waypoints.length > 0 ? waypoints : undefined,
        optimizeWaypoints: false,
        travelMode: window.google.maps.TravelMode.DRIVING
      }

      directionsService.route(request, (result: any, status: any) => {
        if (status === window.google.maps.DirectionsStatus.OK && directionsRenderer) {
          directionsRenderer.setDirections(result)
          
          const route = result.routes[0]
          let totalDistance = 0
          const times: number[] = []

          route.legs.forEach((leg: any) => {
            totalDistance += leg.distance.value / 1609.34 // 미터를 마일로 변환
            times.push(leg.duration.value) // 초 단위
          })

          setMileage(totalDistance)
          setTravelTimes(times)
          setTravelTime(times.reduce((sum, time) => sum + time, 0) / 3600) // 시간 단위

          // 마커 추가
          if (markersRef.current) {
            markersRef.current.forEach(marker => marker.setMap(null))
            markersRef.current = []
          }

          selectedCoursesOrder.forEach((item, index) => {
            const course = tourCourses.find(c => c.id === item.id)
            if (course?.location) {
              const geocoder = new window.google.maps.Geocoder()
              geocoder.geocode({ address: course.location }, (results: any, status: any) => {
                if (status === 'OK' && results[0]) {
                  const marker = new window.google.maps.Marker({
                    position: results[0].geometry.location,
                    map: map,
                    label: {
                      text: String(index + 1),
                      color: 'white',
                      fontWeight: 'bold'
                    },
                    icon: {
                      path: window.google.maps.SymbolPath.CIRCLE,
                      scale: 8,
                      fillColor: '#3B82F6',
                      fillOpacity: 1,
                      strokeColor: 'white',
                      strokeWeight: 2
                    }
                  })
                  markersRef.current.push(marker)
                }
              })
            }
          })
        } else {
          console.error('경로 계산 오류:', status)
          alert(isEnglish ? 'Failed to calculate route.' : '경로 계산에 실패했습니다.')
        }
        setIsCalculatingRoute(false)
      })
    } catch (error) {
      console.error('경로 계산 중 오류:', error)
      alert(isEnglish ? 'An error occurred while calculating the route.' : '경로 계산 중 오류가 발생했습니다.')
      setIsCalculatingRoute(false)
    }
  }

  // Estimate 모달용 데이터 준비
  const estimateCourses = useMemo(() => {
    return selectedCoursesOrder.map(item => {
      const course = tourCourses.find(c => c.id === item.id)
      return {
        courseId: item.id,
        courseName: course?.name_ko || course?.name_en || '',
        day: item.day || '',
        time: item.time || '',
        duration: item.duration || null
      }
    })
  }, [selectedCoursesOrder, tourCourses])

  const tourCoursesWithPhotos = useMemo(() => {
    return tourCourses.filter(course => selectedCourses.has(course.id))
  }, [tourCourses, selectedCourses])

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
        <div className="mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            {isEnglish ? 'Custom Tour Calculator' : '단독 맞춤 투어 계산기'}
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            {isEnglish 
              ? 'Select your desired destinations and create your custom tour itinerary' 
              : '원하는 관광지를 선택하고 나만의 맞춤 투어 일정을 만들어보세요'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* 왼쪽: 코스 선택 및 일정 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. 관광지 선택 */}
            <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
                {isEnglish ? '1. Select Destinations' : '1. 관광지 선택'}
              </h2>
              
              <div className="mb-3 sm:mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={courseSearchTerm}
                    onChange={(e) => setCourseSearchTerm(e.target.value)}
                    placeholder={isEnglish ? 'Search destinations...' : '관광지 검색...'}
                    className="w-full pl-10 pr-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4 bg-gray-50 max-h-[400px] sm:max-h-[600px] overflow-y-auto">
                {(() => {
                  // 모든 부모 이름을 계층적으로 가져오는 함수
                  const getFullCoursePath = (course: TourCourse, isEnglish: boolean): string => {
                    const path: string[] = []
                    let current: TourCourse | undefined = course
                    const visited = new Set<string>()
                    
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
                      
                      const parentId = current.parent_id
                      const parent = tourCourses.find((c: TourCourse) => c.id === parentId)
                      if (parent) {
                        current = parent
                      } else {
                        break
                      }
                    }
                    
                    return path.join(' > ')
                  }

                  // 필터링된 코스 목록 (검색어가 있으면 필터링)
                  let displayCourses = tourCourses
                  
                  if (courseSearchTerm) {
                    const searchLower = courseSearchTerm.toLowerCase()
                    displayCourses = tourCourses.filter(course => {
                      const courseName = isEnglish 
                        ? (course.customer_name_en || course.customer_name_ko || course.name_en || course.name_ko || '')
                        : (course.customer_name_ko || course.customer_name_en || course.name_ko || course.name_en || '')
                      const courseDescription = isEnglish
                        ? (course.customer_description_en || course.customer_description_ko || '')
                        : (course.customer_description_ko || course.customer_description_en || '')
                      
                      return courseName.toLowerCase().includes(searchLower) ||
                             courseDescription.toLowerCase().includes(searchLower) ||
                             course.location?.toLowerCase().includes(searchLower) ||
                             course.name_ko?.toLowerCase().includes(searchLower) ||
                             course.name_en?.toLowerCase().includes(searchLower)
                    })
                  }

                  // 최하위 포인트의 부모만 필터링
                  // 3단 구조면 2단만, 2단 구조면 1단만, 1단 구조면 그것만 표시
                  const pointCourses = displayCourses.filter(course => {
                    // 휴게소, 식사 관련 코스 제외
                    const category = course.category?.toLowerCase() || ''
                    const name = (course.name_ko || course.name_en || course.customer_name_ko || course.customer_name_en || '').toLowerCase()
                    
                    if (category.includes('휴게') || category.includes('rest') || 
                        category.includes('식사') || category.includes('restaurant') || 
                        category.includes('음식') || category.includes('food') ||
                        name.includes('휴게') || name.includes('rest') ||
                        name.includes('식사') || name.includes('restaurant') ||
                        name.includes('음식') || name.includes('food')) {
                      return false
                    }
                    
                    // 이 코스의 자식들을 찾기
                    const children = tourCourses.filter(c => c.parent_id === course.id)
                    
                    // 1. 자식이 없고 부모가 없으면 → 표시 (1단 구조, 예: 홀스슈 밴드)
                    if (children.length === 0 && !course.parent_id) {
                      return true
                    }
                    
                    // 2. 자식이 없고 부모가 있으면 → 제외 (최하위 포인트, 예: 리판 포인트, 선라이즈 포인트)
                    if (children.length === 0 && course.parent_id) {
                      return false
                    }
                    
                    // 3. 자식이 있으면, 그 자식 중 하나라도 자식이 없는 경우 (최하위 포인트를 자식으로 가진 경우) → 표시
                    // 예: 사우스림(자식: 리판 포인트), 브라이스캐년(자식: 선라이즈 포인트)
                    const hasLeafChild = children.some(child => {
                      const grandChildren = tourCourses.filter(c => c.parent_id === child.id)
                      return grandChildren.length === 0 // 자식의 자식이 없으면 최하위 포인트
                    })
                    
                    return hasLeafChild
                  })

                  // 이름과 설명이 있는 코스만 필터링
                  let validCourses = pointCourses.filter(course => {
                    const courseName = isEnglish 
                      ? (course.customer_name_en || course.customer_name_ko || course.name_en || course.name_ko || '')
                      : (course.customer_name_ko || course.customer_name_en || course.name_ko || course.name_en || '')
                    const courseDescription = isEnglish
                      ? (course.customer_description_en || course.customer_description_ko || '')
                      : (course.customer_description_ko || course.customer_description_en || '')
                    
                    return courseName.trim() !== '' || courseDescription.trim() !== ''
                  })


                  if (validCourses.length === 0) {
                    return (
                      <p className="text-sm text-gray-500 text-center py-8">
                        {isEnglish ? 'No destinations found' : '관광지가 없습니다'}
                      </p>
                    )
                  }

                  // 부모별로 그룹화
                  const groupedCourses = new Map<string, TourCourse[]>()
                  validCourses.forEach(course => {
                    const parentId = course.parent_id || 'root'
                    if (!groupedCourses.has(parentId)) {
                      groupedCourses.set(parentId, [])
                    }
                    groupedCourses.get(parentId)!.push(course)
                  })

                  // 그룹별로 렌더링
                  const result: JSX.Element[] = []
                  groupedCourses.forEach((courses, parentId) => {
                    // 부모 이름 가져오기
                    let groupHeader = ''
                    if (parentId !== 'root') {
                      const parentCourse = tourCourses.find(c => c.id === parentId)
                      if (parentCourse) {
                        const parentName = isEnglish 
                          ? (parentCourse.customer_name_en || parentCourse.customer_name_ko || parentCourse.name_en || parentCourse.name_ko || '')
                          : (parentCourse.customer_name_ko || parentCourse.customer_name_en || parentCourse.name_ko || parentCourse.name_en || '')
                        
                        // 부모의 부모도 확인하여 전체 경로 생성
                        if (parentCourse.parent_id) {
                          const grandParent = tourCourses.find(c => c.id === parentCourse.parent_id)
                          if (grandParent) {
                            const grandParentName = isEnglish 
                              ? (grandParent.customer_name_en || grandParent.customer_name_ko || grandParent.name_en || grandParent.name_ko || '')
                              : (grandParent.customer_name_ko || grandParent.customer_name_en || grandParent.name_ko || grandParent.name_en || '')
                            if (grandParentName.trim()) {
                              groupHeader = `${grandParentName} > ${parentName}`
                            } else {
                              groupHeader = parentName
                            }
                          } else {
                            groupHeader = parentName
                          }
                        } else {
                          groupHeader = parentName
                        }
                      }
                    }

                    // 그룹 헤더 추가
                    if (groupHeader && courses.length > 0) {
                      result.push(
                        <div key={`group-${parentId}`} className="bg-gray-100 border border-gray-200 rounded-lg p-3 mb-4">
                          <div className="font-semibold text-gray-900">{groupHeader}</div>
                        </div>
                      )
                    }

                    // 각 코스 렌더링
                    courses.forEach(course => {
                      const fullCourseName = getFullCoursePath(course, isEnglish)
                      
                      const courseDescription = isEnglish
                        ? (course.customer_description_en || course.customer_description_ko || '')
                        : (course.customer_description_ko || course.customer_description_en || '')

                      // 사진 가져오기
                      const primaryPhoto = course.photos?.find(p => p.is_primary) || course.photos?.[0]
                      const photoUrl = primaryPhoto?.photo_url || primaryPhoto?.thumbnail_url || null
                      
                      // 사진 URL이 상대 경로인 경우 절대 경로로 변환
                      let fullPhotoUrl = photoUrl
                      if (photoUrl && !photoUrl.startsWith('http')) {
                        fullPhotoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-course-photos/${photoUrl}`
                      }

                      const isSelected = selectedCourses.has(course.id)

                      result.push(
                        <div 
                          key={course.id} 
                          className={`bg-white border rounded-lg p-3 sm:p-4 cursor-pointer transition-all hover:shadow-md ${
                            isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                          }`}
                          onClick={() => {
                            const newSet = new Set(selectedCourses)
                            if (isSelected) {
                              newSet.delete(course.id)
                              
                              // 상위 카테고리를 해제하면 하위 자식들도 모두 해제
                              const getAllChildIds = (courseId: string): string[] => {
                                const children: string[] = []
                                const findChildren = (parentId: string) => {
                                  const directChildren = tourCourses.filter(c => c.parent_id === parentId)
                                  directChildren.forEach(child => {
                                    children.push(child.id)
                                    findChildren(child.id)
                                  })
                                }
                                findChildren(courseId)
                                return children
                              }
                              
                              const childIds = getAllChildIds(course.id)
                              childIds.forEach(childId => {
                                newSet.delete(childId)
                              })
                            } else {
                              newSet.add(course.id)
                              
                              // 하위 포인트를 선택하면 모든 상위 부모도 자동 선택
                              const getAllParentIds = (courseId: string, visited = new Set<string>()): string[] => {
                                if (visited.has(courseId)) return []
                                visited.add(courseId)
                                
                                const currentCourse = tourCourses.find(c => c.id === courseId)
                                if (!currentCourse || !currentCourse.parent_id) return []
                                
                                const parents = [currentCourse.parent_id]
                                const grandParents = getAllParentIds(currentCourse.parent_id, visited)
                                return [...parents, ...grandParents]
                              }
                              
                              const parentIds = getAllParentIds(course.id)
                              parentIds.forEach(parentId => {
                                newSet.add(parentId)
                              })
                            }
                            setSelectedCourses(newSet)
                          }}
                        >
                          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start">
                            {/* 왼쪽: 체크박스와 사진 */}
                            <div className="flex items-start gap-3 w-full sm:w-auto">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  const newSet = new Set(selectedCourses)
                                  if (isSelected) {
                                    newSet.delete(course.id)
                                    
                                    // 상위 카테고리를 해제하면 하위 자식들도 모두 해제
                                    const getAllChildIds = (courseId: string): string[] => {
                                      const children: string[] = []
                                      const findChildren = (parentId: string) => {
                                        const directChildren = tourCourses.filter(c => c.parent_id === parentId)
                                        directChildren.forEach(child => {
                                          children.push(child.id)
                                          findChildren(child.id)
                                        })
                                      }
                                      findChildren(courseId)
                                      return children
                                    }
                                    
                                    const childIds = getAllChildIds(course.id)
                                    childIds.forEach(childId => {
                                      newSet.delete(childId)
                                    })
                                  } else {
                                    newSet.add(course.id)
                                    
                                    // 하위 포인트를 선택하면 모든 상위 부모도 자동 선택
                                    const getAllParentIds = (courseId: string, visited = new Set<string>()): string[] => {
                                      if (visited.has(courseId)) return []
                                      visited.add(courseId)
                                      
                                      const currentCourse = tourCourses.find(c => c.id === courseId)
                                      if (!currentCourse || !currentCourse.parent_id) return []
                                      
                                      const parents = [currentCourse.parent_id]
                                      const grandParents = getAllParentIds(currentCourse.parent_id, visited)
                                      return [...parents, ...grandParents]
                                    }
                                    
                                    const parentIds = getAllParentIds(course.id)
                                    parentIds.forEach(parentId => {
                                      newSet.add(parentId)
                                    })
                                  }
                                  setSelectedCourses(newSet)
                                }}
                                className="w-5 h-5 text-blue-600 rounded cursor-pointer flex-shrink-0 mt-1"
                                onClick={(e) => e.stopPropagation()}
                              />
                              {fullPhotoUrl && (
                                <div className="flex-shrink-0 w-full sm:w-48">
                                  <img 
                                    src={fullPhotoUrl} 
                                    alt={fullCourseName || 'Course image'} 
                                    className="w-full h-32 sm:h-36 object-cover rounded-lg border border-gray-200"
                                  />
                                </div>
                              )}
                            </div>
                            {/* 오른쪽: 제목과 설명 */}
                            <div className="flex-1 min-w-0 w-full sm:w-auto">
                              {fullCourseName.trim() !== '' && (
                                <div className="font-semibold text-sm sm:text-base text-gray-900 mb-2 flex items-center gap-2">
                                  <span>{fullCourseName}</span>
                                  {course.is_favorite && (
                                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                                  )}
                                </div>
                              )}
                              {courseDescription && courseDescription.trim() !== '' && (
                                <div 
                                  className="text-xs sm:text-sm text-gray-700 whitespace-pre-wrap"
                                  dangerouslySetInnerHTML={{ 
                                    __html: markdownToHtml(courseDescription) 
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  })

                  return result
                })()}
              </div>
            </div>

            {/* 2. 일정 구성 */}
            {selectedCoursesOrder.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">
                  {isEnglish ? '2. Tour Schedule' : '2. 투어 일정'}
                </h2>
                
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="schedule">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                        {selectedCoursesOrder.map((item, index) => {
                          const course = tourCourses.find(c => c.id === item.id)
                          const courseName = isEnglish 
                            ? (course?.customer_name_en || course?.customer_name_ko || course?.name_en || course?.name_ko || '')
                            : (course?.customer_name_ko || course?.customer_name_en || course?.name_ko || course?.name_en || '')
                          
                          return (
                            <Draggable key={item.id} draggableId={item.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 ${
                                    snapshot.isDragging ? 'shadow-lg' : ''
                                  }`}
                                >
                                  <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <div {...provided.dragHandleProps} className="text-gray-400 cursor-move">
                                      <GripVertical className="w-5 h-5" />
                                    </div>
                                    
                                    <div className="flex-1 sm:flex-none">
                                      <div className="font-medium text-sm sm:text-base text-gray-900">{courseName}</div>
                                    </div>
                                  </div>
                                  
                                  <div className="flex-1 w-full sm:w-auto">
                                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                                      <button
                                        onClick={() => {
                                          setEditingDayIndex(index)
                                          setShowDaySelectModal(true)
                                        }}
                                        className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 px-2 py-1 border border-blue-300 rounded"
                                      >
                                        {item.day || (isEnglish ? 'Select Day' : '일차 선택')}
                                      </button>
                                      <input
                                        type="time"
                                        value={item.time || ''}
                                        onChange={(e) => updateScheduleItem(index, { time: e.target.value })}
                                        className="text-xs sm:text-sm border border-gray-300 rounded px-2 py-1.5 sm:py-1 w-full sm:w-auto"
                                      />
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 ml-auto sm:ml-0">
                                    <button
                                      onClick={() => moveCourse(index, 'up')}
                                      disabled={index === 0}
                                      className="p-2 sm:p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                    >
                                      <ArrowUp className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => moveCourse(index, 'down')}
                                      disabled={index === selectedCoursesOrder.length - 1}
                                      className="p-2 sm:p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                    >
                                      <ArrowDown className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        const newSet = new Set(selectedCourses)
                                        newSet.delete(item.id)
                                        setSelectedCourses(newSet)
                                      }}
                                      className="p-2 sm:p-1 text-gray-400 hover:text-red-600"
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

            {/* 3. 경로 및 마일리지 */}
            {selectedCoursesOrder.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">
                  {isEnglish ? '3. Route & Mileage' : '3. 경로 및 마일리지'}
                </h2>
                
                <div className="mb-4 sm:mb-6 h-[250px] sm:h-[400px] w-full rounded-lg border border-gray-200 overflow-hidden relative bg-gray-50">
                  <div ref={mapRef} className="w-full h-full" />
                  {!map && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                        <p>{isEnglish ? 'Loading map...' : '지도를 불러오는 중...'}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <button
                    onClick={calculateRoute}
                    disabled={selectedCoursesOrder.length < 2 || isCalculatingRoute}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
                  >
                    {isCalculatingRoute ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        {isEnglish ? 'Calculating...' : '계산 중...'}
                      </>
                    ) : (
                      <>
                        <Route className="w-4 h-4" />
                        {isEnglish ? 'Calculate Route' : '경로 자동 계산'}
                      </>
                    )}
                  </button>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {isEnglish ? 'Mileage (miles)' : '마일리지 (마일)'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={mileage || ''}
                      onChange={(e) => setMileage(e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder={isEnglish ? 'Enter manually or auto-calculate' : '직접 입력 또는 자동 계산'}
                    />
                  </div>
                </div>
                {travelTime !== null && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">
                        {isEnglish ? 'Total Travel Time:' : '이동 시간 총합:'}
                      </span>
                      <span className="text-sm font-semibold text-blue-700">
                        {travelTime.toFixed(1)} {isEnglish ? 'hours' : '시간'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 투어 코스 설명 */}
            {selectedCoursesOrder.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
                  {isEnglish ? 'Tour Course Description' : '투어 코스 설명'}
                </h2>
                <div className="border border-gray-200 rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4 bg-gray-50">
                  {(() => {
                    const courseOrderMap = new Map<string, number>()
                    selectedCoursesOrder.forEach((c, index) => {
                      courseOrderMap.set(c.id, index)
                    })
                    
                    const pointCourses = tourCourses.filter(course => {
                      const category = course.category?.toLowerCase() || ''
                      return courseOrderMap.has(course.id) && 
                             (category.includes('포인트') || category.includes('point'))
                    })

                    const validCourses = pointCourses.filter(course => {
                      const courseName = isEnglish 
                        ? (course.customer_name_en || course.customer_name_ko || '')
                        : (course.customer_name_ko || course.customer_name_en || '')
                      const courseDescription = isEnglish
                        ? (course.customer_description_en || course.customer_description_ko || '')
                        : (course.customer_description_ko || course.customer_description_en || '')
                      return courseName.trim() !== '' || courseDescription.trim() !== ''
                    })

                    validCourses.sort((a, b) => {
                      const orderA = courseOrderMap.get(a.id) ?? Infinity
                      const orderB = courseOrderMap.get(b.id) ?? Infinity
                      return orderA - orderB
                    })

                    if (validCourses.length === 0) {
                      return (
                        <p className="text-sm text-gray-500 text-center py-4">
                          {isEnglish ? 'No point courses selected.' : '포인트 코스가 없습니다.'}
                        </p>
                      )
                    }

                    return validCourses.map((course) => {
                      const getFullPath = (currentCourse: TourCourse): string[] => {
                        const path: string[] = []
                        let current: TourCourse | undefined = currentCourse
                        const visited = new Set<string>()
                        
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
                          
                          const parentId = current.parent_id
                          const parent = tourCourses.find((c: TourCourse) => c.id === parentId)
                          if (parent) {
                            current = parent
                          } else {
                            break
                          }
                        }
                        
                        return path
                      }
                      
                      const pathNames = getFullPath(course)
                      const fullCourseName = pathNames.join(' > ')
                      
                      const courseDescription = isEnglish
                        ? (course.customer_description_en || course.customer_description_ko || '')
                        : (course.customer_description_ko || course.customer_description_en || '')

                      const primaryPhoto = course.photos?.find(p => p.is_primary) || course.photos?.[0]
                      const photoUrl = primaryPhoto?.photo_url || primaryPhoto?.thumbnail_url || null
                      
                      let fullPhotoUrl = photoUrl
                      if (photoUrl && !photoUrl.startsWith('http')) {
                        fullPhotoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-course-photos/${photoUrl}`
                      }

                      return (
                        <div key={course.id} className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
                          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start">
                            {fullPhotoUrl && (
                              <div className="flex-shrink-0 w-full sm:w-48">
                                <img 
                                  src={fullPhotoUrl} 
                                  alt={fullCourseName || 'Course image'} 
                                  className="w-full h-32 sm:h-36 object-cover rounded-lg border border-gray-200"
                                />
                              </div>
                            )}
                            <div className="flex-1 min-w-0 w-full sm:w-auto">
                              {fullCourseName.trim() !== '' && (
                                <div className="font-semibold text-sm sm:text-base text-gray-900 mb-2">
                                  {fullCourseName}
                                </div>
                              )}
                              {courseDescription && courseDescription.trim() !== '' && (
                                <div className="text-xs sm:text-sm text-gray-700 whitespace-pre-wrap">
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
            )}
          </div>

          {/* 오른쪽: 계산 결과 및 고객 정보 */}
          <div className="lg:col-span-1 space-y-4 sm:space-y-6 order-first lg:order-last">
            {/* 고객 정보 */}
            <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
                <User className="w-4 h-4 sm:w-5 sm:h-5" />
                {isEnglish ? 'Customer Information' : '고객 정보'}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isEnglish ? 'Name' : '이름'} *
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={isEnglish ? 'Enter your name' : '이름을 입력하세요'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isEnglish ? 'Email' : '이메일'} *
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={isEnglish ? 'Enter your email' : '이메일을 입력하세요'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isEnglish ? 'Phone' : '전화번호'}
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={isEnglish ? 'Enter your phone number' : '전화번호를 입력하세요'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isEnglish ? 'Participants' : '참가 인원'} *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={participantCount}
                    onChange={(e) => setParticipantCount(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={isEnglish ? 'Number of participants' : '참가 인원 수'}
                  />
                </div>
              </div>
            </div>

            {/* 투어 정보 */}
            <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
                {isEnglish ? 'Tour Details' : '투어 정보'}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isEnglish ? 'Vehicle Type' : '차량 타입'}
                    <span className="ml-2 text-xs text-gray-500 font-normal">
                      ({isEnglish ? 'Auto' : '자동'})
                    </span>
                  </label>
                  <input
                    type="text"
                    value={vehicleType === 'minivan' 
                      ? (isEnglish ? 'Minivan (1-5 people)' : '미니밴 (1~5인)')
                      : vehicleType === '9seater'
                      ? (isEnglish ? '9-seater (6-9 people)' : '9인승 (6~9인)')
                      : (isEnglish ? '13-seater (10+ people)' : '13인승 (10인 이상)')}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 cursor-not-allowed"
                  />
                </div>
                
                {/* 가이드비 자동 계산 표시 */}
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-800 mb-2">
                    {isEnglish ? 'Guide Fee (Auto-calculated)' : '가이드비 (자동 계산)'}
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>{isEnglish ? 'Total Hours:' : '총 소요 시간:'}</span>
                      <span className="font-medium">{totalHours.toFixed(1)} {isEnglish ? 'hours' : '시간'}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>{isEnglish ? 'Hourly Rate:' : '시급:'}</span>
                      <span className="font-medium">${guideHourlyRate.toFixed(2)}/{isEnglish ? 'hour' : '시간'}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold text-gray-900 pt-2 border-t border-gray-200">
                      <span>{isEnglish ? 'Guide Fee:' : '가이드비:'}</span>
                      <span className="text-blue-600">${calculatedGuideFee.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 기타 금액 */}
              <div className="pt-4 mt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-800">
                    {isEnglish ? 'Other Expenses' : '기타 금액'}
                  </h3>
                  <button
                    onClick={() => {
                      setOtherExpenses([...otherExpenses, { id: crypto.randomUUID(), name: '', amount: 0 }])
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    {isEnglish ? 'Add' : '추가'}
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
                          placeholder={isEnglish ? 'Item name' : '항목명'}
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
                          placeholder={isEnglish ? 'Amount' : '금액'}
                          className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                          onClick={() => {
                            setOtherExpenses(otherExpenses.filter((_, i) => i !== index))
                          }}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 비용 계산 결과 */}
            <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6 lg:sticky lg:top-20">
              <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
                {isEnglish ? 'Cost Estimate' : '비용 계산 결과'}
              </h2>
              
              <div className="space-y-3 sm:space-y-4">
                <div className="border-b pb-3 sm:pb-4">
                  <div className="flex justify-between text-base sm:text-lg font-semibold mb-2">
                    <span className="text-sm sm:text-base">{isEnglish ? 'Selling Price (excl. tip)' : '판매가 (팁 제외)'}</span>
                    <span className="text-blue-600 text-sm sm:text-base">${totalBeforeTip.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm text-gray-600 mb-1">
                    <span>{isEnglish ? 'Tip (15%)' : '팁 (15%)'}</span>
                    <span>${tipAmount.toFixed(2)}</span>
                  </div>
                </div>

                <div className="pt-3 sm:pt-4 border-t-2 border-gray-300">
                  <div className="flex justify-between text-lg sm:text-xl font-bold">
                    <span className="text-base sm:text-lg">{isEnglish ? 'Total Price (incl. tip)' : '팁 포함 총액'}</span>
                    <span className="text-green-600 text-base sm:text-lg">${sellingPriceWithTip.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* 견적서 요청 버튼 */}
              <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t">
                <button
                  onClick={() => {
                    if (!customerName || !customerEmail) {
                      alert(isEnglish ? 'Please enter your name and email.' : '이름과 이메일을 입력해주세요.')
                      return
                    }
                    if (selectedCoursesOrder.length === 0) {
                      alert(isEnglish ? 'Please select at least one destination.' : '최소 하나 이상의 관광지를 선택해주세요.')
                      return
                    }
                    setShowEstimateModal(true)
                  }}
                  disabled={selectedCoursesOrder.length === 0 || !customerName || !customerEmail}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                >
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>{isEnglish ? 'Request Estimate' : '견적서 요청'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Estimate 모달 */}
      {showEstimateModal && (
        <EstimateModal
          customer={{
            name: customerName,
            email: customerEmail,
            phone: customerPhone || null
          }}
          courses={estimateCourses}
          tourCourses={tourCoursesWithPhotos as any}
          mileage={mileage}
          locale={locale}
          tourCourseDescription={tourCourseDescription}
          scheduleDescription={scheduleDescription}
          totalCost={totalCost}
          entranceFees={entranceFees}
          hotelAccommodationCost={hotelAccommodationCost}
          vehicleRentalCost={vehicleRentalCost}
          fuelCost={fuelCost}
          guideFee={calculatedGuideFee}
          otherExpenses={otherExpenses}
          otherExpensesTotal={otherExpensesTotal}
          participantCount={participantCount}
          vehicleType={vehicleType}
          numberOfDays={numberOfDays}
          sellingPrice={sellingPrice}
          additionalCost={additionalCost}
          totalBeforeTip={totalBeforeTip}
          tipAmount={tipAmount}
          sellingPriceWithTip={sellingPriceWithTip}
          configId={null}
          onClose={() => setShowEstimateModal(false)}
          onTourCourseDescriptionChange={setTourCourseDescription}
          onScheduleDescriptionChange={setScheduleDescription}
        />
      )}

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
  )
}
