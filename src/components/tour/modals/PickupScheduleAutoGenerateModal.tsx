'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { X, MapPin, Clock, Users, Navigation } from 'lucide-react'
import { getCachedSunriseSunsetData } from '@/lib/weatherApi'

interface PickupHotel {
  id: string
  hotel: string
  pick_up_location?: string
  address?: string
  link?: string
  group_number: number | null
  pin?: string | null // 위도,경도 좌표
}

interface Reservation {
  id: string
  customer_id: string | null
  pickup_hotel: string | null
  pickup_time: string | null
  adults: number | null
  children?: number | null
  infants?: number | null
}

interface PickupScheduleAutoGenerateModalProps {
  isOpen: boolean
  tourDate: string
  productId: string | null
  assignedReservations: Reservation[]
  pickupHotels: PickupHotel[]
  onClose: () => void
  onSave: (pickupTimes: Record<string, string>) => Promise<void>
  getCustomerName: (customerId: string) => string
}

export default function PickupScheduleAutoGenerateModal({
  isOpen,
  tourDate,
  productId,
  assignedReservations,
  pickupHotels,
  onClose,
  onSave,
  getCustomerName
}: PickupScheduleAutoGenerateModalProps) {
  const [mapLoaded, setMapLoaded] = useState(false)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService | null>(null)
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null)
  const [sunriseTime, setSunriseTime] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pickupSchedule, setPickupSchedule] = useState<Array<{
    hotel: PickupHotel
    reservations: Reservation[]
    pickupTime: string
    order: number
    travelTimeFromPrevious?: number // 이전 호텔에서의 이동 시간 (분, 이동시간+대기시간 합계)
    rawTravelTime?: number // 원본 이동 시간 (분, 대기시간 제외)
  }>>([])
  const [travelTimes, setTravelTimes] = useState<number[]>([]) // 각 구간의 이동 시간 (초)
  const [routeCalculated, setRouteCalculated] = useState(false) // 경로 계산 완료 플래그
  const [linkCopied, setLinkCopied] = useState(false) // 링크 복사 상태

  // 일출 투어 여부 확인
  const isSunriseTour = productId === 'MDGCSUNRISE'

  // 일출 시간 가져오기 (라스베가스 시간으로 변환하고 10분 단위로 내림)
  useEffect(() => {
    if (isSunriseTour && isOpen) {
      const loadSunriseTime = async () => {
        try {
          const data = await getCachedSunriseSunsetData('Grand Canyon South Rim', tourDate)
          if (data?.sunrise) {
            // 시간 형식 변환 (HH:MM:SS 또는 HH:MM -> HH:MM)
            let timeStr = data.sunrise
            if (timeStr.includes(':')) {
              const parts = timeStr.split(':')
              const hours = parseInt(parts[0], 10)
              const minutes = parseInt(parts[1], 10)
              
              // 투어 날짜와 시간을 조합하여 Date 객체 생성 (아리조나 시간대)
              // Grand Canyon은 아리조나 시간대를 사용 (UTC-7, 썸머타임 없음)
              const [year, month, day] = tourDate.split('-').map(Number)
              
              // 아리조나 시간을 UTC로 변환
              // 아리조나 시간 = UTC - 7시간이므로, UTC = 아리조나 시간 + 7시간
              const arizonaTimeString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
              // 아리조나 시간을 UTC로 변환 (UTC-7이므로 +7시간)
              const utcDate = new Date(new Date(arizonaTimeString).getTime() + 7 * 60 * 60 * 1000)
              
              // UTC를 라스베가스 시간으로 변환 (America/Los_Angeles)
              const lasVegasFormatter = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/Los_Angeles',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              })
              
              const lasVegasParts = lasVegasFormatter.formatToParts(utcDate)
              const lvHours = parseInt(lasVegasParts.find(p => p.type === 'hour')?.value || '0', 10)
              const lvMinutes = parseInt(lasVegasParts.find(p => p.type === 'minute')?.value || '0', 10)
              
              // 10분 단위로 내림 처리
              const roundedMinutes = Math.floor(lvMinutes / 10) * 10
              
              const finalTime = `${String(lvHours).padStart(2, '0')}:${String(roundedMinutes).padStart(2, '0')}`
              setSunriseTime(finalTime)
            } else {
              setSunriseTime(timeStr)
            }
          }
        } catch (error) {
          console.error('일출 시간 로딩 실패:', error)
        }
      }
      loadSunriseTime()
    }
  }, [isSunriseTour, isOpen, tourDate])

  // 구글 맵 초기화
  useEffect(() => {
    if (!isOpen) return

    const initializeMap = () => {
      const mapElement = document.getElementById('pickup-schedule-map')
      if (!mapElement) return

      // Google Maps API가 완전히 로드되었는지 확인
      if (window.google && window.google.maps && window.google.maps.Map) {
        try {
          const newMap = new window.google.maps.Map(mapElement, {
            center: { lat: 36.1699, lng: -115.1398 }, // 라스베가스 중심
            zoom: 12,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true
          })

          const service = new window.google.maps.DirectionsService()
          const renderer = new window.google.maps.DirectionsRenderer({
            map: newMap,
            suppressMarkers: false
          })

          setMap(newMap)
          setDirectionsService(service)
          setDirectionsRenderer(renderer)
          setMapLoaded(true)
        } catch (error) {
          console.error('지도 초기화 오류:', error)
        }
      }
    }

    // 이미 스크립트가 있는지 확인
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
    
    if (window.google && window.google.maps && window.google.maps.Map) {
      // 이미 로드된 경우 바로 초기화
      initializeMap()
    } else if (existingScript) {
      // 스크립트가 있지만 아직 로드되지 않은 경우 대기
      const checkLoaded = () => {
        if (window.google && window.google.maps && window.google.maps.Map) {
          initializeMap()
        } else {
          setTimeout(checkLoaded, 100)
        }
      }
      checkLoaded()
    } else {
      // 새로운 스크립트 로드
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      if (!apiKey) {
        alert('Google Maps API 키가 설정되지 않았습니다.')
        return
      }

      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`
      script.async = true
      script.defer = true
      script.id = 'google-maps-script-pickup-schedule'
      
      script.onload = () => {
        // Google Maps API가 완전히 로드될 때까지 대기
        const checkGoogleMaps = () => {
          if (window.google && window.google.maps && window.google.maps.Map) {
            initializeMap()
          } else {
            setTimeout(checkGoogleMaps, 50)
          }
        }
        checkGoogleMaps()
      }
      
      script.onerror = () => {
        alert('Google Maps API 로드 중 오류가 발생했습니다.')
      }
      
      document.head.appendChild(script)
    }
  }, [isOpen])

  // 픽업 스케줄 자동 생성
  const generatePickupSchedule = useCallback(async () => {
    if (!assignedReservations.length || !pickupHotels.length) return

    // 호텔별로 예약 그룹화
    const reservationsByHotel = assignedReservations.reduce((acc, reservation) => {
      if (!reservation.pickup_hotel) return acc
      const hotelId = reservation.pickup_hotel
      if (!acc[hotelId]) {
        acc[hotelId] = []
      }
      acc[hotelId].push(reservation)
      return acc
    }, {} as Record<string, Reservation[]>)

    // 호텔 정보 가져오기 및 북쪽부터 정렬 (위도 기준)
    const hotelsWithReservations = await Promise.all(
      Object.entries(reservationsByHotel)
        .map(async ([hotelId, reservations]) => {
          const hotel = pickupHotels.find(h => h.id === hotelId)
          if (!hotel) return null

          // 위도 가져오기 (pin 필드 또는 Geocoding API 사용)
          let latitude: number | null = null
          
          // pin 필드에 좌표가 있으면 사용
          if (hotel.pin) {
            const coords = hotel.pin.split(',')
            if (coords.length >= 2) {
              latitude = parseFloat(coords[0].trim())
            }
          }
          
          // pin이 없으면 주소로 Geocoding
          if (latitude === null && hotel.address && window.google && window.google.maps) {
            try {
              const geocoder = new window.google.maps.Geocoder()
              const result = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
                geocoder.geocode({ address: hotel.address }, (results, status) => {
                  if (status === 'OK' && results) {
                    resolve(results)
                  } else {
                    reject(new Error('Geocoding 실패'))
                  }
                })
              })
              
              if (result && result.length > 0) {
                latitude = result[0].geometry.location.lat()
              }
            } catch (error) {
              console.error('Geocoding 오류:', error)
            }
          }

          return { hotel, reservations, latitude: latitude ?? 0 }
        })
    )

    const validHotels = hotelsWithReservations.filter(
      (item): item is { hotel: PickupHotel; reservations: Reservation[]; latitude: number } => 
        item !== null
    )

    // 북쪽부터 정렬 (위도가 높을수록 북쪽)
    validHotels.sort((a, b) => b.latitude - a.latitude)

    // 일출 투어인 경우 마지막 픽업 시간 계산
    let lastPickupTime: string = '08:00' // 기본값
    if (isSunriseTour && sunriseTime) {
      const [sunriseHours, sunriseMinutes] = sunriseTime.split(':').map(Number)
      // 일출 시간에서 6시간 30분 전
      let totalMinutes = sunriseHours * 60 + sunriseMinutes - (6 * 60 + 30)
      
      // 음수 처리 (전날로 넘어가는 경우)
      if (totalMinutes < 0) {
        totalMinutes += 24 * 60
      }
      
      const lastPickupHours = Math.floor(totalMinutes / 60) % 24
      const lastPickupMins = totalMinutes % 60
      
      lastPickupTime = `${String(lastPickupHours).padStart(2, '0')}:${String(lastPickupMins).padStart(2, '0')}`
    }

    // 픽업 시간 계산 (역순으로 배치)
    const totalHotels = validHotels.length
    const schedule: Array<{
      hotel: PickupHotel
      reservations: Reservation[]
      pickupTime: string
      order: number
    }> = []

    validHotels.forEach((item, index) => {
      let pickupTime: string
      
      if (isSunriseTour && sunriseTime) {
        // 일출 투어: 마지막 픽업부터 역순으로 시간 배치
        const timeInterval = 10 // 10분 간격
        const minutesFromLast = (totalHotels - index - 1) * timeInterval
        
        const [lastHours, lastMinutes] = lastPickupTime.split(':').map(Number)
        let totalMinutes = lastHours * 60 + lastMinutes - minutesFromLast
        
        // 음수 처리
        if (totalMinutes < 0) {
          totalMinutes += 24 * 60
        }
        
        const hours = Math.floor(totalMinutes / 60) % 24
        const mins = totalMinutes % 60
        pickupTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
      } else {
        // 일반 투어: 08:00부터 10분 간격
        const timeInterval = 10
        const startHours = 8
        const startMinutes = 0
        const totalMinutes = startHours * 60 + startMinutes + (index * timeInterval)
        const hours = Math.floor(totalMinutes / 60) % 24
        const mins = totalMinutes % 60
        pickupTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
      }

      schedule.push({
        hotel: item.hotel,
        reservations: item.reservations,
        pickupTime,
        order: index + 1
      })
    })

    setPickupSchedule(schedule)
  }, [assignedReservations, pickupHotels, isSunriseTour, sunriseTime, mapLoaded])

  // 실제 이동 시간을 기반으로 픽업 시간 업데이트
  const updatePickupTimesWithTravelTimes = useCallback((travelTimes: number[]) => {
    if (travelTimes.length === 0) return

    setPickupSchedule(prevSchedule => {
      if (prevSchedule.length === 0) return prevSchedule

      // 일출 투어인 경우 마지막 픽업 시간 계산
      let lastPickupTime: string = '08:00' // 기본값
      if (isSunriseTour && sunriseTime) {
        const [sunriseHours, sunriseMinutes] = sunriseTime.split(':').map(Number)
        // 일출 시간에서 6시간 30분 전
        let totalMinutes = sunriseHours * 60 + sunriseMinutes - (6 * 60 + 30)
        
        // 음수 처리 (전날로 넘어가는 경우)
        if (totalMinutes < 0) {
          totalMinutes += 24 * 60
        }
        
        const lastPickupHours = Math.floor(totalMinutes / 60) % 24
        const lastPickupMins = totalMinutes % 60
        
        lastPickupTime = `${String(lastPickupHours).padStart(2, '0')}:${String(lastPickupMins).padStart(2, '0')}`
      }

      // 역순으로 시간 계산 (마지막 픽업부터)
      const updatedSchedule = [...prevSchedule]
      const totalHotels = updatedSchedule.length
      
      // 마지막 호텔의 픽업 시간 설정
      const [lastHours, lastMinutes] = lastPickupTime.split(':').map(Number)
      let currentTotalMinutes = lastHours * 60 + lastMinutes

      // 역순으로 각 호텔의 픽업 시간 계산
      for (let i = totalHotels - 1; i >= 0; i--) {
        // 현재 호텔의 픽업 시간 설정
        const hours = Math.floor(currentTotalMinutes / 60) % 24
        const mins = currentTotalMinutes % 60
        updatedSchedule[i].pickupTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`

        // 이전 호텔로 이동 (현재 호텔에서 이전 호텔까지의 이동 시간 추가)
        if (i > 0) {
          // travelTimes 배열 구조:
          // - travelTimes[0]: 시작점(4525 W Spring Mountain) → 첫 번째 호텔
          // - travelTimes[1]: 첫 번째 호텔 → 두 번째 호텔
          // - travelTimes[i-1]: i-1번째 호텔 → i번째 호텔
          // 역순 계산이므로 i번째 호텔에서 i-1번째 호텔로 가는 시간은 travelTimes[i-1]
          const travelTimeSeconds = travelTimes[i - 1] || 0
          const travelTimeMinutes = Math.ceil(travelTimeSeconds / 60) // 초를 분으로 변환 (올림)
          
          // 원본 이동 시간 저장 (대기시간 제외)
          updatedSchedule[i].rawTravelTime = travelTimeMinutes
          
          // 이동 시간 + 대기 시간(5분)을 합쳐서 5분 단위로 반올림
          const totalTimeWithWait = travelTimeMinutes + 5 // 이동 시간 + 대기 시간
          const roundedTime = Math.round(totalTimeWithWait / 5) * 5 // 5분 단위로 반올림
          
          // 이동 시간을 스케줄에 저장 (분 단위) - i번째 호텔에 이전 호텔에서의 이동 시간 저장
          updatedSchedule[i].travelTimeFromPrevious = roundedTime
          
          currentTotalMinutes -= roundedTime
          
          // 음수 처리
          if (currentTotalMinutes < 0) {
            currentTotalMinutes += 24 * 60
          }
        } else {
          // 첫 번째 호텔은 시작점에서의 이동 시간 저장
          if (travelTimes.length > 0 && travelTimes[0] > 0) {
            const travelTimeMinutes = Math.ceil(travelTimes[0] / 60)
            // 원본 이동 시간 저장 (대기시간 제외)
            updatedSchedule[0].rawTravelTime = travelTimeMinutes
            const totalTimeWithWait = travelTimeMinutes + 5 // 이동 시간 + 대기 시간
            const roundedTime = Math.round(totalTimeWithWait / 5) * 5 // 5분 단위로 반올림
            updatedSchedule[0].travelTimeFromPrevious = roundedTime
          }
        }
      }

      return updatedSchedule
    })
  }, [isSunriseTour, sunriseTime])

  // 스케줄 생성 시 자동 실행
  useEffect(() => {
    if (isOpen && assignedReservations.length > 0 && pickupHotels.length > 0) {
      generatePickupSchedule()
    }
  }, [isOpen, generatePickupSchedule])

  // 모달이 열릴 때 routeCalculated 초기화
  useEffect(() => {
    if (isOpen) {
      setRouteCalculated(false)
    }
  }, [isOpen])

  // 구글 맵에 동선 표시 및 실제 이동 시간 계산
  useEffect(() => {
    if (!map || !directionsService || !directionsRenderer || pickupSchedule.length === 0) return

    // 이미 경로가 계산되었으면 다시 계산하지 않음 (핀 깜빡임 방지)
    if (routeCalculated) return

    const waypoints = pickupSchedule
      .map(item => {
        const hotel = item.hotel
        // pin 컬럼(좌표) 우선 사용, 없으면 주소 사용
        if (hotel.pin) {
          const coords = hotel.pin.split(',')
          if (coords.length >= 2) {
            const lat = parseFloat(coords[0].trim())
            const lng = parseFloat(coords[1].trim())
            if (!isNaN(lat) && !isNaN(lng)) {
              return {
                location: new window.google.maps.LatLng(lat, lng),
                stopover: true
              }
            }
          }
        }
        
        // pin이 없거나 유효하지 않으면 주소 사용
        if (hotel.address) {
          return {
            location: hotel.address,
            stopover: true
          }
        } else if (hotel.pick_up_location) {
          return {
            location: hotel.pick_up_location,
            stopover: true
          }
        }
        return null
      })
      .filter((wp): wp is google.maps.DirectionsWaypoint => wp !== null)

    if (waypoints.length === 0) return

    // 시작 위치를 지정된 주소로 설정
    const origin = '4525 W Spring Mountain Rd, Las Vegas, NV 89102'
    const destination = waypoints[waypoints.length - 1].location
    const intermediateWaypoints = waypoints // 모든 호텔을 경유지로 설정

    directionsService.route(
      {
        origin: origin instanceof google.maps.LatLng 
          ? origin 
          : typeof origin === 'string' 
            ? origin 
            : { lat: 36.1699, lng: -115.1398 },
        destination: destination instanceof google.maps.LatLng
          ? destination
          : typeof destination === 'string'
            ? destination
            : { lat: 36.1699, lng: -115.1398 },
        waypoints: intermediateWaypoints,
        optimizeWaypoints: false, // group_number 순서 유지
        travelMode: window.google.maps.TravelMode.DRIVING
      },
      (result, status) => {
        if (status === 'OK' && result && result.routes && result.routes.length > 0) {
          directionsRenderer.setDirections(result)
          
          // 지도 범위 조정
          const bounds = result.routes[0].bounds
          if (bounds) {
            map.fitBounds(bounds)
          }

          // 경로 계산 완료 플래그 설정
          setRouteCalculated(true)

          // 실제 이동 시간 추출
          const route = result.routes[0]
          if (route.legs && route.legs.length > 0) {
            const times = route.legs.map(leg => leg.duration?.value || 0) // 초 단위
            setTravelTimes(times)
            
            // 이동 시간을 기반으로 픽업 시간 재계산 (한 번만 실행)
            if (times.length > 0 && times.some(t => t > 0)) {
              updatePickupTimesWithTravelTimes(times)
            }
          }
        } else {
          console.error('경로 계산 실패:', status)
        }
      }
    )
  }, [map, directionsService, directionsRenderer, pickupSchedule.length, routeCalculated, updatePickupTimesWithTravelTimes]) // pickupSchedule.length만 의존성으로 사용하여 핀 깜빡임 방지

  // 구글맵 공유 링크 생성
  const generateGoogleMapsLink = (): string => {
    if (pickupSchedule.length === 0) return ''

    // 시작점 주소 (4525 W Spring Mountain Rd, Las Vegas, NV 89102)
    const startAddress = '4525 W Spring Mountain Rd, Las Vegas, NV 89102'

    // 각 호텔의 좌표 수집
    const waypoints: string[] = []
    
    pickupSchedule.forEach(item => {
      const hotel = item.hotel
      if (hotel.pin) {
        const coords = hotel.pin.split(',')
        if (coords.length >= 2) {
          const lat = coords[0].trim()
          const lng = coords[1].trim()
          if (lat && lng) {
            waypoints.push(`${lat},${lng}`)
          }
        }
      } else if (hotel.address) {
        // 주소가 있으면 주소를 사용 (구글맵이 자동으로 변환)
        waypoints.push(encodeURIComponent(hotel.address))
      } else if (hotel.pick_up_location) {
        waypoints.push(encodeURIComponent(hotel.pick_up_location))
      }
    })

    if (waypoints.length === 0) return ''

    // 모바일에서도 모든 경유지가 표시되도록 /dir/ 형식 사용
    // 형식: /dir/시작점/경유지1/경유지2/.../마지막목적지
    const allPoints = [encodeURIComponent(startAddress), ...waypoints]
    const googleMapsUrl = `https://www.google.com/maps/dir/${allPoints.join('/')}`
    
    return googleMapsUrl
  }

  // 구글맵 링크 복사
  const copyGoogleMapsLink = async () => {
    const link = generateGoogleMapsLink()
    if (!link) {
      alert('공유할 경로가 없습니다.')
      return
    }

    try {
      await navigator.clipboard.writeText(link)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 3000)
    } catch (error) {
      console.error('링크 복사 실패:', error)
      alert('링크 복사에 실패했습니다.')
    }
  }

  // 저장 처리
  const handleSave = async () => {
    setLoading(true)
    try {
      const pickupTimes: Record<string, string> = {}
      pickupSchedule.forEach(item => {
        item.reservations.forEach(reservation => {
          pickupTimes[reservation.id] = item.pickupTime
        })
      })
      await onSave(pickupTimes)
      onClose()
    } catch (error) {
      console.error('픽업 시간 저장 실패:', error)
      alert('픽업 시간 저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const totalPeople = assignedReservations.reduce((sum, res) => 
    sum + (res.adults || 0) + (res.children || 0) + (res.infants || 0), 0
  )

  // 시작점 호텔 찾기 (Hotel52)
  const startPointHotel = pickupHotels.find(hotel => hotel.id === 'Hotel52')

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-[90vw] h-[90vh] max-w-6xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">픽업 스케줄 자동 생성</h3>
            <p className="text-sm text-gray-500 mt-1">
              {pickupSchedule.length}개 호텔, {totalPeople}명
              {isSunriseTour && sunriseTime && (
                <span className="ml-2 text-orange-600">
                  일출 시간: {sunriseTime} (마지막 픽업: {pickupSchedule[pickupSchedule.length - 1]?.pickupTime || 'N/A'})
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 왼쪽: 스케줄 리스트 */}
          <div className="w-1/3 border-r overflow-y-auto p-4">
            <div className="space-y-3">
              {/* 시작점 카드 */}
              {startPointHotel && (
                <div className="border rounded-lg p-3 bg-gradient-to-r from-blue-50 to-blue-100 hover:bg-gradient-to-r hover:from-blue-100 hover:to-blue-200 transition-colors border-blue-300">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="flex items-center justify-center w-6 h-6 bg-blue-700 text-white rounded-full text-xs font-bold">
                        S
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        시작점
                      </span>
                    </div>
                    <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded font-semibold">
                      START
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-blue-700 mb-1">
                    {startPointHotel.hotel}
                  </div>
                  {startPointHotel.pick_up_location && (
                    <div className="text-xs text-gray-600 mb-2">
                      {startPointHotel.pick_up_location}
                    </div>
                  )}
                  {startPointHotel.address && (
                    <div className="text-xs text-gray-500 mb-2">
                      {startPointHotel.address}
                    </div>
                  )}
                </div>
              )}
              
              {/* 호텔 스케줄 카드 */}
              {pickupSchedule.map((item, index) => (
                <div
                  key={item.hotel.id}
                  className="border rounded-lg p-3 bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-xs font-bold">
                        {item.order}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {item.pickupTime}
                      </span>
                    </div>
                    {item.hotel.group_number !== null && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        그룹 {item.hotel.group_number}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-blue-600 mb-1">
                    {item.hotel.hotel}
                  </div>
                  {item.hotel.pick_up_location && (
                    <div className="text-xs text-gray-500 mb-2">
                      {item.hotel.pick_up_location}
                    </div>
                  )}
                  {/* 이동 시간 표시 */}
                  {item.travelTimeFromPrevious && (
                    <div className="text-xs text-orange-600 mb-2 font-medium">
                      {index === 0 ? (
                        <>
                          시작점에서: 이동 {item.rawTravelTime || 0}분 + 대기 5분 = {item.travelTimeFromPrevious}분
                        </>
                      ) : (
                        <>
                          ← 이전 호텔에서: 이동 {item.rawTravelTime || 0}분 + 대기 5분 = {item.travelTimeFromPrevious}분
                        </>
                      )}
                    </div>
                  )}
                  <div className="flex items-center space-x-1 text-xs text-gray-600">
                    <Users size={12} />
                    <span>
                      {item.reservations.reduce((sum, res) => 
                        sum + (res.adults || 0) + (res.children || 0) + (res.infants || 0), 0
                      )}명
                    </span>
                    <span className="text-gray-300">|</span>
                    <span>{item.reservations.length}건</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {item.reservations.map(reservation => (
                      <div key={reservation.id} className="text-xs text-gray-600 bg-gray-50 p-1 rounded">
                        {getCustomerName(reservation.customer_id || '')}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 오른쪽: 구글 맵 */}
          <div className="flex-1 relative">
            <div id="pickup-schedule-map" className="w-full h-full" />
            {!mapLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">지도를 불러오는 중...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between p-4 border-t">
          <div className="flex space-x-2">
            <button
              onClick={generatePickupSchedule}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              다시 생성
            </button>
            {pickupSchedule.length > 0 && (
              <button
                onClick={copyGoogleMapsLink}
                className={`px-4 py-2 rounded flex items-center space-x-2 transition-colors ${
                  linkCopied 
                    ? 'bg-green-500 text-white' 
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
                title="구글맵 경로 링크 복사"
              >
                {linkCopied ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>클립보드에 복사되었습니다!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    <span>구글맵 링크 공유</span>
                  </>
                )}
              </button>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={loading || pickupSchedule.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>저장 중...</span>
                </>
              ) : (
                <>
                  <span>픽업 시간 업데이트</span>
                  <span className="text-xs opacity-90">({pickupSchedule.reduce((sum, item) => sum + item.reservations.length, 0)}건)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

