'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Send, DollarSign, Users, Calendar, MapPin, Route, Plus, Save, Copy } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import type { Database } from '@/lib/database.types'

// Google Maps 타입 정의 - 다른 파일의 타입 선언과 충돌을 피하기 위해 any 사용

interface Customer {
  id?: string
  name: string
  email: string
  phone?: string | null
}

interface CourseScheduleItem {
  courseId: string
  courseName: string
  day: string
  time: string
  duration: number | null
}

interface OtherExpense {
  id: string
  name: string
  amount: number
}

type TourCourseInfo = Database['public']['Tables']['tour_courses']['Row'] & {
  price_type?: string | null
  price_minivan?: number | null
  price_9seater?: number | null
  price_13seater?: number | null
  customer_name_ko?: string | null
  customer_name_en?: string | null
  category?: string | null
  parent?: TourCourseInfo | null
  children?: TourCourseInfo[]
  photos?: Array<{
    id: string
    photo_url: string | null
    thumbnail_url: string | null
    is_primary: boolean | null
  }> | null
}

interface EstimateModalProps {
  customer: Customer | null
  courses: CourseScheduleItem[]
  tourCourses: TourCourseInfo[]
  locale?: string
  tourCourseDescription: string
  scheduleDescription: string
  totalCost: number
  entranceFees: number
  hotelAccommodationCost: number
  vehicleRentalCost: number
  fuelCost: number
  guideFee: number
  otherExpenses: OtherExpense[]
  otherExpensesTotal: number
  participantCount: number
  vehicleType: string
  numberOfDays: number
  sellingPrice: number
  additionalCost: number
  totalBeforeTip: number
  tipAmount: number
  sellingPriceWithTip: number
  mileage: number | null
  configId?: string | null
  onClose: () => void
  onTourCourseDescriptionChange: (description: string) => void
  onScheduleDescriptionChange: (description: string) => void
}

const formatUSD = (usd: number): string => {
  return `$${usd.toFixed(2)}`
}

