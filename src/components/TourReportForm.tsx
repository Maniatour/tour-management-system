'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { MapPin, Users, DollarSign, Cloud, Star, MessageSquare, AlertTriangle, Package, Lightbulb, MessageCircle, Handshake, FileText, ChevronLeft, ChevronRight, Car, Wrench, Camera, NotebookPen, SkipForward, PenLine, Sunrise, Footprints, CircleParking, ClipboardCheck } from 'lucide-react'
import WaiverSignaturePad from '@/components/waiver/WaiverSignaturePad'
import TourReportNarrationSection from '@/components/tour/TourReportNarrationSection'
import TourReportNumberStepper from '@/components/TourReportNumberStepper'
import TourReportIssuePhotos from '@/components/TourReportIssuePhotos'
import TourReportSkippedStops from '@/components/TourReportSkippedStops'
import TourReportPaceToggle, { type TourReportPace } from '@/components/TourReportPaceToggle'
import {
  displayDrivingSegmentLabel,
  type TourReportDrivingSegment,
} from '@/lib/tourReportDrivingSegments'
import TourReportDrivingRoster from '@/components/TourReportDrivingRoster'
import {
  HORSESHOE_BEND_ACTIVITIES,
  SUNRISE_ACTIVITIES,
  SUNRISE_POINTS,
  assignmentFromRoster,
  flippedAssignmentFromPartner,
  isHorseshoeBendCourse,
  parseActivityDetails,
  partnerAssignedToMeSegmentIds,
  partnerSelfSegmentIds,
  rosterFromAssignment,
  sunriseCourseIdForKey,
  sunrisePointKeyFromCourse,
  unassignedDrivingIds,
  type DrivingClaim,
  type DrivingSeat,
  type HorseshoeBendActivity,
  type PartnerDrivingReport,
  type SunriseActivity,
  type SunrisePointKey,
  type TourReportActivityDetails,
} from '@/lib/tourReportActivityDetails'
import { normalizeTourReportEmail } from '@/lib/tourReportMissing'
import {
  VEHICLE_CONDITION_OPTIONS,
  parseIssuePhotoUrls,
  parseSkippedStops,
  skippedStopsToSubstitutionNotes,
  isTourReportSignatureImage,
  inferTourReportHasIssues,
  tourReportNoLostItemsLabel,
  type SkippedStopsMap,
} from '@/lib/tourReportExtras'
import {
  hasNarrationSkipExplanation,
  narrationSkipNeedsDetails,
  parseNarrationSkip,
  serializeNarrationSkip,
} from '@/lib/tourReportNarration'
import { isGoblinTourProduct } from '@/lib/goblinTour'
import { fetchTourNarrationPlays } from '@/lib/tourNarrationPlays'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { reservationExcludedFromTourAssignment } from '@/lib/reservationStatus'
import {
  isReservationCancelledStatus,
  isReservationDeletedStatus,
  normalizeReservationIds,
} from '@/utils/tourUtils'
import {
  buildMainStopCourseIds,
  displayCourseName,
  expandDbKeyCandidates,
  expandManyDbKeyCandidates,
  hasChildInMap,
  isTourPointCategory,
  resolveCanonicalCourseIds,
  sortMainStopsIndented,
  type CourseForMainStops,
} from '@/lib/tourReportMainStops'

interface TourReportFormProps {
  tourId: string
  /** 있으면 조회 1회 생략; 없으면 tours에서 product_id 로드 */
  productId?: string | null
  /** 수정 모드일 때 대상 리포트 ID */
  reportId?: string | null
  /** 수정 모드 초기값 */
  initialData?: Partial<TourReportData> | null
  onSuccess?: () => void
  onCancel?: () => void
  locale?: string
  /** true면 모바일 단계 UI 강제 (테스트용). 미설정 시 뷰포트로 판단 */
  forceMobileWizard?: boolean
  /** 모달 안에서 열릴 때 높이를 부모에 맞춤 (가이드 투어 상세 등) */
  variant?: 'inline' | 'modal'
}

interface TourReportData {
  end_mileage: number | null
  cash_balance: number | null
  customer_count: number | null
  booked_customer_count: number | null
  weather: string | null
  main_stops_visited: string[]
  driving_segment_ids: string[]
  skipped_stops: SkippedStopsMap
  vehicle_condition_tags: string[]
  vehicle_condition_note: string | null
  issue_photo_urls: string[]
  handoff_note: string | null
  overall_mood: string | null
  guest_comments: string | null
  incidents_delays_health: string[]
  lost_items_damage: string[]
  suggestions_followup: string | null
  communication: string | null
  teamwork: string | null
  comments: string | null
  sign: string | null
  office_note: string | null
  narration_not_played: boolean
  narration_explained_in_person: boolean
  narration_skip_reason: string | null
}

const WEATHER_OPTIONS = [
  { value: 'sunny', icon: '☀️', ko: '맑음', en: 'Sunny' },
  { value: 'cloudy', icon: '☁️', ko: '흐림', en: 'Cloudy' },
  { value: 'rainy', icon: '🌧️', ko: '비', en: 'Rainy' },
  { value: 'snowy', icon: '❄️', ko: '눈', en: 'Snowy' },
  { value: 'windy', icon: '💨', ko: '바람', en: 'Windy' },
  { value: 'foggy', icon: '🌫️', ko: '안개', en: 'Foggy' }
]

const MOOD_OPTIONS = [
  { value: 'excellent', icon: '😊', ko: '가장 좋음', en: 'Excellent' },
  { value: 'good', icon: '🙂', ko: '전반적 만족', en: 'Good' },
  { value: 'average', icon: '😐', ko: '보통', en: 'Average' },
  { value: 'poor', icon: '😞', ko: '매우 불만', en: 'Poor' },
  { value: 'terrible', icon: '😢', ko: '가이드 불만', en: 'Terrible' }
]

const RATING_OPTIONS = [
  { value: 'excellent', icon: '⭐⭐⭐', ko: '우수', en: 'Excellent' },
  { value: 'good', icon: '⭐⭐', ko: '좋음', en: 'Good' },
  { value: 'average', icon: '⭐', ko: '보통', en: 'Average' },
  { value: 'poor', icon: '👎', ko: '나쁨', en: 'Poor' }
]

const INCIDENTS_OPTIONS = [
  { ko: '교통 지연', en: 'Traffic Delay' },
  { ko: '날씨 문제', en: 'Weather Issue' },
  { ko: '차량 고장', en: 'Vehicle Breakdown' },
  { ko: '건강 문제', en: 'Health Issue' },
  { ko: '사고', en: 'Accident' },
  { ko: '예약 오류', en: 'Booking Error' },
  { ko: '가이드 지연', en: 'Guide Delay' },
  { ko: '고객 불만', en: 'Customer Complaint' },
  { ko: '기타', en: 'Other' }
]

const LOST_DAMAGE_OPTIONS = [
  { ko: '분실물 없음', en: 'No Lost Items' },
  { ko: '가방 분실', en: 'Bag Lost' },
  { ko: '휴대폰 분실', en: 'Phone Lost' },
  { ko: '카메라 분실', en: 'Camera Lost' },
  { ko: '차량 손상', en: 'Vehicle Damage' },
  { ko: '시설 손상', en: 'Facility Damage' },
  { ko: '기타 손상', en: 'Other Damage' }
]

const MOBILE_BREAKPOINT = '(max-width: 1023px)'

function reservationPeopleCount(row: {
  total_people?: number | null
  adults?: number | null
  child?: number | null
  infant?: number | null
}): number {
  const parts =
    (Number(row.adults) || 0) + (Number(row.child) || 0) + (Number(row.infant) || 0)
  if (parts > 0) return parts
  return Number(row.total_people) || 0
}

