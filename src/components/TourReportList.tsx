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
  User,
  DollarSign, 
  Cloud, 
  Star, 
  MessageCircle, 
  Handshake,
  Edit,
  Trash2,
  Car,
  Clock,
  Sunrise,
  Wrench,
  Camera,
  NotebookPen,
  SkipForward,
  PenLine,
} from 'lucide-react'
import TourNarrationPlayLog from '@/components/tour/TourNarrationPlayLog'
import { toast } from 'sonner'
import {
  displayMainStopLabel,
  expandManyDbKeyCandidates,
  isOpaqueRecordId,
  type CourseForMainStops,
} from '@/lib/tourReportMainStops'
import {
  displayDrivingSegmentLabel,
  formatApproxDrivingDuration,
  sumApproxDrivingMinutes,
  type TourReportDrivingSegment,
} from '@/lib/tourReportDrivingSegments'
import {
  displayHorseshoeBendActivity,
  displaySunriseActivity,
  displaySunrisePoint,
  parseActivityDetails,
} from '@/lib/tourReportActivityDetails'
import { normalizeTourReportEmail } from '@/lib/tourReportMissing'
import { teamMemberNameForLocale } from '@/lib/teamMemberDisplayName'
import {
  displayIncidentLabel,
  displayLostDamageLabel,
  displayMoodOption,
  displayRatingOption,
  displaySkipReasonLabel,
  displayVehicleConditionLabel,
  displayWeatherOption,
  isTourReportSignatureImage,
  parseIssuePhotoUrls,
  parseSkippedStops,
  tourReportText,
  TOUR_REPORT_MOOD_OPTIONS,
  TOUR_REPORT_WEATHER_OPTIONS,
} from '@/lib/tourReportExtras'
import { narrationSkipSummary } from '@/lib/tourReportNarration'

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
  activity_details?: unknown
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