export default function EstimateModal({
  customer,
  courses,
  tourCourses,
  locale = 'ko',
  tourCourseDescription,
  scheduleDescription,
  totalCost,
  entranceFees,
  hotelAccommodationCost,
  vehicleRentalCost,
  fuelCost,
  guideFee,
  otherExpenses,
  otherExpensesTotal,
  participantCount,
  vehicleType,
  numberOfDays,
  sellingPrice,
  additionalCost,
  totalBeforeTip,
  tipAmount,
  sellingPriceWithTip,
  mileage,
  configId,
  onClose,
  onTourCourseDescriptionChange,
  onScheduleDescriptionChange
}: EstimateModalProps) {
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [creatingReservation, setCreatingReservation] = useState(false)
  const [copying, setCopying] = useState(false)
  const [customerName, setCustomerName] = useState(customer?.name || '')
  const [customerEmail, setCustomerEmail] = useState(customer?.email || '')
  const [customerPhone, setCustomerPhone] = useState(customer?.phone || '')
  const [estimateDate, setEstimateDate] = useState('')
  const [notes, setNotes] = useState('')
  const [customers, setCustomers] = useState<Array<{id: string, name: string, email: string, phone: string | null}>>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const estimateContentRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<any>(null)
  const [directionsRenderer, setDirectionsRenderer] = useState<any>(null)
  const markersRef = useRef<any[]>([])
  const [mapImageData, setMapImageData] = useState<string | null>(null)

  // 라스베가스 시간대 날짜 가져오기
  const getLasVegasDate = () => {
    const now = new Date()
    const lasVegasTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
    const year = lasVegasTime.getFullYear()
    const month = String(lasVegasTime.getMonth() + 1).padStart(2, '0')
    const day = String(lasVegasTime.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  useEffect(() => {
    setEstimateDate(getLasVegasDate())
    if (customer) {
      setCustomerName(customer.name || '')
      setCustomerEmail(customer.email || '')
      setCustomerPhone(customer.phone || '')
      setCustomerSearch(customer.name || '')
    }
  }, [customer])

  // 고객 목록 가져오기 (전체 고객 배치로 불러오기)
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        let allCustomers: Array<{id: string, name: string, email: string | null, phone: string | null}> = []
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
            allCustomers = [...allCustomers, ...data]
            from += batchSize
            hasMore = data.length === batchSize
          } else {
            hasMore = false
          }
        }

        setCustomers(allCustomers.filter((c): c is {id: string, name: string, email: string, phone: string | null} => c.email !== null))
      } catch (err) {
        console.error('고객 목록 조회 중 오류:', err)
      }
    }

    fetchCustomers()
  }, [])

  // 고객 검색 필터링
  const filteredCustomers = customerSearch
    ? customers.filter(c =>
        c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.email?.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.phone?.toLowerCase().includes(customerSearch.toLowerCase())
      ).slice(0, 10)
    : []

  // 고객 선택 핸들러
  const handleCustomerSelect = (selectedCustomer: {id: string, name: string, email: string, phone: string | null}) => {
    setCustomerName(selectedCustomer.name || '')
    setCustomerEmail(selectedCustomer.email || '')
    setCustomerPhone(selectedCustomer.phone || '')
    setCustomerSearch(selectedCustomer.name || '')
    setShowCustomerDropdown(false)
  }

  // 예약 추가 핸들러
  const handleCreateReservation = async () => {
    if (!customerEmail) {
      alert('고객 이메일을 입력해주세요.')
      return
    }

    // 고객 ID 찾기 (customer prop에서 먼저 확인, 없으면 customers 배열에서 찾기)
    let customerId: string | null = null
    
    if (customer?.id) {
      customerId = customer.id
    } else {
      const selectedCustomer = customers.find(c => 
      (c.email && customerEmail && c.email.toLowerCase() === customerEmail.toLowerCase()) || 
      (c.name === customerName && c.email && customerEmail && c.email.toLowerCase() === customerEmail.toLowerCase())
    )
      
      if (!selectedCustomer) {
        alert('고객을 찾을 수 없습니다. 고객 정보를 확인해주세요.')
        return
      }
      
      customerId = selectedCustomer.id
    }

    if (!customerId) {
      alert('고객 ID를 찾을 수 없습니다.')
      return
    }

    setCreatingReservation(true)
    try {
      // 카테고리가 "포인트"인 코스만 필터링 (스케줄 순서대로)
      const courseOrderMap = new Map<string, number>()
      courses.forEach((c, index) => {
        courseOrderMap.set(c.courseId, index)
      })

      const pointCourses = courses
        .map(c => tourCourses.find(tc => tc.id === c.courseId))
        .filter((tc): tc is TourCourseInfo => 
          !!tc && (tc.category?.toLowerCase().includes('포인트') || tc.category?.toLowerCase().includes('point'))
        )

      // 스케줄 순서대로 정렬
      pointCourses.sort((a, b) => {
        const orderA = courseOrderMap.get(a.id) ?? Infinity
        const orderB = courseOrderMap.get(b.id) ?? Infinity
        return orderA - orderB
      })

      // 포인트 코스 이름 나열
      const isEnglish = locale === 'en'
      const pointCourseNames = pointCourses.map(course => {
        const parentName = course.parent 
          ? (isEnglish 
              ? (course.parent.customer_name_en || course.parent.customer_name_ko || '')
              : (course.parent.customer_name_ko || course.parent.customer_name_en || ''))
          : null
        
        const courseName = isEnglish 
          ? (course.customer_name_en || course.customer_name_ko || '')
          : (course.customer_name_ko || course.customer_name_en || '')

        return parentName ? `${parentName} - ${courseName}` : courseName
      }).filter(name => name.trim() !== '')

      // 금액 안내 정보 생성
      const formatUSD = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      
      let costBreakdown = ''
      if (isEnglish) {
        costBreakdown = `Cost Breakdown:\n`
        costBreakdown += `Participants: ${participantCount} people\n`
        costBreakdown += `Selling Price (excluding tip): ${formatUSD(sellingPrice)}\n`
        
        if (otherExpenses && otherExpenses.length > 0 && otherExpenses.some(e => e.amount > 0)) {
          otherExpenses.filter(e => e.amount > 0).forEach(expense => {
            costBreakdown += `+ Additional Cost (${expense.name || 'No name'}): +${formatUSD(expense.amount)}\n`
          })
          costBreakdown += `Total: ${formatUSD(totalBeforeTip)}\n`
          costBreakdown += `-----------------------------------------\n`
        }
        costBreakdown += `Tip (15%): ${formatUSD(tipAmount)}\n`
        costBreakdown += `Selling Price (including tip): ${formatUSD(sellingPriceWithTip)}\n`
      } else {
        costBreakdown = `금액 안내:\n`
        costBreakdown += `참가 인원: ${participantCount}명\n`
        costBreakdown += `판매가 (팁 제외): ${formatUSD(sellingPrice)}\n`
        
        if (otherExpenses && otherExpenses.length > 0 && otherExpenses.some(e => e.amount > 0)) {
          otherExpenses.filter(e => e.amount > 0).forEach(expense => {
            costBreakdown += `+ 추가비용 (${expense.name || '항목명 없음'}): +${formatUSD(expense.amount)}\n`
          })
          costBreakdown += `총합: ${formatUSD(totalBeforeTip)}\n`
          costBreakdown += `-----------------------------------------\n`
        }
        costBreakdown += `팁 (15%): ${formatUSD(tipAmount)}\n`
        costBreakdown += `팁 포함 판매가: ${formatUSD(sellingPriceWithTip)}\n`
      }

      // 포인트 코스 정보와 금액 안내 결합
      let eventNote = ''
      if (pointCourseNames.length > 0) {
        if (isEnglish) {
          eventNote = `Tour Course Description:\n${pointCourseNames.join('\n')}\n\n`
        } else {
          eventNote = `투어 코스 설명:\n${pointCourseNames.join('\n')}\n\n`
        }
      }
      eventNote += costBreakdown

      // 예약 데이터 생성
      const reservationData = {
        product_id: 'MNCUSTOM',
        customer_id: customerId,
        channel_id: 'M00001', // 홈페이지
        adults: participantCount,
        child: 0,
        infant: 0,
        total_people: participantCount,
        status: 'pending',
        event_note: eventNote,
        tour_date: new Date().toISOString().split('T')[0], // 오늘 날짜를 기본값으로
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('reservations')
        .insert(reservationData)
        .select()
        .single()

      if (error) {
        console.error('예약 생성 오류:', error)
        alert('예약 생성 중 오류가 발생했습니다: ' + error.message)
        return
      }

      alert('예약이 성공적으로 생성되었습니다.')
      onClose()
    } catch (error) {
      console.error('예약 생성 오류:', error)
      alert('예약 생성 중 오류가 발생했습니다.')
    } finally {
      setCreatingReservation(false)
    }
  }

  // Google Maps API 로드 및 지도 초기화
  useEffect(() => {
    let isInitialized = false
    let timeoutId: NodeJS.Timeout | null = null

    const initializeMap = () => {
      if (isInitialized || !mapRef.current || !window.google || !window.google.maps) {
        // mapRef가 아직 준비되지 않았으면 재시도
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

      // mapRef가 준비될 때까지 기다림
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

      // 초기 체크
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

  // 선택된 코스들에 경로 표시
  useEffect(() => {
    if (!map || !directionsRenderer || !window.google || !window.google.maps) return

    // 기존 마커 제거
    if (markersRef.current) {
      markersRef.current.forEach(marker => marker.setMap(null))
      markersRef.current = []
    }

    // 좌표가 있는 유효한 코스들만 필터링
    const selected = courses
      .map(c => tourCourses.find(tc => tc.id === c.courseId))
      .filter((tc): tc is TourCourseInfo => 
        !!tc && tc.start_latitude !== null && tc.start_latitude !== undefined &&
        tc.start_longitude !== null && tc.start_longitude !== undefined
      )

    if (selected.length === 0) {
      if (courses.length === 0) {
        map.setCenter({ lat: 36.1699, lng: -115.1398 })
        map.setZoom(8)
      }
      return
    }

    // 마커 표시
    selected.forEach((course, index) => {
      if (!course.start_latitude || !course.start_longitude) return

      const position = { lat: course.start_latitude, lng: course.start_longitude }
      const marker = new (window.google.maps as any).Marker({
        position,
        map,
        title: course.customer_name_ko || course.customer_name_en || '',
        label: {
          text: String(index + 1),
          color: 'white',
          fontWeight: 'bold'
        } as any
      })

      markersRef.current.push(marker)
    })

    // 경로 계산 및 표시
    if (selected.length >= 2 && (window.google.maps as any).DirectionsService) {
      const directionsService = new (window.google.maps as any).DirectionsService()
      const waypoints = selected.slice(1, -1).map(course => ({
        location: { lat: course.start_latitude!, lng: course.start_longitude! },
        stopover: true
      }))

      // 첫 번째 경로: 첫 번째 코스 → ... → 마지막 코스
      const forwardRequest: any = {
        origin: { lat: selected[0].start_latitude!, lng: selected[0].start_longitude! },
        destination: { lat: selected[selected.length - 1].start_latitude!, lng: selected[selected.length - 1].start_longitude! },
        waypoints: waypoints.length > 0 ? waypoints : undefined,
        travelMode: (window.google.maps as any).TravelMode.DRIVING,
        optimizeWaypoints: false
      }

      directionsService.route(forwardRequest, (forwardResult: any, forwardStatus: any) => {
        if (forwardStatus === (window.google.maps as any).DirectionsStatus?.OK && forwardResult) {
          // 경로 표시
          if (directionsRenderer) {
            directionsRenderer.setDirections(forwardResult)
          }
          
          // 경로에 맞게 지도 조정
          const bounds = new (window.google.maps as any).LatLngBounds()
          forwardResult.routes[0].legs.forEach((leg: any) => {
            bounds.extend(leg.start_location)
            bounds.extend(leg.end_location)
          })
          map.fitBounds(bounds)
        }
      })
    } else if (selected.length === 1) {
      map.setCenter({ lat: selected[0].start_latitude!, lng: selected[0].start_longitude! })
      map.setZoom(15)
    } else if (selected.length > 0) {
      // 경로가 없어도 모든 마커가 보이도록 조정
      const bounds = new (window.google.maps as any).LatLngBounds()
      selected.forEach(course => {
        if (course.start_latitude && course.start_longitude) {
          bounds.extend({ lat: course.start_latitude, lng: course.start_longitude })
        }
      })
      map.fitBounds(bounds)
      if (selected.length === 1) {
        map.setZoom(15)
      }
    }
  }, [map, directionsRenderer, courses, tourCourses])

  // PDF용 Estimate HTML 생성 (인보이스 스타일)
  const generateEstimateHTMLForPDF = (mapImageDataParam?: string | null): string => {
    const vehicleTypeName = vehicleType === 'minivan' ? '미니밴' : vehicleType === '9seater' ? '9인승' : '13인승'
    const isEnglish = locale === 'en'
    const estimateNumber = `EST-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`
    const formattedDate = estimateDate ? new Date(estimateDate).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US') : new Date().toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US')
    
    // 투어 코스 설명 생성
    const courseOrderMap = new Map<string, number>()
    courses.forEach((c, index) => {
      courseOrderMap.set(c.courseId, index)
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
      
      return (courseName || '').trim() !== '' || (courseDescription || '').trim() !== ''
    })

    validCourses.sort((a, b) => {
      const orderA = courseOrderMap.get(a.id) ?? Infinity
      const orderB = courseOrderMap.get(b.id) ?? Infinity
      return orderA - orderB
    })

    const courseDescriptionsHTML = validCourses.map(course => {
      const parentName = course.parent 
        ? (isEnglish 
            ? (course.parent.customer_name_en || course.parent.customer_name_ko || '')
            : (course.parent.customer_name_ko || course.parent.customer_name_en || ''))
        : null
      
      const courseName = isEnglish 
        ? (course.customer_name_en || course.customer_name_ko || '')
        : (course.customer_name_ko || course.customer_name_en || '')
      
      const fullCourseName = parentName 
        ? `${parentName} - ${courseName}`
        : courseName
      
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

      let html = '<div style="display: flex; gap: 16px; margin-bottom: 24px; align-items: flex-start;">'
      
      // 왼쪽: 사진
      if (fullPhotoUrl) {
        html += `<div style="flex: 0 0 200px;">
          <img src="${fullPhotoUrl}" alt="${fullCourseName || 'Course image'}" style="width: 200px; height: 150px; object-fit: cover; border-radius: 8px; border: 1px solid #e5e7eb;" />
        </div>`
      }
      
      // 오른쪽: 제목과 설명
      html += '<div style="flex: 1;">'
      if (fullCourseName && fullCourseName.trim() !== '') {
        html += `<div style="font-weight: bold; color: #111827; margin-bottom: 8px; font-size: 14px;">${fullCourseName}</div>`
      }
      if (courseDescription && courseDescription.trim() !== '') {
        html += `<div style="color: #374151; line-height: 1.6; margin-bottom: 0;">${courseDescription.replace(/\n/g, '<br>')}</div>`
      }
      html += '</div>'
      html += '</div>'
      
      return html
    }).join('')

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
            font-size: 12px;
            line-height: 1.5;
            color: #1f2937;
            background: #ffffff;
            padding: 20mm 20mm 20mm 20mm;
            margin: 0;
          }
          .estimate-container {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
          }
          .company-info {
            flex: 1;
          }
          .company-info h2 {
            margin: 0 0 12px 0;
            font-size: 18px;
            font-weight: 700;
            color: #111827;
            letter-spacing: 0.5px;
          }
          .company-info p {
            margin: 4px 0;
            font-size: 11px;
            line-height: 1.6;
            color: #4b5563;
          }
          .estimate-header {
            flex: 1;
            text-align: right;
          }
          .estimate-info {
            margin-bottom: 0;
          }
          .estimate-info p {
            margin: 6px 0;
            text-align: right;
            font-size: 11px;
            color: #374151;
          }
          .estimate-info strong {
            color: #111827;
            font-weight: 600;
          }
          .estimate-title {
            text-align: center;
            font-size: 36px;
            font-weight: 700;
            margin: 30px 0;
            color: #111827;
            letter-spacing: 1px;
          }
          .schedule-section {
            margin: 40px 0;
            page-break-inside: avoid;
            break-inside: avoid;
            page-break-before: auto;
            break-before: auto;
            min-height: 100px;
          }
          .schedule-section h3 {
            font-size: 14px;
            font-weight: 600;
            color: #111827;
            margin-bottom: 12px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            background: #ffffff;
          }
          thead th {
            background-color: #f3f4f6;
            font-weight: 600;
            font-size: 14px;
            color: #374151;
            padding: 10px 14px;
            text-align: left;
            border-bottom: 2px solid #e5e7eb;
            vertical-align: middle;
          }
          tbody td {
            padding: 10px 14px;
            font-size: 14px;
            color: #4b5563;
            border-bottom: 1px solid #e5e7eb;
            vertical-align: middle;
          }
          tbody tr:last-child td {
            border-bottom: none;
          }
          .text-right {
            text-align: right;
          }
          .cost-section {
            margin: 30px 0;
            page-break-inside: avoid;
            break-inside: avoid;
            page-break-before: auto;
            break-before: auto;
          }
          .cost-section h3 {
            font-size: 14px;
            font-weight: 600;
            color: #111827;
            margin-bottom: 12px;
          }
          .cost-table {
            width: 100%;
            border-collapse: collapse;
          }
          .cost-table th,
          .cost-table td {
            padding: 10px 14px;
            font-size: 14px;
            border-bottom: 1px solid #e5e7eb;
            vertical-align: middle;
          }
          .cost-table th {
            text-align: left;
            font-weight: 500;
            color: #6b7280;
            background-color: #f9fafb;
            vertical-align: middle;
          }
          .cost-table td {
            text-align: right;
            color: #111827;
            font-weight: 500;
            vertical-align: middle;
          }
          .cost-table .total-row {
            background-color: #eff6ff;
            font-weight: 700;
          }
          .cost-table .total-row th,
          .cost-table .total-row td {
            border-top: 2px solid #3b82f6;
            border-bottom: 2px solid #3b82f6;
            color: #1e40af;
            font-size: 13px;
            padding: 12px;
          }
          .description-section {
            margin: 40px 0;
            padding: 20px;
            background-color: #f9fafb;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
            page-break-inside: avoid;
            break-inside: avoid;
            page-break-before: auto;
            break-before: auto;
            min-height: 100px;
          }
          .description-section h3 {
            font-size: 14px;
            font-weight: 600;
            color: #111827;
            margin-bottom: 16px;
          }
          .description-section > div {
            margin-bottom: 16px;
            padding-bottom: 16px;
            border-bottom: 1px solid #e5e7eb;
          }
          .description-section > div:last-child {
            margin-bottom: 0;
            padding-bottom: 0;
            border-bottom: none;
          }
          .notes-section {
            margin-top: 30px;
            padding: 16px;
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            border-radius: 4px;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .notes-section h3 {
            font-size: 13px;
            font-weight: 600;
            color: #92400e;
            margin-bottom: 8px;
          }
          .notes-section p {
            font-size: 11px;
            color: #78350f;
            line-height: 1.6;
          }
          .map-section {
            margin: 40px 0;
            page-break-inside: avoid;
            break-inside: avoid;
            page-break-before: auto;
            break-before: auto;
            min-height: 200px;
          }
          .map-section h3 {
            font-size: 14px;
            font-weight: 600;
            color: #111827;
            margin-bottom: 12px;
          }
          .map-container {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            overflow: hidden;
            background-color: #f9fafb;
          }
          .map-header {
            padding: 12px;
            background-color: #f3f4f6;
            border-bottom: 1px solid #e5e7eb;
          }
          .map-header-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .map-image-wrapper {
            width: 100%;
            overflow: hidden;
            display: block;
            background-color: #f3f4f6;
            min-height: 200px;
            max-height: 500px;
          }
          .map-image {
            width: 100%;
            height: auto;
            display: block;
            max-width: 100%;
            object-fit: fill;
            object-position: center;
            background-color: #f3f4f6;
          }
          @media print {
            body { 
              padding: 20mm !important;
              margin: 0 !important;
            }
            @page {
              margin: 20mm;
              size: A4;
            }
            .schedule-section,
            .cost-section,
            .description-section,
            .notes-section,
            .map-section {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              page-break-before: auto !important;
              break-before: auto !important;
            }
            .schedule-section:first-of-type,
            .cost-section:first-of-type,
            .description-section:first-of-type,
            .map-section:first-of-type {
              page-break-before: auto !important;
              break-before: auto !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="estimate-container">
          <div class="company-info">
            <h2>LAS VEGAS MANIA TOUR</h2>
            <p>3351 South Highland Drive</p>
            <p>Las Vegas, Nevada 89109</p>
            <p>United States</p>
            <p>info@maniatour.com</p>
            <p>+1 702-929-8025 / +1 702-444-5531</p>
          </div>
          <div class="estimate-header">
            <div class="estimate-info">
              <p><strong>${isEnglish ? 'Estimate Number' : 'Estimate 번호'}:</strong> ${estimateNumber}</p>
              <p><strong>${isEnglish ? 'Date' : '작성일'}:</strong> ${formattedDate}</p>
              <p><strong>${isEnglish ? 'Customer' : '고객'}:</strong> ${customerName || 'N/A'}</p>
              <p><strong>${isEnglish ? 'Email' : '이메일'}:</strong> ${customerEmail || 'N/A'}</p>
              ${customerPhone ? `<p><strong>${isEnglish ? 'Phone' : '전화번호'}:</strong> ${customerPhone}</p>` : ''}
            </div>
          </div>
        </div>
        
        <h1 class="estimate-title">${isEnglish ? 'ESTIMATE' : 'ESTIMATE'}</h1>

        <div class="cost-section">
          <h3>${isEnglish ? 'Cost Breakdown' : '금액 안내'}</h3>
          <table class="cost-table">
            <tr>
              <th>${isEnglish ? 'Participants' : '참가 인원'}</th>
              <td>${participantCount} ${isEnglish ? 'people' : '명'}</td>
            </tr>
            <tr>
              <th>${isEnglish ? 'Selling Price (excluding tip)' : '판매가 (팁 제외)'}</th>
              <td>${formatUSD(sellingPrice)}</td>
            </tr>
            ${otherExpenses.length > 0 && otherExpenses.some(e => e.amount > 0) ? otherExpenses.filter(e => e.amount > 0).map(expense => `
            <tr>
              <th>+ ${isEnglish ? 'Additional Cost' : '추가비용'} (${expense.name || (isEnglish ? 'No name' : '항목명 없음')})</th>
              <td>+${formatUSD(expense.amount)}</td>
            </tr>
            `).join('') : ''}
            ${otherExpenses.length > 0 && otherExpenses.some(e => e.amount > 0) ? `
            <tr>
              <th>${isEnglish ? 'Total' : '총합'}</th>
              <td>${formatUSD(totalBeforeTip)}</td>
            </tr>
            <tr>
              <td colspan="2" style="border-top: 1px solid #d1d5db; padding: 8px 0;"></td>
            </tr>
            ` : ''}
            <tr>
              <th>${isEnglish ? 'Tip (15%)' : '팁 (15%)'}</th>
              <td>${formatUSD(tipAmount)}</td>
            </tr>
            <tr class="total-row">
              <th>${isEnglish ? 'Selling Price (including tip)' : '팁 포함 판매가'}</th>
              <td>${formatUSD(sellingPriceWithTip)}</td>
            </tr>
          </table>
        </div>

        ${courses.length > 0 ? `
        <div class="schedule-section">
          <h3>${isEnglish ? 'Tour Schedule' : '투어 스케줄'}</h3>
          <table>
            <thead>
              <tr>
                <th>${isEnglish ? 'Day' : '일차'}</th>
                <th>${isEnglish ? 'Time' : '시간'}</th>
                <th>${isEnglish ? 'Course' : '투어 코스'}</th>
                <th class="text-right">${isEnglish ? 'Duration' : '소요 시간'}</th>
              </tr>
            </thead>
            <tbody>
              ${courses.map(course => `
                <tr>
                  <td>${course.day || ''}</td>
                  <td>${course.time || 'TBD'}</td>
                  <td>${course.courseName}</td>
                  <td class="text-right">${course.duration ? `${course.duration} ${isEnglish ? 'min' : '분'}` : 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        ${validCourses.length > 0 ? `
        <div class="description-section">
          <h3>${isEnglish ? 'Tour Course Description' : '투어 코스 설명'}</h3>
          ${courseDescriptionsHTML}
        </div>
        ` : ''}

        ${mapImageDataParam ? `
        <div class="map-section">
          <h3>${isEnglish ? 'Route & Mileage' : '경로 및 마일리지'}</h3>
          <div class="map-container">
            <div class="map-header">
              <div class="map-header-content">
                <span style="font-size: 11px; font-weight: 500; color: #374151;">${isEnglish ? 'Total Mileage' : '총 마일리지'}</span>
                <span style="font-size: 11px; font-weight: 600; color: #111827;">${mileage ? `${mileage.toFixed(1)} ${isEnglish ? 'miles' : '마일'}` : 'N/A'}</span>
              </div>
            </div>
            <div class="map-image-wrapper">
              <img src="${mapImageDataParam}" alt="${isEnglish ? 'Route Map' : '경로 지도'}" class="map-image" />
            </div>
          </div>
        </div>
        ` : ''}

        ${notes ? `
        <div class="notes-section">
          <h3>${isEnglish ? 'Notes' : '메모'}</h3>
          <p>${notes.replace(/\n/g, '<br>')}</p>
        </div>
        ` : ''}
      </body>
      </html>
    `
  }

  // Estimate 저장 함수 (다운로드 없이 저장만)
  const handleSaveEstimate = async () => {
    if (!estimateContentRef.current || !mapRef.current) return

    setSaving(true)
    try {
      // 고객 ID 찾기
      let customerId: string | null = null
      if (customer?.id) {
        customerId = customer.id
      } else {
        const selectedCustomer = customers.find(c => 
          (c.email && customerEmail && c.email.toLowerCase() === customerEmail.toLowerCase()) || 
          (c.name === customerName && c.email && customerEmail && c.email.toLowerCase() === customerEmail.toLowerCase())
        )
        customerId = selectedCustomer?.id || null
      }

      if (!customerId) {
        alert(locale === 'ko' ? '고객 정보를 찾을 수 없습니다.' : 'Customer information not found.')
        return
      }

      // 지도를 이미지로 캡처 (PDF 가로 넓이에 맞게 큰 크기로)
      let mapImage: string | null = null
      try {
        if (!mapRef.current) {
          console.warn('지도 컨테이너가 없습니다.')
          throw new Error('Map container not found')
        }

        const mapContainer = mapRef.current
        
        // 현재 지도 상태 저장 (캡처 전 화면과 동일하게 유지하기 위해)
        let originalZoom: number | null = null
        let originalCenter: { lat: number; lng: number } | null = null
        let originalBounds: any = null
        
        if (map) {
          if (typeof map.getZoom === 'function') {
            originalZoom = map.getZoom()
          }
          if (typeof map.getCenter === 'function') {
            const center = map.getCenter()
            if (center) {
              originalCenter = {
                lat: typeof center.lat === 'function' ? center.lat() : (center as any).lat,
                lng: typeof center.lng === 'function' ? center.lng() : (center as any).lng
              }
            }
          }
          if (typeof map.getBounds === 'function') {
            originalBounds = map.getBounds()
          }
          console.log('현재 지도 상태 저장:', { zoom: originalZoom, center: originalCenter })
        }
        
        const originalWidth = mapContainer.style.width
        const originalHeight = mapContainer.style.height
        const originalPosition = mapContainer.style.position
        const originalLeft = mapContainer.style.left
        const originalTop = mapContainer.style.top
        const originalZIndex = mapContainer.style.zIndex
        
        // PDF 가로 넓이에 맞게 지도 컨테이너 임시 확대 (A4 가로: 210mm - 마진 40mm = 170mm, 약 640px @ 96dpi)
        // 더 높은 해상도를 위해 1200px로 설정
        const targetWidth = 1200 // PDF 가로 넓이에 맞춘 픽셀 크기
        const targetHeight = 800 // 적절한 높이 비율 유지
        
        // 지도 컨테이너를 임시로 확대하여 캡처
        mapContainer.style.position = 'fixed'
        mapContainer.style.left = '-9999px'
        mapContainer.style.top = '0'
        mapContainer.style.width = `${targetWidth}px`
        mapContainer.style.height = `${targetHeight}px`
        mapContainer.style.zIndex = '9999'
        
        // 지도 컨트롤과 오버레이 숨기기
        const controls = mapContainer.querySelectorAll('.gm-control-active, .gm-style-cc, [title*="zoom"], [title*="Use ctrl"]')
        const originalDisplay: string[] = []
        
        controls.forEach((control: Element) => {
          const htmlElement = control as HTMLElement
          originalDisplay.push(htmlElement.style.display)
          htmlElement.style.display = 'none'
        })

        // 지도가 새로운 크기로 완전히 렌더링될 때까지 대기
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Google Maps가 새로운 크기에 맞춰 재렌더링되도록 트리거
        if (map && typeof map.resize === 'function') {
          map.resize()
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
        
        // 저장된 지도 상태로 복원 후 2단계 줌인
        if (map) {
          if (originalCenter && typeof map.setCenter === 'function') {
            map.setCenter(originalCenter)
          }
          if (originalZoom !== null && typeof map.setZoom === 'function') {
            // 1단계 줌인 (최대 18까지)
            const zoomedZoom = Math.min(18, originalZoom + 1)
            map.setZoom(zoomedZoom)
            console.log(`지도 1단계 줌인: ${originalZoom} → ${zoomedZoom}`)
          }
          // bounds가 있으면 bounds로 설정 후 1단계 줌인
          if (originalBounds && typeof map.fitBounds === 'function') {
            map.fitBounds(originalBounds)
            // fitBounds 후 추가로 1단계 줌인
            await new Promise(resolve => setTimeout(resolve, 500))
            if (originalZoom !== null && typeof map.setZoom === 'function') {
              const zoomedZoom = Math.min(18, originalZoom + 1)
              map.setZoom(zoomedZoom)
              console.log(`Bounds 적용 후 1단계 줌인: ${originalZoom} → ${zoomedZoom}`)
            }
          }
          console.log('지도 상태 복원 및 1단계 줌인 완료')
          // 상태 복원 후 렌더링 대기
          await new Promise(resolve => setTimeout(resolve, 1500))
        }
        
        // 지도가 실제로 렌더링되었는지 확인
        if (mapContainer.offsetWidth === 0 || mapContainer.offsetHeight === 0) {
          console.warn('지도 컨테이너가 제대로 렌더링되지 않았습니다.')
          throw new Error('Map container not properly rendered')
        }

        // 고해상도로 캡처 (scale 2로 더 선명하게)
        const mapCanvas = await html2canvas(mapContainer, {
          scale: 2, // 고해상도 캡처
          useCORS: true,
          logging: false,
          allowTaint: false,
          backgroundColor: '#ffffff',
          width: targetWidth,
          height: targetHeight,
          windowWidth: targetWidth,
          windowHeight: targetHeight,
          x: 0,
          y: 0,
          scrollX: 0,
          scrollY: 0,
          ignoreElements: (element) => {
            // Google Maps 컨트롤과 오버레이 제외
            const className = typeof element.className === 'string' 
              ? element.className 
              : ((element.className as any)?.baseVal || (element.className as any)?.toString() || '')
            const title = (element as HTMLElement).title || ''
            const classStr = String(className)
            return (
              classStr.includes('gm-control') ||
              classStr.includes('gm-style-cc') ||
              title.includes('zoom') ||
              title.includes('Use ctrl') ||
              title.includes('Click to zoom')
            )
          }
        })
        
        mapImage = mapCanvas.toDataURL('image/png', 1.0) // 최고 품질
        
        // 원래 크기와 위치로 복원
        mapContainer.style.width = originalWidth
        mapContainer.style.height = originalHeight
        mapContainer.style.position = originalPosition
        mapContainer.style.left = originalLeft
        mapContainer.style.top = originalTop
        mapContainer.style.zIndex = originalZIndex
        
        // Google Maps 재렌더링
        if (map && typeof map.resize === 'function') {
          map.resize()
          await new Promise(resolve => setTimeout(resolve, 500))
        }
        
        // 원래 지도 상태로 완전히 복원 (캡처 전 화면과 동일하게)
        if (map) {
          if (originalCenter && typeof map.setCenter === 'function') {
            map.setCenter(originalCenter)
          }
          if (originalZoom !== null && typeof map.setZoom === 'function') {
            map.setZoom(originalZoom)
          }
          // bounds가 있으면 bounds로 설정 (더 정확함)
          if (originalBounds && typeof map.fitBounds === 'function') {
            map.fitBounds(originalBounds)
          }
          console.log('지도 원래 상태로 복원 완료')
        }

        // 컨트롤 다시 표시
        controls.forEach((control: Element, index: number) => {
          const htmlElement = control as HTMLElement
          htmlElement.style.display = originalDisplay[index] || ''
        })
        
        setMapImageData(mapImage)
        console.log('지도 이미지 캡처 완료 (고해상도), 크기:', mapImage.length, '픽셀:', mapCanvas.width, 'x', mapCanvas.height)
      } catch (mapError) {
        console.error('지도 캡처 오류:', mapError)
        // 지도 캡처 실패해도 계속 진행
        // 원래 크기로 복원 시도
        if (mapRef.current) {
          mapRef.current.style.width = ''
          mapRef.current.style.height = ''
          mapRef.current.style.position = ''
          mapRef.current.style.left = ''
          mapRef.current.style.top = ''
          mapRef.current.style.zIndex = ''
          if (map && typeof map.resize === 'function') {
            map.resize()
          }
        }
      }

      // 이미지가 캡처되면 잠시 대기 (DOM 업데이트 반영)
      if (mapImage) {
        console.log('지도 이미지 캡처 완료, 크기:', mapImage.length)
        await new Promise(resolve => setTimeout(resolve, 500))
      } else {
        console.warn('지도 이미지가 캡처되지 않았습니다.')
      }

      const fileName = `Estimate_${customerName || 'customer'}_${new Date().toISOString().split('T')[0]}.pdf`

      // jsPDF로 PDF 생성 (마진 포함)
      const pageMargin = 20 // mm
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      })

      // 페이지 크기 (마진 제외)
      const pageWidth = 210 // A4 너비 (mm)
      const pageHeight = 297 // A4 높이 (mm)
      const contentWidth = pageWidth - (pageMargin * 2) // 마진 제외한 콘텐츠 너비
      const contentHeight = pageHeight - (pageMargin * 2) // 마진 제외한 콘텐츠 높이

      // 섹션별 HTML 생성 함수
      const generateSectionHTML = (sectionContent: string, includeHeader: boolean = true): string => {
        const isEnglish = locale === 'en'
        const estimateNumber = `EST-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`
        const formattedDate = estimateDate ? new Date(estimateDate).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US') : new Date().toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US')
        
        return `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
                font-size: 16px;
                line-height: 1.6;
                color: #1f2937;
                background: #ffffff;
                padding: 0;
                margin: 0;
                width: 210mm;
              }
              .estimate-container {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 30px;
              }
              .company-info {
                flex: 1;
              }
              .company-info h2 {
                margin: 0 0 12px 0;
                font-size: 18px;
                font-weight: 700;
                color: #111827;
                letter-spacing: 0.5px;
              }
              .company-info p {
                margin: 4px 0;
                font-size: 13px;
                line-height: 1.6;
                color: #4b5563;
              }
              .estimate-header {
                flex: 1;
                text-align: right;
              }
              .estimate-info {
                margin-bottom: 0;
              }
              .estimate-info p {
                margin: 6px 0;
                text-align: right;
                font-size: 13px;
                color: #374151;
              }
              .estimate-info strong {
                color: #111827;
                font-weight: 600;
              }
              .estimate-title {
                text-align: center;
                font-size: 36px;
                font-weight: 700;
                margin: 30px 0;
                color: #111827;
                letter-spacing: 1px;
              }
              .cost-section {
                margin: 30px 0;
              }
              .cost-section h3 {
                font-size: 16px;
                font-weight: 600;
                color: #111827;
                margin-bottom: 12px;
              }
              .cost-table {
                width: 100%;
                border-collapse: collapse;
              }
              .cost-table th,
              .cost-table td {
                padding: 8px 12px;
                font-size: 11px;
                border-bottom: 1px solid #e5e7eb;
              }
              .cost-table th {
                text-align: left;
                font-weight: 500;
                color: #6b7280;
                background-color: #f9fafb;
              }
              .cost-table td {
                text-align: right;
                color: #111827;
                font-weight: 500;
              }
              .cost-table .total-row {
                background-color: #eff6ff;
                font-weight: 700;
              }
              .cost-table .total-row th,
              .cost-table .total-row td {
                border-top: 2px solid #3b82f6;
                border-bottom: 2px solid #3b82f6;
                color: #1e40af;
                font-size: 18px;
                padding: 16px;
              }
              .schedule-section {
                margin: 30px 0;
              }
              .schedule-section h3 {
                font-size: 16px;
                font-weight: 600;
                color: #111827;
                margin-bottom: 12px;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 30px;
                background: #ffffff;
              }
              thead th {
                background-color: #f3f4f6;
                font-weight: 600;
                font-size: 14px;
                color: #374151;
                padding: 10px 14px;
                text-align: left;
                border-bottom: 2px solid #e5e7eb;
                vertical-align: middle;
              }
              tbody td {
                padding: 10px 14px;
                font-size: 14px;
                color: #4b5563;
                border-bottom: 1px solid #e5e7eb;
                vertical-align: middle;
              }
              tbody tr:last-child td {
                border-bottom: none;
              }
              .text-right {
                text-align: right;
              }
              .description-section {
                margin: 30px 0;
                padding: 20px;
                background-color: #f9fafb;
                border-radius: 8px;
                border: 1px solid #e5e7eb;
              }
              .description-section h3 {
                font-size: 16px;
                font-weight: 600;
                color: #111827;
                margin-bottom: 16px;
              }
              .description-section > div {
                margin-bottom: 16px;
                padding-bottom: 16px;
                border-bottom: 1px solid #e5e7eb;
              }
              .description-section > div:last-child {
                margin-bottom: 0;
                padding-bottom: 0;
                border-bottom: none;
              }
              .notes-section {
                margin-top: 30px;
                padding: 16px;
                background-color: #fef3c7;
                border-left: 4px solid #f59e0b;
                border-radius: 4px;
              }
              .notes-section h3 {
                font-size: 15px;
                font-weight: 600;
                color: #92400e;
                margin-bottom: 8px;
              }
              .notes-section p {
                font-size: 13px;
                color: #78350f;
                line-height: 1.6;
              }
              .map-section {
                margin: 30px 0;
              }
              .map-section h3 {
                font-size: 16px;
                font-weight: 600;
                color: #111827;
                margin-bottom: 12px;
              }
              .map-container {
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                overflow: visible;
                background-color: #f9fafb;
                display: flex;
                flex-direction: column;
              }
              .map-header {
                padding: 12px;
                background-color: #f3f4f6;
                border-bottom: 1px solid #e5e7eb;
                flex-shrink: 0;
              }
              .map-header-content {
                display: flex;
                justify-content: space-between;
                align-items: center;
              }
              .map-image-wrapper {
                width: 100%;
                overflow: hidden;
                display: block;
                background-color: #f3f4f6;
                min-height: 200px;
                max-height: 500px;
              }
              .map-image {
                width: 100%;
                height: auto;
                display: block;
                max-width: 100%;
                object-fit: cover;
                object-position: center;
                background-color: #f3f4f6;
                min-height: 300px;
              }
              .map-placeholder {
                width: 100%;
                height: 300px;
                background-color: #f3f4f6;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #6b7280;
                font-size: 14px;
                border-top: 1px solid #e5e7eb;
              }
            </style>
          </head>
          <body>
            ${includeHeader ? `
            <div class="estimate-container">
              <div class="company-info">
                <h2>LAS VEGAS MANIA TOUR</h2>
                <p>3351 South Highland Drive</p>
                <p>Las Vegas, Nevada 89109</p>
                <p>United States</p>
                <p>info@maniatour.com</p>
                <p>+1 702-929-8025 / +1 702-444-5531</p>
              </div>
              <div class="estimate-header">
                <div class="estimate-info">
                  <p><strong>${isEnglish ? 'Estimate Number' : 'Estimate 번호'}:</strong> ${estimateNumber}</p>
                  <p><strong>${isEnglish ? 'Date' : '작성일'}:</strong> ${formattedDate}</p>
                  <p><strong>${isEnglish ? 'Customer' : '고객'}:</strong> ${customerName || 'N/A'}</p>
                  <p><strong>${isEnglish ? 'Email' : '이메일'}:</strong> ${customerEmail || 'N/A'}</p>
                  ${customerPhone ? `<p><strong>${isEnglish ? 'Phone' : '전화번호'}:</strong> ${customerPhone}</p>` : ''}
                </div>
              </div>
            </div>
            <h1 class="estimate-title">${isEnglish ? 'ESTIMATE' : 'ESTIMATE'}</h1>
            ` : ''}
            ${sectionContent}
          </body>
          </html>
        `
      }

      // 섹션을 캔버스로 변환하는 헬퍼 함수
      const sectionToCanvas = async (html: string): Promise<HTMLCanvasElement> => {
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = html
        tempDiv.style.position = 'absolute'
        tempDiv.style.left = '-9999px'
        tempDiv.style.width = '210mm'
        tempDiv.style.backgroundColor = '#ffffff'
        tempDiv.style.padding = '0'
        tempDiv.style.margin = '0'
        document.body.appendChild(tempDiv)
        
        await new Promise(resolve => setTimeout(resolve, 300))
        
        // 이미지 로딩 대기
        const images = tempDiv.querySelectorAll('img')
        if (images.length > 0) {
          await Promise.all(
            Array.from(images).map((img) => {
              const htmlImg = img as HTMLImageElement
              if (htmlImg.complete && htmlImg.naturalHeight > 0) {
                return Promise.resolve()
              }
              return new Promise((resolve) => {
                htmlImg.onload = () => resolve(null)
                htmlImg.onerror = () => resolve(null)
                setTimeout(() => resolve(null), 3000)
              })
            })
          )
          await new Promise(resolve => setTimeout(resolve, 500))
        }
        
        const canvas = await html2canvas(tempDiv, {
          scale: 2,
          useCORS: true,
          logging: false,
          allowTaint: false,
          backgroundColor: '#ffffff',
          width: tempDiv.scrollWidth,
          height: tempDiv.scrollHeight,
          windowWidth: tempDiv.scrollWidth,
          windowHeight: tempDiv.scrollHeight,
        })
        
        document.body.removeChild(tempDiv)
        return canvas
      }

      // 페이지 1: 고객 정보 + 금액 안내 + 메모 + 경로 및 마일리지
      const page1Sections: string[] = []
      
      page1Sections.push(`
        <div class="cost-section">
          <h3>${locale === 'en' ? 'Cost Breakdown' : '금액 안내'}</h3>
          <table class="cost-table">
            <tr>
              <th>${locale === 'en' ? 'Participants' : '참가 인원'}</th>
              <td>${participantCount} ${locale === 'en' ? 'people' : '명'}</td>
            </tr>
            <tr>
              <th>${locale === 'en' ? 'Selling Price (excluding tip)' : '판매가 (팁 제외)'}</th>
              <td>${formatUSD(sellingPrice)}</td>
            </tr>
            ${otherExpenses.length > 0 && otherExpenses.some(e => e.amount > 0) ? otherExpenses.filter(e => e.amount > 0).map(expense => `
            <tr>
              <th>+ ${locale === 'en' ? 'Additional Cost' : '추가비용'} (${expense.name || (locale === 'en' ? 'No name' : '항목명 없음')})</th>
              <td>+${formatUSD(expense.amount)}</td>
            </tr>
            `).join('') : ''}
            ${otherExpenses.length > 0 && otherExpenses.some(e => e.amount > 0) ? `
            <tr>
              <th>${locale === 'en' ? 'Total' : '총합'}</th>
              <td>${formatUSD(totalBeforeTip)}</td>
            </tr>
            <tr>
              <td colspan="2" style="border-top: 1px solid #d1d5db; padding: 8px 0;"></td>
            </tr>
            ` : ''}
            <tr>
              <th>${locale === 'en' ? 'Tip (15%)' : '팁 (15%)'}</th>
              <td>${formatUSD(tipAmount)}</td>
            </tr>
            <tr class="total-row">
              <th>${locale === 'en' ? 'Selling Price (including tip)' : '팁 포함 판매가'}</th>
              <td>${formatUSD(sellingPriceWithTip)}</td>
            </tr>
          </table>
        </div>
      `)
      
      if (notes) {
        page1Sections.push(`
          <div class="notes-section">
            <h3>${locale === 'en' ? 'Notes' : '메모'}</h3>
            <p>${notes.replace(/\n/g, '<br>')}</p>
          </div>
        `)
      }
      
      // 경로 및 마일리지 섹션은 항상 표시 (지도가 없어도)
      page1Sections.push(`
        <div class="map-section">
          <h3>${locale === 'en' ? 'Route & Mileage' : '경로 및 마일리지'}</h3>
          <div class="map-container">
            <div class="map-header">
              <div class="map-header-content">
                <span style="font-size: 15px; font-weight: 500; color: #374151;">${locale === 'en' ? 'Total Mileage' : '총 마일리지'}</span>
                <span style="font-size: 15px; font-weight: 600; color: #111827;">${mileage ? `${mileage.toFixed(1)} ${locale === 'en' ? 'miles' : '마일'}` : 'N/A'}</span>
              </div>
            </div>
            <div class="map-image-wrapper">
              ${mapImage ? `
                <img src="${mapImage}" alt="${locale === 'en' ? 'Route Map' : '경로 지도'}" class="map-image" onerror="this.style.display='none'; this.parentElement.nextElementSibling.style.display='flex';" />
              ` : ''}
            </div>
            ${!mapImage ? `
              <div class="map-placeholder">${locale === 'en' ? 'Route map is not available' : '경로 지도를 사용할 수 없습니다'}</div>
            ` : ''}
          </div>
        </div>
      `)
      
      const page1HTML = generateSectionHTML(page1Sections.join(''), true)
      
      const page1Canvas = await sectionToCanvas(page1HTML)
      const page1ImgData = page1Canvas.toDataURL('image/jpeg', 0.95)
      const page1Width = page1Canvas.width
      const page1Height = page1Canvas.height
      const page1AspectRatio = page1Height / page1Width
      const page1PdfWidth = contentWidth
      const page1PdfHeight = page1PdfWidth * page1AspectRatio
      
      if (page1PdfHeight <= contentHeight) {
        pdf.addImage(page1ImgData, 'JPEG', pageMargin, pageMargin, page1PdfWidth, page1PdfHeight)
      } else {
        // 페이지 1이 한 페이지를 넘으면 잘라서 배치
        let remaining = page1PdfHeight
        let sourceY = 0
        while (remaining > 0) {
          const sliceHeight = Math.min(contentHeight, remaining)
          const sourceHeight = (sliceHeight / page1PdfHeight) * page1Height
          
          const sliceCanvas = document.createElement('canvas')
          sliceCanvas.width = page1Width
          sliceCanvas.height = Math.ceil(sourceHeight)
          const sliceCtx = sliceCanvas.getContext('2d')
          
          if (sliceCtx) {
            sliceCtx.drawImage(page1Canvas, 0, sourceY, page1Width, sourceHeight, 0, 0, page1Width, sourceHeight)
            pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', pageMargin, pageMargin, page1PdfWidth, sliceHeight)
          }
          
          sourceY += sourceHeight
          remaining -= sliceHeight
          if (remaining > 0) pdf.addPage()
        }
      }

      // 페이지 2: 투어 스케줄 (경로 및 마일리지와 메모는 1페이지에 이미 포함됨)
      if (courses.length > 0) {
        pdf.addPage()
        const page2HTML = generateSectionHTML(`
          <div class="schedule-section">
            <h3>${locale === 'en' ? 'Tour Schedule' : '투어 스케줄'}</h3>
            <table>
              <thead>
                <tr>
                  <th>${locale === 'en' ? 'Day' : '일차'}</th>
                  <th>${locale === 'en' ? 'Time' : '시간'}</th>
                  <th>${locale === 'en' ? 'Course' : '투어 코스'}</th>
                  <th class="text-right">${locale === 'en' ? 'Duration' : '소요 시간'}</th>
                </tr>
              </thead>
              <tbody>
                ${courses.map(course => `
                  <tr>
                    <td>${course.day || ''}</td>
                    <td>${course.time || 'TBD'}</td>
                    <td>${course.courseName}</td>
                    <td class="text-right">${course.duration ? `${course.duration} ${locale === 'en' ? 'min' : '분'}` : 'N/A'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `, false)
        
        const page2Canvas = await sectionToCanvas(page2HTML)
        const page2ImgData = page2Canvas.toDataURL('image/jpeg', 0.95)
        const page2Width = page2Canvas.width
        const page2Height = page2Canvas.height
        const page2AspectRatio = page2Height / page2Width
        const page2PdfWidth = contentWidth
        const page2PdfHeight = page2PdfWidth * page2AspectRatio
        
        if (page2PdfHeight <= contentHeight) {
          pdf.addImage(page2ImgData, 'JPEG', pageMargin, pageMargin, page2PdfWidth, page2PdfHeight)
        } else {
          let remaining = page2PdfHeight
          let sourceY = 0
          while (remaining > 0) {
            const sliceHeight = Math.min(contentHeight, remaining)
            const sourceHeight = (sliceHeight / page2PdfHeight) * page2Height
            
            const sliceCanvas = document.createElement('canvas')
            sliceCanvas.width = page2Width
            sliceCanvas.height = Math.ceil(sourceHeight)
            const sliceCtx = sliceCanvas.getContext('2d')
            
            if (sliceCtx) {
              sliceCtx.drawImage(page2Canvas, 0, sourceY, page2Width, sourceHeight, 0, 0, page2Width, sourceHeight)
              pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', pageMargin, pageMargin, page2PdfWidth, sliceHeight)
            }
            
            sourceY += sourceHeight
            remaining -= sliceHeight
            if (remaining > 0) pdf.addPage()
          }
        }
      }

      // 페이지 3부터: 투어 코스 설명 (이어서 배치)
      const courseOrderMap = new Map<string, number>()
      courses.forEach((c, index) => {
        courseOrderMap.set(c.courseId, index)
      })
      
      const pointCourses = tourCourses.filter(course => {
        const category = course.category?.toLowerCase() || ''
        return courseOrderMap.has(course.id) && 
               (category.includes('포인트') || category.includes('point'))
      })

      const validCourses = pointCourses.filter(course => {
        const courseName = locale === 'en' 
          ? (course.customer_name_en || course.customer_name_ko || '')
          : (course.customer_name_ko || course.customer_name_en || '')
        const courseDescription = locale === 'en'
          ? (course.customer_description_en || course.customer_description_ko || '')
          : (course.customer_description_ko || course.customer_description_en || '')
        
        return (courseName || '').trim() !== '' || (courseDescription || '').trim() !== ''
      })

      validCourses.sort((a, b) => {
        const orderA = courseOrderMap.get(a.id) ?? Infinity
        const orderB = courseOrderMap.get(b.id) ?? Infinity
        return orderA - orderB
      })

      if (validCourses.length > 0) {
        const courseDescriptionsHTML = validCourses.map(course => {
          const parentName = course.parent 
            ? (locale === 'en' 
                ? (course.parent.customer_name_en || course.parent.customer_name_ko || '')
                : (course.parent.customer_name_ko || course.parent.customer_name_en || ''))
            : null
          
          const courseName = locale === 'en' 
            ? (course.customer_name_en || course.customer_name_ko || '')
            : (course.customer_name_ko || course.customer_name_en || '')
          
          const fullCourseName = parentName 
            ? `${parentName} - ${courseName}`
            : courseName
          
          const courseDescription = locale === 'en'
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

          let html = '<div style="display: flex; gap: 16px; margin-bottom: 24px; align-items: flex-start;">'
          
          // 왼쪽: 사진
          if (fullPhotoUrl) {
            html += `<div style="flex: 0 0 200px;">
              <img src="${fullPhotoUrl}" alt="${fullCourseName || 'Course image'}" style="width: 200px; height: 150px; object-fit: cover; border-radius: 8px; border: 1px solid #e5e7eb;" />
            </div>`
          }
          
          // 오른쪽: 제목과 설명
          html += '<div style="flex: 1;">'
          if (fullCourseName && fullCourseName.trim() !== '') {
            html += `<div style="font-weight: bold; color: #111827; margin-bottom: 8px; font-size: 14px;">${fullCourseName}</div>`
          }
          if (courseDescription && courseDescription.trim() !== '') {
            html += `<div style="color: #374151; line-height: 1.6; margin-bottom: 0;">${courseDescription.replace(/\n/g, '<br>')}</div>`
          }
          html += '</div>'
          html += '</div>'
          
          return html
        }).join('')

        const page3HTML = generateSectionHTML(`
          <div class="description-section">
            <h3>${locale === 'en' ? 'Tour Course Description' : '투어 코스 설명'}</h3>
            ${courseDescriptionsHTML}
          </div>
        `, false)
        
        const page3Canvas = await sectionToCanvas(page3HTML)
        const page3ImgData = page3Canvas.toDataURL('image/jpeg', 0.95)
        const page3Width = page3Canvas.width
        const page3Height = page3Canvas.height
        const page3AspectRatio = page3Height / page3Width
        const page3PdfWidth = contentWidth
        const page3PdfHeight = page3PdfWidth * page3AspectRatio
        
        // 첫 페이지 추가
        pdf.addPage()
        let remaining = page3PdfHeight
        let sourceY = 0
        let isFirstPage = true
        
        while (remaining > 0) {
          if (!isFirstPage) {
            pdf.addPage()
          }
          isFirstPage = false
          
          const sliceHeight = Math.min(contentHeight, remaining)
          const sourceHeight = (sliceHeight / page3PdfHeight) * page3Height
          
          const sliceCanvas = document.createElement('canvas')
          sliceCanvas.width = page3Width
          sliceCanvas.height = Math.ceil(sourceHeight)
          const sliceCtx = sliceCanvas.getContext('2d')
          
          if (sliceCtx) {
            sliceCtx.drawImage(page3Canvas, 0, sourceY, page3Width, sourceHeight, 0, 0, page3Width, sourceHeight)
            pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', pageMargin, pageMargin, page3PdfWidth, sliceHeight)
          }
          
          sourceY += sourceHeight
          remaining -= sliceHeight
        }
      }

      // PDF를 Blob으로 변환
      const pdfArrayBuffer = pdf.output('arraybuffer')
      const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' })

      // Supabase Storage에 업로드 및 estimates 테이블에 저장
      try {
        // Estimate 번호 생성
        const estimateNumber = `EST-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`
        
        // Storage에 업로드
        const timestamp = Date.now()
        const storageFileName = `estimates/${customerId}/${timestamp}_${estimateNumber}.pdf`
        
        const { error: uploadError } = await supabase.storage
          .from('customer-documents')
          .upload(storageFileName, pdfBlob, {
            contentType: 'application/pdf',
            upsert: false
          })

        if (uploadError) {
          console.error('PDF 업로드 오류:', uploadError)
          alert(locale === 'ko' ? 'PDF 업로드 중 오류가 발생했습니다.' : 'Error uploading PDF.')
          return
        }

        // Public URL 가져오기
        const { data: urlData } = supabase.storage
          .from('customer-documents')
          .getPublicUrl(storageFileName)

        // estimates 테이블에 저장
        const estimateData = {
          customer_id: customerId,
          estimate_number: estimateNumber,
          estimate_date: estimateDate || new Date().toISOString().split('T')[0],
          estimate_data: {
            customerName, 
            customerEmail, 
            customerPhone, 
            courses: courses.map(c => ({
              courseId: c.courseId,
              courseName: c.courseName,
              day: c.day,
              time: c.time,
              duration: c.duration
            })),
            participantCount, 
            vehicleType, 
            numberOfDays, 
            sellingPrice,
            additionalCost, 
            totalBeforeTip, 
            tipAmount, 
            sellingPriceWithTip,
            mileage, 
            notes
          } as any,
          pdf_url: urlData.publicUrl,
          pdf_file_path: storageFileName,
          status: 'draft'
        }

        const { error: saveError } = await supabase
          .from('estimates')
          .insert(estimateData as any)

        if (saveError) {
          console.error('Estimate 저장 오류:', saveError)
          alert(locale === 'ko' ? 'Estimate 저장 중 오류가 발생했습니다.' : 'Error saving estimate.')
        } else {
          alert(locale === 'ko' ? 'Estimate가 저장되었습니다.' : 'Estimate has been saved.')
        }
      } catch (saveError) {
        console.error('Estimate 저장 중 오류:', saveError)
        alert(locale === 'ko' ? 'Estimate 저장 중 오류가 발생했습니다.' : 'Error saving estimate.')
      }

      // PDF 생성 후 이미지 데이터 초기화
      setMapImageData(null)
    } catch (error) {
      console.error('Estimate 저장 오류:', error)
      alert(locale === 'ko' ? 'Estimate 저장 중 오류가 발생했습니다.' : 'Error saving estimate.')
      setMapImageData(null)
    } finally {
      setSaving(false)
    }
  }

  const handleSendEmail = async () => {
    if (!customerEmail) {
      alert('고객 이메일을 입력해주세요.')
      return
    }

    setSending(true)
    try {
      const estimateHTML = generateEstimateHTML()
      
      // 이메일 발송 API 호출 (실제 구현 필요)
      const response = await fetch('/api/send-estimate-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: customerEmail,
          subject: `Tour Estimate - ${customerName || 'Customer'}`,
          html: estimateHTML,
          customerName: customerName,
          customerPhone: customerPhone,
        }),
      })

      if (!response.ok) {
        throw new Error('이메일 발송 실패')
      }

      alert('Estimate가 성공적으로 발송되었습니다.')
      onClose()
    } catch (error) {
      console.error('이메일 발송 오류:', error)
      alert('이메일 발송 중 오류가 발생했습니다.')
    } finally {
      setSending(false)
    }
  }

  // 텍스트 형식으로 estimate 생성
  const generateEstimateText = (): string => {
    const vehicleTypeName = vehicleType === 'minivan' ? '미니밴' : vehicleType === '9seater' ? '9인승' : '13인승'
    const isEnglish = locale === 'en'
    
    let text = ''
    text += isEnglish ? 'Tour Estimate\n' : '투어 견적\n'
    text += `Date: ${estimateDate}\n\n`
    text += isEnglish ? 'Customer Information\n' : '고객 정보\n'
    text += `${isEnglish ? 'Name' : '이름'}: ${customerName || 'N/A'}\n`
    text += `${isEnglish ? 'Email' : '이메일'}: ${customerEmail}\n`
    if (customerPhone) {
      text += `${isEnglish ? 'Phone' : '전화번호'}: ${customerPhone}\n`
    }
    text += `${isEnglish ? 'Participants' : '참가 인원'}: ${participantCount} ${isEnglish ? 'people' : '명'}\n`
    text += `${isEnglish ? 'Vehicle' : '차량'}: ${vehicleTypeName}\n`
    text += `${isEnglish ? 'Duration' : '기간'}: ${numberOfDays} ${isEnglish ? 'day(s)' : '일'}\n\n`

    if (courses.length > 0) {
      text += isEnglish ? 'Tour Schedule\n' : '투어 스케줄\n'
      text += `${isEnglish ? 'Day' : '일차'}\t${isEnglish ? 'Time' : '시간'}\t${isEnglish ? 'Course' : '코스'}\t${isEnglish ? 'Duration' : '소요시간'}\n`
      courses.forEach(course => {
        text += `${course.day}\t${course.time || 'TBD'}\t${course.courseName}\t${course.duration ? `${course.duration} min` : 'N/A'}\n`
      })
      text += '\n'
    }

    text += isEnglish ? 'Cost Breakdown\n' : '금액 안내\n'
    text += `${isEnglish ? 'Participants' : '참가 인원'}: ${participantCount} ${isEnglish ? 'people' : '명'}\n`
    text += `${isEnglish ? 'Selling Price (excluding tip)' : '판매가 (팁 제외)'}: ${formatUSD(sellingPrice)}\n`
    
    if (otherExpenses.length > 0 && otherExpenses.some(e => e.amount > 0)) {
      otherExpenses.filter(e => e.amount > 0).forEach(expense => {
        text += `+ ${isEnglish ? 'Additional Cost' : '추가비용'} (${expense.name || (isEnglish ? 'No name' : '항목명 없음')}): +${formatUSD(expense.amount)}\n`
      })
      text += `${isEnglish ? 'Total' : '총합'}: ${formatUSD(totalBeforeTip)}\n`
      text += '----------------------------------------\n'
    }
    
    text += `${isEnglish ? 'Tip (15%)' : '팁 (15%)'}: ${formatUSD(tipAmount)}\n`
    text += `${isEnglish ? 'Selling Price (including tip)' : '팁 포함 판매가'}: ${formatUSD(sellingPriceWithTip)}\n\n`

    // 투어 코스 설명
    const courseOrderMap = new Map<string, number>()
    courses.forEach((c, index) => {
      courseOrderMap.set(c.courseId, index)
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
      
      return (courseName || '').trim() !== '' || (courseDescription || '').trim() !== ''
    })

    validCourses.sort((a, b) => {
      const orderA = courseOrderMap.get(a.id) ?? Infinity
      const orderB = courseOrderMap.get(b.id) ?? Infinity
      return orderA - orderB
    })

    if (validCourses.length > 0) {
      text += isEnglish ? 'Tour Course Description\n' : '투어 코스 설명\n'
      validCourses.forEach(course => {
        const parentName = course.parent 
          ? (isEnglish 
              ? (course.parent.customer_name_en || course.parent.customer_name_ko || '')
              : (course.parent.customer_name_ko || course.parent.customer_name_en || ''))
          : null
        
        const courseName = isEnglish 
          ? (course.customer_name_en || course.customer_name_ko || '')
          : (course.customer_name_ko || course.customer_name_en || '')
        
        const fullCourseName = parentName 
          ? `${parentName} - ${courseName}`
          : courseName
        
        const courseDescription = isEnglish
          ? (course.customer_description_en || course.customer_description_ko || '')
          : (course.customer_description_ko || course.customer_description_en || '')

        if (fullCourseName && fullCourseName.trim() !== '') {
          text += `${fullCourseName}\n`
        }
        if (courseDescription && courseDescription.trim() !== '') {
          text += `${courseDescription}\n`
        }
        text += '\n'
      })
    }

    if (notes) {
      text += `${isEnglish ? 'Notes' : '메모'}\n`
      text += `${notes}\n`
    }

    return text
  }

  // 클립보드에 복사하는 함수
  const handleCopyToClipboard = async () => {
    if (!estimateContentRef.current) return

    setCopying(true)
    try {
      // HTML 형식으로 복사 (이메일 클라이언트에서 사용 가능)
      const htmlContent = generateEstimateHTML()
      
      // 클립보드 API 사용
      if (navigator.clipboard && navigator.clipboard.write) {
        try {
          // HTML과 텍스트 모두 복사
          const clipboardItem = new ClipboardItem({
            'text/html': new Blob([htmlContent], { type: 'text/html' }),
            'text/plain': new Blob([generateEstimateText()], { type: 'text/plain' })
          })
          await navigator.clipboard.write([clipboardItem])
        } catch (clipboardError) {
          // ClipboardItem이 지원되지 않으면 텍스트만 복사
          const textContent = generateEstimateText()
          await navigator.clipboard.writeText(textContent)
        }
      } else {
        // 폴백: 텍스트만 복사
        const textContent = generateEstimateText()
        await navigator.clipboard.writeText(textContent)
      }

      alert(locale === 'ko' ? '클립보드에 복사되었습니다.' : 'Copied to clipboard.')
    } catch (error) {
      console.error('클립보드 복사 오류:', error)
      // 폴백: 텍스트만 복사
      try {
        const textContent = generateEstimateText()
        await navigator.clipboard.writeText(textContent)
        alert(locale === 'ko' ? '클립보드에 복사되었습니다.' : 'Copied to clipboard.')
      } catch (fallbackError) {
        console.error('클립보드 복사 폴백 오류:', fallbackError)
        alert(locale === 'ko' ? '클립보드 복사 중 오류가 발생했습니다.' : 'Error copying to clipboard.')
      }
    } finally {
      setCopying(false)
    }
  }

  const generateEstimateHTML = (): string => {
    const vehicleTypeName = vehicleType === 'minivan' ? '미니밴' : vehicleType === '9seater' ? '9인승' : '13인승'
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
          .header h1 { color: #2563eb; margin: 0; }
          .info-section { margin-bottom: 30px; }
          .info-row { display: flex; margin-bottom: 10px; }
          .info-label { font-weight: bold; width: 150px; }
          .schedule-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .schedule-table th, .schedule-table td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          .schedule-table th { background-color: #2563eb; color: white; }
          .cost-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .cost-table th, .cost-table td { border: 1px solid #ddd; padding: 10px; text-align: right; }
          .cost-table th { background-color: #f3f4f6; text-align: left; }
          .total-row { font-weight: bold; font-size: 1.2em; background-color: #dbeafe; }
          .description-section { margin: 30px 0; padding: 20px; background-color: #f9fafb; border-radius: 8px; }
          .description-section h3 { color: #2563eb; margin-top: 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Tour Estimate</h1>
            <p>Date: ${estimateDate}</p>
          </div>

          <div class="info-section">
            <h2>Customer Information</h2>
            <div class="info-row">
              <span class="info-label">Name:</span>
              <span>${customerName || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Email:</span>
              <span>${customerEmail}</span>
            </div>
            ${customerPhone ? `
            <div class="info-row">
              <span class="info-label">Phone:</span>
              <span>${customerPhone}</span>
            </div>
            ` : ''}
            <div class="info-row">
              <span class="info-label">Participants:</span>
              <span>${participantCount} people</span>
            </div>
            <div class="info-row">
              <span class="info-label">Vehicle:</span>
              <span>${vehicleTypeName}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Duration:</span>
              <span>${numberOfDays} day(s)</span>
            </div>
          </div>

          ${courses.length > 0 ? `
          <div class="info-section">
            <h2>Tour Schedule</h2>
            <table class="schedule-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Time</th>
                  <th>Course</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                ${courses.map(course => `
                  <tr>
                    <td>${course.day}</td>
                    <td>${course.time || 'TBD'}</td>
                    <td>${course.courseName}</td>
                    <td>${course.duration ? `${course.duration} min` : 'N/A'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          <div class="info-section">
            <h2>Cost Breakdown</h2>
            <table class="cost-table">
              <tr>
                <th>Participants</th>
                <td>${participantCount} people</td>
              </tr>
              <tr>
                <th>Selling Price (excluding tip)</th>
                <td>${formatUSD(sellingPrice)}</td>
              </tr>
              ${otherExpenses.length > 0 && otherExpenses.some(e => e.amount > 0) ? otherExpenses.filter(e => e.amount > 0).map(expense => `
              <tr>
                <th>+ Additional Cost (${expense.name || 'No name'})</th>
                <td>+${formatUSD(expense.amount)}</td>
              </tr>
              `).join('') : ''}
              ${otherExpenses.length > 0 && otherExpenses.some(e => e.amount > 0) ? `
              <tr>
                <th>Total</th>
                <td>${formatUSD(totalBeforeTip)}</td>
              </tr>
              <tr>
                <td colspan="2" style="border-top: 1px solid #ddd; padding: 10px 0;"></td>
              </tr>
              ` : ''}
              <tr>
                <th>Tip (15%)</th>
                <td>${formatUSD(tipAmount)}</td>
              </tr>
              <tr class="total-row">
                <th>Selling Price (including tip)</th>
                <td>${formatUSD(sellingPriceWithTip)}</td>
              </tr>
            </table>
          </div>

          ${(() => {
            // 선택된 코스 ID 목록과 순서 유지
            const courseOrderMap = new Map<string, number>()
            courses.forEach((c, index) => {
              courseOrderMap.set(c.courseId, index)
            })
            
            // 카테고리가 "포인트"인 코스만 필터링
            const pointCourses = tourCourses.filter(course => {
              const category = course.category?.toLowerCase() || ''
              return courseOrderMap.has(course.id) && 
                     (category.includes('포인트') || category.includes('point'))
            })

            // 이름과 설명이 모두 있는 코스만 필터링
            const isEnglish = locale === 'en'
            const validCourses = pointCourses.filter(course => {
              const courseName = isEnglish 
                ? (course.customer_name_en || course.customer_name_ko || '')
                : (course.customer_name_ko || course.customer_name_en || '')
              const courseDescription = isEnglish
                ? (course.customer_description_en || course.customer_description_ko || '')
                : (course.customer_description_ko || course.customer_description_en || '')
              
              // 이름 또는 설명 중 하나라도 있으면 포함
              return (courseName || '').trim() !== '' || (courseDescription || '').trim() !== ''
            })

            // 스케줄 순서대로 정렬
            validCourses.sort((a, b) => {
              const orderA = courseOrderMap.get(a.id) ?? Infinity
              const orderB = courseOrderMap.get(b.id) ?? Infinity
              return orderA - orderB
            })

            if (validCourses.length === 0) return ''

            const courseDescriptions = validCourses.map(course => {
              // 상위 카테고리 이름 가져오기
              const parentName = course.parent 
                ? (isEnglish 
                    ? (course.parent.customer_name_en || course.parent.customer_name_ko || '')
                    : (course.parent.customer_name_ko || course.parent.customer_name_en || ''))
                : null
              
              // 포인트 이름
              const courseName = isEnglish 
                ? (course.customer_name_en || course.customer_name_ko || '')
                : (course.customer_name_ko || course.customer_name_en || '')
              
              // 상위 카테고리 포함한 전체 이름
              const fullCourseName = parentName 
                ? `${parentName} - ${courseName}`
                : courseName
              
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
              
              return `
                <div style="display: flex; gap: 16px; margin-bottom: 24px; align-items: flex-start; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb;">
                  ${fullPhotoUrl ? `<div style="flex: 0 0 200px;"><img src="${fullPhotoUrl}" alt="${fullCourseName || 'Course image'}" style="width: 200px; height: 150px; object-fit: cover; border-radius: 8px; border: 1px solid #e5e7eb;" /></div>` : ''}
                  <div style="flex: 1;">
                    ${fullCourseName && fullCourseName.trim() !== '' ? `<h4 style="font-weight: bold; color: #111827; margin-bottom: 8px; font-size: 14px;">${fullCourseName}</h4>` : ''}
                    ${courseDescription && courseDescription.trim() !== '' ? `<p style="color: #374151; line-height: 1.6; margin-bottom: 0;">${courseDescription.replace(/\n/g, '<br>')}</p>` : ''}
                  </div>
                </div>
              `
            }).join('')

            return `
              <div class="description-section">
                <h3>Tour Course Description</h3>
                ${courseDescriptions}
              </div>
            `
          })()}


          ${notes ? `
          <div class="description-section">
            <h3>Notes</h3>
            <p>${notes.replace(/\n/g, '<br>')}</p>
          </div>
          ` : ''}
        </div>
      </body>
      </html>
    `
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Estimate</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* 본문 */}
        <div ref={estimateContentRef} className="flex-1 overflow-y-auto p-6">
          {/* 고객 정보 */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Users className="w-5 h-5" />
              고객 정보
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이름
                </label>
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value)
                    setCustomerName(e.target.value)
                    setShowCustomerDropdown(true)
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  onBlur={() => {
                    // 드롭다운 클릭을 위해 약간의 지연
                    setTimeout(() => setShowCustomerDropdown(false), 200)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="고객 이름, 이메일, 전화번호로 검색..."
                />
                {showCustomerDropdown && customerSearch && filteredCustomers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredCustomers.map(c => (
                      <div
                        key={c.id}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          handleCustomerSelect(c)
                        }}
                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">{c.name || '이름 없음'}</div>
                        {c.email && (
                          <div className="text-sm text-gray-500">{c.email}</div>
                        )}
                        {c.phone && (
                          <div className="text-sm text-gray-500">{c.phone}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이메일 *
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="customer@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  전화번호
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="전화번호"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimate 날짜
                </label>
                <input
                  type="date"
                  value={estimateDate}
                  onChange={(e) => setEstimateDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* 금액 안내 */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              금액 안내
            </h3>
            <div className="border border-gray-200 rounded-lg p-4 bg-white">
              <div className="space-y-2">
                <div className="flex justify-between py-2">
                  <span className="text-sm font-medium text-gray-700">참가 인원</span>
                  <span className="text-sm font-medium text-gray-900">{participantCount}명</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-sm font-medium text-gray-700">판매가 (팁 제외)</span>
                  <span className="text-sm font-medium text-gray-900">{formatUSD(sellingPrice)}</span>
                </div>
                {otherExpenses.length > 0 && otherExpenses.map((expense) => (
                  expense.amount > 0 && (
                    <div key={expense.id} className="flex justify-between py-2 pl-6">
                      <span className="text-sm font-medium text-gray-700">
                        + 추가비용 ({expense.name || '항목명 없음'})
                      </span>
                      <span className="text-sm font-medium text-gray-900">+{formatUSD(expense.amount)}</span>
                    </div>
                  )
                ))}
                {otherExpenses.length > 0 && otherExpenses.some(e => e.amount > 0) && (
                  <>
                    <div className="flex justify-between py-2 mt-1">
                      <span className="text-sm font-semibold text-gray-700">총합</span>
                      <span className="text-sm font-semibold text-gray-900">{formatUSD(totalBeforeTip)}</span>
                    </div>
                    <div className="border-t border-gray-200 my-2"></div>
                  </>
                )}
                <div className="flex justify-between py-2">
                  <span className="text-sm font-medium text-gray-700">팁 (15%)</span>
                  <span className="text-sm font-medium text-gray-900">{formatUSD(tipAmount)}</span>
                </div>
                <div className="flex justify-between py-3 bg-blue-50 rounded-lg px-3 mt-2">
                  <span className="text-base font-bold text-gray-900">팁 포함 판매가</span>
                  <span className="text-base font-bold text-blue-600">{formatUSD(sellingPriceWithTip)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 투어 코스 및 스케줄 */}
          {courses.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                투어 스케줄
              </h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">일차</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">시간</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">투어 코스</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">소요 시간</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map((course, index) => (
                      <tr key={index} className="border-t border-gray-200">
                        <td className="px-4 py-2 text-sm">{course.day}</td>
                        <td className="px-4 py-2 text-sm">{course.time || 'TBD'}</td>
                        <td className="px-4 py-2 text-sm">{course.courseName}</td>
                        <td className="px-4 py-2 text-sm">{course.duration ? `${course.duration}분` : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 투어 코스 설명 */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              투어 코스 설명
            </h3>
            <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50">
              {(() => {
                // 선택된 코스 ID 목록과 순서 유지
                const courseOrderMap = new Map<string, number>()
                courses.forEach((c, index) => {
                  courseOrderMap.set(c.courseId, index)
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
                      카테고리가 "포인트"인 투어 코스가 없습니다.
                    </p>
                  )
                }

                return validCourses.map((course) => {
                  const isEnglish = locale === 'en'
                  
                  // 상위 카테고리 이름 가져오기
                  const parentName = course.parent 
                    ? (isEnglish 
                        ? (course.parent.customer_name_en || course.parent.customer_name_ko || '')
                        : (course.parent.customer_name_ko || course.parent.customer_name_en || ''))
                    : null
                  
                  // 포인트 이름
                  const courseName = isEnglish 
                    ? (course.customer_name_en || course.customer_name_ko || '')
                    : (course.customer_name_ko || course.customer_name_en || '')
                  
                  // 상위 카테고리 포함한 전체 이름
                  const fullCourseName = parentName 
                    ? `${parentName} - ${courseName}`
                    : courseName
                  
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

          {/* 경로 및 마일리지 */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Route className="w-5 h-5" />
              경로 및 마일리지
            </h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">총 마일리지</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {mileage ? `${mileage.toFixed(1)} 마일` : 'N/A'}
                  </span>
                </div>
              </div>
              {mapImageData ? (
                <img 
                  src={mapImageData} 
                  alt="Route Map" 
                  className="w-full h-auto object-cover border border-gray-300 rounded"
                  style={{ minHeight: '300px', maxHeight: '600px' }}
                />
              ) : (
                <div ref={mapRef} className="w-full h-96 bg-gray-100" style={{ minHeight: '384px' }} />
              )}
            </div>
          </div>

          {/* 메모 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              메모
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="추가 메모를 입력하세요..."
            />
          </div>

        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end p-6 border-t gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleCreateReservation}
            disabled={creatingReservation || !customerEmail}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {creatingReservation ? '예약 생성 중...' : '예약 추가'}
          </button>
          <button
            onClick={handleSaveEstimate}
            disabled={saving || !customerEmail}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? '저장 중...' : 'Estimate 저장'}
          </button>
          <button
            onClick={handleSendEmail}
            disabled={sending || !customerEmail}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send className="h-4 w-4" />
            {sending ? '발송 중...' : '이메일 발송'}
          </button>
          <button
            onClick={handleCopyToClipboard}
            disabled={copying}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Copy className="h-4 w-4" />
            {copying ? (locale === 'ko' ? '복사 중...' : 'Copying...') : (locale === 'ko' ? '복사' : 'Copy')}
          </button>
        </div>
      </div>
    </div>
  )
}
