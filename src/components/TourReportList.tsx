import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  FileText, 
  Search, 
  Filter, 
  MapPin, 
  Users, 
  DollarSign, 
  Cloud, 
  Star, 
  MessageCircle, 
  Handshake,
  Edit,
  Trash2,
  Car,
  Wrench,
  Camera,
  NotebookPen,
  SkipForward,
  PenLine,
} from 'lucide-react'
import TourNarrationPlayLog from '@/components/tour/TourNarrationPlayLog'
import { toast } from 'sonner'
import { displayCourseName, type CourseForMainStops } from '@/lib/tourReportMainStops'
import {
  displayDrivingSegmentLabel,
  type TourReportDrivingSegment,
} from '@/lib/tourReportDrivingSegments'
import {
  displaySkipReasonLabel,
  displayVehicleConditionLabel,
  isTourReportSignatureImage,
  parseIssuePhotoUrls,
  parseSkippedStops,
} from '@/lib/tourReportExtras'
import { narrationSkipSummary } from '@/lib/tourReportNarration'

const LOST_DAMAGE_OPTIONS = [
  { ko: '분실물 없음', en: 'No Lost Items' },
  { ko: '가방 분실', en: 'Bag Lost' },
  { ko: '휴대폰 분실', en: 'Phone Lost' },
  { ko: '카메라 분실', en: 'Camera Lost' },
  { ko: '차량 손상', en: 'Vehicle Damage' },
  { ko: '시설 손상', en: 'Facility Damage' },
  { ko: '기타 손상', en: 'Other Damage' }
]

interface TourReport {
  id: string
  tour_id: string
  end_mileage: number | null
  cash_balance: number | null
  customer_count: number | null
  booked_customer_count?: number | null
  weather: string | null
  main_stops_visited: string[]
  driving_segment_ids?: string[] | null
  skipped_stops?: unknown
  vehicle_condition_tags?: string[] | null
  vehicle_condition_note?: string | null
  issue_photo_urls?: string[] | null
  handoff_note?: string | null
  main_stop_substitutions?: Record<string, string> | null
  overall_mood: string | null
  guest_comments: string | null
  incidents_delays_health: string[]
  lost_items_damage: string[]
  suggestions_followup: string | null
  communication: string | null
  teamwork: string | null
  comments: string | null
  submitted_on: string
  user_email: string
  sign: string | null
  office_note: string | null
  narration_not_played?: boolean | null
  narration_explained_in_person?: boolean | null
  narration_skip_reason?: string | null
  created_at: string
  updated_at: string
  tours?: {
    id: string
    tour_date: string
    tour_status: string | null
    products?: {
      name_ko: string
      name_en: string
    }
  }
}

interface TourReportListProps {
  tourId?: string
  showTourInfo?: boolean
  onEdit?: (report: TourReport) => void
  onDelete?: (reportId: string) => void
  locale?: string
  highlightReportId?: string | null
}

const WEATHER_LABELS = {
  sunny: { label: '맑음', icon: '☀️' },
  cloudy: { label: '흐림', icon: '☁️' },
  rainy: { label: '비', icon: '🌧️' },
  snowy: { label: '눈', icon: '❄️' },
  windy: { label: '바람', icon: '💨' },
  foggy: { label: '안개', icon: '🌫️' }
}

const MOOD_LABELS = {
  excellent: { label: '매우 좋음', icon: '😊' },
  good: { label: '좋음', icon: '🙂' },
  average: { label: '보통', icon: '😐' },
  poor: { label: '나쁨', icon: '😞' },
  terrible: { label: '매우 나쁨', icon: '😢' }
}

const RATING_LABELS = {
  excellent: { label: '매우 좋음', icon: '⭐⭐⭐' },
  good: { label: '좋음', icon: '⭐⭐' },
  average: { label: '보통', icon: '⭐' },
  poor: { label: '나쁨', icon: '👎' }
}

