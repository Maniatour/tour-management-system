'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { MapPin, Users, DollarSign, Cloud, Star, MessageSquare, AlertTriangle, Package, Lightbulb, MessageCircle, Handshake, FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
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
  weather: string | null
  main_stops_visited: string[]
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
      customerCount: getText('고객 수', 'Customer Count'),
      weather: getText('날씨', 'Weather'),
      mainStopsVisited: getText('주요 방문지', 'Main Stops Visited'),
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
      officeNote: getText('사무실 메모', 'Office Note')
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
      getText('방문·분위기', 'Stops & mood'),
      getText('고객·이슈', 'Guest & issues'),
      getText('평가·메모·제출', 'Ratings & submit')
    ],
    messages: {
      reportSubmitted: getText('리포트가 성공적으로 제출되었습니다.', 'Report submitted successfully.'),
      submitError: getText('리포트 제출 중 오류가 발생했습니다.', 'Error submitting report.'),
      loginRequired: getText('로그인이 필요합니다.', 'Login required.')
    },
    placeholders: {
      endMileage: getText('종료 주행거리를 입력하세요', 'Enter end mileage'),
      cashBalance: getText('현금 잔액을 입력하세요', 'Enter cash balance'),
      customerCount: getText('고객 수를 입력하세요', 'Enter customer count'),
      guestComments: getText('고객의 코멘트를 입력하세요', 'Enter guest comments'),
      suggestionsFollowup: getText('제안사항이나 후속조치를 입력하세요', 'Enter suggestions or follow-up actions'),
      comments: getText('추가 코멘트를 입력하세요', 'Enter additional comments'),
      sign: getText('서명을 입력하세요', 'Enter signature'),
      officeNote: getText('사무실 메모를 입력하세요', 'Enter office note')
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

  const [formData, setFormData] = useState<TourReportData>({
    end_mileage: null,
    cash_balance: null,
    customer_count: null,
    weather: null,
    main_stops_visited: [],
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
  })

  useEffect(() => {
    if (!initialData) return
    setFormData((prev) => ({
      ...prev,
      ...initialData,
      main_stops_visited: Array.isArray(initialData.main_stops_visited)
        ? initialData.main_stops_visited
        : prev.main_stops_visited,
      incidents_delays_health: Array.isArray(initialData.incidents_delays_health)
        ? initialData.incidents_delays_health
        : prev.incidents_delays_health,
      lost_items_damage: Array.isArray(initialData.lost_items_damage)
        ? initialData.lost_items_damage
        : prev.lost_items_damage,
    }))
  }, [initialData, reportId, tourId])

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
  }, [tourId])

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
            byId.set(row.id as string, row as CourseForMainStops)
          }
        }

        const loadByIds = async (ids: string[]) => {
          if (ids.length === 0) return
          const expanded = expandManyDbKeyCandidates(ids)
          let { data, error } = await supabase.from('tour_courses').select(embedCourseSelect).in('id', expanded)
          if (error) {
            const r = await supabase.from('tour_courses').select(baseCourseSelect).in('id', expanded)
            if (r.error) throw error
            data = r.data
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
              ptcRows = r.data
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
              byId.set(course.id, course)
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
              allRows = r.data
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
            children = r.data
          }
          const next: string[] = []
          for (const row of children || []) {
            if (!byId.has(row.id)) {
              byId.set(row.id, row as CourseForMainStops)
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
            sibs = r.data
          }
          for (const row of sibs || []) {
            byId.set(row.id, row as CourseForMainStops)
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
      if (nextStops.length === prev.main_stops_visited.length) return prev
      return { ...prev, main_stops_visited: nextStops }
    })
  }, [mainStopOptions])

  const totalSteps = 4

  const mobileStepVisible = (index: number) =>
    !useMobileWizard || mobileStep === index

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
        return {
          ...prev,
          main_stops_visited: [...prev.main_stops_visited.filter((id) => id !== courseId), courseId],
        }
      }
      return {
        ...prev,
        main_stops_visited: prev.main_stops_visited.filter((id) => id !== courseId),
      }
    })
  }

  const mainStopsIndented = useMemo(
    () => sortMainStopsIndented(courseById, mainStopOptions),
    [courseById, mainStopOptions]
  )

  const submitReport = async () => {
    if (!user?.email) {
      toast.error(t.messages.loginRequired)
      return
    }

    setLoading(true)
    try {
      const payload = {
        end_mileage: formData.end_mileage,
        cash_balance: formData.cash_balance,
        customer_count: formData.customer_count,
        weather: formData.weather,
        main_stops_visited: formData.main_stops_visited,
        main_stop_substitutions: {},
        activities_completed: [],
        overall_mood: formData.overall_mood,
        guest_comments: formData.guest_comments,
        incidents_delays_health: formData.incidents_delays_health,
        lost_items_damage: formData.lost_items_damage,
        suggestions_followup: formData.suggestions_followup,
        communication: formData.communication,
        teamwork: formData.teamwork,
        comments: formData.comments,
        sign: formData.sign,
        office_note: formData.office_note,
      }

      const { error } = reportId
        ? await supabase.from('tour_reports').update(payload).eq('id', reportId)
        : await supabase.from('tour_reports').insert({
            tour_id: tourId,
            user_email: user.email,
            ...payload,
          })

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
                  {t.stepTitles[mobileStep]}
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
            {/* Step 0 — 기본 정보 */}
            <div className={cn(!mobileStepVisible(0) && 'hidden', blockY)}>
            <div className={cn('grid grid-cols-1 md:grid-cols-3', gridBasic)}>
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
                <Input
                  id="customer_count"
                  type="number"
                  value={formData.customer_count || ''}
                  onChange={(e) => handleInputChange('customer_count', parseInt(e.target.value) || null)}
                  placeholder={t.placeholders.customerCount}
                  className="h-11 md:h-10"
                />
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
            </div>

            {/* Step 1 — 방문·활동·분위기 */}
            <div className={cn(!mobileStepVisible(1) && 'hidden', blockY)}>
            <div className={fieldY}>
              <Label className={cn('flex items-center gap-2', labelMb)}>
                <MapPin className="h-4 w-4 shrink-0" />
                {t.fields.mainStopsVisited}
              </Label>
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
                              visited ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
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
                    return (
                      <Badge key={stopId} variant="secondary">
                        {displayText}
                      </Badge>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 전체적인 분위기 */}
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
            </div>

            {/* Step 2 — 고객·이슈 */}
            <div className={cn(!mobileStepVisible(2) && 'hidden', blockY)}>
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
            </div>

            {/* Step 3 — 평가·메모·제출 */}
            <div className={cn(blockY, !mobileStepVisible(3) && 'hidden')}>
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

            {/* 서명 */}
            <div className={cn(fieldY, 'pt-1')}>
              <Label htmlFor="sign" className={cn('flex items-center gap-2', labelMb)}>
                <FileText className="h-4 w-4 shrink-0" />
                {t.fields.sign}
              </Label>
              <Input
                id="sign"
                value={formData.sign || ''}
                onChange={(e) => handleInputChange('sign', e.target.value)}
                placeholder={t.placeholders.sign}
                className="h-11 md:h-10"
              />
            </div>

            {/* 사무실 메모 */}
            <div className={cn(fieldY, 'pt-1')}>
              <Label htmlFor="office_note" className={cn('flex items-center gap-2', labelMb)}>
                <FileText className="h-4 w-4 shrink-0" />
                {t.fields.officeNote}
              </Label>
              <Textarea
                id="office_note"
                value={formData.office_note || ''}
                onChange={(e) => handleInputChange('office_note', e.target.value)}
                placeholder={t.placeholders.officeNote}
                rows={2}
                className="min-h-[80px] resize-y md:min-h-0"
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
                disabled={loading}
                className="flex-1 h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200/80 ring-2 ring-blue-200 focus-visible:ring-blue-400"
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
                      disabled={loading}
                      className="flex-1 h-11 font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200/80 ring-2 ring-blue-200 focus-visible:ring-blue-400"
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
