'use client'



import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Plus, Search, MapPin, Image as ImageIcon, Video, X, ChevronLeft, ChevronRight, Trash2, Copy, AlertTriangle, ChevronDown, ChevronUp, Info, Map, Table, Grid3X3, Edit2, Save, XCircle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import NextImage from 'next/image'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'

import PickupHotelForm from '@/components/PickupHotelForm'

import { groupHotelsByGroupNumber, processPickupRequest } from '@/utils/pickupHotelUtils'



// Google Maps 타입 정의

interface GoogleMapsMap {

  addListener: (event: string, callback: (event: GoogleMapsMapMouseEvent) => void) => void

  setCenter: (center: { lat: number; lng: number }) => void

  setZoom: (zoom: number) => void

  fitBounds: (bounds: GoogleMapsLatLngBounds) => void
}



interface GoogleMapsMarker {

  setMap: (map: GoogleMapsMap | null) => void

  addListener: (event: string, callback: () => void) => void

  getPosition: () => { lat: () => number; lng: () => number }

}



interface GoogleMapsMapMouseEvent {

  latLng?: {

    lat: () => number

    lng: () => number

  }

}



// Google Maps API는 동적으로 로드되므로 필요한 타입만 정의
interface GoogleMapsLatLngBounds {
  extend: (position: { lat: () => number; lng: () => number }) => void
}

interface GoogleMapsCircle {
  setMap: (map: GoogleMapsMap | null) => void
}

// Google Maps API 타입 정의
interface GoogleMapsAPI {
  maps: {
    Map: new (element: HTMLElement, options: GoogleMapsMapOptions) => GoogleMapsMap
    Marker: new (options: GoogleMapsMarkerOptions) => GoogleMapsMarker
    Circle: new (options: GoogleMapsCircleOptions) => GoogleMapsCircle
    InfoWindow: GoogleMapsInfoWindowConstructor
    LatLngBounds: new () => GoogleMapsLatLngBounds
    MapTypeId?: {
  ROADMAP: string

    }
  }
}

interface GoogleMapsMapOptions {
  center: { lat: number; lng: number }
  zoom: number
  mapTypeId?: string
}

interface GoogleMapsMarkerOptions {
  position: { lat: number; lng: number }
  map: GoogleMapsMap
  title: string
  label: string
}

interface GoogleMapsCircleOptions {
  center: { lat: number; lng: number }
  radius: number
  map: GoogleMapsMap
  fillColor: string
  fillOpacity: number
  strokeColor: string
  strokeOpacity: number
  strokeWeight: number
}

interface GoogleMapsInfoWindowOptions {
  content: string
}



interface GoogleMapsInfoWindow {

  open: (map: GoogleMapsMap, marker: GoogleMapsMarker) => void

}



interface GoogleMapsInfoWindowConstructor {
  new (options: GoogleMapsInfoWindowOptions): GoogleMapsInfoWindow
}

// Google Maps API는 동적으로 로드되므로 any 타입으로 처리


interface PickupHotel {

  id: string

  hotel: string

  pick_up_location: string

  description_ko: string | null

  description_en: string | null

  address: string

  pin: string | null

  link: string | null

  youtube_link: string | null

  media: string[] | null

  is_active: boolean | null

  group_number: number | null

  created_at: string | null

  updated_at: string | null

}



interface AdminPickupHotelsProps {

  params: Promise<{ locale: string }>

}