export default function TourReportList({ 
  tourId, 
  showTourInfo = true, 
  onEdit, 
  onDelete,
  locale = 'ko',
  highlightReportId = null,
}: TourReportListProps) {
  const { user } = useAuth()
  const [reports, setReports] = useState<TourReport[]>([])
  const [stopCourseById] = useState<Map<string, CourseForMainStops>>(new Map())
  const [drivingById, setDrivingById] = useState<Map<string, TourReportDrivingSegment>>(new Map())
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [weatherFilter, setWeatherFilter] = useState<string>('all')
  const [moodFilter, setMoodFilter] = useState<string>('all')

  useEffect(() => {
    fetchReports()
    void fetchDrivingSegments()
  }, [tourId, user])

  const fetchDrivingSegments = async () => {
    try {
      const { data, error } = await supabase
        .from('tour_report_driving_segments')
        .select('id, label_ko, label_en, sort_order, is_active')
      if (error) throw error
      const map = new Map<string, TourReportDrivingSegment>()
      for (const row of (data ?? []) as TourReportDrivingSegment[]) {
        map.set(row.id, row)
      }
      setDrivingById(map)
    } catch (e) {
      console.error('Error fetching driving segments:', e)
    }
  }

  const fetchReports = async () => {
    if (!user?.email) return

    setLoading(true)
    try {
      let query = supabase
        .from('tour_reports')
        .select(`
          *,
          tours (
            id,
            tour_date,
            tour_status,
            products (
              name_ko,
              name_en
            )
          )
        `)
        .order('submitted_on', { ascending: false })

      if (tourId) {
        query = query.eq('tour_id', tourId)
      }

      const { data, error } = await query

      if (error) throw error
      setReports((data ?? []) as TourReport[])
    } catch (error) {
      console.error('Error fetching tour reports:', error)
      toast.error('리포트를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (reportId: string) => {
    if (!confirm('정말로 이 리포트를 삭제하시겠습니까?')) return

    try {
      const { error } = await supabase
        .from('tour_reports')
        .delete()
        .eq('id', reportId)

      if (error) throw error

      toast.success('리포트가 삭제되었습니다.')
      fetchReports()
      onDelete?.(reportId)
    } catch (error) {
      console.error('Error deleting tour report:', error)
      const msg =
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message?: unknown }).message === 'string'
          ? (error as { message: string }).message
          : ''
      if (msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('permission')) {
        toast.error('삭제 권한이 없거나 삭제 가능 기간(투어 다음날까지)이 지났습니다.')
      } else {
        toast.error('리포트 삭제 중 오류가 발생했습니다.')
      }
    }
  }

  const shouldShowFilters = !tourId
  const filteredReports = shouldShowFilters
    ? reports.filter(report => {
        const matchesSearch = searchTerm === '' || 
          report.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          report.tours?.products?.name_ko?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          report.tours?.products?.name_en?.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesWeather = weatherFilter === 'all' || report.weather === weatherFilter
        const matchesMood = moodFilter === 'all' || report.overall_mood === moodFilter

        return matchesSearch && matchesWeather && matchesMood
      })
    : reports

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>리포트를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 필터 및 검색 (전체 리포트 화면에서만 표시) */}
      {shouldShowFilters && (
        <Card>
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <FileText className="w-5 h-5" />
              투어 리포트 목록
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">검색</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input type="search"
                    placeholder="이메일, 상품명으로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">날씨</label>
                <Select value={weatherFilter} onValueChange={setWeatherFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="날씨 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {Object.entries(WEATHER_LABELS).map(([value, { label, icon }]) => (
                      <SelectItem key={value} value={value}>
                        {icon} {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">분위기</label>
                <Select value={moodFilter} onValueChange={setMoodFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="분위기 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {Object.entries(MOOD_LABELS).map(([value, { label, icon }]) => (
                      <SelectItem key={value} value={value}>
                        {icon} {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={fetchReports} variant="outline" className="w-full h-10">
                  <Filter className="w-4 h-4 mr-2" />
                  새로고침
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 리포트 목록 */}
      <div className="space-y-4">
        {filteredReports.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">리포트가 없습니다.</p>
            </CardContent>
          </Card>
        ) : (
          filteredReports.map((report) => (
            <Card
              key={report.id}
              id={`tour-report-card-${report.id}`}
              className={`transition-shadow hover:shadow-md ${
                highlightReportId === report.id ? 'ring-2 ring-amber-500' : ''
              }`}
            >
              <CardHeader className="p-4 md:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <CardTitle className="text-base md:text-lg">
                      {showTourInfo && report.tours?.products ? (
                        `${report.tours.products.name_ko} (${report.tours.products.name_en})`
                      ) : (
                        `투어 리포트 #${report.id.slice(-8)}`
                      )}
                    </CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      {report.user_email} • {formatDate(report.submitted_on)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {onEdit && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEdit(report)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(report.id)}
                        className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                  {report.end_mileage && (
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-md">
                      <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="text-sm">마일리지: {report.end_mileage.toLocaleString()}</span>
                    </div>
                  )}
                  {report.cash_balance !== null && (
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-md">
                      <DollarSign className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="text-sm">잔액: ${report.cash_balance.toFixed(2)}</span>
                    </div>
                  )}
                  {report.customer_count != null && (
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-md">
                      <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="text-sm">
                        {locale === 'en' ? 'On board' : '탑승'}: {report.customer_count}명
                        {report.booked_customer_count != null
                          ? locale === 'en'
                            ? ` / booked ${report.booked_customer_count}`
                            : ` / 예약 ${report.booked_customer_count}`
                          : ''}
                      </span>
                    </div>
                  )}
                  {report.weather && (
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-md">
                      <Cloud className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="text-sm">
                        {WEATHER_LABELS[report.weather as keyof typeof WEATHER_LABELS]?.icon} 
                        {WEATHER_LABELS[report.weather as keyof typeof WEATHER_LABELS]?.label}
                      </span>
                    </div>
                  )}
                </div>

                {(() => {
                  const tags = Array.isArray(report.vehicle_condition_tags)
                    ? report.vehicle_condition_tags.filter(Boolean)
                    : []
                  const note = report.vehicle_condition_note?.trim()
                  if (tags.length === 0 && !note) return null
                  const hasIssue = tags.some((tag) => tag !== 'ok')
                  return (
                    <div className="mb-4">
                      <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
                        <Wrench className="h-4 w-4 text-gray-500" />
                        {locale === 'en' ? 'Vehicle condition:' : '차량 상태:'}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant={tag === 'ok' ? 'secondary' : 'destructive'}
                            className="text-xs"
                          >
                            {displayVehicleConditionLabel(tag, locale)}
                          </Badge>
                        ))}
                      </div>
                      {note && (
                        <p
                          className={`mt-2 text-sm rounded px-2 py-1 ${
                            hasIssue ? 'bg-red-50 text-red-800' : 'bg-gray-50 text-gray-700'
                          }`}
                        >
                          {note}
                        </p>
                      )}
                    </div>
                  )
                })()}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {report.overall_mood && (
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-gray-500" />
                      <span className="text-sm">
                        분위기: {MOOD_LABELS[report.overall_mood as keyof typeof MOOD_LABELS]?.icon} 
                        {MOOD_LABELS[report.overall_mood as keyof typeof MOOD_LABELS]?.label}
                      </span>
                    </div>
                  )}
                  {report.communication && (
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-gray-500" />
                      <span className="text-sm">
                        커뮤니케이션: {RATING_LABELS[report.communication as keyof typeof RATING_LABELS]?.icon}
                        {RATING_LABELS[report.communication as keyof typeof RATING_LABELS]?.label}
                      </span>
                    </div>
                  )}
                  {report.teamwork && (
                    <div className="flex items-center gap-2">
                      <Handshake className="w-4 h-4 text-gray-500" />
                      <span className="text-sm">
                        팀워크: {RATING_LABELS[report.teamwork as keyof typeof RATING_LABELS]?.icon}
                        {RATING_LABELS[report.teamwork as keyof typeof RATING_LABELS]?.label}
                      </span>
                    </div>
                  )}
                </div>

                {/* 주요 정류장 */}
                {report.main_stops_visited.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">주요 정류장:</p>
                    <div className="flex flex-wrap gap-1">
                      {report.main_stops_visited.map((stop) => {
                        const c = stopCourseById.get(stop)
                        const label = c ? displayCourseName(c, locale) : stop
                        return (
                          <Badge key={stop} variant="secondary" className="text-xs">
                            {label}
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                )}

                {Array.isArray(report.driving_segment_ids) && report.driving_segment_ids.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
                      <Car className="h-4 w-4 text-gray-500" />
                      {locale === 'en' ? 'Driving:' : 'Driving:'}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {report.driving_segment_ids.map((segId) => {
                        const seg = drivingById.get(segId)
                        const label = seg ? displayDrivingSegmentLabel(seg, locale) : segId
                        return (
                          <Badge key={segId} variant="outline" className="text-xs">
                            {label}
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                )}

                <TourNarrationPlayLog tourId={report.tour_id} locale={locale} />
                {(() => {
                  const skip = narrationSkipSummary(report, locale)
                  if (!skip) return null
                  return (
                    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2">
                      <p className="text-sm font-medium text-amber-900">{skip.title}</p>
                      {skip.detail ? (
                        <p className="mt-1 text-sm text-amber-900/80">{skip.detail}</p>
                      ) : null}
                    </div>
                  )
                })()}

                {(() => {
                  const skipped = parseSkippedStops(report.skipped_stops)
                  const skippedIds = Object.keys(skipped)
                  if (skippedIds.length === 0) return null
                  return (
                    <div className="mb-4">
                      <p className="text-sm font-medium mb-2 flex items-center gap-1.5 text-amber-800">
                        <SkipForward className="h-4 w-4" />
                        {locale === 'en' ? 'Skipped stops:' : '스킵한 포인트:'}
                      </p>
                      <ul className="space-y-1 text-sm text-gray-700">
                        {skippedIds.map((cid) => {
                          const entry = skipped[cid]
                          const c = stopCourseById.get(cid)
                          const point = c ? displayCourseName(c, locale) : cid
                          const reason = entry.reason
                            ? displaySkipReasonLabel(entry.reason, locale)
                            : ''
                          const note = entry.note.trim()
                          const detail = [reason, note].filter(Boolean).join(' — ')
                          return (
                            <li key={cid} className="rounded bg-amber-50/80 px-2 py-1">
                              <span className="font-medium">{point}</span>
                              {detail ? `: ${detail}` : ''}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )
                })()}

                {(() => {
                  const skipped = parseSkippedStops(report.skipped_stops)
                  if (Object.keys(skipped).length > 0) return null
                  if (!report.main_stop_substitutions) return null
                  if (Object.keys(report.main_stop_substitutions).length === 0) return null
                  return (
                    <div className="mb-4">
                      <p className="text-sm font-medium mb-2 text-amber-800">
                        {locale === 'en' ? 'Alternative stops / notes:' : '대체 방문·메모:'}
                      </p>
                      <ul className="space-y-1 text-sm text-gray-700">
                        {Object.entries(report.main_stop_substitutions).map(([cid, note]) => {
                          if (!note?.trim()) return null
                          const c = stopCourseById.get(cid)
                          const point = c ? displayCourseName(c, locale) : cid
                          return (
                            <li key={cid} className="rounded bg-amber-50/80 px-2 py-1">
                              <span className="font-medium">{point}</span>: {note}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )
                })()}

                {/* 문제사항 */}
                {report.incidents_delays_health.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2 text-red-600">문제사항:</p>
                    <div className="flex flex-wrap gap-1">
                      {report.incidents_delays_health.map((incident) => (
                        <Badge key={incident} variant="destructive" className="text-xs">
                          {incident}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* 분실물/손상 */}
                {report.lost_items_damage.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2 text-orange-600">{locale === 'en' ? 'Lost Items/Damage:' : '분실물/손상:'}</p>
                    <div className="flex flex-wrap gap-1">
                      {report.lost_items_damage.map((item) => {
                        // 선택된 값이 한국어인지 영어인지 확인하고 적절한 표시 텍스트 찾기
                        const option = LOST_DAMAGE_OPTIONS.find(opt => opt.ko === item || opt.en === item)
                        const displayText = option ? (locale === 'en' ? option.en : option.ko) : item
                        return (
                          <Badge key={item} variant="outline" className="text-xs text-orange-600">
                            {displayText}
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                )}

                {(() => {
                  const photos = parseIssuePhotoUrls(report.issue_photo_urls)
                  if (photos.length === 0) return null
                  return (
                    <div className="mb-4">
                      <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
                        <Camera className="h-4 w-4 text-gray-500" />
                        {locale === 'en' ? 'Issue photos:' : '이슈 사진:'}
                      </p>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {photos.map((url) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="relative aspect-square overflow-hidden rounded-lg border bg-muted"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={locale === 'en' ? 'Issue photo' : '이슈 사진'}
                              className="h-full w-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* 코멘트들 */}
                <div className="space-y-2">
                  {report.guest_comments && (
                    <div>
                      <p className="text-sm font-medium text-primary mb-1">고객 코멘트:</p>
                      <p className="text-sm text-gray-700 bg-primary/5 p-2 rounded">{report.guest_comments}</p>
                    </div>
                  )}
                  {report.suggestions_followup && (
                    <div>
                      <p className="text-sm font-medium text-green-600 mb-1">제안사항:</p>
                      <p className="text-sm text-gray-700 bg-green-50 p-2 rounded">{report.suggestions_followup}</p>
                    </div>
                  )}
                  {report.comments && (
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">기타 코멘트:</p>
                      <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{report.comments}</p>
                    </div>
                  )}
                  {report.handoff_note?.trim() && (
                    <div>
                      <p className="text-sm font-medium text-amber-800 mb-1 flex items-center gap-1.5">
                        <NotebookPen className="h-4 w-4" />
                        {locale === 'en' ? 'Handoff for next team:' : '다음 팀 인수인계:'}
                      </p>
                      <p className="text-sm text-gray-800 bg-amber-50 p-2 rounded border border-amber-200/80">
                        {report.handoff_note}
                      </p>
                    </div>
                  )}
                  {report.office_note && (
                    <div>
                      <p className="text-sm font-medium text-purple-600 mb-1">사무실 메모:</p>
                      <p className="text-sm text-gray-700 bg-purple-50 p-2 rounded">{report.office_note}</p>
                    </div>
                  )}
                  {report.sign?.trim() ? (
                    <div>
                      <p className="text-sm font-medium mb-1 flex items-center gap-1.5">
                        <PenLine className="h-4 w-4 text-gray-500" />
                        {locale === 'en' ? 'Signature:' : '서명:'}
                      </p>
                      {isTourReportSignatureImage(report.sign) ? (
                        <div className="overflow-hidden rounded-xl border border-border bg-white">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={report.sign}
                            alt={locale === 'en' ? 'Guide signature' : '가이드 서명'}
                            className="h-[100px] w-full max-w-md object-contain object-left bg-white"
                          />
                        </div>
                      ) : (
                        <p className="text-sm text-gray-800 bg-gray-50 p-2 rounded">{report.sign}</p>
                      )}
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
