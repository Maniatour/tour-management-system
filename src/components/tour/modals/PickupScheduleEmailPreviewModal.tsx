'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { X, Mail, Eye, Loader2, Users, Clock, Building, Copy, Check, Image as ImageIcon, FileText, ExternalLink } from 'lucide-react'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import html2pdf from 'html2pdf.js'

interface PickupScheduleEmailPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  reservations: Array<{
    id: string
    customer_id: string | null
    pickup_time: string | null
    tour_date?: string | null
  }>
  tourDate: string
  tourId?: string | null
  onSend?: () => Promise<void>
}

export default function PickupScheduleEmailPreviewModal({
  isOpen,
  onClose,
  reservations,
  tourDate,
  tourId,
  onSend
}: PickupScheduleEmailPreviewModalProps) {
  const t = useTranslations('tours.pickupSchedule')
  const locale = useLocale()
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null)
  const [emailContent, setEmailContent] = useState<{
    subject: string
    html: string
    customer: {
      name: string
      email: string
      language: string
    }
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendingReservationId, setSendingReservationId] = useState<string | null>(null)
  const [sentReservations, setSentReservations] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const emailPreviewRef = useRef<HTMLDivElement>(null)
  const [reservationDetails, setReservationDetails] = useState<Record<string, {
    customerName: string
    adults: number | null
    children: number | null
    infants: number | null
    pickupHotel: string | null
    pickupLocation: string | null
  }>>({})
  const [preparationInfoSource, setPreparationInfoSource] = useState<{
    productId: string
    channelId: string | null
    languageCode: string
    productName?: string
  } | null>(null)

  // 픽업 시간별로 정렬 (오후 9시(21:00) 이후 시간은 전날로 취급)
  const reservationsWithPickupTime = React.useMemo(() => {
    const filtered = reservations.filter(
      (res) => res.pickup_time && res.pickup_time.trim() !== ''
    )
    
    // 오후 9시(21:00) 이후 시간은 전날로 취급하여 정렬
    const sortByPickupTime = (a: typeof filtered[0], b: typeof filtered[0]) => {
      const parseTime = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number)
        return hours * 60 + (minutes || 0)
      }
      
      const parseDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return new Date(tourDate)
        const [year, month, day] = dateStr.split('-').map(Number)
        return new Date(year, month - 1, day)
      }
      
      const timeA = parseTime(a.pickup_time!)
      const timeB = parseTime(b.pickup_time!)
      const referenceTime = 21 * 60 // 오후 9시 (21:00) = 1260분
      
      // 오후 9시 이후 시간은 전날로 취급
      let dateA = parseDate(a.tour_date)
      let dateB = parseDate(b.tour_date)
      
      if (timeA >= referenceTime) {
        dateA = new Date(dateA)
        dateA.setDate(dateA.getDate() - 1)
      }
      if (timeB >= referenceTime) {
        dateB = new Date(dateB)
        dateB.setDate(dateB.getDate() - 1)
      }
      
      // 날짜와 시간을 함께 고려하여 정렬
      const dateTimeA = dateA.getTime() + timeA * 60 * 1000
      const dateTimeB = dateB.getTime() + timeB * 60 * 1000
      
      return dateTimeA - dateTimeB
    }
    
    return [...filtered].sort(sortByPickupTime)
  }, [reservations, tourDate])

  // 예약 ID 배열 메모이제이션
  const reservationIds = React.useMemo(
    () => reservationsWithPickupTime.map(r => r.id),
    [reservationsWithPickupTime]
  )

  // 예약 상세 정보 가져오기
  useEffect(() => {
    if (!isOpen || reservationsWithPickupTime.length === 0) return

    const fetchReservationDetails = async () => {
      const details: Record<string, {
        customerName: string
        adults: number | null
        children: number | null
        infants: number | null
        pickupHotel: string | null
        pickupLocation: string | null
      }> = {}

      // 모든 예약 ID 수집
      const reservationIds = reservationsWithPickupTime.map(r => r.id)
      
      try {
        // 한 번에 모든 예약 정보 조회
        type ReservationData = {
          id: string
          customer_id: string | null
          adults: number | null
          child: number | null
          infant: number | null
          pickup_hotel: string | null
        }
        
        const { data: reservationsData, error: reservationsError } = await supabase
          .from('reservations')
          .select('id, customer_id, adults, child, infant, pickup_hotel')
          .in('id', reservationIds)

        if (reservationsError) {
          console.error('예약 정보 조회 오류:', reservationsError)
          // 에러가 발생해도 기본값 설정
          reservationsWithPickupTime.forEach(res => {
            details[res.id] = {
              customerName: 'Unknown',
              adults: null,
              children: null,
              infants: null,
              pickupHotel: null,
              pickupLocation: null
            }
          })
          setReservationDetails(details)
          return
        }

        const reservationsTyped = (reservationsData || []) as ReservationData[]

        // 고객 ID 수집
        const customerIds = [...new Set(reservationsTyped
          .map(r => r.customer_id)
          .filter((id): id is string => id !== null)
        )]

        // 한 번에 모든 고객 정보 조회
        type CustomerData = {
          id: string
          name: string
        }
        
        let customersMap: Record<string, string> = {}
        if (customerIds.length > 0) {
          const { data: customersData } = await supabase
            .from('customers')
            .select('id, name')
            .in('id', customerIds)

          if (customersData) {
            const customersTyped = customersData as CustomerData[]
            customersMap = customersTyped.reduce((acc, customer) => {
              acc[customer.id] = customer.name
              return acc
            }, {} as Record<string, string>)
          }
        }

        // 호텔 ID 수집
        const hotelIds = [...new Set(reservationsTyped
          .map(r => r.pickup_hotel)
          .filter((id): id is string => id !== null)
        )]

        // 한 번에 모든 호텔 정보 조회
        type HotelData = {
          id: string
          hotel: string
          pick_up_location: string | null
        }
        
        let hotelsMap: Record<string, { hotel: string; location: string | null }> = {}
        if (hotelIds.length > 0) {
          const { data: hotelsData } = await supabase
            .from('pickup_hotels')
            .select('id, hotel, pick_up_location')
            .in('id', hotelIds)

          if (hotelsData) {
            const hotelsTyped = hotelsData as HotelData[]
            hotelsMap = hotelsTyped.reduce((acc, hotel) => {
              acc[hotel.id] = {
                hotel: hotel.hotel,
                location: hotel.pick_up_location
              }
              return acc
            }, {} as Record<string, { hotel: string; location: string | null }>)
          }
        }

        // 예약별로 상세 정보 구성
        reservationsTyped.forEach(reservation => {
          const customerName = reservation.customer_id 
            ? (customersMap[reservation.customer_id] || 'Unknown')
            : 'Unknown'
          
          const hotelInfo = reservation.pickup_hotel 
            ? hotelsMap[reservation.pickup_hotel]
            : null

          details[reservation.id] = {
            customerName,
            adults: reservation.adults || null,
            children: reservation.child || null,
            infants: reservation.infant || null,
            pickupHotel: hotelInfo?.hotel || null,
            pickupLocation: hotelInfo?.location || null
          }
        })

        // 데이터가 없는 예약에 대해서도 기본값 설정
        reservationsWithPickupTime.forEach(res => {
          if (!details[res.id]) {
            details[res.id] = {
              customerName: 'Unknown',
              adults: null,
              children: null,
              infants: null,
              pickupHotel: null,
              pickupLocation: null
            }
          }
        })

        setReservationDetails(details)
      } catch (error) {
        console.error('예약 상세 정보 조회 오류:', error)
        // 에러 발생 시 기본값 설정
        reservationsWithPickupTime.forEach(res => {
          details[res.id] = {
            customerName: 'Unknown',
            adults: null,
            children: null,
            infants: null,
            pickupHotel: null,
            pickupLocation: null
          }
        })
        setReservationDetails(details)
      }
    }

    fetchReservationDetails()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, reservationIds.join(',')])

  const selectedReservation = selectedReservationId 
    ? reservations.find(r => r.id === selectedReservationId)
    : reservationsWithPickupTime[0]

  const loadEmailPreview = useCallback(async (preparationInfoOverride?: string | null) => {
    if (!selectedReservation || !selectedReservation.pickup_time) return

    setLoading(true)
    try {
      const body: Record<string, unknown> = {
        reservationId: selectedReservation.id,
        pickupTime: selectedReservation.pickup_time.includes(':') 
          ? selectedReservation.pickup_time 
          : `${selectedReservation.pickup_time}:00`,
        tourDate: selectedReservation.tour_date || tourDate,
        tourId: tourId || undefined
      }
      if (preparationInfoOverride !== undefined && preparationInfoOverride !== null) {
        body.preparationInfo = preparationInfoOverride
      }
      const response = await fetch('/api/preview-pickup-schedule-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('API 응답 오류:', response.status, errorData)
        throw new Error(errorData.error || `이메일 미리보기 로드 실패 (${response.status})`)
      }

      const data = await response.json()
      if (!data.emailContent) {
        throw new Error('이메일 내용을 받을 수 없습니다.')
      }
      setEmailContent(data.emailContent)
      if (data.preparationInfoSource) {
        setPreparationInfoSource(data.preparationInfoSource)
      } else {
        setPreparationInfoSource(null)
      }
    } catch (error) {
      console.error('이메일 미리보기 로드 오류:', error)
      alert(t('emailPreviewLoadError'))
    } finally {
      setLoading(false)
    }
  }, [selectedReservation, tourDate, tourId])

  // 초기 선택 예약 설정
  useEffect(() => {
    if (isOpen && reservationsWithPickupTime.length > 0 && !selectedReservationId) {
      setSelectedReservationId(reservationsWithPickupTime[0].id)
    }
  }, [isOpen, reservationsWithPickupTime, selectedReservationId])

  // 선택된 예약이 변경되면 이메일 미리보기 로드
  useEffect(() => {
    if (isOpen && selectedReservation && selectedReservation.pickup_time) {
      loadEmailPreview()
    }
  }, [isOpen, selectedReservationId, selectedReservation, loadEmailPreview])

  const handleSend = async () => {
    if (!onSend) return

    setSending(true)
    try {
      await onSend()
      onClose()
    } catch (error) {
      console.error('일괄 발송 오류:', error)
    } finally {
      setSending(false)
    }
  }

  // HTML을 텍스트로 변환하는 함수 (블록 요소에 줄바꿈 마커 삽입)
  const htmlToText = (html: string): string => {
    // 줄바꿈 마커
    const NL = '{{NL}}'
    const NL2 = '{{NL2}}'
    
    // HTML 문자열에서 직접 줄바꿈 마커 삽입
    let processed = html
    
    // 블록 요소 앞뒤에 줄바꿈 마커 삽입
    const blockTags = ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'tr', 'td', 'th', 'section', 'article', 'header', 'footer']
    for (const tag of blockTags) {
      // 닫는 태그 뒤에 줄바꿈
      processed = processed.replace(new RegExp(`</${tag}>`, 'gi'), `</${tag}>${NL}`)
    }
    
    // <br> 태그를 줄바꿈으로
    processed = processed.replace(/<br\s*\/?>/gi, NL)
    
    // 섹션 구분용 클래스 앞에 이중 줄바꿈 추가
    processed = processed.replace(/class="info-box/gi, `${NL2}class="info-box`)
    processed = processed.replace(/class="highlight/gi, `${NL2}class="highlight`)
    
    // DOM 파싱
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = processed
    
    // 스타일과 스크립트 태그 제거
    const scripts = tempDiv.querySelectorAll('script, style')
    scripts.forEach(el => el.remove())
    
    // 링크를 "텍스트 (URL)" 형태로 변환 (중복 URL 제거)
    const seenUrls = new Set<string>()
    const allLinks = tempDiv.querySelectorAll('a')
    allLinks.forEach(link => {
      const linkText = link.textContent?.trim() || ''
      const linkUrl = link.getAttribute('href') || ''
      
      if (linkUrl && !seenUrls.has(linkUrl)) {
        seenUrls.add(linkUrl)
        const replacement = linkText ? `${linkText} (${linkUrl})` : linkUrl
        const textNode = document.createTextNode(replacement)
        link.parentNode?.replaceChild(textNode, link)
      } else if (linkText) {
        const textNode = document.createTextNode(linkText)
        link.parentNode?.replaceChild(textNode, link)
      } else {
        link.remove()
      }
    })
    
    // 이미지 URL 수집 (중복 제거, base64 제외)
    const imageUrls: string[] = []
    const seenImageUrls = new Set<string>()
    const images = tempDiv.querySelectorAll('img')
    images.forEach(img => {
      const src = img.getAttribute('src') || ''
      if (src && !src.startsWith('data:image') && !seenImageUrls.has(src)) {
        seenImageUrls.add(src)
        imageUrls.push(src)
      }
      img.remove()
    })
    
    // 텍스트 추출
    let text = tempDiv.textContent || ''
    
    // 마커를 실제 줄바꿈으로 변환
    text = text.replace(/\{\{NL2\}\}/g, '\n\n')
    text = text.replace(/\{\{NL\}\}/g, '\n')
    
    // 이미지 URL 섹션 추가
    if (imageUrls.length > 0) {
      if (text.includes('픽업 장소 이미지')) {
        text = text.replace(/(픽업 장소 이미지[^\n]*\n[^\n]*)/, '$1\n\n' + imageUrls.join('\n'))
      } else {
        text += '\n\n📷 이미지:\n' + imageUrls.join('\n')
      }
    }
    
    // 먼저 분리된 아이콘과 제목을 합치기 (아이콘 제거하고 제목만 유지)
    text = text.replace(/🚌\s*\n*\s*(모든 픽업 스케줄)/g, '$1')
    text = text.replace(/📸\s*\n*\s*(픽업 장소 이미지)/g, '$1')
    text = text.replace(/👥\s*\n*\s*(투어 상세 정보)/g, '$1')
    text = text.replace(/⚠️\s*\n*\s*(중요)/g, '$1')
    text = text.replace(/💬\s*\n*\s*(투어 채팅방)/g, '$1')
    
    // 섹션 구분자
    const sectionMarker = '■■■■■'
    
    // 섹션 제목 매핑 (원본 -> 표시용)
    const sectionTitleMap: { [key: string]: string } = {
      '📸 픽업 장소 이미지': '픽업 장소 이미지',
      '🖼️ 픽업 장소 이미지': '픽업 장소 이미지',
      '픽업 장소 이미지:': '픽업 장소 이미지',
      '픽업 장소 이미지': '픽업 장소 이미지',
      '🚌 모든 픽업 스케줄': '모든 픽업 스케줄',
      '📋 모든 픽업 스케줄': '모든 픽업 스케줄',
      '모든 픽업 스케줄': '모든 픽업 스케줄',
      'All Pickup Schedule': 'All Pickup Schedule',
      '👥 투어 상세 정보': '투어 상세 정보',
      '📋 투어 상세 정보': '투어 상세 정보',
      '투어 상세 정보': '투어 상세 정보',
      'Tour Details': 'Tour Details',
      '⚠️ 중요:': '중요 안내',
      '⚠️ 중요': '중요 안내',
      '중요:': '중요 안내',
      '💬 투어 채팅방': '투어 채팅방',
      '투어 채팅방': '투어 채팅방'
    }
    
    for (const [original, display] of Object.entries(sectionTitleMap)) {
      if (text.includes(original)) {
        const formattedTitle = `${sectionMarker} ${display} ${sectionMarker}`
        text = text.split(original).join('\n\n' + formattedTitle + '\n')
      }
    }
    
    // 각 픽업 시간 앞에 빈 줄 + 시계 이모지 추가 (시간 패턴)
    // 11:20 PM, 11:25 AM 등의 패턴
    text = text.replace(/(\d{1,2}:\d{2}\s*(?:AM|PM))/gi, '\n\n🕐 $1')
    
    // 정리
    text = text.replace(/[ \t]+/g, ' ') // 여러 공백을 하나로
    text = text.replace(/\n{4,}/g, '\n\n') // 4개 이상 줄바꿈을 2개로
    text = text.replace(/\n{3,}/g, '\n\n') // 3개 이상 줄바꿈을 2개로
    text = text.replace(/^\s+$/gm, '') // 빈 줄의 공백 제거
    text = text.trim()
    
    return text
  }

  // 텍스트 버전 복사
  const handleCopyText = async () => {
    if (!emailContent) return

    try {
      let textContent = htmlToText(emailContent.html)
      // Windows 줄바꿈으로 변환 (일부 앱에서 더 잘 인식)
      textContent = textContent.replace(/\n/g, '\r\n')
      
      await navigator.clipboard.writeText(textContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('텍스트 복사 실패:', error)
      // 폴백: 텍스트 영역 사용
      const textArea = document.createElement('textarea')
      let textContent = htmlToText(emailContent.html)
      textContent = textContent.replace(/\n/g, '\r\n')
      textArea.value = textContent
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('복사 실패:', err)
        alert(t('emailPreviewCopyTextFailed'))
      }
      document.body.removeChild(textArea)
    }
  }

  const handleCopyEmail = async () => {
    if (!emailContent) return

    try {
      // HTML을 클립보드에 복사 (text/html 형식으로)
      const htmlBlob = new Blob([emailContent.html], { type: 'text/html' })
      const textBlob = new Blob([emailContent.html], { type: 'text/plain' })
      
      const clipboardItem = new ClipboardItem({
        'text/html': htmlBlob,
        'text/plain': textBlob
      })
      
      await navigator.clipboard.write([clipboardItem])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('HTML 형식 복사 실패, 텍스트로 복사 시도:', error)
      try {
        // 폴백: 일반 텍스트로 복사
        await navigator.clipboard.writeText(emailContent.html)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        // Gmail 사용 안내 표시
        alert(t('emailPreviewHTMLCopiedGmail'))
      } catch (err) {
        console.error('복사 실패:', err)
        // 최종 폴백: 텍스트 영역 사용
        const textArea = document.createElement('textarea')
        textArea.value = emailContent.html
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.appendChild(textArea)
        textArea.select()
        try {
          document.execCommand('copy')
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
          alert(t('emailPreviewHTMLCopiedGmail'))
        } catch (finalErr) {
          console.error('복사 실패:', finalErr)
          alert(t('emailPreviewCopyFailed'))
        }
        document.body.removeChild(textArea)
      }
    }
  }

  // 이미지 압축 함수 (1MB 미만으로)
  const compressImage = async (dataUrl: string, maxSizeMB: number = 1): Promise<string> => {
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    let quality = 0.9

    // PNG를 JPEG로 변환하여 압축
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(dataUrl)
          return
        }

        // 이미지 크기 조정 (너무 크면 줄임)
        let width = img.width
        let height = img.height
        const maxDimension = 2000 // 최대 크기 제한

        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height)
          width = width * ratio
          height = height * ratio
        }

        canvas.width = width
        canvas.height = height
        ctx.drawImage(img, 0, 0, width, height)

        // JPEG로 변환하며 품질 조정
        const tryCompress = (q: number) => {
          const jpegDataUrl = canvas.toDataURL('image/jpeg', q)
          const sizeInBytes = (jpegDataUrl.length * 3) / 4 // base64 크기 추정
          
          if (sizeInBytes <= maxSizeBytes || q <= 0.1) {
            resolve(jpegDataUrl)
          } else {
            // 품질을 낮춰서 재시도
            setTimeout(() => tryCompress(q - 0.1), 0)
          }
        }

        tryCompress(quality)
      }
      img.onerror = () => resolve(dataUrl)
      img.src = dataUrl
    })
  }

  // 이미지로 다운로드
  const handleDownloadImage = async () => {
    if (!emailPreviewRef.current || !emailContent) return

    setDownloading(true)
    try {
      const canvas = await html2canvas(emailPreviewRef.current, {
        backgroundColor: '#ffffff',
        scale: 1.5, // scale을 낮춰서 용량 감소
        logging: false,
        useCORS: true,
        allowTaint: false
      })

      let dataUrl = canvas.toDataURL('image/png')
      
      // 이미지 압축
      dataUrl = await compressImage(dataUrl, 1)
      
      const link = document.createElement('a')
      const customerName = emailContent.customer?.name || 'customer'
      const fileName = `픽업_스케줄_${customerName}_${new Date().toISOString().split('T')[0]}.jpg`
      link.download = fileName
      link.href = dataUrl
      link.click()
    } catch (error) {
      console.error('이미지 다운로드 오류:', error)
      alert(t('emailPreviewImageDownloadFailed'))
    } finally {
      setDownloading(false)
    }
  }

  // PDF로 다운로드
  const handleDownloadPDF = async () => {
    if (!emailPreviewRef.current || !emailContent) return

    setDownloading(true)
    try {
      const customerName = emailContent.customer?.name || 'customer'
      // 영문 파일명으로 생성 (한글 제거 및 영문 변환)
      const sanitizedCustomerName = customerName
        .replace(/[^a-zA-Z0-9]/g, '_') // 한글 및 특수문자를 언더스코어로 변환
        .substring(0, 30) // 최대 30자로 제한
      const dateStr = new Date().toISOString().split('T')[0]
      const fileName = `Pickup_notification_${sanitizedCustomerName}_${dateStr}.pdf`

      // html2pdf.js 옵션 설정 (링크 클릭 가능)
      const opt = {
        margin: 10,
        filename: fileName,
        image: { type: 'jpeg' as const, quality: 0.95 },
        html2canvas: { 
          scale: 2, 
          useCORS: true,
          logging: false,
          allowTaint: false,
          letterRendering: true
        },
        jsPDF: { 
          unit: 'mm' as const, 
          format: 'a4' as const, 
          orientation: 'portrait' as const,
          compress: true
        },
        pagebreak: { mode: 'avoid-all' as const }
      }

      // html2pdf로 PDF 생성 (링크 유지됨)
      await html2pdf().set(opt).from(emailPreviewRef.current).save()
      
    } catch (error) {
      console.error('PDF 다운로드 오류:', error)
      // 폴백: 기존 방식으로 시도
      try {
        const canvas = await html2canvas(emailPreviewRef.current, {
          backgroundColor: '#ffffff',
          scale: 2,
          logging: false,
          useCORS: true,
          allowTaint: false
        })

        let imgData = canvas.toDataURL('image/png')
        imgData = await compressImage(imgData, 0.9)

        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
          compress: true
        })

        const pdfWidth = pdf.internal.pageSize.getWidth()
        const pdfHeight = pdf.internal.pageSize.getHeight()

        const img = new Image()
        await new Promise((resolve) => {
          img.onload = resolve
          img.onerror = resolve
          img.src = imgData
        })

        const imgWidth = img.width || canvas.width
        const imgHeight = img.height || canvas.height
        const ratio = Math.min(pdfWidth / (imgWidth * 0.264583), pdfHeight / (imgHeight * 0.264583))
        const imgX = (pdfWidth - imgWidth * 0.264583 * ratio) / 2
        const imgY = 10

        pdf.addImage(imgData, 'JPEG', imgX, imgY, imgWidth * 0.264583 * ratio, imgHeight * 0.264583 * ratio, undefined, 'FAST')

        const customerName = emailContent.customer?.name || 'customer'
        // 영문 파일명으로 생성 (한글 제거 및 영문 변환)
        const sanitizedCustomerName = customerName
          .replace(/[^a-zA-Z0-9]/g, '_') // 한글 및 특수문자를 언더스코어로 변환
          .substring(0, 30) // 최대 30자로 제한
        const dateStr = new Date().toISOString().split('T')[0]
        const fileName = `Pickup_notification_${sanitizedCustomerName}_${dateStr}.pdf`
        pdf.save(fileName)
      } catch (fallbackError) {
        console.error('PDF 폴백 다운로드 오류:', fallbackError)
        alert(t('emailPreviewPDFDownloadFailed'))
      }
    } finally {
      setDownloading(false)
    }
  }

  const handleSendIndividual = async (reservationId: string) => {
    const reservation = reservations.find(r => r.id === reservationId)
    if (!reservation) {
      console.error('예약을 찾을 수 없습니다:', { reservationId, reservations: reservations.map(r => r.id) })
      alert(t('emailPreviewReservationNotFound'))
      return
    }

    if (!reservation.pickup_time) {
      alert(t('emailPreviewNoPickupTime'))
      return
    }

    setSendingReservationId(reservationId)
    try {
      const reservationTourDate = reservation.tour_date || tourDate
      if (!reservationTourDate) {
        alert(t('emailPreviewNoTourDate'))
        return
      }

      console.log('개별 발송 요청:', {
        reservationId: reservation.id,
        pickupTime: reservation.pickup_time,
        tourDate: reservationTourDate
      })

      const response = await fetch('/api/send-pickup-schedule-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reservationId: reservation.id,
          pickupTime: reservation.pickup_time.includes(':') 
            ? reservation.pickup_time 
            : `${reservation.pickup_time}:00`,
          tourDate: reservationTourDate
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || t('emailPreviewSendError')
        const errorDetails = errorData.details ? `\n\n상세: ${errorData.details}` : ''
        const errorType = errorData.errorType ? `\n\n오류 유형: ${errorData.errorType}` : ''
        throw new Error(`${errorMessage}${errorDetails}${errorType}`)
      }

      setSentReservations(prev => new Set(prev).add(reservationId))
      alert(t('emailPreviewSendSuccess'))
    } catch (error) {
      console.error('개별 발송 오류:', error)
      console.error('에러 상세:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      alert(error instanceof Error ? error.message : t('emailPreviewSendError'))
    } finally {
      setSendingReservationId(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">{t('emailPreviewModalTitle')}</h2>
            <span className="text-sm text-gray-500">
              ({reservationsWithPickupTime.length}{t('emailPreviewCountUnit')})
            </span>
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
          {/* 왼쪽: 예약 목록 */}
          <div className="w-80 border-r overflow-y-auto p-4 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-3">{t('emailPreviewReservationList')}</h3>
            <div className="space-y-3">
              {reservationsWithPickupTime.map((reservation, index) => {
                const details = reservationDetails[reservation.id]
                const totalPeople = (details?.adults || 0) + (details?.children || 0) + (details?.infants || 0)
                const pickupTime = reservation.pickup_time?.includes(':') 
                  ? reservation.pickup_time.substring(0, 5)
                  : reservation.pickup_time

                const isSending = sendingReservationId === reservation.id
                const isSent = sentReservations.has(reservation.id)

                return (
                  <div
                    key={reservation.id}
                    className={`w-full rounded-lg border-2 transition-all ${
                      selectedReservationId === reservation.id
                        ? 'bg-blue-50 border-blue-500 shadow-md'
                        : 'bg-white border-gray-200 hover:border-gray-400 hover:shadow-sm'
                    }`}
                  >
                    <button
                      onClick={() => setSelectedReservationId(reservation.id)}
                      className="w-full text-left p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-semibold text-gray-500">
                          {t('emailPreviewReservationNum', { n: index + 1 })}
                        </div>
                        <div className="flex items-center gap-2">
                          {isSent && (
                            <span className="text-xs text-green-600 font-medium">{t('emailPreviewSent')}</span>
                          )}
                          {selectedReservationId === reservation.id && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          )}
                        </div>
                      </div>
                      
                      {/* 고객명 */}
                      <div className="font-semibold text-gray-900 mb-2 truncate">
                        {details?.customerName || 'Loading...'}
                      </div>

                      {/* 인원 정보 */}
                      {totalPeople > 0 && (
                        <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
                          <Users size={12} />
                          <span>{totalPeople}{t('emailPreviewPeopleShort')}</span>
                          {details?.adults && details.adults > 0 && (
                            <span className="text-gray-500">({t('emailPreviewAdults')} {details.adults}</span>
                          )}
                          {details?.children && details.children > 0 && (
                            <span className="text-gray-500">, {t('emailPreviewChildren')} {details.children}</span>
                          )}
                          {details?.infants && details.infants > 0 && (
                            <span className="text-gray-500">, {t('emailPreviewInfants')} {details.infants}</span>
                          )}
                          {totalPeople > 0 && <span className="text-gray-500">)</span>}
                        </div>
                      )}

                      {/* 픽업 시간 */}
                      {pickupTime && (
                        <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
                          <Clock size={12} />
                          <span className="font-medium">{pickupTime}</span>
                        </div>
                      )}

                      {/* 픽업 호텔 */}
                      {details?.pickupHotel && (
                        <div className="flex items-start gap-1 text-xs text-gray-600">
                          <Building size={12} className="mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{details.pickupHotel}</div>
                            {details.pickupLocation && (
                              <div className="text-gray-500 truncate mt-0.5">{details.pickupLocation}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </button>
                    
                    {/* 개별 발송 버튼 */}
                    <div className="px-4 pb-4 space-y-2">
                      {isSent ? (
                        <>
                          <div className="w-full px-3 py-2 text-xs rounded bg-green-100 text-green-700 flex items-center justify-center gap-2">
                            <Mail className="w-3 h-3" />
                            <span>{t('emailPreviewSendDone')}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSendIndividual(reservation.id)
                            }}
                            disabled={isSending}
                            className={`w-full px-3 py-2 text-xs rounded transition-all flex items-center justify-center gap-2 ${
                              isSending
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                : 'bg-orange-600 text-white hover:bg-orange-700'
                            }`}
                          >
                            {isSending ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>{t('emailPreviewResending')}</span>
                              </>
                            ) : (
                              <>
                                <Mail className="w-3 h-3" />
                                <span>{t('emailPreviewResend')}</span>
                              </>
                            )}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSendIndividual(reservation.id)
                          }}
                          disabled={isSending}
                          className={`w-full px-3 py-2 text-xs rounded transition-all flex items-center justify-center gap-2 ${
                            isSending
                              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {isSending ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>{t('emailPreviewSending')}</span>
                            </>
                          ) : (
                            <>
                              <Mail className="w-3 h-3" />
                              <span>{t('emailPreviewSendIndividual')}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 오른쪽: 이메일 미리보기 */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
                  <p className="text-gray-600">{t('emailPreviewLoading')}</p>
                </div>
              </div>
            ) : emailContent ? (
              <div className="space-y-4">
                {/* 이메일 정보 */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-semibold text-gray-700">{t('emailPreviewTo')}</span>
                      <span className="ml-2 text-gray-900">{emailContent.customer?.name || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">{t('emailPreviewEmailLabel')}</span>
                      <span className="ml-2 text-gray-900">{emailContent.customer?.email || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">{t('emailPreviewLanguage')}</span>
                      <span className="ml-2 text-gray-900">{emailContent.customer?.language || t('emailPreviewDefaultLanguage')}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">{t('emailPreviewSubject')}</span>
                      <span className="ml-2 text-gray-900">{emailContent.subject || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* 상품 상세 수정으로 이동 (추천 준비물 등 편집) */}
                {preparationInfoSource?.productId && (
                  <div className="flex justify-end">
                    <Link
                      href={`/${locale}/admin/products/${preparationInfoSource.productId}/details`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {t('emailPreviewProductDetailsEdit')}
                    </Link>
                  </div>
                )}

                {/* 이메일 내용 미리보기 */}
                <div className="border rounded-lg overflow-hidden bg-white">
                  <div className="bg-gray-100 px-4 py-2 border-b">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="w-4 h-4" />
                        <span>{t('emailPreviewTitle')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* 텍스트 복사 버튼 */}
                        <button
                          onClick={handleCopyText}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                          title={t('emailPreviewCopyTextTitle')}
                          disabled={downloading}
                        >
                          {copied ? (
                            <>
                              <Check className="w-4 h-4" />
                              <span>{t('emailPreviewCopied')}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              <span>{t('emailPreviewCopyText')}</span>
                            </>
                          )}
                        </button>
                        {/* 이미지 다운로드 버튼 */}
                        <button
                          onClick={handleDownloadImage}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50"
                          title={t('emailPreviewDownloadImageTitle')}
                          disabled={downloading}
                        >
                          {downloading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>{t('emailPreviewDownloading')}</span>
                            </>
                          ) : (
                            <>
                              <ImageIcon className="w-4 h-4" />
                              <span>{t('emailPreviewImage')}</span>
                            </>
                          )}
                        </button>
                        {/* PDF 다운로드 버튼 */}
                        <button
                          onClick={handleDownloadPDF}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                          title={t('emailPreviewDownloadPDFTitle')}
                          disabled={downloading}
                        >
                          {downloading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>{t('emailPreviewDownloading')}</span>
                            </>
                          ) : (
                            <>
                              <FileText className="w-4 h-4" />
                              <span>{t('emailPreviewPDF')}</span>
                            </>
                          )}
                        </button>
                        {/* HTML 복사 버튼 */}
                        <button
                          onClick={handleCopyEmail}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          title={t('emailPreviewCopyHTMLTitle')}
                          disabled={downloading}
                        >
                          <Copy className="w-4 h-4" />
                          <span>{t('emailPreviewCopyHTML')}</span>
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 bg-yellow-50 border border-yellow-200 rounded p-2 mb-2">
                      💡 <strong>{t('emailPreviewUsageTipLabel')}</strong> {t('emailPreviewUsageTip')}
                    </div>
                  </div>
                  <div 
                    ref={emailPreviewRef}
                    className="p-4"
                    dangerouslySetInnerHTML={{ __html: emailContent.html }}
                    style={{ 
                      maxWidth: '600px',
                      margin: '0 auto',
                      backgroundColor: '#ffffff'
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-500">
                  <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>{t('emailPreviewLoadFailed')}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            {t('emailPreviewFooterCount', { current: selectedReservationId ? reservationsWithPickupTime.findIndex(r => r.id === selectedReservationId) + 1 : 1, total: reservationsWithPickupTime.length })}
          </div>
          <div className="flex items-center gap-3">
            {onSend && (
              <button
                onClick={handleSend}
                disabled={sending || reservationsWithPickupTime.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('emailPreviewBatchSending')}</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    <span>{t('emailPreviewBatchSend', { count: reservationsWithPickupTime.length })}</span>
                  </>
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              {t('emailPreviewClose')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