export default function AdminPickupHotels({ params }: AdminPickupHotelsProps) {
  const paramsObj = useParams()
  const locale = paramsObj.locale as string

  

  // Translation strings

  const translations = {

    title: 'Add New Hotel',

    editTitle: 'Edit Hotel',

    hotel: 'Hotel Name',

    pickUpLocation: 'Pickup Location',

    descriptionKo: 'Description (Korean)',

    descriptionEn: 'Description (English)',

    address: 'Address',

    pin: 'Coordinates (Latitude, Longitude)',

    link: 'Google Map Link',

    media: 'Media Files (Photos, Videos)',

    cancel: 'Cancel',

    add: 'Add',

    edit: 'Edit'

  }

  

  const [hotels, setHotels] = useState<PickupHotel[]>([])

  const [loading, setLoading] = useState(true)

  const [searchTerm, setSearchTerm] = useState('')

  const [showAddForm, setShowAddForm] = useState(false)

  const [editingHotel, setEditingHotel] = useState<PickupHotel | null>(null)

  const [imageViewer, setImageViewer] = useState<{

    isOpen: boolean

    images: string[]

    currentIndex: number

    hotelName: string

  }>({

    isOpen: false,

    images: [],

    currentIndex: 0,

    hotelName: ''

  })

  const [deleteConfirm, setDeleteConfirm] = useState<{

    isOpen: boolean

    hotel: PickupHotel | null

  }>({

    isOpen: false,

    hotel: null

  })

  const [expandedGroups, setExpandedGroups] = useState<{ [key: string]: boolean }>({})

  const [testRequest, setTestRequest] = useState('')

  const [testResult, setTestResult] = useState<{

    success: boolean

    message: string

    targetHotel: PickupHotel | null

    requestedHotel: PickupHotel | null

  } | null>(null)

  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'map'>('grid')

  const [editingHotelId, setEditingHotelId] = useState<string | null>(null)

  const [editFormData, setEditFormData] = useState<Partial<PickupHotel>>({})

  const [mapLoaded, setMapLoaded] = useState(false)

  const [mapInstance, setMapInstance] = useState<GoogleMapsMap | null>(null)

  const [mapMarkers, setMapMarkers] = useState<GoogleMapsMarker[]>([])
  const [mapCircles, setMapCircles] = useState<GoogleMapsCircle[]>([])

  const markerMapRef = useRef<{ [id: string]: GoogleMapsMarker }>({})
  const circleMapRef = useRef<{ [id: string]: GoogleMapsCircle }>({})
  
  // 그룹 번호별 색상 배열 (정수 그룹 번호에 따라 다른 색상 적용)
  const groupColors = useMemo(() => [
    '#ff0000', // 그룹 1: 빨간색
    '#00ff00', // 그룹 2: 초록색
    '#0000ff', // 그룹 3: 파란색
    '#ffff00', // 그룹 4: 노란색
    '#ff00ff', // 그룹 5: 마젠타
    '#00ffff', // 그룹 6: 시안
    '#ff8000', // 그룹 7: 주황색
    '#8000ff', // 그룹 8: 보라색
    '#ff0080', // 그룹 9: 핑크
    '#80ff00', // 그룹 10: 라임
    '#0080ff', // 그룹 11: 하늘색
    '#ff8080', // 그룹 12: 연한 빨강
    '#80ff80', // 그룹 13: 연한 초록
    '#8080ff', // 그룹 14: 연한 파랑
    '#ffff80', // 그룹 15: 연한 노랑
  ], [])

  // 그룹 번호에 따른 색상 반환 함수
  const getGroupColor = useCallback((groupNumber: number): string => {
    const index = (groupNumber - 1) % groupColors.length
    return groupColors[index]
  }, [groupColors])

  const [bulkEditMode, setBulkEditMode] = useState(false)

  const [bulkEditData, setBulkEditData] = useState<{ [hotelId: string]: Partial<PickupHotel> }>({})

  const [sortField, setSortField] = useState<keyof PickupHotel | null>(null)

  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const [selectedHotelInfo, setSelectedHotelInfo] = useState<{ name: string; pickup: string; address: string; group: number | null; id: string } | null>(null)
  const [quickEditMode, setQuickEditMode] = useState(false)
  const [quickEditGroupNumber, setQuickEditGroupNumber] = useState<number | null>(null)
  
  // 지도 필터링 상태
  const [groupFilter, setGroupFilter] = useState<'all' | 'integer'>('all') // 기본값: 모두 보기
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')


  // Supabase에서 픽업 호텔 데이터 가져오기

  const fetchHotels = async () => {

    try {

      const { data, error } = await supabase

        .from('pickup_hotels')

        .select('*')

        .order('hotel', { ascending: true })



      if (error) {

        console.error('Error fetching pickup hotels:', error)

        return

      }



      setHotels(data || [])

    } catch (error) {

      console.error('Error fetching pickup hotels:', error)

    }

  }



  useEffect(() => {

    const loadData = async () => {

      setLoading(true)

      await fetchHotels()

      setLoading(false)

    }

    

    loadData()

  }, [])



  // 키보드 네비게이션

  useEffect(() => {

    const handleKeyDown = (e: KeyboardEvent) => {

      if (!imageViewer.isOpen) return



      switch (e.key) {

        case 'Escape':

          closeImageViewer()

          break

        case 'ArrowLeft':

          prevImage()

          break

        case 'ArrowRight':

          nextImage()

          break

      }

    }



    document.addEventListener('keydown', handleKeyDown)

    return () => document.removeEventListener('keydown', handleKeyDown)

  }, [imageViewer.isOpen])



  const filteredHotels = hotels.filter(hotel => {

    const searchLower = searchTerm.toLowerCase()

    const matchesSearch = (
      hotel.hotel?.toLowerCase().includes(searchLower) ||

      hotel.pick_up_location?.toLowerCase().includes(searchLower) ||

      hotel.address?.toLowerCase().includes(searchLower)

    )

    
    // 그룹 번호 필터링
    let matchesGroupFilter = true
    if (groupFilter === 'integer') {
      // 정수인 그룹 번호만 (소수점이 없는 것)
      if (hotel.group_number !== null) {
        matchesGroupFilter = Number.isInteger(hotel.group_number)
      } else {
        matchesGroupFilter = false
      }
    }
    
    // 활성화 상태 필터링
    let matchesStatusFilter = true
    if (statusFilter === 'active') {
      matchesStatusFilter = hotel.is_active !== false // null이나 undefined도 활성으로 간주
    } else if (statusFilter === 'inactive') {
      matchesStatusFilter = hotel.is_active === false
    }
    
    return matchesSearch && matchesGroupFilter && matchesStatusFilter
  })



  const groupedHotels = groupHotelsByGroupNumber(filteredHotels)

  // Convert group keys to English if locale is 'en'
  const getGroupLabel = (key: string) => {
    if (locale === 'en') {
      if (key === '그룹 미설정') return 'No Group'
      return key.replace('그룹 ', 'Group ')
    }
    return key
  }

  const sortedGroupKeys = Object.keys(groupedHotels).sort((a, b) => {

    // Sort by group number (ungrouped items last)

    const ungrouped = locale === 'en' ? 'No Group' : '그룹 미설정'
    if (a === ungrouped || a === '그룹 미설정') return 1

    if (b === ungrouped || b === '그룹 미설정') return -1

    

    const aNum = parseInt(a.replace('그룹 ', ''))

    const bNum = parseInt(b.replace('그룹 ', ''))

    return aNum - bNum

  })



  // 정렬 함수

  const handleSort = (field: keyof PickupHotel) => {

    if (sortField === field) {

      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')

    } else {

      setSortField(field)

      setSortDirection('asc')

    }

  }



  const getSortIcon = (field: keyof PickupHotel) => {

    if (sortField !== field) {

      return <ArrowUpDown size={14} className="text-gray-400" />

    }

    return sortDirection === 'asc' 

      ? <ArrowUp size={14} className="text-blue-600" />

      : <ArrowDown size={14} className="text-blue-600" />

  }



  // 정렬된 호텔 목록

  const sortedHotels = [...filteredHotels].sort((a, b) => {

    if (!sortField) return 0

    

    let aValue = a[sortField]

    let bValue = b[sortField]

    

    // null/undefined 처리

    if (aValue === null || aValue === undefined) aValue = ''

    if (bValue === null || bValue === undefined) bValue = ''

    

    // 숫자 비교 (그룹 번호)

    if (sortField === 'group_number') {

      const aNum = typeof aValue === 'number' ? aValue : 999

      const bNum = typeof bValue === 'number' ? bValue : 999

      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum

    }

    

    // 문자열 비교

    const aStr = `${aValue}`.toLowerCase()
    const bStr = `${bValue}`.toLowerCase()
    

    if (aStr < bStr) return sortDirection === 'asc' ? -1 : 1

    if (aStr > bStr) return sortDirection === 'asc' ? 1 : -1

    return 0

  })



  // 그룹 토글 함수

  const toggleGroup = (groupKey: string) => {

    setExpandedGroups(prev => ({

      ...prev,

      [groupKey]: !prev[groupKey]

    }))

  }



  // 초기 로드 시 모든 그룹을 확장

  useEffect(() => {

    if (sortedGroupKeys.length > 0 && Object.keys(expandedGroups).length === 0) {

      const initialExpanded: { [key: string]: boolean } = {}

      sortedGroupKeys.forEach(key => {

        initialExpanded[key] = true

      })

      setExpandedGroups(initialExpanded)

    }

  }, [sortedGroupKeys, expandedGroups])



  // 모든 그룹 토글 함수

  const toggleAllGroups = () => {

    const allExpanded = Object.values(expandedGroups).every(expanded => expanded)

    const newExpanded: { [key: string]: boolean } = {}

    sortedGroupKeys.forEach(key => {

      newExpanded[key] = !allExpanded

    })

    setExpandedGroups(newExpanded)

  }



  // 픽업 요청 테스트 함수

  const testPickupRequest = () => {

    if (!testRequest.trim()) {

        alert('Please enter a hotel name to test.')

      return

    }

    

    const result = processPickupRequest(testRequest, hotels)

    setTestResult(result)

  }



  // 인라인 편집 함수들

  const startEdit = (hotel: PickupHotel) => {

    setEditingHotelId(hotel.id)

    setEditFormData({

      hotel: hotel.hotel,

      pick_up_location: hotel.pick_up_location,

      description_ko: hotel.description_ko,

      description_en: hotel.description_en,

      address: hotel.address,

      pin: hotel.pin,

      link: hotel.link,

      group_number: hotel.group_number,

      is_active: hotel.is_active

    })

  }



  const cancelEdit = () => {

    setEditingHotelId(null)

    setEditFormData({})

  }



  const saveEdit = async (hotelId: string) => {

    try {

      const { error } = await supabase

        .from('pickup_hotels')

        .update(editFormData as never)

        .eq('id', hotelId)



      if (error) {

        console.error('Error updating hotel:', error)

        alert('Error updating hotel: ' + error.message)

        return

      }



      await fetchHotels()

      setEditingHotelId(null)

      setEditFormData({})

      alert('Hotel updated successfully!')

    } catch (error) {

      console.error('Error updating hotel:', error)

      alert('Error updating hotel.')

    }

  }

  // 빠른 편집 저장 함수
  const saveQuickEdit = async () => {
    if (!selectedHotelInfo) return

    try {
      const { error } = await supabase
        .from('pickup_hotels')
        .update({ group_number: quickEditGroupNumber } as never)
        .eq('id', selectedHotelInfo.id)

      if (error) {
        console.error('Error updating hotel group number:', error)
        alert('Error updating group number: ' + error.message)
        return
      }

      await fetchHotels()
      setQuickEditMode(false)
      setQuickEditGroupNumber(null)
      
      // 선택된 호텔 정보 업데이트
      setSelectedHotelInfo(prev => prev ? { ...prev, group: quickEditGroupNumber } : null)
      
      alert('Group number updated successfully!')
    } catch (error) {
      console.error('Error updating hotel group number:', error)
      alert('Error updating group number.')
    }
  }



  // 지도 초기화 함수

  const initializeMap = useCallback(() => {

    try {
      const google = (window as unknown as { google?: GoogleMapsAPI }).google
      if (typeof window !== 'undefined' && google && google.maps) {
      const mapElement = document.getElementById('hotelMap')

        if (!mapElement) {
          console.warn('지도 컨테이너 요소를 찾을 수 없습니다.')
          return
        }


        // MapTypeId가 없어도 기본값으로 처리
        const mapOptions: GoogleMapsMapOptions = {
        center: { lat: 36.1699, lng: -115.1398 }, // 라스베가스 중심

          zoom: 12
        }

        // MapTypeId가 있으면 사용, 없으면 기본값 사용
        if (google.maps.MapTypeId && google.maps.MapTypeId.ROADMAP) {
          mapOptions.mapTypeId = google.maps.MapTypeId.ROADMAP
        } else {
          console.warn('MapTypeId를 사용할 수 없어 기본 지도 타입을 사용합니다.')
          mapOptions.mapTypeId = 'roadmap' // 문자열로 직접 지정
        }

        const map = new google.maps.Map(mapElement, mapOptions)
      setMapInstance(map)

      setMapLoaded(true)

        console.log('지도가 성공적으로 초기화되었습니다.')
      } else {
        console.warn('Google Maps API가 아직 로드되지 않았습니다.')
      }
    } catch (error) {
      console.error('지도 초기화 중 오류 발생:', error)
    }

  }, [])



  // 호텔 마커 및 원 추가 함수 (완전히 안전한 버전)
  const addHotelMarkers = useCallback((map: GoogleMapsMap) => {

    const google = (window as unknown as { google?: GoogleMapsAPI }).google
    // Google Maps API가 로드되었는지 확인
    if (!google || !google.maps || !google.maps.Marker || !google.maps.InfoWindow || !google.maps.Circle) {
      console.warn('Google Maps API가 아직 완전히 로드되지 않았습니다.')
      return
    }

    // 재사용 가능한 마커 및 원 맵 사용
    const existingMarkers = markerMapRef.current
    const existingCircles = circleMapRef.current
    const nextIds = new Set<string>()

    // 안전한 HTML 이스케이프 함수
    const escapeHtml = (text: string | null | undefined): string => {
      if (!text) return ''
      return `${text}`
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    }

    // 안전한 문자열 생성 함수
    const createSafeString = (value: unknown): string => {
      if (value === null || value === undefined) return ''
      return `${value}`
    }

    filteredHotels.forEach((hotel, index) => {
      try {
        if (!hotel || !hotel.pin) {
          console.warn(`호텔 ${index}: pin 정보가 없습니다.`, hotel)
          return
        }

        const pinParts = hotel.pin.split(',')
        if (pinParts.length !== 2) {
          console.warn(`호텔 ${index}: pin 형식이 잘못되었습니다.`, hotel.pin)
          return
        }

        const lat = parseFloat(pinParts[0])
        const lng = parseFloat(pinParts[1])
        
        if (isNaN(lat) || isNaN(lng)) {
          console.warn(`호텔 ${index}: 좌표 변환 실패`, hotel.pin)
          return
        }

        // 마커 생성/업데이트
        const markerTitle = escapeHtml(createSafeString(hotel.hotel)) || '호텔명 없음'
        let markerLabel = '?'
        if (hotel.group_number !== null && hotel.group_number !== undefined) {
          markerLabel = `${hotel.group_number}`
        }
        const id = hotel.id
        nextIds.add(id)
        const existing = existingMarkers[id]
        if (existing) {
          // 위치/라벨/타이틀 업데이트
          try {
            const pos = (existing as unknown as { getPosition: () => { lat: () => number; lng: () => number } | null }).getPosition()
            const currLat = pos?.lat()
            const currLng = pos?.lng()
            if (currLat !== lat || currLng !== lng) {
              (existing as unknown as { setPosition: (p: { lat: number; lng: number }) => void }).setPosition({ lat, lng })
            }
            (existing as unknown as { setLabel: (l: string) => void }).setLabel(markerLabel)
            ;(existing as unknown as { setTitle?: (t: string) => void }).setTitle?.(markerTitle)
          } catch {}
        } else {
          const marker = new google.maps.Marker({
            position: { lat, lng },

            map: map,

            title: markerTitle,
            label: markerLabel
          })
          ;(marker as unknown as { addListener: (event: string, callback: () => void) => void }).addListener('click', () => {
            setSelectedHotelInfo({
              name: escapeHtml(`${hotel.hotel ?? ''}`) || '호텔명 없음',
              pickup: escapeHtml(`${hotel.pick_up_location ?? ''}`) || '픽업 위치 없음',
              address: escapeHtml(`${hotel.address ?? ''}`) || '주소 없음',
              group: hotel.group_number ?? null,
              id: hotel.id
            })
          })
          existingMarkers[id] = marker
        }

        // 정수 그룹 번호인 경우 원 추가
        if (hotel.group_number !== null && hotel.group_number !== undefined && Number.isInteger(hotel.group_number)) {
          const groupColor = getGroupColor(hotel.group_number)
          const existingCircle = existingCircles[id]
          if (existingCircle) {
            // 기존 원 업데이트 (위치 변경 시)
            try {
              const pos = (existing as unknown as { getPosition: () => { lat: () => number; lng: () => number } | null }).getPosition()
              const currLat = pos?.lat()
              const currLng = pos?.lng()
              if (currLat !== lat || currLng !== lng) {
                (existingCircle as unknown as { setCenter: (c: { lat: number; lng: number }) => void }).setCenter({ lat, lng })
              }
              // 색상도 업데이트 (그룹 번호가 변경된 경우)
              (existingCircle as unknown as { setOptions: (options: { fillColor: string; strokeColor: string }) => void }).setOptions({
                fillColor: groupColor,
                strokeColor: groupColor
              })
            } catch {}
          } else {
            // 새 원 생성
            const circle = new google.maps.Circle({
              center: { lat, lng },
              radius: 1000, // 1000미터
              map: map,
              fillColor: groupColor, // 그룹 번호에 따른 색상
              fillOpacity: 0.2, // 반투명
              strokeColor: groupColor, // 그룹 번호에 따른 테두리 색상
              strokeOpacity: 0.5,
              strokeWeight: 2
            })
            existingCircles[id] = circle
          }
        } else {
          // 정수가 아닌 경우 기존 원 제거
          const existingCircle = existingCircles[id]
          if (existingCircle) {
            try {
              (existingCircle as unknown as { setMap: (m: GoogleMapsMap | null) => void }).setMap(null)
            } catch {}
            delete existingCircles[id]
          }
        }
        
      } catch (error) {
        console.error(`호텔 ${index} 마커 생성 중 오류:`, error, hotel)
      }
    })

    // 제거 대상 마커 및 원 정리
    Object.keys(existingMarkers).forEach((id) => {
      if (!nextIds.has(id)) {
        try {
          (existingMarkers[id] as unknown as { setMap: (m: GoogleMapsMap | null) => void }).setMap(null)
        } catch {}
        delete existingMarkers[id]
      }
    })

    Object.keys(existingCircles).forEach((id) => {
      if (!nextIds.has(id)) {
        try {
          (existingCircles[id] as unknown as { setMap: (m: GoogleMapsMap | null) => void }).setMap(null)
        } catch {}
        delete existingCircles[id]
      }
    })

    setMapMarkers(Object.values(existingMarkers))
    setMapCircles(Object.values(existingCircles))
  }, [filteredHotels, getGroupColor])



  // 지도 뷰가 활성화될 때 지도 초기화 (최적화된 버전)
  useEffect(() => {

    if (viewMode === 'map' && !mapLoaded) {

      const google = (window as unknown as { google?: GoogleMapsAPI }).google
      // Google Maps API 스크립트 로드

      if (!google) {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

        if (!apiKey) {

          console.error('Google Maps API 키가 설정되지 않았습니다.')
          return

        }

        

        const script = document.createElement('script')

        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps&loading=async`
        script.async = true

        script.defer = true

        
        // 전역 콜백 함수 설정
        ;(window as unknown as { initGoogleMaps: () => void }).initGoogleMaps = () => {
          console.log('Google Maps API 콜백이 호출되었습니다.')
          // 더 긴 지연 시간으로 안정성 확보
          setTimeout(() => {
            const googleAfterLoad = (window as unknown as { google?: GoogleMapsAPI }).google
            if (googleAfterLoad && googleAfterLoad.maps) {
              initializeMap()
            } else {
              console.warn('콜백에서도 Google Maps API에 접근할 수 없습니다.')
            }
          }, 300)
        }

        script.onerror = () => {

          console.error('Google Maps API 로드 중 오류가 발생했습니다.')
        }

        document.head.appendChild(script)

      } else {

        // 이미 로드된 경우에도 안전하게 처리
        setTimeout(() => {
          const googleAfterLoad = (window as unknown as { google?: GoogleMapsAPI }).google
          if (googleAfterLoad && googleAfterLoad.maps) {
            initializeMap()
          } else {
            console.warn('Google Maps API가 이미 로드되어 있지만 접근할 수 없습니다.')
          }
        }, 200)
      }

    }

  }, [viewMode, mapLoaded, initializeMap])



  // 호텔 데이터가 변경될 때 마커 업데이트 (최적화된 버전)
  useEffect(() => {

    if (mapInstance && mapLoaded && viewMode === 'map') {

      // 지연 실행으로 성능 최적화
      const timeoutId = setTimeout(() => {
      addHotelMarkers(mapInstance)

      }, 250)
      
      return () => clearTimeout(timeoutId)
    }

  }, [filteredHotels, mapInstance, mapLoaded, viewMode, addHotelMarkers])



  // 지도에서 호텔 편집을 위한 전역 함수

  useEffect(() => {

    (window as unknown as { editHotel: (hotelId: string) => void }).editHotel = (hotelId: string) => {

      const hotel = hotels.find(h => h.id === hotelId)

      if (hotel) {

        setEditingHotel(hotel)

      }

    }

    

    return () => {

      delete (window as unknown as { editHotel?: (hotelId: string) => void }).editHotel

    }

  }, [hotels])



  const handleAddHotel = async (hotelData: Omit<PickupHotel, 'id' | 'created_at' | 'updated_at'>) => {

    try {

      const { error } = await supabase

        .from('pickup_hotels')

        .insert([hotelData] as never[])



      if (error) {

          console.error('Error adding hotel:', error)

        alert('Error adding hotel: ' + error.message)

        return

      }



      await fetchHotels()

      setShowAddForm(false)

      alert('Hotel added successfully!')

    } catch (error) {

      console.error('Error adding hotel:', error)

      alert('Error adding hotel.')

    }

  }



  const handleEditHotel = async (hotelData: Omit<PickupHotel, 'id' | 'created_at' | 'updated_at'>) => {

    if (editingHotel) {

      try {

        const { error } = await supabase

          .from('pickup_hotels')

          .update(hotelData as never)

          .eq('id', editingHotel.id)



        if (error) {

          console.error('Error updating hotel:', error)

          alert(locale === 'en' ? 'Error updating hotel: ' + error.message : '호텔 수정 중 오류가 발생했습니다: ' + error.message)

          return

        }



        await fetchHotels()

        setEditingHotel(null)

      } catch (error) {

        console.error('Error updating hotel:', error)

        alert(locale === 'en' ? 'Error updating hotel.' : '호텔 수정 중 오류가 발생했습니다.')

      }

    }

  }



  const handleDeleteHotel = async (hotel: PickupHotel) => {

    try {

      const { error } = await supabase

        .from('pickup_hotels')

        .delete()

        .eq('id', hotel.id)



      if (error) {

        console.error('Error deleting hotel:', error)

        alert(locale === 'en' ? 'Error deleting hotel: ' + error.message : '호텔 삭제 중 오류가 발생했습니다: ' + error.message)

        return

      }



      await fetchHotels()

      setDeleteConfirm({ isOpen: false, hotel: null })

      alert(locale === 'en' ? 'Hotel deleted successfully!' : '호텔이 성공적으로 삭제되었습니다!')

    } catch (error) {

      console.error('Error deleting hotel:', error)

      alert(locale === 'en' ? 'Error deleting hotel.' : '호텔 삭제 중 오류가 발생했습니다.')

    }

  }



  const handleToggleActive = async (id: string, currentStatus: boolean | null) => {

    try {

      const newStatus = !currentStatus

      const { error } = await supabase

        .from('pickup_hotels')

        .update({ is_active: newStatus } as never)

        .eq('id', id)



      if (error) {

        console.error('Error toggling hotel status:', error)

        alert(locale === 'en' ? 'Error changing hotel status: ' + error.message : '호텔 상태 변경 중 오류가 발생했습니다: ' + error.message)

        return

      }



      await fetchHotels()

      alert(locale === 'en' ? `Hotel has been ${newStatus ? 'activated' : 'deactivated'}!` : `호텔이 ${newStatus ? '활성화' : '비활성화'}되었습니다!`)

    } catch (error) {


      console.error('Error toggling hotel status:', error)

      alert(locale === 'en' ? 'Error changing hotel status.' : '호텔 상태 변경 중 오류가 발생했습니다.')

    }

  }



  // 호텔 복사 함수

  const handleCopyHotel = async (hotel: PickupHotel) => {

    try {

      const newHotel = {

            hotel: `${hotel.hotel} ${locale === 'en' ? '(Copy)' : '(복사본)'}`,

        pick_up_location: hotel.pick_up_location,

        description_ko: hotel.description_ko,

        description_en: hotel.description_en,

        address: hotel.address,

        pin: hotel.pin,

        link: hotel.link,

        media: hotel.media,

        is_active: false // 복사본은 비활성 상태로 생성

      }



      const { error } = await supabase

        .from('pickup_hotels')

        .insert([newHotel] as never[])



      if (error) {

        console.error('Error copying hotel:', error)

        alert(locale === 'en' ? 'Error copying hotel: ' + error.message : '호텔 복사 중 오류가 발생했습니다: ' + error.message)

        return

      }



      await fetchHotels()

      alert(locale === 'en' ? 'Hotel copied successfully!' : '호텔이 복사되었습니다!')

    } catch (error) {

      console.error('Error copying hotel:', error)

      alert(locale === 'en' ? 'Error copying hotel.' : '호텔 복사 중 오류가 발생했습니다.')

    }

  }





  // 이미지 뷰어 열기

  const openImageViewer = (images: string[], startIndex: number, hotelName: string) => {

    setImageViewer({

      isOpen: true,

      images,

      currentIndex: startIndex,

      hotelName

    })

  }



  // 이미지 뷰어 닫기

  const closeImageViewer = () => {

    setImageViewer({

      isOpen: false,

      images: [],

      currentIndex: 0,

      hotelName: ''

    })

  }



  // 이전 이미지

  const prevImage = () => {

    setImageViewer(prev => ({

      ...prev,

      currentIndex: prev.currentIndex > 0 ? prev.currentIndex - 1 : prev.images.length - 1

    }))

  }



  // 다음 이미지

  const nextImage = () => {

    setImageViewer(prev => ({

      ...prev,

      currentIndex: prev.currentIndex < prev.images.length - 1 ? prev.currentIndex + 1 : 0

    }))

  }



  if (loading) {

    return (

      <div className="flex items-center justify-center h-64">

        <div className="text-lg text-gray-600">Loading...</div>

      </div>

    )

  }



  return (

    <div className="space-y-6">

      <div className="flex justify-between items-center">

        <h1 className="text-3xl font-bold text-gray-900">Pickup Hotel Management</h1>

        <div className="flex items-center space-x-3">

          {/* 뷰 모드 전환 버튼 */}

          <div className="flex items-center bg-gray-100 rounded-lg p-1">

            <button

              onClick={() => setViewMode('grid')}

              className={`px-3 py-2 rounded-md flex items-center space-x-2 transition-colors ${

                viewMode === 'grid' 

                  ? 'bg-white text-blue-600 shadow-sm' 

                  : 'text-gray-600 hover:text-gray-900'

              }`}

            >

              <Grid3X3 size={16} />

              <span>Grid</span>

            </button>

            <button

              onClick={() => setViewMode('table')}

              className={`px-3 py-2 rounded-md flex items-center space-x-2 transition-colors ${

                viewMode === 'table' 

                  ? 'bg-white text-blue-600 shadow-sm' 

                  : 'text-gray-600 hover:text-gray-900'

              }`}

            >

              <Table size={16} />

              <span>Table</span>

            </button>

            <button

              onClick={() => setViewMode('map')}

              className={`px-3 py-2 rounded-lg flex items-center space-x-2 transition-colors ${

                viewMode === 'map' 

                  ? 'bg-white text-blue-600 shadow-sm' 

                  : 'text-gray-600 hover:text-gray-900'

              }`}

            >

              <Map size={16} />

              <span>Map</span>

            </button>

          </div>



          {sortedGroupKeys.length > 0 && viewMode === 'grid' && (

            <button

              onClick={toggleAllGroups}

              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center space-x-2"

            >

              {Object.values(expandedGroups).every(expanded => expanded) ? (

                <>

                  <ChevronUp size={20} />

                  <span>Collapse All</span>

                </>

              ) : (

                <>

                  <ChevronDown size={20} />

                  <span>Expand All</span>

                </>

              )}

            </button>

          )}

          <button

            onClick={() => setShowAddForm(true)}

            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"

          >

            <Plus size={20} />

            <span>Add Hotel</span>

          </button>

        </div>

      </div>



      {/* 검색 */}

      {/* 검색창 및 필터 */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />

        <input

          type="text"

          placeholder="Search by hotel name, location, address..."

          value={searchTerm}

          onChange={(e) => setSearchTerm(e.target.value)}

          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"

        />

        </div>
        
        {/* 필터 버튼들 */}
        <div className="flex items-center space-x-2">
          {/* Group filter */}
          <div className="flex items-center space-x-1">
            <span className="text-sm text-gray-600 font-medium">Group:</span>
            <button
              onClick={() => setGroupFilter('integer')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                groupFilter === 'integer'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Integers Only
            </button>
            <button
              onClick={() => setGroupFilter('all')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                groupFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All
            </button>
          </div>
          
          {/* Status filter */}
          <div className="flex items-center space-x-1">
            <span className="text-sm text-gray-600 font-medium">Status:</span>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                statusFilter === 'all'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                statusFilter === 'active'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                statusFilter === 'inactive'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Inactive
            </button>
          </div>
        </div>
      </div>



      {/* Pickup Request Test */}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">

        <div className="flex items-center space-x-2 mb-3">

          <Info size={20} className="text-blue-600" />

          <h3 className="text-lg font-semibold text-blue-900">Pickup Request Test</h3>

        </div>

        <p className="text-sm text-blue-700 mb-4">

          Enter a hotel name to test if it correctly guides to the rounded hotel based on the group number.

        </p>

        

        <div className="flex space-x-3">

          <input

            type="text"

            placeholder="e.g., Planet Hollywood"

            value={testRequest}

            onChange={(e) => setTestRequest(e.target.value)}

            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"

            onKeyPress={(e) => {

              if (e.key === 'Enter') {

                testPickupRequest()

              }

            }}

          />

          <button

            onClick={testPickupRequest}

            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"

          >

            Test

          </button>

        </div>



        {/* Test Result */}

        {testResult && (

          <div className={`mt-4 p-3 rounded-lg border ${

            testResult.success 

              ? 'bg-green-50 border-green-200' 

              : 'bg-red-50 border-red-200'

          }`}>

            <div className={`text-sm font-medium ${

              testResult.success ? 'text-green-800' : 'text-red-800'

            }`}>

              {testResult.message}

            </div>

            {testResult.targetHotel && (

              <div className="mt-2 text-xs text-gray-600">

                <div><strong>Requested Hotel:</strong> {testResult.requestedHotel?.hotel} (Group {testResult.requestedHotel?.group_number})</div>

                <div><strong>Target Hotel:</strong> {testResult.targetHotel.hotel} (Group {testResult.targetHotel.group_number})</div>

                <div><strong>Pickup Location:</strong> {testResult.targetHotel.pick_up_location}</div>

              </div>

            )}

          </div>

        )}

      </div>



      {/* 호텔 목록 - 뷰 모드별 렌더링 */}

      {sortedGroupKeys.length > 0 ? (

        <>

          {/* 그리드 뷰 */}

          {viewMode === 'grid' && (

            <div className="space-y-6">

              {sortedGroupKeys.map((groupKey) => (

              <div key={groupKey} className="bg-white rounded-lg shadow-md border border-gray-200">

                {/* 그룹 헤더 */}

                <div 

                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"

                  onClick={() => toggleGroup(groupKey)}

                >

                  <div className="flex items-center space-x-3">

                     <h2 className="text-lg font-semibold text-gray-900">{getGroupLabel(groupKey)}</h2>

                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">

                      {groupedHotels[groupKey].length} hotels

                    </span>

                  </div>

                  <div className="flex items-center space-x-2">

                    {expandedGroups[groupKey] ? (

                      <ChevronUp size={20} className="text-gray-500" />

                    ) : (

                      <ChevronDown size={20} className="text-gray-500" />

                    )}

                  </div>

                </div>



                {/* 그룹 내용 */}

                {expandedGroups[groupKey] && (

                  <div className="p-4 pt-0">

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                      {groupedHotels[groupKey].map((hotel) => (

          <div 

            key={hotel.id} 

            className="bg-white rounded-lg shadow-md p-6 border border-gray-200 cursor-pointer hover:shadow-lg transition-shadow"

            onClick={() => setEditingHotel(hotel)}

          >

            {/* 호텔명 */}

            <div className="mb-4">

              <div className="flex items-center justify-between">

                <div className="flex items-center space-x-2">

                  <h3 className="text-base font-semibold text-gray-900">{hotel.hotel}</h3>

                  {hotel.group_number && (

                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">

                      Group {hotel.group_number}

                    </span>

                  )}

                </div>

                <div className="flex items-center space-x-2">

                  {hotel.link && (

                    <a

                      href={hotel.link}

                      target="_blank"

                      rel="noopener noreferrer"

                      className="text-blue-600 hover:text-blue-800 transition-colors"

                      onClick={(e) => e.stopPropagation()}

                    >

                      <MapPin size={16} />

                    </a>

                  )}

                  {hotel.youtube_link && (

                    <a

                      href={hotel.youtube_link}

                      target="_blank"

                      rel="noopener noreferrer"

                      className="text-red-600 hover:text-red-800 transition-colors"

                      onClick={(e) => e.stopPropagation()}

                      title="View YouTube Video"

                    >

                      <Video size={16} />

                    </a>

                  )}

                  <button

                    onClick={(e) => {

                      e.stopPropagation()

                      handleCopyHotel(hotel)

                    }}

                    className="text-blue-600 hover:text-blue-800 transition-colors"

                    title="Copy Hotel"

                  >

                    <Copy size={16} />

                  </button>

                  <button

                    onClick={(e) => {

                      e.stopPropagation()

                      setDeleteConfirm({ isOpen: true, hotel })

                    }}

                    className="text-red-600 hover:text-red-800 transition-colors"

                    title="Delete Hotel"

                  >

                    <Trash2 size={16} />

                  </button>

                  <button

                    onClick={(e) => {

                      e.stopPropagation()

                      handleToggleActive(hotel.id, hotel.is_active)

                    }}

                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${

                      hotel.is_active ? 'bg-blue-600' : 'bg-gray-300'

                    }`}

                    title={hotel.is_active ? 'Deactivate' : 'Activate'}

                  >

                    <span

                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${

                        hotel.is_active ? 'translate-x-5' : 'translate-x-1'

                      }`}

                    />

                  </button>

                </div>

              </div>

            </div>



            {/* 픽업 위치 */}

            <div className="flex items-center mb-3">

              <MapPin size={16} className="text-gray-400 mr-2" />

              <span className="text-sm text-gray-700">{hotel.pick_up_location}</span>

            </div>



            {/* Description */}

            {(hotel.description_ko || hotel.description_en) && (

              <div className="mb-4">

                {hotel.description_ko && (

                  <div className="text-sm text-gray-900 mb-1">

                    <span className="font-medium">Description (KO):</span> {hotel.description_ko}

                  </div>

                )}

                {hotel.description_en && (

                  <div className="text-sm text-gray-600">

                    <span className="font-medium">Description (EN):</span> {hotel.description_en}

                  </div>

                )}

              </div>

            )}



            {/* 주소 */}

            <div className="text-sm text-gray-700 mb-3">

              <span className="font-medium">Address:</span> {hotel.address}

            </div>



            {/* 좌표 */}

            {hotel.pin && (

              <div className="text-sm text-gray-600 mb-3">

                <span className="font-medium">Coordinates:</span> {hotel.pin}

              </div>

            )}



            {/* 구글맵 링크 */}

            {hotel.link && (

              <div className="text-sm text-gray-600 mb-3">

                <div className="flex items-center">

                  <span className="font-medium mr-2">Google Map:</span>

                  <a

                    href={hotel.link}

                    target="_blank"

                    rel="noopener noreferrer"

                    className="text-blue-600 hover:text-blue-800 underline break-all flex-1"

                    onClick={(e) => e.stopPropagation()}

                  >

                    {hotel.link}

                  </a>

                  <button

                    onClick={(e) => {

                      e.stopPropagation()

                      if (hotel.link) {

                        navigator.clipboard.writeText(hotel.link)

                        alert('링크가 클립보드에 복사되었습니다!')

                      }

                    }}

                    className="ml-2 p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"

                    title="Copy Link"

                  >

                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />

                    </svg>

                  </button>

                </div>

              </div>

            )}

            {/* YouTube 링크 */}

            {hotel.youtube_link && (

              <div className="text-sm text-gray-600 mb-3">

                <div className="flex items-center">

                  <span className="font-medium mr-2">YouTube:</span>

                  <a

                    href={hotel.youtube_link}

                    target="_blank"

                    rel="noopener noreferrer"

                    className="text-red-600 hover:text-red-800 underline break-all flex-1"

                    onClick={(e) => e.stopPropagation()}

                  >

                    {hotel.youtube_link}

                  </a>

                  <button

                    onClick={(e) => {

                      e.stopPropagation()

                      if (hotel.youtube_link) {

                        navigator.clipboard.writeText(hotel.youtube_link)

                        alert('YouTube 링크가 클립보드에 복사되었습니다!')

                      }

                    }}

                    className="ml-2 p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"

                    title="Copy YouTube Link"

                  >

                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />

                    </svg>

                  </button>

                </div>

              </div>

            )}



            {/* 미디어 */}

            {hotel.media && hotel.media.length > 0 && (

              <div className="mb-4">

                 <div className="text-sm font-medium text-gray-700 mb-2">{locale === 'en' ? 'Media:' : '미디어:'}</div>

                <div className="grid grid-cols-4 gap-2">

                  {hotel.media.slice(0, 4).map((url, index) => {

                    const isImage = url.match(/\.(jpg|jpeg|png|gif|webp)$/i) || url.includes('drive.google.com')

                    return (

                      <div 

                        key={index} 

                        className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors relative group"

                        onClick={(e) => {

                          e.stopPropagation()

                          if (isImage) {

                            openImageViewer(hotel.media || [], index, hotel.hotel)

                          }

                        }}

                      >

                        {isImage ? (

                          <NextImage
                            src={url}

                            alt={`${hotel.hotel} 이미지 ${index + 1}`}

                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover rounded-lg"
                            onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                              const target = e.target as HTMLImageElement

                              target.style.display = 'none'

                              const parent = target.parentElement

                              if (parent) {

                                parent.innerHTML = `

                                  <div class="w-full h-full flex items-center justify-center">

                                    <div class="text-center">

                                      <div class="text-red-500 text-xs">이미지 로드 실패</div>

                                      <div class="text-gray-400 text-xs mt-1">URL 확인 필요</div>

                                    </div>

                                  </div>

                                `

                              }

                            }}

                          />

                        ) : (

                          <Video size={16} className="text-blue-600" />

                        )}

                        

                        {/* 호버 오버레이 */}

                        {isImage && (

                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity rounded-lg flex items-center justify-center">

                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">

                              <ImageIcon size={20} className="text-white" />
                            </div>

                          </div>

                        )}

                      </div>

                    )

                  })}

                  {hotel.media.length > 4 && (

                    <div 

                      className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-500 cursor-pointer hover:bg-gray-200 transition-colors"

                      onClick={(e) => {

                        e.stopPropagation()

                        openImageViewer(hotel.media || [], 4, hotel.hotel)

                      }}

                    >

                      +{hotel.media.length - 4}{locale === 'en' ? ' more' : '개 더'}

                    </div>

                  )}

                </div>

              </div>

            )}



            

                  </div>

                  ))}

                </div>

              </div>

            )}

          </div>

        ))}

            </div>

          )}



          {/* 테이블 뷰 */}

          {viewMode === 'table' && (

            <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">

              {/* 전체 수정 버튼 */}

              <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">

                <div className="flex items-center justify-between">

                  <h3 className="text-lg font-semibold text-gray-900">{locale === 'en' ? 'Pickup Hotel List' : '픽업 호텔 목록'}</h3>

                  <div className="flex items-center space-x-3">

                    <button

                      onClick={async () => {

                        if (bulkEditMode) {

                          // 전체 수정 완료 - 저장 후 종료

                          console.log('Bulk edit data:', bulkEditData)

                          const updatedHotels = Object.keys(bulkEditData)

                          console.log('Updated hotels:', updatedHotels)

                          if (updatedHotels.length === 0) {

                            alert(locale === 'en' ? 'No changes made.' : '변경된 내용이 없습니다.')

                            setBulkEditMode(false)

                            setBulkEditData({})

                            return

                          }

                          

                           const confirmMessage = locale === 'en' 
                             ? `Do you want to save changes for ${updatedHotels.length} hotels?`
                             : `${updatedHotels.length}개 호텔의 변경사항을 저장하시겠습니까?`

                          if (!confirm(confirmMessage)) return

                          

                          try {

                            let successCount = 0

                            let errorCount = 0

                            

                            for (const hotelId of updatedHotels) {

                              const updateData = bulkEditData[hotelId]

                              if (updateData && Object.keys(updateData).length > 0) {

                                const { error } = await supabase

                                  .from('pickup_hotels')

                                  .update(updateData as never)

                                  .eq('id', hotelId)

                                

                                if (error) {

                                  console.error(`Error updating hotel ${hotelId}:`, error)

                                  errorCount++

                                } else {

                                  successCount++

                                }

                              }

                            }

                            

                            await fetchHotels()

                            setBulkEditData({})

                            setBulkEditMode(false)

                            

                            if (errorCount === 0) {

                              alert(locale === 'en' 
                                ? `${successCount} hotel(s) saved successfully!`
                                : `${successCount}개 호텔이 성공적으로 저장되었습니다!`)

                            } else {

                              alert(locale === 'en' 
                                ? `${successCount} hotel(s) saved, ${errorCount} failed`
                                : `${successCount}개 호텔 저장 완료, ${errorCount}개 호텔 저장 실패`)

                            }

                          } catch (error) {

                            console.error('Error bulk saving hotels:', error)

                            alert(locale === 'en' ? 'Error bulk saving hotels.' : '호텔 일괄 저장 중 오류가 발생했습니다.')

                          }

                        } else {

                          // 전체 수정 시작

                          setBulkEditMode(true)

                        }

                      }}

                      className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${

                        bulkEditMode 

                          ? 'bg-green-600 text-white hover:bg-green-700' 

                          : 'bg-gray-600 text-white hover:bg-gray-700'

                      }`}

                    >

                      <Edit2 size={16} />

                          <span>{bulkEditMode ? (locale === 'en' ? 'Finish Bulk Edit' : '전체 수정 완료') : (locale === 'en' ? 'Bulk Edit' : '전체 수정')}</span>

                    </button>

                    {bulkEditMode && (

                      <button

                        onClick={() => {

                          setBulkEditMode(false)

                          setBulkEditData({})

                        }}

                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-2"

                      >

                        <XCircle size={16} />

                        <span>{locale === 'en' ? 'Cancel' : '취소'}</span>

                      </button>

                    )}

                  </div>

                </div>

              </div>

              

              <div className="overflow-x-auto">

                <table className="min-w-full divide-y divide-gray-200">

                  <thead className="bg-gray-50">

                    <tr>

                      <th 

                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"

                        onClick={() => handleSort('group_number')}

                      >

                        <div className="flex items-center space-x-1">

                           <span>{locale === 'en' ? 'Group Number' : '그룹 번호'}</span>

                          {getSortIcon('group_number')}

                        </div>

                      </th>

                      <th 

                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"

                        onClick={() => handleSort('hotel')}

                      >

                        <div className="flex items-center space-x-1">

                          <span>{locale === 'en' ? 'Hotel Name' : '호텔명'}</span>

                          {getSortIcon('hotel')}

                        </div>

                      </th>

                      <th 

                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"

                        onClick={() => handleSort('pick_up_location')}

                      >

                        <div className="flex items-center space-x-1">

                          <span>{locale === 'en' ? 'Pickup Location' : '픽업 위치'}</span>

                          {getSortIcon('pick_up_location')}

                        </div>

                      </th>

                      <th 

                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"

                        onClick={() => handleSort('address')}

                      >

                        <div className="flex items-center space-x-1">

                          <span>{locale === 'en' ? 'Address' : '주소'}</span>

                          {getSortIcon('address')}

                        </div>

                      </th>

                      <th 

                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"

                        onClick={() => handleSort('is_active')}

                      >

                        <div className="flex items-center space-x-1">

                          <span>{locale === 'en' ? 'Status' : '상태'}</span>

                          {getSortIcon('is_active')}

                        </div>

                      </th>

                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{locale === 'en' ? 'Media' : '미디어'}</th>

                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{locale === 'en' ? 'Actions' : '작업'}</th>

                    </tr>

                  </thead>

                  <tbody className="bg-white divide-y divide-gray-200">

                    {sortedHotels.map((hotel) => (

                      <tr key={hotel.id} className="hover:bg-gray-50">

                        <td className="px-6 py-4 whitespace-nowrap">

                          {bulkEditMode ? (

                            <input

                              type="number"

                              step="0.1"

                              value={bulkEditData[hotel.id]?.group_number ?? hotel.group_number ?? ''}

                              onChange={(e) => {

                                const newData = {

                                  ...bulkEditData,

                                  [hotel.id]: {

                                    ...bulkEditData[hotel.id],

                                    group_number: e.target.value ? parseFloat(e.target.value) : null

                                  }

                                }

                                console.log('Group number updated:', hotel.id, e.target.value, newData)

                                setBulkEditData(newData)

                              }}

                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"

                            />

                          ) : editingHotelId === hotel.id ? (

                            <input

                              type="number"

                              step="0.1"

                              value={editFormData.group_number || ''}

                              onChange={(e) => setEditFormData({...editFormData, group_number: e.target.value ? parseFloat(e.target.value) : null})}

                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"

                            />

                          ) : (

                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">

                               {hotel.group_number || (locale === 'en' ? 'Not Set' : '미설정')}

                            </span>

                          )}

                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">

                          {bulkEditMode ? (

                            <input

                              type="text"

                              value={bulkEditData[hotel.id]?.hotel ?? hotel.hotel ?? ''}

                              onChange={(e) => setBulkEditData({

                                ...bulkEditData,

                                [hotel.id]: {

                                  ...bulkEditData[hotel.id],

                                  hotel: e.target.value

                                }

                              })}

                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"

                            />

                          ) : editingHotelId === hotel.id ? (

                            <input

                              type="text"

                              value={editFormData.hotel || ''}

                              onChange={(e) => setEditFormData({...editFormData, hotel: e.target.value})}

                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"

                            />

                          ) : (

                            <div className="text-sm font-medium text-gray-900">{hotel.hotel}</div>

                          )}

                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">

                          {bulkEditMode ? (

                            <input

                              type="text"

                              value={bulkEditData[hotel.id]?.pick_up_location ?? hotel.pick_up_location ?? ''}

                              onChange={(e) => setBulkEditData({

                                ...bulkEditData,

                                [hotel.id]: {

                                  ...bulkEditData[hotel.id],

                                  pick_up_location: e.target.value

                                }

                              })}

                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"

                            />

                          ) : editingHotelId === hotel.id ? (

                            <input

                              type="text"

                              value={editFormData.pick_up_location || ''}

                              onChange={(e) => setEditFormData({...editFormData, pick_up_location: e.target.value})}

                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"

                            />

                          ) : (

                            <div className="text-sm text-gray-900">{hotel.pick_up_location}</div>

                          )}

                        </td>

                        <td className="px-6 py-4">

                          {bulkEditMode ? (

                            <input

                              type="text"

                              value={bulkEditData[hotel.id]?.address ?? hotel.address ?? ''}

                              onChange={(e) => setBulkEditData({

                                ...bulkEditData,

                                [hotel.id]: {

                                  ...bulkEditData[hotel.id],

                                  address: e.target.value

                                }

                              })}

                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"

                            />

                          ) : editingHotelId === hotel.id ? (

                            <input

                              type="text"

                              value={editFormData.address || ''}

                              onChange={(e) => setEditFormData({...editFormData, address: e.target.value})}

                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"

                            />

                          ) : (

                            <div className="text-sm text-gray-900 max-w-xs truncate">{hotel.address}</div>

                          )}

                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">

                          {bulkEditMode ? (

                            <label className="flex items-center">

                              <input

                                type="checkbox"

                                checked={bulkEditData[hotel.id]?.is_active ?? hotel.is_active ?? false}

                                onChange={(e) => setBulkEditData({

                                  ...bulkEditData,

                                  [hotel.id]: {

                                    ...bulkEditData[hotel.id],

                                    is_active: e.target.checked

                                  }

                                })}

                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"

                              />

                            </label>

                          ) : editingHotelId === hotel.id ? (

                            <label className="flex items-center">

                              <input

                                type="checkbox"

                                checked={editFormData.is_active || false}

                                onChange={(e) => setEditFormData({...editFormData, is_active: e.target.checked})}

                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"

                              />

                            </label>

                          ) : (

                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${

                              hotel.is_active 

                                ? 'bg-green-100 text-green-800' 

                                : 'bg-red-100 text-red-800'

                            }`}>

                              {hotel.is_active ? (locale === 'en' ? 'Active' : '활성') : (locale === 'en' ? 'Inactive' : '비활성')}

                            </span>

                          )}

                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">

                          {hotel.media && hotel.media.length > 0 ? (

                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">

                              {hotel.media.length}{locale === 'en' ? '' : '개'}

                            </span>

                          ) : (

                            <span className="text-gray-400">없음</span>

                          )}

                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">

                          {bulkEditMode ? (

                            <div className="flex space-x-2">

                              <button

                                onClick={() => setEditingHotel(hotel)}

                                className="text-gray-600 hover:text-gray-900"

                                title="상세 편집"

                              >

                                <MapPin size={16} />

                              </button>

                              <button

                                onClick={() => handleCopyHotel(hotel)}

                                className="text-blue-600 hover:text-blue-900"

                                title="복사"

                              >

                                <Copy size={16} />

                              </button>

                              <button

                                onClick={() => setDeleteConfirm({ isOpen: true, hotel })}

                                className="text-red-600 hover:text-red-900"

                                title="삭제"

                              >

                                <Trash2 size={16} />

                              </button>

                            </div>

                          ) : editingHotelId === hotel.id ? (

                            <div className="flex space-x-2">

                              <button

                                onClick={() => saveEdit(hotel.id)}

                                className="text-green-600 hover:text-green-900"

                                title="저장"

                              >

                                <Save size={16} />

                              </button>

                              <button

                                onClick={cancelEdit}

                                className="text-red-600 hover:text-red-900"

                                title={locale === 'en' ? 'Cancel' : '취소'}

                              >

                                <XCircle size={16} />

                              </button>

                            </div>

                          ) : (

                            <div className="flex space-x-2">

                              <button

                                onClick={() => startEdit(hotel)}

                                className="text-blue-600 hover:text-blue-900"

                                title={locale === 'en' ? 'Inline Edit' : '인라인 편집'}

                              >

                                <Edit2 size={16} />

                              </button>

                              <button

                                onClick={() => setEditingHotel(hotel)}

                                className="text-gray-600 hover:text-gray-900"

                                title="상세 편집"

                              >

                                <MapPin size={16} />

                              </button>

                              <button

                                onClick={() => handleCopyHotel(hotel)}

                                className="text-blue-600 hover:text-blue-900"

                                title="복사"

                              >

                                <Copy size={16} />

                              </button>

                              <button

                                onClick={() => setDeleteConfirm({ isOpen: true, hotel })}

                                className="text-red-600 hover:text-red-900"

                                title="삭제"

                              >

                                <Trash2 size={16} />

                              </button>

                            </div>

                          )}

                        </td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

              

              {/* 전체 수정 모드 컨트롤 패널 */}

              {bulkEditMode && (

                <div className="px-6 py-4 bg-blue-50 border-t border-blue-200">

                  <div className="flex items-center justify-between">

                    <div className="flex items-center space-x-4">

                      <span className="text-sm text-gray-700">

                        {locale === 'en' ? 'Bulk Edit Mode - You can edit all hotels simultaneously' : '전체 편집 모드 - 모든 호텔을 동시에 편집할 수 있습니다'}

                      </span>

                    </div>

                    

                    <div className="flex items-center space-x-3">

                      <span className="text-sm text-gray-500">

                        {locale === 'en' ? 'Click the "Finish Bulk Edit" button above to save' : '상단의 "전체 수정 완료" 버튼을 눌러 저장하세요'}
                      </span>

                    </div>

                  </div>

                </div>

              )}

            </div>

          )}



          {/* 지도 뷰 */}

          {viewMode === 'map' && (

            <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">

              <div className="p-4 border-b border-gray-200">

                 <h3 className="text-lg font-semibold text-gray-900">{locale === 'en' ? 'Hotel Location Map' : '호텔 위치 지도'}</h3>

                <p className="text-sm text-gray-600">
                  {locale === 'en' ? 'Click on a marker to view hotel information. Marker labels show group numbers. A transparent circle of 1000m is displayed around hotels with integer group numbers, with different colors for each group. Click the edit button in the hotel information window to modify hotel information.' : '마커를 클릭하면 호텔 정보를 확인할 수 있습니다. 마커 라벨은 그룹 번호를 표시합니다. 정수 그룹 번호를 가진 호텔 주변에는 1000m 반투명 원이 표시되며, 각 그룹마다 다른 색상으로 구분됩니다. 호텔 정보 창에서 편집 버튼을 클릭하여 호텔 정보를 수정할 수 있습니다.'}

                </p>

                {/* 색상 범례 */}
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">그룹별 색상 범례:</h4>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 15 }, (_, i) => i + 1).map(groupNum => {
                      const color = getGroupColor(groupNum)
                      const hasGroup = filteredHotels.some(hotel => 
                        hotel.group_number === groupNum && Number.isInteger(hotel.group_number)
                      )
                      if (!hasGroup) return null
                      
                      return (
                        <div key={groupNum} className="flex items-center space-x-1 text-xs">
                          <div 
                            className="w-3 h-3 rounded-full border border-gray-300"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-gray-600">{locale === 'en' ? `Group ${groupNum}` : `그룹 ${groupNum}`}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

              </div>

              <div className="relative">

                <div 

                  id="hotelMap" 

                  style={{ width: '100%', height: '600px' }}

                  className="bg-gray-100"

                />

                {selectedHotelInfo && (
                  <div className="absolute top-4 left-4 bg-white shadow-lg rounded-lg border border-gray-200 p-4 max-w-sm z-10">
                    <div className="flex items-start justify-between space-x-4">
                      <div className="flex-1">
                        <div className="text-base font-semibold text-gray-900">{selectedHotelInfo.name}</div>
                        <div className="text-sm text-gray-700 mt-1">{selectedHotelInfo.pickup}</div>
                        <div className="text-xs text-gray-500 mt-1">{selectedHotelInfo.address}</div>
                        
                        {/* 그룹 번호 표시/편집 */}
                        <div className="mt-2">
                          {quickEditMode ? (
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-600">{locale === 'en' ? 'Group:' : '그룹:'}</span>
                              <input
                                type="number"
                                step="0.1"
                                value={quickEditGroupNumber || ''}
                                onChange={(e) => setQuickEditGroupNumber(e.target.value ? parseFloat(e.target.value) : null)}
                                className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder={locale === 'en' ? 'Group Number' : '그룹 번호'}
                                autoFocus
                              />
                              <button
                                onClick={saveQuickEdit}
                                className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                                title="저장"
                              >
                                저장
                              </button>
                              <button
                                onClick={() => {
                                  setQuickEditMode(false)
                                  setQuickEditGroupNumber(null)
                                }}
                                className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                                title={locale === 'en' ? 'Cancel' : '취소'}
                              >
                                {locale === 'en' ? 'Cancel' : '취소'}
                              </button>
                            </div>
                          ) : (
                            selectedHotelInfo.group != null && (
                              <div className="text-xs text-blue-700">{locale === 'en' ? `Group: ${selectedHotelInfo.group}` : `그룹: ${selectedHotelInfo.group}`}</div>
                            )
                          )}
                        </div>
                        
                        {/* 편집 버튼들 */}
                        {!quickEditMode && (
                          <div className="flex space-x-2 mt-3">
                            <button
                              onClick={() => {
                                const hotel = hotels.find(h => h.id === selectedHotelInfo.id)
                                if (hotel) {
                                  setEditingHotel(hotel)
                                  setSelectedHotelInfo(null)
                                }
                              }}
                              className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 flex items-center space-x-1"
                              title="호텔 편집"
                            >
                              <Edit2 size={12} />
                              <span>{locale === 'en' ? 'Edit' : '편집'}</span>
                            </button>
                            
                            <button
                              onClick={() => {
                                setQuickEditMode(true)
                                setQuickEditGroupNumber(selectedHotelInfo.group)
                              }}
                              className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 flex items-center space-x-1"
                              title="빠른 편집"
                            >
                              <Save size={12} />
                              <span>{locale === 'en' ? 'Quick Edit' : '빠른 편집'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <button
                        onClick={() => {
                          setSelectedHotelInfo(null)
                          setQuickEditMode(false)
                          setQuickEditGroupNumber(null)
                        }}
                        className="text-gray-400 hover:text-gray-600"
                        aria-label="닫기"
                        title="닫기"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                )}
                {!mapLoaded && (

                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100">

                    <div className="text-center">

                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>

                      <p className="text-gray-600">{locale === 'en' ? 'Loading map...' : '지도를 로딩 중...'}</p>

                    </div>

                  </div>

                )}

              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-200">

                <div className="flex items-center justify-between">

                  <div className="text-sm text-gray-600">

                    {locale === 'en' 
                      ? `Total ${filteredHotels.length} hotels, showing ${filteredHotels.filter(h => h.pin).length} locations`
                      : `총 ${filteredHotels.length}개 호텔 중 ${filteredHotels.filter(h => h.pin).length}개 위치 표시`}

                    {groupFilter === 'integer' && (locale === 'en' ? ' (integer groups only)' : ' (정수 그룹만)')}
                    {statusFilter !== 'all' && (locale === 'en' ? ` (${statusFilter === 'active' ? 'active' : 'inactive'} only)` : ` (${statusFilter === 'active' ? '활성' : '비활성'}만)`)}
                    {mapMarkers.length > 0 && (locale === 'en' ? ` • ${mapMarkers.length} active markers` : ` • ${mapMarkers.length}개 마커 활성`)}
                    {mapCircles.length > 0 && (locale === 'en' ? ` • ${mapCircles.length} circles` : ` • ${mapCircles.length}개 원 표시`)}
                  </div>

                  <div className="flex space-x-2">

                    <button

                      onClick={() => {

                        if (mapInstance) {

                          const google = (window as unknown as { google?: GoogleMapsAPI }).google
                          if (google && google.maps) {
                            const bounds = new google.maps.LatLngBounds()
                            for (const marker of mapMarkers) {
                              const position = (marker as unknown as { getPosition: () => { lat: () => number; lng: () => number } | null }).getPosition()
                              if (position) {
                                bounds.extend(position)
                              }
                            }
                            (mapInstance as unknown as { fitBounds: (bounds: GoogleMapsLatLngBounds) => void }).fitBounds(bounds)
                          }
                        }

                      }}

                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"

                    >

                      {locale === 'en' ? 'View All Hotels' : '모든 호텔 보기'}

                    </button>

                    <button

                      onClick={() => {

                        if (mapInstance) {

                          mapInstance.setCenter({ lat: 36.1699, lng: -115.1398 })

                          mapInstance.setZoom(12)

                        }

                      }}

                      className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"

                    >

                      {locale === 'en' ? 'Las Vegas Center' : '라스베가스 중심'}

                    </button>

                  </div>

                </div>

              </div>

            </div>

          )}

        </>

      ) : (

        <div className="text-center py-12">

          <div className="text-gray-500 text-lg">

            {searchTerm ? (locale === 'en' ? 'No search results.' : '검색 결과가 없습니다.') : (locale === 'en' ? 'No registered hotels.' : '등록된 호텔이 없습니다.')}

          </div>

          <div className="text-gray-400 text-sm mt-2">

            {searchTerm ? (locale === 'en' ? 'Try a different search term.' : '다른 검색어를 시도해보세요.') : (locale === 'en' ? 'Add a new hotel.' : '새 호텔을 추가해보세요.')}

          </div>

        </div>

      )}



      {/* 호텔 추가/편집 모달 */}

      {showAddForm && (

        <PickupHotelForm

          onSubmit={handleAddHotel}

          onCancel={() => setShowAddForm(false)}

          translations={translations}

        />

      )}



             {editingHotel && (

         <PickupHotelForm

           hotel={editingHotel}

           onSubmit={handleEditHotel}

           onCancel={() => {

             setEditingHotel(null)

           }}

           onDelete={(id: string) => {

             const hotel = hotels.find(h => h.id === id)

             if (hotel) handleDeleteHotel(hotel)

           }}

           translations={translations}

         />

       )}



      {/* 이미지 뷰어 모달 */}

      {imageViewer.isOpen && (

        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">

          <div className="relative w-full h-full flex items-center justify-center">

            {/* 닫기 버튼 */}

            <button

              onClick={closeImageViewer}

              className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"

            >

              <X size={32} />

            </button>



            {/* 호텔명 */}

            <div className="absolute top-4 left-4 text-white text-lg font-semibold z-10">

              {imageViewer.hotelName}

            </div>



            {/* 이미지 카운터 */}

            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-white text-sm z-10">

              {imageViewer.currentIndex + 1} / {imageViewer.images.length}

            </div>



            {/* 이전 버튼 */}

            {imageViewer.images.length > 1 && (

              <button

                onClick={prevImage}

                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 z-10"

              >

                <ChevronLeft size={48} />

              </button>

            )}



            {/* 다음 버튼 */}

            {imageViewer.images.length > 1 && (

              <button

                onClick={nextImage}

                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 z-10"

              >

                <ChevronRight size={48} />

              </button>

            )}



            {/* 메인 이미지 */}

            <div className="max-w-4xl max-h-4xl mx-auto relative">
              <NextImage
                src={imageViewer.images[imageViewer.currentIndex]}

                alt={`${imageViewer.hotelName} 이미지 ${imageViewer.currentIndex + 1}`}

                width={800}
                height={600}
                className="max-w-full max-h-full object-contain"

                onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                  const target = e.target as HTMLImageElement

                  target.style.display = 'none'

                  const parent = target.parentElement

                  if (parent) {

                    parent.innerHTML = `

                      <div class="w-full h-64 flex items-center justify-center bg-gray-800 rounded-lg">

                        <div class="text-center text-white">

                          <div class="text-red-400 text-lg mb-2">이미지 로드 실패</div>

                          <div class="text-gray-400">URL을 확인해주세요</div>

                        </div>

                      </div>

                    `

                  }

                }}

              />

            </div>



            {/* 썸네일 네비게이션 */}

            {imageViewer.images.length > 1 && (

              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-10">

                {imageViewer.images.map((url, index) => (

                  <button

                    key={index}

                    onClick={() => setImageViewer(prev => ({ ...prev, currentIndex: index }))}

                    className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${

                      index === imageViewer.currentIndex 

                        ? 'border-white' 

                        : 'border-transparent hover:border-gray-400'

                    }`}

                  >

                    <NextImage
                      src={url}

                      alt={`썸네일 ${index + 1}`}

                      fill
                      sizes="48px"
                      className="object-cover"
                    />

                  </button>

                ))}

              </div>

            )}

          </div>

        </div>

      )}



      {/* 삭제 확인 모달 */}

      {deleteConfirm.isOpen && deleteConfirm.hotel && (

        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">

          <div className="bg-white rounded-lg p-6 w-full max-w-md">

            <div className="flex items-center mb-4">

              <AlertTriangle className="h-6 w-6 text-red-600 mr-3" />

              <h3 className="text-lg font-semibold text-gray-900">{locale === 'en' ? 'Confirm Hotel Deletion' : '호텔 삭제 확인'}</h3>

            </div>

            

            <div className="mb-6">

              <p className="text-gray-700 mb-2">

                {locale === 'en' ? 'Are you sure you want to delete the following hotel?' : '다음 호텔을 삭제하시겠습니까?'}

              </p>

              <div className="bg-gray-50 p-3 rounded-lg">

                <p className="font-medium text-gray-900">{deleteConfirm.hotel.hotel}</p>

                <p className="text-sm text-gray-600">{deleteConfirm.hotel.pick_up_location}</p>

              </div>

              <p className="text-sm text-red-600 mt-2">

                ⚠️ {locale === 'en' ? 'This action cannot be undone.' : '이 작업은 되돌릴 수 없습니다.'}

              </p>

            </div>

            

            <div className="flex justify-end space-x-3">

              <button

                onClick={() => setDeleteConfirm({ isOpen: false, hotel: null })}

                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"

              >

                {locale === 'en' ? 'Cancel' : '취소'}

              </button>

              <button

                onClick={() => deleteConfirm.hotel && handleDeleteHotel(deleteConfirm.hotel)}

                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"

              >

                {locale === 'en' ? 'Delete' : '삭제'}

              </button>

            </div>

          </div>

        </div>

      )}

    </div>

  )

}