export default function TourReportForm({
  tourId,
  productId: productIdProp,
  reportId,
  initialData,
  onSuccess,
  onCancel,
  locale = 'ko',
  forceMobileWizard,
  variant = 'inline'
}: TourReportFormProps) {
  const { user } = useAuth()
  
  // 번역 함수 - locale prop을 사용하여 언어 결정
  const getText = (ko: string, en: string) => locale === 'en' ? en : ko
  
  // 번역 함수들을 정의
  const t = {
    title: getText('투어 리포트 작성', 'Tour Report'),
    fields: {
      endMileage: getText('종료 주행거리', 'End Mileage'),
      cashBalance: getText('현금 잔액', 'Cash Balance'),
      customerCount: getText('실제 탑승 인원', 'Guests on board'),
      customerCountBooked: (booked: number, noShow: number) =>
        noShow > 0
          ? getText(
              `예약 ${booked}명 · 노쇼 ${noShow}명. 실제 탑승 인원을 조정하세요.`,
              `Booked ${booked} · no-show ${noShow}. Adjust the number who boarded.`
            )
          : getText(
              `예약 ${booked}명. 실제 탑승 인원을 조정하세요.`,
              `Booked ${booked}. Adjust the number who boarded.`
            ),
      weather: getText('날씨', 'Weather'),
      mainStopsVisited: getText('주요 방문지', 'Main Stops Visited'),
      mainStopsHint: getText(
        '오늘 자신이 진행한 관광지를 선택해 주세요.',
        'Select the attractions you actually led today.'
      ),
      mainStopsLoading: getText('주요 방문지 불러오는 중…', 'Loading main stops…'),
      mainStopsFromCourseEmpty: getText('연결된 코스 방문지가 없습니다.', 'No linked course stops found.'),
      activitiesCompleted: getText('완료된 활동', 'Activities Completed'),
      overallMood: getText('전체 분위기', 'Overall Mood'),
      guestComments: getText('고객 코멘트', 'Guest Comments'),
      incidentsDelaysHealth: getText('사고/지연/건강 문제', 'Incidents/Delays/Health Issues'),
      lostItemsDamage: getText('분실/손상', 'Lost Items/Damage'),
      suggestionsFollowup: getText('제안사항/후속조치', 'Suggestions/Follow-up'),
      communication: getText('소통', 'Communication'),
      teamwork: getText('팀워크', 'Teamwork'),
      comments: getText('코멘트', 'Comments'),
      sign: getText('서명', 'Signature'),
      signHint: getText(
        '손가락, 스타일러스 또는 마우스로 서명하세요.',
        'Draw with finger, stylus, or mouse.'
      ),
      signClear: getText('지우기', 'Clear'),
      signUndo: getText('실행 취소', 'Undo'),
      signExisting: getText('저장된 서명', 'Saved signature'),
      signReplaceHint: getText(
        '아래에 다시 그리면 기존 서명이 바뀝니다.',
        'Draw below to replace the saved signature.'
      ),
      markAllStops: getText('오늘 코스 전부 방문', 'Mark all stops visited'),
      allClearVehicle: getText(
        '차량은 이상 없음으로 저장됩니다. 이상이 있으면 위에서 「이슈·특이사항 있음」을 선택하세요.',
        'Vehicle will be saved as no issues. If something is wrong, choose “Something to report” above.'
      ),
      officeNote: getText('사무실 메모', 'Office Note'),
      driving: getText('Driving', 'Driving'),
      drivingHint: getText(
        '코스별로 자신 또는 파트너가 운전했는지 체크하세요.',
        'For each segment, check whether you or your partner drove.'
      ),
      drivingMe: getText('자신', 'Me'),
      drivingPartner: getText('파트너', 'Partner'),
      horseshoeOptions: getText('홀스슈밴드에서 한 일', 'What you did at Horseshoe Bend'),
      sunriseTitle: getText('일출 포인트', 'Sunrise viewpoint'),
      sunriseHint: getText(
        '오늘 일출을 본 포인트와, 차량 대기인지 사진 촬영인지 선택해 주세요.',
        'Choose the sunrise viewpoint and whether you waited in the vehicle or took photos.'
      ),
      drivingLoading: getText('운전 구간 불러오는 중…', 'Loading driving segments…'),
      drivingEmpty: getText('등록된 운전 구간이 없습니다.', 'No driving segments are set up yet.'),
      skippedStops: getText('스킵한 포인트와 이유', 'Skipped stops & reasons'),
      vehicleCondition: getText('차량 상태', 'Vehicle condition'),
      vehicleConditionHint: getText(
        '회사 차량만 해당합니다. 이상이 있으면 선택해 주세요.',
        'Company vehicles only. Select anything that needs follow-up.'
      ),
      vehicleConditionNote: getText('차량 상태 메모', 'Vehicle notes'),
      issuePhotos: getText('이슈 사진', 'Issue photos'),
      handoffNote: getText('다음 팀 인수인계', 'Handoff for next team'),
    },
    weatherOptions: {
      sunny: getText('맑음', 'Sunny'),
      cloudy: getText('흐림', 'Cloudy'),
      rainy: getText('비', 'Rainy'),
      snowy: getText('눈', 'Snowy'),
      windy: getText('바람', 'Windy'),
      foggy: getText('안개', 'Foggy')
    },
    moodOptions: {
      excellent: getText('매우 좋음', 'Excellent'),
      good: getText('좋음', 'Good'),
      average: getText('보통', 'Average'),
      poor: getText('나쁨', 'Poor')
    },
    communicationOptions: {
      excellent: getText('매우 좋음', 'Excellent'),
      good: getText('좋음', 'Good'),
      average: getText('보통', 'Average'),
      poor: getText('나쁨', 'Poor')
    },
    teamworkOptions: {
      excellent: getText('매우 좋음', 'Excellent'),
      good: getText('좋음', 'Good'),
      average: getText('보통', 'Average'),
      poor: getText('나쁨', 'Poor')
    },
    buttons: {
      submit: getText('제출', 'Submit'),
      cancel: getText('취소', 'Cancel'),
      next: getText('다음', 'Next'),
      prev: getText('이전', 'Back'),
      stepOf: (n: number, total: number) =>
        locale === 'en' ? `Step ${n} of ${total}` : `${n}/${total} 단계`
    },
    stepTitles: [
      getText('기본 정보', 'Basics'),
      getText('방문·운전·분위기', 'Stops, driving & mood'),
      getText('고객·이슈', 'Guest & issues'),
      getText('평가·메모·제출', 'Ratings & submit')
    ],
    stepTitlesAllClear: [
      getText('기본 정보', 'Basics'),
      getText('방문·운전', 'Stops & driving'),
      getText('서명·제출', 'Sign & submit')
    ],
    messages: {
      reportSubmitted: getText('리포트가 성공적으로 제출되었습니다.', 'Report submitted successfully.'),
      submitError: getText('리포트 제출 중 오류가 발생했습니다.', 'Error submitting report.'),
      loginRequired: getText('로그인이 필요합니다.', 'Login required.'),
      signatureRequired: getText('서명을 그려 주세요.', 'Please draw your signature.'),
      weatherRequired: getText('날씨를 선택해 주세요.', 'Please select the weather.'),
      narrationSkipRequired: getText(
        '재생하지 않은 사유를 적거나, 충분한 설명을 했음을 체크해 주세요.',
        'Write a reason for not playing narration, or check that you explained it sufficiently.'
      ),
      narrationRequired: getText(
        '나레이션 재생 기록이 없습니다. 재생하지 않았다면 사유를 적거나, 충분한 설명을 했음을 체크해 주세요.',
        'No narration playback was recorded. If it was not played, write a reason or check that you explained it sufficiently.'
      ),
      horseshoeRequired: getText(
        '홀스슈밴드를 방문했다면 하이킹 / 주차장 대기 / 앤텔롭캐년 체크인 중 하나를 선택해 주세요.',
        'If you visited Horseshoe Bend, choose hiking, parking wait, or Antelope Canyon check-in.'
      ),
      sunriseRequired: getText(
        '밤도깨비 투어는 일출 포인트와 차량 대기/사진 촬영을 선택해 주세요.',
        'For goblin tours, choose the sunrise viewpoint and vehicle wait or photography.'
      ),
      drivingGapsRequired: getText(
        '드라이빙 구간을 빠짐없이 자신 또는 파트너에게 나눠 주세요.',
        'Assign every driving segment to you or your partner. No gaps.'
      ),
      drivingClaimConfirm: (partnerName: string, label: string) =>
        getText(
          `${partnerName}이(가) 「${label}」를 운전했다고 제출했습니다.\n본인이 운전했다면 클레임하고 수정합니다.`,
          `${partnerName} submitted “${label}” as their driving.\nIf you drove it, claim it and correct the report.`
        ),
    },
    placeholders: {
      endMileage: getText('종료 주행거리를 입력하세요', 'Enter end mileage'),
      cashBalance: getText('현금 잔액을 입력하세요', 'Enter cash balance'),
      customerCount: getText('탑승 인원', 'Guests on board'),
      guestComments: getText('고객의 코멘트를 입력하세요', 'Enter guest comments'),
      suggestionsFollowup: getText('제안사항이나 후속조치를 입력하세요', 'Enter suggestions or follow-up actions'),
      comments: getText('추가 코멘트를 입력하세요', 'Enter additional comments'),
      officeNote: getText('사무실 메모를 입력하세요', 'Enter office note'),
      vehicleConditionNote: getText(
        '연료, 세차, 경고등, 손상 등을 적어 주세요.',
        'Note fuel, wash, warning lights, or damage.'
      ),
      handoffNote: getText(
        '다음 팀이 알면 좋은 내용을 적어 주세요. 예: 에어컨 약함, 특정 호텔 픽업 지연.',
        'Leave a note for the next team. Example: weak A/C, delayed hotel pickup.'
      ),
    }
  }
  const [loading, setLoading] = useState(false)
  const [mobileStep, setMobileStep] = useState(0)
  const [useMobileWizard, setUseMobileWizard] = useState(false)
  const [mainStopsLoading, setMainStopsLoading] = useState(false)
  const [mainStopOptions, setMainStopOptions] = useState<
    { id: string; course: CourseForMainStops; sort_order: number }[]
  >([])
  const [courseById, setCourseById] = useState<Map<string, CourseForMainStops>>(new Map())
  const [isRentalVehicle, setIsRentalVehicle] = useState(false)
  const [isCompanyVehicle, setIsCompanyVehicle] = useState(false)
  const [isGoblinTour, setIsGoblinTour] = useState(false)
  const [bookedCustomerCount, setBookedCustomerCount] = useState<number | null>(null)
  const [drivingSegments, setDrivingSegments] = useState<TourReportDrivingSegment[]>([])
  const [drivingSegmentsLoading, setDrivingSegmentsLoading] = useState(false)
  const [horseshoeBend, setHorseshoeBend] = useState<Record<string, HorseshoeBendActivity>>({})
  const [sunrisePointKey, setSunrisePointKey] = useState<SunrisePointKey | null>(null)
  const [sunriseActivity, setSunriseActivity] = useState<SunriseActivity | null>(null)
  const [drivingAssignment, setDrivingAssignment] = useState<Record<string, DrivingSeat>>({})
  const [partnerReports, setPartnerReports] = useState<PartnerDrivingReport[]>([])
  const [myDisplayName, setMyDisplayName] = useState('')
  const [assignedPartnerName, setAssignedPartnerName] = useState('')
  const [assignedPartnerEmail, setAssignedPartnerEmail] = useState('')
  const originalPartnerSelfIdsRef = useRef<string[]>([])
  const previousDrivingClaimsRef = useRef<DrivingClaim[]>([])
  const drivingHydratedKeyRef = useRef('')
  const [reportPace, setReportPace] = useState<TourReportPace>(() =>
    inferTourReportHasIssues(initialData) ? 'has_issues' : 'all_clear'
  )
  const signatureDataUrlRef = useRef('')
  const [signatureEmpty, setSignatureEmpty] = useState(true)

  const handleSignaturePadChange = useCallback((empty: boolean, dataUrl: string) => {
    signatureDataUrlRef.current = dataUrl
    setSignatureEmpty((prev) => (prev === empty ? prev : empty))
  }, [])

  const [formData, setFormData] = useState<TourReportData>({
    end_mileage: null,
    cash_balance: null,
    customer_count: null,
    booked_customer_count: null,
    weather: null,
    main_stops_visited: [],
    driving_segment_ids: [],
    skipped_stops: {},
    vehicle_condition_tags: [],
    vehicle_condition_note: '',
    issue_photo_urls: [],
    handoff_note: '',
    overall_mood: null,
    guest_comments: '',
    incidents_delays_health: [],
    lost_items_damage: [],
    suggestions_followup: '',
    communication: null,
    teamwork: null,
    comments: '',
    sign: '',
    office_note: '',
    narration_not_played: false,
    narration_explained_in_person: false,
    narration_skip_reason: '',
  })

  useEffect(() => {
    if (!initialData) return
    setFormData((prev) => ({
      ...prev,
      ...initialData,
      main_stops_visited: Array.isArray(initialData.main_stops_visited)
        ? initialData.main_stops_visited
        : prev.main_stops_visited,
      driving_segment_ids: Array.isArray(initialData.driving_segment_ids)
        ? initialData.driving_segment_ids
        : prev.driving_segment_ids,
      skipped_stops: parseSkippedStops(initialData.skipped_stops ?? prev.skipped_stops),
      vehicle_condition_tags: Array.isArray(initialData.vehicle_condition_tags)
        ? initialData.vehicle_condition_tags
        : prev.vehicle_condition_tags,
      vehicle_condition_note:
        initialData.vehicle_condition_note !== undefined
          ? initialData.vehicle_condition_note
          : prev.vehicle_condition_note,
      issue_photo_urls: parseIssuePhotoUrls(
        initialData.issue_photo_urls ?? prev.issue_photo_urls
      ),
      handoff_note:
        initialData.handoff_note !== undefined ? initialData.handoff_note : prev.handoff_note,
      incidents_delays_health: Array.isArray(initialData.incidents_delays_health)
        ? initialData.incidents_delays_health
        : prev.incidents_delays_health,
      lost_items_damage: Array.isArray(initialData.lost_items_damage)
        ? initialData.lost_items_damage
        : prev.lost_items_damage,
      ...parseNarrationSkip(initialData),
    }))
    const details = parseActivityDetails(
      (initialData as { activity_details?: unknown }).activity_details
    )
    setHorseshoeBend(details.horseshoeBend ?? {})
    setSunrisePointKey(details.sunrise?.pointKey ?? null)
    setSunriseActivity(details.sunrise?.activity ?? null)
    previousDrivingClaimsRef.current = details.drivingRoster?.claims ?? []
  }, [initialData, reportId, tourId])

  useEffect(() => {
    if (reportPace !== 'all_clear') return
    const noneLabel = tourReportNoLostItemsLabel(locale)
    setFormData((prev) => ({
      ...prev,
      vehicle_condition_tags: isCompanyVehicle ? ['ok'] : [],
      vehicle_condition_note: isCompanyVehicle ? '' : prev.vehicle_condition_note,
      incidents_delays_health: [],
      lost_items_damage: [noneLabel],
      overall_mood: prev.overall_mood || 'good',
    }))
  }, [reportPace, isCompanyVehicle, locale])

  useEffect(() => {
    if (forceMobileWizard !== undefined) {
      setUseMobileWizard(forceMobileWizard)
      return
    }
    const mq = window.matchMedia(MOBILE_BREAKPOINT)
    const apply = () => setUseMobileWizard(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [forceMobileWizard])

  useEffect(() => {
    setMobileStep(0)
  }, [tourId, reportPace])

  useEffect(() => {
    let cancelled = false
    async function loadTourContext() {
      try {
        const { data: tour, error } = await supabase
          .from('tours')
          .select('tour_car_id, reservation_ids, product_id')
          .eq('id', tourId)
          .maybeSingle()
        if (error) throw error

        const productId = (tour?.product_id as string | null) ?? productIdProp ?? null
        if (!cancelled) {
          setIsGoblinTour(isGoblinTourProduct(null, productId))
        }
        if (productId) {
          const { data: product } = await supabase
            .from('products')
            .select('id, name, name_ko, name_en')
            .eq('id', productId)
            .maybeSingle()
          if (!cancelled && product) {
            setIsGoblinTour(isGoblinTourProduct(product, productId))
          }
        }

        const carId = (tour?.tour_car_id as string | null) ?? null
        if (!carId) {
          if (!cancelled) {
            setIsRentalVehicle(false)
            setIsCompanyVehicle(false)
          }
        } else {
          const { data: vehicle, error: ve } = await supabase
            .from('vehicles')
            .select('vehicle_category')
            .eq('id', carId)
            .maybeSingle()
          if (ve) throw ve
          const category = String(vehicle?.vehicle_category ?? '').trim().toLowerCase()
          const rental = category === 'rental'
          if (!cancelled) {
            setIsRentalVehicle(rental)
            setIsCompanyVehicle(!rental)
          }
        }

        const ids = normalizeReservationIds(tour?.reservation_ids)
        if (ids.length === 0) {
          if (!cancelled) {
            setBookedCustomerCount(0)
            if (!reportId) {
              setFormData((prev) =>
                prev.customer_count == null ? { ...prev, customer_count: 0, booked_customer_count: 0 } : prev
              )
            }
          }
          return
        }

        const { data: reservations, error: re } = await supabase
          .from('reservations')
          .select('id, status, total_people, adults, child, infant')
          .in('id', ids)
        if (re) throw re

        let booked = 0
        let boardedDefault = 0
        for (const row of reservations || []) {
          const status = (row as { status?: string | null }).status
          if (
            isReservationCancelledStatus(status) ||
            isReservationDeletedStatus(status) ||
            reservationExcludedFromTourAssignment(status)
          ) {
            continue
          }
          const people = reservationPeopleCount(row)
          booked += people
          if (String(status || '').toLowerCase().trim() !== 'no_show') {
            boardedDefault += people
          }
        }

        if (cancelled) return
        setBookedCustomerCount(booked)
        if (!reportId) {
          setFormData((prev) => {
            if (prev.customer_count != null && prev.booked_customer_count != null) return prev
            return {
              ...prev,
              customer_count: prev.customer_count ?? boardedDefault,
              booked_customer_count: booked,
            }
          })
        }
      } catch (e) {
        console.error('Tour report vehicle/pax load error:', e)
        if (!cancelled) {
          setIsRentalVehicle(false)
          setIsCompanyVehicle(false)
        }
      }
    }
    void loadTourContext()
    return () => {
      cancelled = true
    }
  }, [tourId, reportId, productIdProp])

  useEffect(() => {
    let cancelled = false
    async function loadDrivingSegments() {
      setDrivingSegmentsLoading(true)
      try {
        const { data, error } = await supabase
          .from('tour_report_driving_segments')
          .select('id, label_ko, label_en, sort_order, is_active')
          .order('sort_order', { ascending: true })
        if (error) throw error
        if (!cancelled) setDrivingSegments((data ?? []) as TourReportDrivingSegment[])
      } catch (e) {
        console.error('Tour report driving segments load error:', e)
        if (!cancelled) setDrivingSegments([])
      } finally {
        if (!cancelled) setDrivingSegmentsLoading(false)
      }
    }
    void loadDrivingSegments()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadPartnerReports() {
      if (!tourId || !user?.email) {
        setPartnerReports([])
        setMyDisplayName('')
        return
      }
      try {
        const myEmail = normalizeTourReportEmail(user.email)
        const { data, error } = await supabase
          .from('tour_reports')
          .select('id, user_email, driving_segment_ids, activity_details, submitted_on, updated_at')
          .eq('tour_id', tourId)
        if (error) throw error
        const rows = (data ?? []) as Array<{
          id: string
          user_email: string
          driving_segment_ids: string[] | null
          activity_details: unknown
          submitted_on: string | null
          updated_at: string | null
        }>
        const emails = [...new Set(rows.map((row) => row.user_email).filter(Boolean))]
        if (!emails.includes(user.email)) emails.push(user.email)

        const { data: tourStaff } = await supabase
          .from('tours')
          .select('tour_guide_id, assistant_id')
          .eq('id', tourId)
          .maybeSingle()
        const assignedEmails = [tourStaff?.tour_guide_id, tourStaff?.assistant_id]
          .map((value) => normalizeTourReportEmail(String(value || '')))
          .filter(Boolean)
        for (const email of assignedEmails) {
          if (!emails.some((item) => normalizeTourReportEmail(item) === email)) emails.push(email)
        }
        const { data: teamRows } = emails.length
          ? await supabase.from('team').select('email, nick_name, name_ko, name_en').in('email', emails)
          : { data: [] as Array<{ email: string; nick_name: string | null; name_ko: string | null; name_en: string | null }> }
        const nameByEmail = new Map<string, string>()
        for (const member of teamRows ?? []) {
          const email = normalizeTourReportEmail(member.email)
          const name =
            String(member.nick_name || '').trim() ||
            String(member.name_ko || '').trim() ||
            String(member.name_en || '').trim()
          if (email && name) nameByEmail.set(email, name)
        }
        if (!cancelled) {
          setMyDisplayName(nameByEmail.get(myEmail) || user.email.split('@')[0] || getText('자신', 'Me'))
          const assignedPartnerEmail = assignedEmails.find((email) => email && email !== myEmail) || ''
          setAssignedPartnerEmail(assignedPartnerEmail)
          setAssignedPartnerName(
            assignedPartnerEmail
              ? nameByEmail.get(assignedPartnerEmail) || assignedPartnerEmail.split('@')[0] || getText('파트너', 'Partner')
              : ''
          )
          setPartnerReports(
            rows
              .filter((row) => {
                if (reportId && row.id === reportId) return false
                return normalizeTourReportEmail(row.user_email) !== myEmail
              })
              .map((row) => {
                const email = normalizeTourReportEmail(row.user_email)
                return {
                  id: row.id,
                  user_email: email,
                  userName: nameByEmail.get(email) || row.user_email.split('@')[0] || email,
                  driving_segment_ids: Array.isArray(row.driving_segment_ids) ? row.driving_segment_ids : [],
                  activity_details: parseActivityDetails(row.activity_details),
                  submitted_on: row.submitted_on,
                  updated_at: row.updated_at,
                } satisfies PartnerDrivingReport
              })
          )
        }
      } catch (e) {
        console.error('Tour report partner load error:', e)
        if (!cancelled) {
          setPartnerReports([])
          setAssignedPartnerEmail('')
          setAssignedPartnerName('')
        }
      }
    }
    void loadPartnerReports()
    return () => {
      cancelled = true
    }
  }, [tourId, reportId, user?.email, locale])

  useEffect(() => {
    drivingHydratedKeyRef.current = ''
  }, [tourId, reportId])

  useEffect(() => {
    if (drivingSegmentsLoading) return
    const scheduleIds = drivingSegments
      .filter((seg) => seg.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((seg) => seg.id)
    if (scheduleIds.length === 0) return
    const key = `${tourId}:${reportId || 'new'}:${scheduleIds.join(',')}:${partnerReports.map((row) => row.id).join(',')}`
    if (drivingHydratedKeyRef.current === key) return
    const details = parseActivityDetails(
      initialData ? (initialData as { activity_details?: unknown }).activity_details : {}
    )
    const partner = partnerReports[0]
    originalPartnerSelfIdsRef.current = partnerSelfSegmentIds(partner)
    setDrivingAssignment((prev) => {
      const next = details.drivingRoster
        ? assignmentFromRoster(
            scheduleIds,
            details.drivingRoster,
            Array.isArray(initialData?.driving_segment_ids)
              ? initialData.driving_segment_ids
              : formData.driving_segment_ids,
            details.drivingRoster.partnerSegmentIds
          )
        : flippedAssignmentFromPartner(scheduleIds, partner)
      if (!drivingHydratedKeyRef.current) return next
      for (const id of scheduleIds) {
        if (prev[id] === 'me') next[id] = 'me'
      }
      return next
    })
    drivingHydratedKeyRef.current = key
  }, [
    drivingSegments,
    drivingSegmentsLoading,
    partnerReports,
    tourId,
    reportId,
    initialData,
    formData.driving_segment_ids,
  ])

  useEffect(() => {
    let cancelled = false
    async function loadMainStops() {
      setMainStopsLoading(true)
      try {
        const tid = String(tourId ?? '').trim()
        if (!tid) {
          if (!cancelled) {
            setMainStopOptions([])
            setCourseById(new Map())
          }
          return
        }

        let pid: string | null =
          productIdProp != null && String(productIdProp).trim() !== ''
            ? String(productIdProp).trim()
            : null

        if (!pid) {
          const { data: tr, error: te } = await supabase
            .from('tours')
            .select('product_id')
            .eq('id', tid)
            .maybeSingle()
          if (te) throw te
          pid = (tr?.product_id as string | null) ?? null
        }

        // TEXT 투어 id 대소문자만 다른 경우 등 (ILIKE는 _ % 가 와일드카드라 해당 문자가 있으면 생략)
        if (!pid && !/[%_]/.test(tid)) {
          const { data: rows, error: te2 } = await supabase
            .from('tours')
            .select('product_id')
            .ilike('id', tid)
            .limit(2)
          if (te2) throw te2
          if (rows?.length === 1) {
            pid = (rows[0] as { product_id: string | null }).product_id ?? null
          }
        }

        if (pid != null && String(pid).trim() !== '') {
          pid = String(pid).trim()
        } else {
          pid = null
        }
        if (!pid) {
          if (!cancelled) {
            setMainStopOptions([])
            setCourseById(new Map())
          }
          return
        }

        const byId = new Map<string, CourseForMainStops>()
        const baseCourseSelect =
          'id, parent_id, name_ko, name_en, customer_name_ko, customer_name_en, category, category_id, path, sort_order'
        const embedCourseSelect = `${baseCourseSelect}, tour_course_categories(name_ko, name_en)`

        const mergeCourseRows = (rows: Record<string, unknown>[] | null | undefined) => {
          for (const row of rows || []) {
            byId.set(row.id as string, {
              ...row,
              tour_course_categories: (row as { tour_course_categories?: CourseForMainStops['tour_course_categories'] }).tour_course_categories ?? null,
            } as CourseForMainStops)
          }
        }

        const loadByIds = async (ids: string[]) => {
          if (ids.length === 0) return
          const expanded = expandManyDbKeyCandidates(ids)
          let { data, error } = await supabase.from('tour_courses').select(embedCourseSelect).in('id', expanded)
          if (error) {
            const r = await supabase.from('tour_courses').select(baseCourseSelect).in('id', expanded)
            if (r.error) throw error
            data = (r.data ?? []).map(row => ({
              ...row,
              tour_course_categories: null,
            }))
          }
          mergeCourseRows(data as Record<string, unknown>[])
        }

        let selectedIds: string[] = []

        // 1) product_tour_courses + embed(조인): 별도 tour_courses.in()과 다른 응답을 주는 경우 대비
        for (const cand of expandDbKeyCandidates(pid)) {
          let { data: ptcRows, error: eEmbed } = await supabase
            .from('product_tour_courses')
            .select(`tour_course_id, tour_courses(${embedCourseSelect})`)
            .eq('product_id', cand)
            .order('order', { ascending: true })
          if (eEmbed) {
            const r = await supabase
              .from('product_tour_courses')
              .select(`tour_course_id, tour_courses(${baseCourseSelect})`)
              .eq('product_id', cand)
              .order('order', { ascending: true })
            if (!r.error) {
              ptcRows = r.data as typeof ptcRows
              eEmbed = null
            }
          }
          if (eEmbed) throw eEmbed

          const ids: string[] = []
          for (const r of ptcRows || []) {
            const row = r as {
              tour_course_id: string
              tour_courses: CourseForMainStops | CourseForMainStops[] | null
            }
            ids.push(row.tour_course_id)
            const tc = row.tour_courses
            const course = Array.isArray(tc) ? tc[0] : tc
            if (course && typeof course === 'object' && course.id) {
              byId.set(course.id, {
                ...course,
                tour_course_categories: (course as CourseForMainStops).tour_course_categories ?? null,
              })
            }
          }
          selectedIds = [...new Set(ids)]
          if (selectedIds.length > 0) break
        }

        // 2) embed 없이 연결 id만
        if (selectedIds.length === 0) {
          for (const cand of expandDbKeyCandidates(pid)) {
            const { data: ptc, error: e1 } = await supabase
              .from('product_tour_courses')
              .select('tour_course_id')
              .eq('product_id', cand)
              .order('order', { ascending: true })
            if (e1) throw e1
            const ids = [...new Set((ptc || []).map((r: { tour_course_id: string }) => r.tour_course_id))]
            if (ids.length > 0) {
              selectedIds = ids
              break
            }
          }
        }

        // 3) product_tour_courses 없을 때 tour_courses.product_id
        if (selectedIds.length === 0) {
          for (const cand of expandDbKeyCandidates(pid)) {
            const { data: byProduct, error: eProd } = await supabase
              .from('tour_courses')
              .select('id')
              .eq('product_id', cand)
            if (eProd) throw eProd
            const ids = [...new Set((byProduct || []).map((r: { id: string }) => r.id))]
            if (ids.length > 0) {
              selectedIds = ids
              break
            }
          }
        }

        if (selectedIds.length === 0) {
          if (!cancelled) {
            setMainStopOptions([])
            setCourseById(new Map())
          }
          return
        }

        await loadByIds(selectedIds)

        // 4) 연결 id는 있는데 tour_courses 행이 안 붙은 경우: 해당 상품의 코스 전체(최후 보루)
        if (byId.size === 0) {
          for (const cand of expandDbKeyCandidates(pid)) {
            let { data: allRows, error: eAll } = await supabase
              .from('tour_courses')
              .select(embedCourseSelect)
              .eq('product_id', cand)
            if (eAll) {
              const r = await supabase.from('tour_courses').select(baseCourseSelect).eq('product_id', cand)
              if (r.error) throw eAll
              allRows = (r.data ?? []).map(row => ({ ...row, tour_course_categories: null }))
            }
            mergeCourseRows(allRows as Record<string, unknown>[])
            if (byId.size > 0) break
          }
        }

        let canonicalLinked = resolveCanonicalCourseIds(selectedIds, byId)
        if (canonicalLinked.length === 0 && byId.size > 0) {
          canonicalLinked = [...byId.keys()]
        }

        const pathExtras = new Set<string>()
        for (const id of canonicalLinked) {
          const r = byId.get(id)
          if (r?.path) {
            for (const seg of r.path.split('.').filter(Boolean)) {
              pathExtras.add(seg)
            }
          }
        }
        const missingPath = [...pathExtras].filter((id) => !byId.has(id))
        await loadByIds(missingPath)

        const canonicalSet = new Set(canonicalLinked.filter((id) => byId.has(id)))
        const hasDescendantInSelection = (id: string) => {
          const target = byId.get(id)
          if (!target?.path) return false
          for (const otherId of canonicalSet) {
            if (otherId === id) continue
            const other = byId.get(otherId)
            if (!other?.path) continue
            const segs = other.path.split('.').filter(Boolean)
            if (segs.includes(id)) return true
          }
          return false
        }
        const bfsSeeds = [...canonicalSet].filter((id) => !hasDescendantInSelection(id))
        const selectedScope = new Set<string>((bfsSeeds.length > 0 ? bfsSeeds : [...canonicalSet]).filter((id) => byId.has(id)))
        let frontier = [...selectedScope]
        let depth = 0
        const maxDescDepth = 24
        while (frontier.length > 0 && depth < maxDescDepth) {
          depth++
          const parentKeys = expandManyDbKeyCandidates(frontier)
          let { data: children, error: eDesc } = await supabase
            .from('tour_courses')
            .select(embedCourseSelect)
            .in('parent_id', parentKeys)
          if (eDesc) {
            const r = await supabase.from('tour_courses').select(baseCourseSelect).in('parent_id', parentKeys)
            if (r.error) throw eDesc
            children = (r.data ?? []).map(row => ({ ...row, tour_course_categories: null }))
          }
          const next: string[] = []
          for (const row of children || []) {
            if (!byId.has(row.id)) {
              byId.set(row.id, {
                ...row,
                tour_course_categories: (row as CourseForMainStops).tour_course_categories ?? null,
              })
              next.push(row.id)
            }
            selectedScope.add(row.id)
          }
          frontier = next
        }

        const siblingParents = new Set<string>()
        for (const id of selectedScope) {
          const c = byId.get(id)
          if (!c) continue
          if (!isTourPointCategory(c)) continue
          if (!hasChildInMap(c.id, byId) && c.parent_id) siblingParents.add(c.parent_id)
        }

        if (siblingParents.size > 0) {
          const parentKeys = expandManyDbKeyCandidates([...siblingParents])
          let { data: sibs, error: e2 } = await supabase
            .from('tour_courses')
            .select(embedCourseSelect)
            .in('parent_id', parentKeys)
          if (e2) {
            const r = await supabase.from('tour_courses').select(baseCourseSelect).in('parent_id', parentKeys)
            if (r.error) throw e2
            sibs = (r.data ?? []).map(row => ({ ...row, tour_course_categories: null }))
          }
          for (const row of sibs || []) {
            byId.set(row.id, {
              ...row,
              tour_course_categories: (row as CourseForMainStops).tour_course_categories ?? null,
            })
            if (row.parent_id && siblingParents.has(row.parent_id) && isTourPointCategory(row as CourseForMainStops)) {
              selectedScope.add(row.id)
            }
          }
        }

        let optionIds = buildMainStopCourseIds(selectedScope, byId)

        if (optionIds.length === 0) {
          const scopeRows = [...selectedScope].map((id) => byId.get(id)).filter(Boolean) as CourseForMainStops[]
          const tourPts = scopeRows.filter(isTourPointCategory).map((c) => c.id)
          if (tourPts.length > 0) {
            optionIds = tourPts
          } else {
            optionIds = scopeRows.filter((c) => !hasChildInMap(c.id, byId)).map((c) => c.id)
          }
        }
        const opts = optionIds
          .map((id) => {
            const course = byId.get(id)
            if (!course) return null
            return {
              id,
              course,
              sort_order: course.sort_order ?? 0,
            }
          })
          .filter((x): x is { id: string; course: CourseForMainStops; sort_order: number } => x !== null)
          .sort(
            (a, b) =>
              a.sort_order - b.sort_order ||
              displayCourseName(a.course, locale).localeCompare(displayCourseName(b.course, locale))
          )

        if (!cancelled) {
          setCourseById(byId)
          setMainStopOptions(opts)
        }
      } catch (e) {
        console.error('Tour report main stops load error:', e)
        if (!cancelled) {
          setMainStopOptions([])
          setCourseById(new Map())
          toast.error(
            locale === 'en' ? 'Could not load tour course stops.' : '투어 코스(방문지)를 불러오지 못했습니다.'
          )
        }
      } finally {
        if (!cancelled) setMainStopsLoading(false)
      }
    }

    loadMainStops()
    return () => {
      cancelled = true
    }
  }, [tourId, productIdProp, locale])

  useEffect(() => {
    if (mainStopOptions.length === 0) return
    const allowed = new Set(mainStopOptions.map((o) => o.id))
    setFormData((prev) => {
      const nextStops = prev.main_stops_visited.filter((id) => allowed.has(id))
      const nextSkipped: SkippedStopsMap = {}
      for (const [id, entry] of Object.entries(prev.skipped_stops)) {
        if (allowed.has(id) && !nextStops.includes(id)) nextSkipped[id] = entry
      }
      const stopsSame = nextStops.length === prev.main_stops_visited.length
      const skipSame = Object.keys(nextSkipped).length === Object.keys(prev.skipped_stops).length
      if (stopsSame && skipSame) return prev
      return { ...prev, main_stops_visited: nextStops, skipped_stops: nextSkipped }
    })
  }, [mainStopOptions])

  const totalSteps = reportPace === 'all_clear' ? 3 : 4
  const visibleStepTitles = reportPace === 'all_clear' ? t.stepTitlesAllClear : t.stepTitles

  const mobileStepVisible = (section: 0 | 1 | 2 | 3) => {
    if (!useMobileWizard) return true
    if (reportPace === 'all_clear') {
      if (section === 0) return mobileStep === 0
      if (section === 1) return mobileStep === 1
      if (section === 2) return false
      return mobileStep === 2
    }
    return mobileStep === section
  }

  /** 모달: 거의 풀블리드(안전영역만); 인라인: 기존 */
  const shellPad =
    variant === 'modal'
      ? 'px-0 pl-[max(0.5rem,env(safe-area-inset-left,0px))] pr-[max(0.5rem,env(safe-area-inset-right,0px))] sm:px-4 md:px-6'
      : 'px-2.5 sm:px-3 md:px-0'
  const blockY = 'space-y-5 md:space-y-6'
  /** 모달 위저드: 세로 간격 살짝 타이트 */
  const blockYModal = 'space-y-4 md:space-y-6'
  const fieldY = 'space-y-2'
  const labelMb = 'mb-2 md:mb-3'
  const chipGap = 'gap-2.5 md:gap-2'
  const gridBasic = 'gap-3 md:gap-4'

  const handleInputChange = (field: keyof TourReportData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleArrayChange = (field: keyof TourReportData, value: string, checked: boolean) => {
    setFormData((prev) => {
      const currentArray = prev[field] as string[]
      if (checked) {
        return {
          ...prev,
          [field]: [...currentArray, value],
        }
      } else {
        return {
          ...prev,
          [field]: currentArray.filter((item) => item !== value),
        }
      }
    })
  }

  const toggleMainStopVisited = (courseId: string, visited: boolean) => {
    setFormData((prev) => {
      if (visited) {
        const { [courseId]: _removed, ...restSkipped } = prev.skipped_stops
        return {
          ...prev,
          main_stops_visited: [...prev.main_stops_visited.filter((id) => id !== courseId), courseId],
          skipped_stops: restSkipped,
        }
      }
      return {
        ...prev,
        main_stops_visited: prev.main_stops_visited.filter((id) => id !== courseId),
      }
    })
    if (!visited) {
      setHorseshoeBend((prev) => {
        if (!(courseId in prev)) return prev
        const next = { ...prev }
        delete next[courseId]
        return next
      })
    }
  }

  const toggleVehicleCondition = (value: string) => {
    setFormData((prev) => {
      const has = prev.vehicle_condition_tags.includes(value)
      if (value === 'ok') {
        return { ...prev, vehicle_condition_tags: has ? [] : ['ok'] }
      }
      const withoutOk = prev.vehicle_condition_tags.filter((t) => t !== 'ok' && t !== value)
      return {
        ...prev,
        vehicle_condition_tags: has ? withoutOk : [...withoutOk, value],
      }
    })
  }

  const visibleDrivingSegments = useMemo(
    () =>
      drivingSegments
        .filter((seg) => seg.is_active || (drivingAssignment[seg.id] && drivingAssignment[seg.id] !== 'none'))
        .sort((a, b) => a.sort_order - b.sort_order),
    [drivingSegments, drivingAssignment]
  )

  const partnerSubmitted = partnerReports.length > 0
  const partnerName =
    partnerReports[0]?.userName || assignedPartnerName || t.fields.drivingPartner
  const partnerEmail = partnerReports[0]?.user_email || assignedPartnerEmail
  const suggestedMineIds = new Set(partnerAssignedToMeSegmentIds(partnerReports[0]))
  const drivingUnassignedIds = unassignedDrivingIds(
    visibleDrivingSegments.map((seg) => seg.id),
    drivingAssignment
  )
  const claimedDrivingIds = new Set(
    rosterFromAssignment(
      drivingAssignment,
      originalPartnerSelfIdsRef.current,
      partnerEmail,
      partnerName,
      previousDrivingClaimsRef.current
    ).claims.map((claim) => claim.segmentId)
  )

  const toggleDrivingSeat = (segmentId: string, seat: 'me' | 'partner') => {
    const current = drivingAssignment[segmentId] || 'none'
    if (current === seat) {
      setDrivingAssignment((prev) => ({ ...prev, [segmentId]: 'none' }))
      return
    }
    if (seat === 'me' && current === 'partner' && originalPartnerSelfIdsRef.current.includes(segmentId)) {
      const seg = drivingSegments.find((row) => row.id === segmentId)
      const label = seg ? displayDrivingSegmentLabel(seg, locale) : segmentId
      if (!window.confirm(t.messages.drivingClaimConfirm(partnerName, label))) return
    }
    setDrivingAssignment((prev) => ({ ...prev, [segmentId]: seat }))
  }

  const mainStopsIndented = useMemo(
    () => sortMainStopsIndented(courseById, mainStopOptions),
    [courseById, mainStopOptions]
  )

  const hasSignature = !signatureEmpty || Boolean(formData.sign?.trim())

  const submitReport = async () => {
    if (!user?.email) {
      toast.error(t.messages.loginRequired)
      return
    }

    setLoading(true)
    try {
      const drawn = signatureDataUrlRef.current.trim()
      const nextSign = drawn || formData.sign?.trim() || null
      if (!nextSign) {
        toast.error(t.messages.signatureRequired)
        return
      }
      if (reportPace === 'all_clear' && !formData.weather) {
        toast.error(t.messages.weatherRequired)
        if (useMobileWizard) setMobileStep(0)
        return
      }

      if (narrationSkipNeedsDetails(formData)) {
        toast.error(t.messages.narrationSkipRequired)
        if (useMobileWizard) setMobileStep(totalSteps - 1)
        return
      }

      if (isGoblinTour && !hasNarrationSkipExplanation(formData)) {
        const plays = await fetchTourNarrationPlays(tourId)
        if (plays.length === 0) {
          toast.error(t.messages.narrationRequired)
          if (useMobileWizard) setMobileStep(totalSteps - 1)
          return
        }
      }

      const horseshoeIds = mainStopOptions
        .filter((row) => isHorseshoeBendCourse(row.course))
        .map((row) => row.id)
      const visitedHorseshoe = horseshoeIds.filter((id) => formData.main_stops_visited.includes(id))
      if (visitedHorseshoe.some((id) => !horseshoeBend[id])) {
        toast.error(t.messages.horseshoeRequired)
        if (useMobileWizard) setMobileStep(1)
        return
      }

      if (isGoblinTour && (!sunrisePointKey || !sunriseActivity)) {
        toast.error(t.messages.sunriseRequired)
        if (useMobileWizard) setMobileStep(1)
        return
      }

      if (drivingUnassignedIds.length > 0) {
        toast.error(t.messages.drivingGapsRequired)
        if (useMobileWizard) setMobileStep(1)
        return
      }

      const drivingRoster = rosterFromAssignment(
        drivingAssignment,
        originalPartnerSelfIdsRef.current,
        partnerEmail,
        partnerName,
        previousDrivingClaimsRef.current
      )
      const activityDetails: TourReportActivityDetails = {
        horseshoeBend: Object.fromEntries(
          visitedHorseshoe
            .map((id) => [id, horseshoeBend[id]] as const)
            .filter((entry): entry is readonly [string, HorseshoeBendActivity] => Boolean(entry[1]))
        ),
        drivingRoster,
      }
      if (isGoblinTour && sunrisePointKey && sunriseActivity) {
        activityDetails.sunrise = {
          pointKey: sunrisePointKey,
          courseId: sunriseCourseIdForKey(
            sunrisePointKey,
            mainStopOptions.map((row) => row.course)
          ),
          activity: sunriseActivity,
        }
      }

      const narrationSkip = serializeNarrationSkip(formData)

      const payload = {
        end_mileage: isRentalVehicle ? null : formData.end_mileage,
        cash_balance: formData.cash_balance,
        customer_count: formData.customer_count,
        booked_customer_count: bookedCustomerCount ?? formData.booked_customer_count,
        weather: formData.weather,
        main_stops_visited: formData.main_stops_visited,
        driving_segment_ids: drivingRoster.selfSegmentIds,
        activity_details: activityDetails,
        skipped_stops: Object.fromEntries(
          Object.entries(formData.skipped_stops).filter(
            ([id]) => !formData.main_stops_visited.includes(id)
          )
        ),
        main_stop_substitutions: skippedStopsToSubstitutionNotes(
          Object.fromEntries(
            Object.entries(formData.skipped_stops).filter(
              ([id]) => !formData.main_stops_visited.includes(id)
            )
          ),
          locale
        ),
        vehicle_condition_tags: isCompanyVehicle ? formData.vehicle_condition_tags : [],
        vehicle_condition_note: isCompanyVehicle
          ? formData.vehicle_condition_note?.trim() || null
          : null,
        issue_photo_urls: formData.issue_photo_urls,
        handoff_note: formData.handoff_note?.trim() || null,
        activities_completed: [],
        overall_mood: formData.overall_mood,
        guest_comments: formData.guest_comments,
        incidents_delays_health: formData.incidents_delays_health,
        lost_items_damage: formData.lost_items_damage,
        suggestions_followup: formData.suggestions_followup,
        communication: formData.communication,
        teamwork: formData.teamwork,
        comments: formData.comments,
        sign: nextSign,
        office_note: formData.office_note,
        ...narrationSkip,
      }

      const { error } = reportId
        ? await supabase.from('tour_reports').update(payload as never).eq('id', reportId)
        : await supabase.from('tour_reports').insert({
            tour_id: tourId,
            user_email: user.email,
            ...payload,
          } as never)

      if (error) throw error

      toast.success(t.messages.reportSubmitted)
      onSuccess?.()
    } catch (error) {
      console.error('Error submitting tour report:', error)
      toast.error(t.messages.submitError)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await submitReport()
  }

  return (
    <div
      className={cn(
        variant === 'modal' && useMobileWizard
          ? 'mx-0 w-full max-w-none py-0'
          : 'mx-auto max-w-4xl py-2 md:py-4',
        useMobileWizard && 'flex min-h-0 flex-col',
        useMobileWizard && variant === 'modal' && 'h-full min-h-0 flex-1',
        useMobileWizard &&
          variant === 'inline' &&
          '[min-height:min(70vh,520px)] lg:min-h-0'
      )}
    >
      <Card
        className={cn(
          useMobileWizard &&
            'flex min-h-0 flex-1 flex-col border-0 shadow-none sm:border sm:shadow-sm'
        )}
      >
        <CardHeader
          className={cn(
            'px-2.5 py-4 sm:px-3 md:px-6 md:py-6',
            useMobileWizard ? 'hidden shrink-0 lg:block' : 'shrink-0'
          )}
        >
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            <FileText className="w-5 h-5" />
            {t.title}
          </CardTitle>
        </CardHeader>
        <CardContent
          className={cn(
            variant === 'modal' && useMobileWizard ? 'px-0 py-2' : 'px-0 py-3 md:px-6 md:py-6',
            useMobileWizard && 'flex min-h-0 flex-1 flex-col lg:max-h-none lg:min-h-0'
          )}
        >
          <form
            onSubmit={handleSubmit}
            className={cn(
              useMobileWizard && variant === 'modal' ? blockYModal : blockY,
              shellPad,
              useMobileWizard && 'flex min-h-0 flex-1 flex-col pb-1'
            )}
          >
            {useMobileWizard && (
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 pb-3">
                <p className="text-sm font-medium leading-snug text-gray-900">
                  {visibleStepTitles[mobileStep]}
                </p>
                <span className="shrink-0 text-xs tabular-nums text-gray-500">
                  {t.buttons.stepOf(mobileStep + 1, totalSteps)}
                </span>
              </div>
            )}
            <div
              className={cn(
                useMobileWizard && variant === 'modal' ? blockYModal : blockY,
                useMobileWizard &&
                  'min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain'
              )}
            >
            <div className={cn(useMobileWizard && mobileStep !== 0 && 'hidden')}>
              <TourReportPaceToggle
                value={reportPace}
                onChange={setReportPace}
                locale={locale}
              />
            </div>

            {/* Step 0 — 기본 정보 */}
            <div className={cn(!mobileStepVisible(0) && 'hidden', blockY)}>
            <div className={cn('grid grid-cols-1', isRentalVehicle ? 'md:grid-cols-2' : 'md:grid-cols-3', gridBasic)}>
              {!isRentalVehicle && (
              <div className={fieldY}>
                <Label htmlFor="end_mileage" className={cn('flex items-center gap-2', labelMb)}>
                  <MapPin className="h-4 w-4 shrink-0" />
                  {t.fields.endMileage}
                </Label>
                <Input
                  id="end_mileage"
                  type="number"
                  value={formData.end_mileage || ''}
                  onChange={(e) => handleInputChange('end_mileage', parseInt(e.target.value) || null)}
                  placeholder={t.placeholders.endMileage}
                  className="h-11 md:h-10"
                />
              </div>
              )}
              <div className={fieldY}>
                <Label htmlFor="cash_balance" className={cn('flex items-center gap-2', labelMb)}>
                  <DollarSign className="h-4 w-4 shrink-0" />
                  {t.fields.cashBalance}
                </Label>
                <Input
                  id="cash_balance"
                  type="number"
                  step="0.01"
                  value={formData.cash_balance || ''}
                  onChange={(e) => handleInputChange('cash_balance', parseFloat(e.target.value) || null)}
                  placeholder={t.placeholders.cashBalance}
                  className="h-11 md:h-10"
                />
              </div>
              <div className={fieldY}>
                <Label htmlFor="customer_count" className={cn('flex items-center gap-2', labelMb)}>
                  <Users className="h-4 w-4 shrink-0" />
                  {t.fields.customerCount}
                </Label>
                <TourReportNumberStepper
                  id="customer_count"
                  value={formData.customer_count}
                  onChange={(value) => handleInputChange('customer_count', value)}
                  placeholder={t.placeholders.customerCount}
                  increaseLabel={getText('탑승 인원 증가', 'Increase guests on board')}
                  decreaseLabel={getText('탑승 인원 감소', 'Decrease guests on board')}
                />
                {bookedCustomerCount != null && (
                  <p className="text-xs text-muted-foreground">
                    {t.fields.customerCountBooked(
                      bookedCustomerCount,
                      Math.max(0, bookedCustomerCount - (formData.customer_count ?? bookedCustomerCount))
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* 날씨 */}
            <div className={fieldY}>
              <Label className={cn('flex items-center gap-2', labelMb)}>
                <Cloud className="h-4 w-4 shrink-0" />
                {t.fields.weather}
              </Label>
              <div className={cn('grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6', chipGap)}>
                {WEATHER_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={formData.weather === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleInputChange('weather', option.value)}
                    className="flex min-h-[42px] items-center gap-1.5 px-2 text-xs md:min-h-0 md:text-sm"
                  >
                    <span className="text-base">{option.icon}</span>
                    <span className="truncate">{locale === 'en' ? option.en : option.ko}</span>
                  </Button>
                ))}
              </div>
            </div>
            {isCompanyVehicle && reportPace === 'all_clear' && (
              <p className="text-sm text-muted-foreground">{t.fields.allClearVehicle}</p>
            )}
            {isCompanyVehicle && reportPace === 'has_issues' && (
              <div className={fieldY}>
                <Label className={cn('flex items-center gap-2', labelMb)}>
                  <Wrench className="h-4 w-4 shrink-0" />
                  {t.fields.vehicleCondition}
                </Label>
                <p className="text-sm text-muted-foreground">{t.fields.vehicleConditionHint}</p>
                <div className={cn('grid grid-cols-2 md:grid-cols-3', chipGap)}>
                  {VEHICLE_CONDITION_OPTIONS.map((option) => {
                    const selected = formData.vehicle_condition_tags.includes(option.value)
                    return (
                      <Button
                        key={option.value}
                        type="button"
                        variant={selected ? (option.value === 'ok' ? 'default' : 'destructive') : 'outline'}
                        size="sm"
                        onClick={() => toggleVehicleCondition(option.value)}
                        className="flex min-h-[42px] items-center justify-start px-2 text-xs md:min-h-0 md:text-sm"
                      >
                        {locale === 'en' ? option.en : option.ko}
                      </Button>
                    )
                  })}
                </div>
                <Textarea
                  id="vehicle_condition_note"
                  value={formData.vehicle_condition_note || ''}
                  onChange={(e) => handleInputChange('vehicle_condition_note', e.target.value)}
                  placeholder={t.placeholders.vehicleConditionNote}
                  rows={2}
                  className="min-h-[72px] resize-y md:min-h-0"
                />
              </div>
            )}
            </div>

            {/* Step 1 — 방문·활동·분위기 */}
            <div className={cn(!mobileStepVisible(1) && 'hidden', blockY)}>
            <div className={fieldY}>
              <Label className={cn('flex items-center gap-2', labelMb)}>
                <MapPin className="h-4 w-4 shrink-0" />
                {t.fields.mainStopsVisited}
              </Label>
              <p className="text-sm text-muted-foreground">{t.fields.mainStopsHint}</p>
              {reportPace === 'all_clear' && mainStopOptions.length > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11 w-full rounded-xl sm:w-auto"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      main_stops_visited: mainStopOptions.map((o) => o.id),
                      skipped_stops: {},
                    }))
                  }
                >
                  {t.fields.markAllStops}
                </Button>
              )}
              {mainStopsLoading ? (
                <p className="text-sm text-gray-500">{t.fields.mainStopsLoading}</p>
              ) : mainStopOptions.length === 0 ? (
                <p className="text-sm text-amber-700">{t.fields.mainStopsFromCourseEmpty}</p>
              ) : (
                <div
                  className={cn(
                    'rounded-lg border border-gray-200 bg-gray-50/60',
                    variant === 'modal' ? 'px-1 py-2' : 'px-2 py-2'
                  )}
                >
                  {mainStopsIndented.map(({ id, course, depth }) => {
                    const visited = formData.main_stops_visited.includes(id)
                    const label = displayCourseName(course, locale)
                    const indentPx = Math.min(depth, 12) * 14
                    const horseshoe = isHorseshoeBendCourse(course)
                    const horseshoeIcon = (value: HorseshoeBendActivity) => {
                      if (value === 'hiking') return Footprints
                      if (value === 'parking_wait') return CircleParking
                      return ClipboardCheck
                    }
                    return (
                      <div
                        key={id}
                        className="border-b border-gray-100/90 last:border-b-0"
                        style={{ paddingLeft: indentPx }}
                      >
                        <Button
                          type="button"
                          variant={visited ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleMainStopVisited(id, !visited)}
                          className="my-1 flex min-h-[42px] w-full max-w-full items-center justify-start gap-2 px-2 text-xs md:min-h-[38px] md:text-sm"
                        >
                          <span
                            className={cn(
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded border-2',
                              visited ? 'border-primary bg-blue-600' : 'border-gray-300'
                            )}
                          >
                            {visited && (
                              <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </span>
                          <span className="whitespace-normal text-left font-medium leading-snug">{label}</span>
                        </Button>
                        {horseshoe && visited ? (
                          <div className="mb-2 ml-6 space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground">{t.fields.horseshoeOptions}</p>
                            <div className="grid gap-1.5">
                              {HORSESHOE_BEND_ACTIVITIES.map((option) => {
                                const selected = horseshoeBend[id] === option.value
                                const Icon = horseshoeIcon(option.value)
                                return (
                                  <Button
                                    key={option.value}
                                    type="button"
                                    variant={selected ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() =>
                                      setHorseshoeBend((prev) => ({ ...prev, [id]: option.value }))
                                    }
                                    className="h-auto min-h-[40px] justify-start gap-2 whitespace-normal px-2 py-2 text-left text-xs"
                                  >
                                    <Icon className="h-3.5 w-3.5 shrink-0" />
                                    {locale === 'en' ? option.en : option.ko}
                                  </Button>
                                )
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
              {formData.main_stops_visited.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {formData.main_stops_visited.map((stopId) => {
                    const c = courseById.get(stopId)
                    const displayText = c ? displayCourseName(c, locale) : stopId
                    const horseshoeLabel = horseshoeBend[stopId]
                      ? locale === 'en'
                        ? HORSESHOE_BEND_ACTIVITIES.find((item) => item.value === horseshoeBend[stopId])?.en
                        : HORSESHOE_BEND_ACTIVITIES.find((item) => item.value === horseshoeBend[stopId])?.ko
                      : null
                    return (
                      <Badge key={stopId} variant="secondary">
                        {displayText}
                        {horseshoeLabel ? ` · ${horseshoeLabel}` : ''}
                      </Badge>
                    )
                  })}
                </div>
              )}
            </div>

            {mainStopOptions.length > 0 && (
              <div className={cn(fieldY, 'pt-1')}>
                <Label className={cn('flex items-center gap-2', labelMb)}>
                  <SkipForward className="h-4 w-4 shrink-0" />
                  {t.fields.skippedStops}
                </Label>
                <TourReportSkippedStops
                  locale={locale}
                  stops={mainStopsIndented.map(({ id, course, depth }) => ({
                    id,
                    label: displayCourseName(course, locale),
                    depth,
                  }))}
                  visitedIds={formData.main_stops_visited}
                  skipped={formData.skipped_stops}
                  onChange={(next) => handleInputChange('skipped_stops', next)}
                />
              </div>
            )}

            {isGoblinTour && (
              <div className={cn(fieldY, 'pt-1')}>
                <Label className={cn('flex items-center gap-2', labelMb)}>
                  <Sunrise className="h-4 w-4 shrink-0" />
                  {t.fields.sunriseTitle}
                </Label>
                <p className="text-sm text-muted-foreground">{t.fields.sunriseHint}</p>
                <div className="grid grid-cols-2 gap-2">
                  {SUNRISE_POINTS.map((point) => {
                    const selected = sunrisePointKey === point.key
                    return (
                      <Button
                        key={point.key}
                        type="button"
                        variant={selected ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setSunrisePointKey(point.key)
                          const option = mainStopOptions.find(
                            (row) => sunrisePointKeyFromCourse(row.course) === point.key
                          )
                          if (option) toggleMainStopVisited(option.id, true)
                        }}
                        className="h-auto min-h-[42px] whitespace-normal px-2 py-2 text-xs"
                      >
                        {locale === 'en' ? point.en : point.ko}
                      </Button>
                    )
                  })}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SUNRISE_ACTIVITIES.map((option) => {
                    const selected = sunriseActivity === option.value
                    return (
                      <Button
                        key={option.value}
                        type="button"
                        variant={selected ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSunriseActivity(option.value)}
                        className="h-auto min-h-[42px] justify-start gap-2 whitespace-normal px-2 py-2 text-left text-xs"
                      >
                        {option.value === 'photography' ? (
                          <Camera className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <Car className="h-3.5 w-3.5 shrink-0" />
                        )}
                        {locale === 'en' ? option.en : option.ko}
                      </Button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className={cn(fieldY, 'pt-1')}>
              <Label className={cn('flex items-center gap-2', labelMb)}>
                <Car className="h-4 w-4 shrink-0" />
                {t.fields.driving}
              </Label>
              <TourReportDrivingRoster
                locale={locale}
                segments={visibleDrivingSegments}
                loading={drivingSegmentsLoading}
                myName={myDisplayName || t.fields.drivingMe}
                partnerName={partnerName}
                partnerSubmitted={partnerSubmitted}
                suggestedMineIds={suggestedMineIds}
                assignment={drivingAssignment}
                claimedIds={claimedDrivingIds}
                unassignedIds={drivingUnassignedIds}
                onToggle={toggleDrivingSeat}
              />
            </div>

            {/* 전체적인 분위기 */}
            {reportPace === 'has_issues' && (
            <div className={cn(fieldY, 'pt-1')}>
              <Label className={cn('flex items-center gap-2', labelMb)}>
                <Star className="h-4 w-4 shrink-0" />
                {t.fields.overallMood}
              </Label>
              <div className={cn('grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5', chipGap)}>
                {MOOD_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={formData.overall_mood === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleInputChange('overall_mood', option.value)}
                    className="flex min-h-[42px] items-center gap-1.5 px-2 text-xs md:min-h-0 md:text-sm"
                  >
                    <span className="text-base">{option.icon}</span>
                    <span className="truncate">{locale === 'en' ? option.en : option.ko}</span>
                  </Button>
                ))}
              </div>
            </div>
            )}
            </div>

            {/* Step 2 — 고객·이슈 */}
            <div className={cn((!mobileStepVisible(2) || reportPace === 'all_clear') && 'hidden', blockY)}>
            <div className={fieldY}>
              <Label htmlFor="guest_comments" className={cn('flex items-center gap-2', labelMb)}>
                <MessageSquare className="h-4 w-4 shrink-0" />
                {t.fields.guestComments}
              </Label>
              <Textarea
                id="guest_comments"
                value={formData.guest_comments || ''}
                onChange={(e) => handleInputChange('guest_comments', e.target.value)}
                placeholder={t.placeholders.guestComments}
                rows={3}
                className="min-h-[100px] resize-y md:min-h-0"
              />
            </div>

            {/* 사고/지연/건강 문제 */}
            <div className={cn(fieldY, 'pt-1')}>
              <Label className={cn('flex items-center gap-2', labelMb)}>
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {t.fields.incidentsDelaysHealth}
              </Label>
              <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3', chipGap)}>
                {INCIDENTS_OPTIONS.map((incident) => {
                  const displayText = locale === 'en' ? incident.en : incident.ko
                  const keyText = locale === 'en' ? incident.en : incident.ko
                  return (
                    <Button
                      key={keyText}
                      type="button"
                      variant={formData.incidents_delays_health.includes(keyText) ? "destructive" : "outline"}
                      size="sm"
                      onClick={() => handleArrayChange('incidents_delays_health', keyText, !formData.incidents_delays_health.includes(keyText))}
                      className="flex min-h-[44px] items-center justify-start gap-2 px-2 text-xs md:min-h-0 md:text-sm"
                    >
                      <span className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        formData.incidents_delays_health.includes(keyText) 
                          ? 'bg-red-600 border-red-600' 
                          : 'border-gray-300'
                      }`}>
                        {formData.incidents_delays_health.includes(keyText) && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                      <span className="truncate">{displayText}</span>
                    </Button>
                  )
                })}
              </div>
              {formData.incidents_delays_health.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {formData.incidents_delays_health.map((incident) => {
                    // 선택된 값이 한국어인지 영어인지 확인하고 적절한 표시 텍스트 찾기
                    const option = INCIDENTS_OPTIONS.find(opt => opt.ko === incident || opt.en === incident)
                    const displayText = option ? (locale === 'en' ? option.en : option.ko) : incident
                    return (
                      <Badge key={incident} variant="destructive">
                        {displayText}
                      </Badge>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 분실물/손상 */}
            <div className={cn(fieldY, 'pt-1')}>
              <Label className={cn('flex items-center gap-2', labelMb)}>
                <Package className="h-4 w-4 shrink-0" />
                {t.fields.lostItemsDamage}
              </Label>
              <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3', chipGap)}>
                {LOST_DAMAGE_OPTIONS.map((item) => {
                  const displayText = locale === 'en' ? item.en : item.ko
                  const keyText = locale === 'en' ? item.en : item.ko
                  return (
                    <Button
                      key={keyText}
                      type="button"
                      variant={formData.lost_items_damage.includes(keyText) ? "destructive" : "outline"}
                      size="sm"
                      onClick={() => handleArrayChange('lost_items_damage', keyText, !formData.lost_items_damage.includes(keyText))}
                      className="flex min-h-[44px] items-center justify-start gap-2 px-2 text-xs md:min-h-0 md:text-sm"
                    >
                      <span className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        formData.lost_items_damage.includes(keyText) 
                          ? 'bg-red-600 border-red-600' 
                          : 'border-gray-300'
                      }`}>
                        {formData.lost_items_damage.includes(keyText) && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                      <span className="truncate">{displayText}</span>
                    </Button>
                  )
                })}
              </div>
              {formData.lost_items_damage.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {formData.lost_items_damage.map((item) => {
                    // 선택된 값이 한국어인지 영어인지 확인하고 적절한 표시 텍스트 찾기
                    const option = LOST_DAMAGE_OPTIONS.find(opt => opt.ko === item || opt.en === item)
                    const displayText = option ? (locale === 'en' ? option.en : option.ko) : item
                    return (
                      <Badge key={item} variant="outline">
                        {displayText}
                      </Badge>
                    )
                  })}
                </div>
              )}
            </div>

            <div className={cn(fieldY, 'pt-1')}>
              <Label className={cn('flex items-center gap-2', labelMb)}>
                <Camera className="h-4 w-4 shrink-0" />
                {t.fields.issuePhotos}
              </Label>
              <TourReportIssuePhotos
                tourId={tourId}
                urls={formData.issue_photo_urls}
                onChange={(urls) => handleInputChange('issue_photo_urls', urls)}
                locale={locale}
              />
            </div>
            </div>

            {/* Step 3 — 평가·메모·제출 */}
            <div className={cn(blockY, !mobileStepVisible(3) && 'hidden')}>
              {reportPace === 'has_issues' && (
              <>
              <div className={fieldY}>
              <Label htmlFor="suggestions_followup" className={cn('flex items-center gap-2', labelMb)}>
                <Lightbulb className="h-4 w-4 shrink-0" />
                {t.fields.suggestionsFollowup}
              </Label>
              <Textarea
                id="suggestions_followup"
                value={formData.suggestions_followup || ''}
                onChange={(e) => handleInputChange('suggestions_followup', e.target.value)}
                placeholder={t.placeholders.suggestionsFollowup}
                rows={3}
                className="min-h-[88px] resize-y md:min-h-0"
              />
              </div>

            {/* 커뮤니케이션 */}
            <div className={cn(fieldY, 'pt-1')}>
              <Label className={cn('flex items-center gap-2', labelMb)}>
                <MessageCircle className="h-4 w-4 shrink-0" />
                {t.fields.communication}
              </Label>
              <div className={cn('grid grid-cols-2 md:grid-cols-4', chipGap)}>
                {RATING_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={formData.communication === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleInputChange('communication', option.value)}
                    className="flex min-h-[42px] items-center gap-1.5 px-1.5 text-xs md:min-h-0 md:text-sm"
                  >
                    <span className="text-base">{option.icon}</span>
                    <span className="truncate">{locale === 'en' ? option.en : option.ko}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* 팀워크 */}
            <div className={cn(fieldY, 'pt-1')}>
              <Label className={cn('flex items-center gap-2', labelMb)}>
                <Handshake className="h-4 w-4 shrink-0" />
                {t.fields.teamwork}
              </Label>
              <div className={cn('grid grid-cols-2 md:grid-cols-4', chipGap)}>
                {RATING_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={formData.teamwork === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleInputChange('teamwork', option.value)}
                    className="flex min-h-[42px] items-center gap-1.5 px-1.5 text-xs md:min-h-0 md:text-sm"
                  >
                    <span className="text-base">{option.icon}</span>
                    <span className="truncate">{locale === 'en' ? option.en : option.ko}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* 기타 코멘트 */}
            <div className={cn(fieldY, 'pt-1')}>
              <Label htmlFor="comments" className={cn('flex items-center gap-2', labelMb)}>
                <MessageSquare className="h-4 w-4 shrink-0" />
                {t.fields.comments}
              </Label>
              <Textarea
                id="comments"
                value={formData.comments || ''}
                onChange={(e) => handleInputChange('comments', e.target.value)}
                placeholder={t.placeholders.comments}
                rows={3}
                className="min-h-[100px] resize-y md:min-h-0"
              />
            </div>

            <div className={cn(fieldY, 'pt-1')}>
              <Label htmlFor="handoff_note" className={cn('flex items-center gap-2', labelMb)}>
                <NotebookPen className="h-4 w-4 shrink-0" />
                {t.fields.handoffNote}
              </Label>
              <Textarea
                id="handoff_note"
                value={formData.handoff_note || ''}
                onChange={(e) => handleInputChange('handoff_note', e.target.value)}
                placeholder={t.placeholders.handoffNote}
                rows={3}
                className="min-h-[88px] resize-y md:min-h-0"
              />
            </div>
              </>
              )}

            <TourReportNarrationSection
              tourId={tourId}
              locale={locale}
              notPlayed={formData.narration_not_played}
              explainedInPerson={formData.narration_explained_in_person}
              skipReason={formData.narration_skip_reason || ''}
              onNotPlayedChange={(value) => {
                setFormData((prev) => ({
                  ...prev,
                  narration_not_played: value,
                  narration_explained_in_person: value ? prev.narration_explained_in_person : false,
                }))
              }}
              onExplainedChange={(value) => {
                setFormData((prev) => ({
                  ...prev,
                  narration_explained_in_person: value,
                  narration_not_played: value ? true : prev.narration_not_played,
                }))
              }}
              onReasonChange={(value) => handleInputChange('narration_skip_reason', value)}
            />

            {/* 서명 */}
            <div className={cn(fieldY, 'pt-1')}>
              {formData.sign?.trim() && signatureEmpty ? (
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <PenLine className="h-4 w-4 shrink-0" />
                    {t.fields.signExisting}
                  </p>
                  {isTourReportSignatureImage(formData.sign) ? (
                    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={formData.sign}
                        alt={t.fields.signExisting}
                        className="h-[120px] w-full object-contain object-left bg-white"
                      />
                    </div>
                  ) : (
                    <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                      {formData.sign}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">{t.fields.signReplaceHint}</p>
                </div>
              ) : null}
              <WaiverSignaturePad
                label={t.fields.sign}
                hint={t.fields.signHint}
                clearLabel={t.fields.signClear}
                undoLabel={t.fields.signUndo}
                onChange={handleSignaturePadChange}
              />
            </div>
            </div>

            </div>

            {/* 데스크톱: 제출 */}
            <div
              className={cn(
                'flex shrink-0 flex-col gap-3 pt-2 sm:flex-row md:pt-4',
                useMobileWizard && 'hidden'
              )}
            >
              <Button
                type="submit"
                disabled={loading || !hasSignature}
                className="flex-1 h-12 text-base font-semibold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-blue-200/80 ring-2 ring-ring/30 focus-visible:ring-blue-400"
              >
                {loading ? getText('제출 중...', 'Submitting...') : t.buttons.submit}
              </Button>
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  className="flex-1 sm:flex-none h-12 text-base"
                >
                  {t.buttons.cancel}
                </Button>
              )}
            </div>

            {/* 모바일 위저드: 진행 + 이전/다음/제출 — 모달에서는 mt-auto로 시트 하단에 고정 */}
            {useMobileWizard && (
              <div
                className={cn(
                  'shrink-0 space-y-3 border-t border-gray-200 bg-white pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]',
                  variant === 'modal' ? 'mt-auto' : 'mt-3'
                )}
              >
                <div className="flex justify-center gap-2" role="tablist" aria-label={getText('진행 상태', 'Progress')}>
                  {Array.from({ length: totalSteps }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-current={mobileStep === i ? 'step' : undefined}
                      onClick={() => setMobileStep(i)}
                      className={cn(
                        'h-2 rounded-full transition-all',
                        mobileStep === i ? 'w-6 bg-blue-600' : 'w-2 bg-gray-200'
                      )}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 h-11 gap-1"
                    disabled={mobileStep <= 0}
                    onClick={() => setMobileStep((s) => Math.max(0, s - 1))}
                  >
                    <ChevronLeft className="w-4 h-4 shrink-0" />
                    {t.buttons.prev}
                  </Button>
                  {mobileStep < totalSteps - 1 ? (
                    <Button
                      type="button"
                      className="flex-1 h-11 gap-1"
                      onClick={() => setMobileStep((s) => Math.min(totalSteps - 1, s + 1))}
                    >
                      {t.buttons.next}
                      <ChevronRight className="w-4 h-4 shrink-0" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      disabled={loading || !hasSignature}
                      className="flex-1 h-11 font-semibold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-blue-200/80 ring-2 ring-ring/30 focus-visible:ring-blue-400"
                      onClick={submitReport}
                    >
                      {loading ? getText('제출 중...', 'Submitting...') : t.buttons.submit}
                    </Button>
                  )}
                </div>
                {onCancel && mobileStep === totalSteps - 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full h-10 text-gray-600"
                    onClick={onCancel}
                  >
                    {t.buttons.cancel}
                  </Button>
                )}
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
