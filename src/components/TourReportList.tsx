import React, { useState, useEffect } from 'react'
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
  Calendar, 
  MapPin, 
  Users, 
  DollarSign, 
  Cloud, 
  Star, 
  MessageSquare, 
  AlertTriangle, 
  Package, 
  Lightbulb, 
  MessageCircle, 
  Handshake,
  Eye,
  Edit,
  Trash2
} from 'lucide-react'
import { toast } from 'sonner'

// 옵션 상수들을 TourReportForm에서 가져옴
const MAIN_STOPS_OPTIONS = [
  { ko: '그랜드 캐니언', en: 'Grand Canyon' },
  { ko: '앤텔로프 캐니언', en: 'Antelope Canyon' },
  { ko: '브라이스 캐니언', en: 'Bryce Canyon' },
  { ko: '자이온 국립공원', en: 'Zion National Park' },
  { ko: '모뉴먼트 밸리', en: 'Monument Valley' },
  { ko: '아치스 국립공원', en: 'Arches National Park' },
  { ko: '캐피톨 리프', en: 'Capitol Reef' },
  { ko: '코랄 핑크 샌듄스', en: 'Coral Pink Sand Dunes' },
  { ko: '호스슈 벤드', en: 'Horseshoe Bend' },
  { ko: '글렌 캐니언', en: 'Glen Canyon' },
  { ko: '페이지', en: 'Page' },
  { ko: '라스베가스', en: 'Las Vegas' },
  { ko: '로스앤젤레스', en: 'Los Angeles' }
]

const ACTIVITIES_OPTIONS = [
  { ko: '하이킹', en: 'Hiking' },
  { ko: '사진 촬영', en: 'Photography' },
  { ko: '관광', en: 'Sightseeing' },
  { ko: '식사', en: 'Dining' },
  { ko: '쇼핑', en: 'Shopping' },
  { ko: '선셋 관람', en: 'Sunset Viewing' },
  { ko: '선라이즈 관람', en: 'Sunrise Viewing' },
  { ko: '헬리콥터 투어', en: 'Helicopter Tour' },
  { ko: '보트 투어', en: 'Boat Tour' },
  { ko: '버스 투어', en: 'Bus Tour' },
  { ko: '걷기 투어', en: 'Walking Tour' },
  { ko: '자전거 투어', en: 'Bike Tour' },
  { ko: '캠핑', en: 'Camping' },
  { ko: '피크닉', en: 'Picnic' }
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

interface TourReport {
  id: string
  tour_id: string
  end_mileage: number | null
  cash_balance: number | null
  customer_count: number | null
  weather: string | null
  main_stops_visited: string[]
  activities_completed: string[]
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
  locale = 'ko'
}: TourReportListProps) {
  const { user } = useAuth()
  const [reports, setReports] = useState<TourReport[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [weatherFilter, setWeatherFilter] = useState<string>('all')
  const [moodFilter, setMoodFilter] = useState<string>('all')

  useEffect(() => {
    fetchReports()
  }, [tourId, user])

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
      setReports(data || [])
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
      toast.error('리포트 삭제 중 오류가 발생했습니다.')
    }
  }

  const filteredReports = reports.filter(report => {
    const matchesSearch = searchTerm === '' || 
      report.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.tours?.products?.name_ko?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.tours?.products?.name_en?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesWeather = weatherFilter === 'all' || report.weather === weatherFilter
    const matchesMood = moodFilter === 'all' || report.overall_mood === moodFilter

    return matchesSearch && matchesWeather && matchesMood
  })

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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>리포트를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 필터 및 검색 */}
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
                <Input
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
            <Card key={report.id} className="hover:shadow-md transition-shadow">
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
                  {report.customer_count && (
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-md">
                      <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="text-sm">고객: {report.customer_count}명</span>
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
                      {report.main_stops_visited.map((stop) => (
                        <Badge key={stop} variant="secondary" className="text-xs">
                          {stop}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* 완료된 활동 */}
                {report.activities_completed.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">완료된 활동:</p>
                    <div className="flex flex-wrap gap-1">
                      {report.activities_completed.map((activity) => (
                        <Badge key={activity} variant="outline" className="text-xs">
                          {activity}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

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

                {/* 코멘트들 */}
                <div className="space-y-2">
                  {report.guest_comments && (
                    <div>
                      <p className="text-sm font-medium text-blue-600 mb-1">고객 코멘트:</p>
                      <p className="text-sm text-gray-700 bg-blue-50 p-2 rounded">{report.guest_comments}</p>
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
                  {report.office_note && (
                    <div>
                      <p className="text-sm font-medium text-purple-600 mb-1">사무실 메모:</p>
                      <p className="text-sm text-gray-700 bg-purple-50 p-2 rounded">{report.office_note}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