export default function TourReportList({ 
  tourId, 
  showTourInfo = true, 
  onEdit, 
  onDelete,
  locale = 'ko',
  highlightReportId = null,
}: TourReportListProps) {
  const { user } = useAuth()
  const getText = (ko: string, en: string) => tourReportText(locale, ko, en)
  const [reports, setReports] = useState<TourReport[]>([])
  const [stopCourseById, setStopCourseById] = useState<Map<string, CourseForMainStops>>(new Map())
  const [guideNameByEmail, setGuideNameByEmail] = useState<Map<string, string>>(new Map())
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
      const rows = (data ?? []) as TourReport[]
      setReports(rows)
      void loadStopCourses(rows)
      void loadGuideNames(rows)
    } catch (error) {
      console.error('Error fetching tour reports:', error)
      toast.error(getText('리포트를 불러오는 중 오류가 발생했습니다.', 'Could not load reports.'))
    } finally {
      setLoading(false)
    }
  }

  const loadStopCourses = async (rows: TourReport[]) => {
    const ids = [
      ...new Set(
        rows.flatMap((report) => [
          ...(Array.isArray(report.main_stops_visited) ? report.main_stops_visited : []),
          ...Object.keys(parseSkippedStops(report.skipped_stops)),
          ...Object.keys(report.main_stop_substitutions || {}),
        ])
      ),
    ].filter(Boolean)
    if (ids.length === 0) {
      setStopCourseById(new Map())
      return
    }
    try {
      const expanded = expandManyDbKeyCandidates(ids).filter((id) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      )
      if (expanded.length === 0) {
        setStopCourseById(new Map())
        return
      }
      const { data, error } = await supabase
        .from('tour_courses')
        .select(
          'id, parent_id, name_ko, name_en, customer_name_ko, customer_name_en, category, category_id, path, sort_order'
        )
        .in('id', expanded)
      if (error) throw error
      const map = new Map<string, CourseForMainStops>()
      for (const row of (data ?? []) as CourseForMainStops[]) {
        map.set(row.id, row)
      }
      setStopCourseById(map)
    } catch (e) {
      console.error('Error fetching tour report stop names:', e)
    }
  }

  const loadGuideNames = async (rows: TourReport[]) => {
    const emails = [...new Set(rows.map((report) => report.user_email?.trim()).filter(Boolean))]
    if (emails.length === 0) {
      setGuideNameByEmail(new Map())
      return
    }
    try {
      const { data, error } = await supabase
        .from('team')
        .select('email, name_ko, name_en, nick_name')
        .in('email', emails)
      if (error) throw error
      const map = new Map<string, string>()
      for (const row of data ?? []) {
        const email = String(row.email || '').trim().toLowerCase()
        const name = teamMemberNameForLocale(row, locale)
        if (!email || !name || isOpaqueRecordId(name)) continue
        map.set(email, name)
      }
      setGuideNameByEmail(map)
    } catch (e) {
      console.error('Error fetching tour report guide names:', e)
    }
  }

  const handleDelete = async (reportId: string) => {
    if (!confirm(getText('정말로 이 리포트를 삭제하시겠습니까?', 'Delete this report?'))) return

    try {
      const { error } = await supabase
        .from('tour_reports')
        .delete()
        .eq('id', reportId)

      if (error) throw error

      toast.success(getText('리포트가 삭제되었습니다.', 'Report deleted.'))
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
        toast.error(
          getText(
            '삭제 권한이 없거나 삭제 가능 기간(투어 다음날까지)이 지났습니다.',
            'You cannot delete this report, or the edit window (until the day after the tour) has passed.'
          )
        )
      } else {
        toast.error(getText('리포트 삭제 중 오류가 발생했습니다.', 'Could not delete the report.'))
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
    return new Date(dateString).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
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
          <p>{getText('리포트를 불러오는 중...', 'Loading reports...')}</p>
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
              {getText('투어 리포트 목록', 'Tour Reports')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">{getText('검색', 'Search')}</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input type="search"
                    placeholder={getText('이메일, 상품명으로 검색...', 'Search by email or product...')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{getText('날씨', 'Weather')}</label>
                <Select value={weatherFilter} onValueChange={setWeatherFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder={getText('날씨 선택', 'Select weather')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{getText('전체', 'All')}</SelectItem>
                    {TOUR_REPORT_WEATHER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.icon} {getText(option.ko, option.en)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{getText('분위기', 'Mood')}</label>
                <Select value={moodFilter} onValueChange={setMoodFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder={getText('분위기 선택', 'Select mood')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{getText('전체', 'All')}</SelectItem>
                    {TOUR_REPORT_MOOD_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.icon} {getText(option.ko, option.en)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={fetchReports} variant="outline" className="w-full h-10">
                  <Filter className="w-4 h-4 mr-2" />
                  {getText('새로고침', 'Refresh')}
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
              <p className="text-gray-500">{getText('리포트가 없습니다.', 'No reports.')}</p>
            </CardContent>
          </Card>
        ) : (
          filteredReports.map((report) => {
            const guideName = guideNameByEmail.get(report.user_email.trim().toLowerCase())
            const details = parseActivityDetails(report.activity_details)
            const visibleStops = (report.main_stops_visited || [])
              .map((stop) => ({ stop, label: displayMainStopLabel(stop, stopCourseById, locale) }))
              .filter((item): item is { stop: string; label: string } => Boolean(item.label))
            const drivingIds = Array.isArray(report.driving_segment_ids)
              ? report.driving_segment_ids
              : []
            const approxDrivingMinutes = sumApproxDrivingMinutes(drivingIds, drivingById)
            const myEmail = normalizeTourReportEmail(report.user_email)
            const claimedFromMe = filteredReports
              .filter((other) => other.tour_id === report.tour_id && other.id !== report.id)
              .flatMap((other) => parseActivityDetails(other.activity_details).drivingRoster?.claims ?? [])
              .filter((claim) => claim.fromEmail === myEmail)
            const weather = displayWeatherOption(report.weather, locale)
            const mood = displayMoodOption(report.overall_mood, locale)
            const communication = displayRatingOption(report.communication, locale)
            const teamwork = displayRatingOption(report.teamwork, locale)
            return (
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
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base md:text-lg">
                        {showTourInfo && report.tours?.products ? (
                          getText(
                            `${report.tours.products.name_ko} (${report.tours.products.name_en})`,
                            report.tours.products.name_en || report.tours.products.name_ko
                          )
                        ) : (
                          getText('투어 리포트', 'Tour Report')
                        )}
                      </CardTitle>
                      {guideName ? (
                        <Badge variant="secondary" className="gap-1 text-xs font-medium">
                          <User className="h-3 w-3" />
                          {guideName}
                        </Badge>
                      ) : null}
                    </div>
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
                <div className="mb-4 flex flex-wrap gap-3">
                  {report.end_mileage && (
                    <div className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2">
                      <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="text-sm">{getText('마일리지', 'Mileage')}: {report.end_mileage.toLocaleString()}</span>
                    </div>
                  )}
                  {report.cash_balance !== null && (
                    <div className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2">
                      <DollarSign className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="text-sm">{getText('잔액', 'Balance')}: ${report.cash_balance.toFixed(2)}</span>
                    </div>
                  )}
                  {report.customer_count != null && (
                    <div className="flex min-w-[240px] flex-[1.6] items-center gap-2 rounded-md bg-gray-50 px-3 py-2 sm:min-w-[280px]">
                      <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="text-sm whitespace-nowrap">
                        {getText('탑승', 'On board')}: {report.customer_count}
                        {getText('명', '')}
                        {report.booked_customer_count != null
                          ? getText(
                              ` / 예약 ${report.booked_customer_count}명`,
                              ` / booked ${report.booked_customer_count}`
                            )
                          : ''}
                      </span>
                    </div>
                  )}
                  {weather && (
                    <div className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2">
                      <Cloud className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="text-sm">
                        {weather.icon} {weather.label}
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
                        {getText('차량 상태:', 'Vehicle condition:')}
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
                  {mood && (
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-gray-500" />
                      <span className="text-sm">
                        {getText('분위기', 'Mood')}: {mood.icon} {mood.label}
                      </span>
                    </div>
                  )}
                  {communication && (
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-gray-500" />
                      <span className="text-sm">
                        {getText('커뮤니케이션', 'Communication')}: {communication.icon} {communication.label}
                      </span>
                    </div>
                  )}
                  {teamwork && (
                    <div className="flex items-center gap-2">
                      <Handshake className="w-4 h-4 text-gray-500" />
                      <span className="text-sm">
                        {getText('팀워크', 'Teamwork')}: {teamwork.icon} {teamwork.label}
                      </span>
                    </div>
                  )}
                </div>

                {visibleStops.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">{getText('주요 정류장:', 'Main stops:')}</p>
                    <div className="flex flex-wrap gap-1">
                      {visibleStops.map(({ stop, label }) => {
                        const activity = details.horseshoeBend?.[stop]
                        return (
                          <Badge key={stop} variant="secondary" className="text-xs">
                            {label}
                            {activity ? ` · ${displayHorseshoeBendActivity(activity, locale)}` : ''}
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                )}

                {details.sunrise ? (
                  <div className="mb-4 rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-amber-950">
                      <Sunrise className="h-4 w-4" />
                      {getText('일출', 'Sunrise')}
                    </p>
                    <p className="mt-1 text-sm text-amber-900">
                      {displaySunrisePoint(details.sunrise.pointKey, locale)}
                      {' · '}
                      {displaySunriseActivity(details.sunrise.activity, locale)}
                    </p>
                  </div>
                ) : null}

                {drivingIds.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="inline-flex items-center gap-1.5">
                        <Car className="h-4 w-4 text-gray-500" />
                        {getText('Driving:', 'Driving:')}
                      </span>
                      {approxDrivingMinutes > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-normal text-gray-500">
                          <Clock className="h-3.5 w-3.5" />
                          {formatApproxDrivingDuration(approxDrivingMinutes, locale)}
                        </span>
                      ) : null}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {drivingIds.map((segId) => {
                        const seg = drivingById.get(segId)
                        const label = seg ? displayDrivingSegmentLabel(seg, locale) : ''
                        if (!label || isOpaqueRecordId(label)) return null
                        const claim = (details.drivingRoster?.claims ?? []).find((item) => item.segmentId === segId)
                        return (
                          <Badge key={segId} variant="outline" className="text-xs">
                            {label}
                            {claim
                              ? getText(
                                  ` · ${claim.fromName} 제출 클레임`,
                                  ` · claimed from ${claim.fromName}`
                                )
                              : ''}
                          </Badge>
                        )
                      })}
                    </div>
                    {claimedFromMe.length > 0 ? (
                      <p className="mt-2 text-xs text-amber-800">
                        {getText(
                          `파트너 클레임: ${claimedFromMe
                              .map((claim) => {
                                const seg = drivingById.get(claim.segmentId)
                                return seg ? displayDrivingSegmentLabel(seg, locale) : claim.segmentId
                              })
                              .join(', ')}`,
                          `Claimed by partner: ${claimedFromMe
                              .map((claim) => {
                                const seg = drivingById.get(claim.segmentId)
                                return seg ? displayDrivingSegmentLabel(seg, locale) : claim.segmentId
                              })
                              .join(', ')}`
                        )}
                      </p>
                    ) : null}
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
                        {getText('스킵한 포인트:', 'Skipped stops:')}
                      </p>
                      <ul className="space-y-1 text-sm text-gray-700">
                        {skippedIds.map((cid) => {
                          const entry = skipped[cid]
                          const point = displayMainStopLabel(cid, stopCourseById, locale)
                          if (!point) return null
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
                        {getText('대체 방문·메모:', 'Alternative stops / notes:')}
                      </p>
                      <ul className="space-y-1 text-sm text-gray-700">
                        {Object.entries(report.main_stop_substitutions).map(([cid, note]) => {
                          if (!note?.trim()) return null
                          const point = displayMainStopLabel(cid, stopCourseById, locale)
                          if (!point) return null
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
                    <p className="text-sm font-medium mb-2 text-red-600">{getText('문제사항:', 'Incidents:')}</p>
                    <div className="flex flex-wrap gap-1">
                      {report.incidents_delays_health.map((incident) => (
                        <Badge key={incident} variant="destructive" className="text-xs">
                          {displayIncidentLabel(incident, locale)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* 분실물/손상 */}
                {report.lost_items_damage.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2 text-orange-600">{getText('분실물/손상:', 'Lost Items/Damage:')}</p>
                    <div className="flex flex-wrap gap-1">
                      {report.lost_items_damage.map((item) => {
                        const displayText = displayLostDamageLabel(item, locale)
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
                        {getText('이슈 사진:', 'Issue photos:')}
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
                              alt={getText('이슈 사진', 'Issue photo')}
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
                      <p className="text-sm font-medium text-primary mb-1">{getText('고객 코멘트:', 'Guest comments:')}</p>
                      <p className="text-sm text-gray-700 bg-primary/5 p-2 rounded">{report.guest_comments}</p>
                    </div>
                  )}
                  {report.suggestions_followup && (
                    <div>
                      <p className="text-sm font-medium text-green-600 mb-1">{getText('제안사항:', 'Suggestions:')}</p>
                      <p className="text-sm text-gray-700 bg-green-50 p-2 rounded">{report.suggestions_followup}</p>
                    </div>
                  )}
                  {report.comments && (
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">{getText('기타 코멘트:', 'Other comments:')}</p>
                      <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{report.comments}</p>
                    </div>
                  )}
                  {report.handoff_note?.trim() && (
                    <div>
                      <p className="text-sm font-medium text-amber-800 mb-1 flex items-center gap-1.5">
                        <NotebookPen className="h-4 w-4" />
                        {getText('다음 팀 인수인계:', 'Handoff for next team:')}
                      </p>
                      <p className="text-sm text-gray-800 bg-amber-50 p-2 rounded border border-amber-200/80">
                        {report.handoff_note}
                      </p>
                    </div>
                  )}
                  {report.office_note && (
                    <div>
                      <p className="text-sm font-medium text-purple-600 mb-1">{getText('사무실 메모:', 'Office note:')}</p>
                      <p className="text-sm text-gray-700 bg-purple-50 p-2 rounded">{report.office_note}</p>
                    </div>
                  )}
                  {report.sign?.trim() ? (
                    <div>
                      <p className="text-sm font-medium mb-1 flex items-center gap-1.5">
                        <PenLine className="h-4 w-4 text-gray-500" />
                        {getText('서명:', 'Signature:')}
                      </p>
                      {isTourReportSignatureImage(report.sign) ? (
                        <div className="overflow-hidden rounded-xl border border-border bg-white">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={report.sign}
                            alt={getText('가이드 서명', 'Guide signature')}
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
            )
          })
        )}
      </div>
    </div>
  )
}
