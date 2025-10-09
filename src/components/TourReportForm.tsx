'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Calendar, MapPin, Users, DollarSign, Cloud, Star, MessageSquare, AlertTriangle, Package, Lightbulb, MessageCircle, Handshake, FileText } from 'lucide-react'
import { toast } from 'sonner'

interface TourReportFormProps {
  tourId: string
  onSuccess?: () => void
  onCancel?: () => void
  locale?: string
}

interface TourReportData {
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

export default function TourReportForm({ tourId, onSuccess, onCancel, locale = 'ko' }: TourReportFormProps) {
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
      cancel: getText('취소', 'Cancel')
    },
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
  const [formData, setFormData] = useState<TourReportData>({
    end_mileage: null,
    cash_balance: null,
    customer_count: null,
    weather: null,
    main_stops_visited: [],
    activities_completed: [],
    overall_mood: null,
    guest_comments: '',
    incidents_delays_health: [],
    lost_items_damage: [],
    suggestions_followup: '',
    communication: null,
    teamwork: null,
    comments: '',
    sign: '',
    office_note: ''
  })

  const handleInputChange = (field: keyof TourReportData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleArrayChange = (field: keyof TourReportData, value: string, checked: boolean) => {
    setFormData(prev => {
      const currentArray = prev[field] as string[]
      if (checked) {
        return {
          ...prev,
          [field]: [...currentArray, value]
        }
      } else {
        return {
          ...prev,
          [field]: currentArray.filter(item => item !== value)
        }
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.email) {
      toast.error(t.messages.loginRequired)
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('tour_reports')
        .insert({
          tour_id: tourId,
          user_email: user.email,
          ...formData
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

  return (
    <div className="max-w-4xl mx-auto p-2 md:p-4 space-y-4 md:space-y-6">
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            <FileText className="w-5 h-5" />
            {t.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
            {/* 기본 정보 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="end_mileage" className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {t.fields.endMileage}
                </Label>
                <Input
                  id="end_mileage"
                  type="number"
                  value={formData.end_mileage || ''}
                  onChange={(e) => handleInputChange('end_mileage', parseInt(e.target.value) || null)}
                  placeholder={t.placeholders.endMileage}
                />
              </div>
              <div>
                <Label htmlFor="cash_balance" className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  {t.fields.cashBalance}
                </Label>
                <Input
                  id="cash_balance"
                  type="number"
                  step="0.01"
                  value={formData.cash_balance || ''}
                  onChange={(e) => handleInputChange('cash_balance', parseFloat(e.target.value) || null)}
                  placeholder={t.placeholders.cashBalance}
                />
              </div>
              <div>
                <Label htmlFor="customer_count" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {t.fields.customerCount}
                </Label>
                <Input
                  id="customer_count"
                  type="number"
                  value={formData.customer_count || ''}
                  onChange={(e) => handleInputChange('customer_count', parseInt(e.target.value) || null)}
                  placeholder={t.placeholders.customerCount}
                />
              </div>
            </div>

            {/* 날씨 */}
            <div>
              <Label className="flex items-center gap-2 mb-3">
                <Cloud className="w-4 h-4" />
                {t.fields.weather}
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                {WEATHER_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={formData.weather === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleInputChange('weather', option.value)}
                    className="flex items-center gap-1 text-xs md:text-sm"
                  >
                    <span className="text-base">{option.icon}</span>
                    <span className="truncate">{locale === 'en' ? option.en : option.ko}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* 주요 정류장 방문 */}
            <div>
              <Label className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4" />
                {t.fields.mainStopsVisited}
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {MAIN_STOPS_OPTIONS.map((stop) => {
                  const displayText = locale === 'en' ? stop.en : stop.ko
                  const keyText = locale === 'en' ? stop.en : stop.ko
                  return (
                    <Button
                      key={keyText}
                      type="button"
                      variant={formData.main_stops_visited.includes(keyText) ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleArrayChange('main_stops_visited', keyText, !formData.main_stops_visited.includes(keyText))}
                      className="flex items-center gap-2 text-xs md:text-sm justify-start"
                    >
                      <span className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        formData.main_stops_visited.includes(keyText) 
                          ? 'bg-blue-600 border-blue-600' 
                          : 'border-gray-300'
                      }`}>
                        {formData.main_stops_visited.includes(keyText) && (
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
              {formData.main_stops_visited.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {formData.main_stops_visited.map((stop) => {
                    // 선택된 값이 한국어인지 영어인지 확인하고 적절한 표시 텍스트 찾기
                    const option = MAIN_STOPS_OPTIONS.find(opt => opt.ko === stop || opt.en === stop)
                    const displayText = option ? (locale === 'en' ? option.en : option.ko) : stop
                    return (
                      <Badge key={stop} variant="secondary">
                        {displayText}
                      </Badge>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 완료된 활동 */}
            <div>
              <Label className="flex items-center gap-2 mb-3">
                <Package className="w-4 h-4" />
                {t.fields.activitiesCompleted}
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {ACTIVITIES_OPTIONS.map((activity) => {
                  const displayText = locale === 'en' ? activity.en : activity.ko
                  const keyText = locale === 'en' ? activity.en : activity.ko
                  return (
                    <Button
                      key={keyText}
                      type="button"
                      variant={formData.activities_completed.includes(keyText) ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleArrayChange('activities_completed', keyText, !formData.activities_completed.includes(keyText))}
                      className="flex items-center gap-2 text-xs md:text-sm justify-start"
                    >
                      <span className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        formData.activities_completed.includes(keyText) 
                          ? 'bg-blue-600 border-blue-600' 
                          : 'border-gray-300'
                      }`}>
                        {formData.activities_completed.includes(keyText) && (
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
              {formData.activities_completed.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {formData.activities_completed.map((activity) => {
                    // 선택된 값이 한국어인지 영어인지 확인하고 적절한 표시 텍스트 찾기
                    const option = ACTIVITIES_OPTIONS.find(opt => opt.ko === activity || opt.en === activity)
                    const displayText = option ? (locale === 'en' ? option.en : option.ko) : activity
                    return (
                      <Badge key={activity} variant="secondary">
                        {displayText}
                      </Badge>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 전체적인 분위기 */}
            <div>
              <Label className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4" />
                {t.fields.overallMood}
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {MOOD_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={formData.overall_mood === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleInputChange('overall_mood', option.value)}
                    className="flex items-center gap-1 text-xs md:text-sm"
                  >
                    <span className="text-base">{option.icon}</span>
                    <span className="truncate">{locale === 'en' ? option.en : option.ko}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* 고객 코멘트 */}
            <div>
              <Label htmlFor="guest_comments" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                {t.fields.guestComments}
              </Label>
              <Textarea
                id="guest_comments"
                value={formData.guest_comments || ''}
                onChange={(e) => handleInputChange('guest_comments', e.target.value)}
                placeholder={t.placeholders.guestComments}
                rows={3}
              />
            </div>

            {/* 사고/지연/건강 문제 */}
            <div>
              <Label className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4" />
                {t.fields.incidentsDelaysHealth}
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
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
                      className="flex items-center gap-2 text-xs md:text-sm justify-start"
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
                <div className="mt-2 flex flex-wrap gap-1">
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
            <div>
              <Label className="flex items-center gap-2 mb-3">
                <Package className="w-4 h-4" />
                {t.fields.lostItemsDamage}
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
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
                      className="flex items-center gap-2 text-xs md:text-sm justify-start"
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
                <div className="mt-2 flex flex-wrap gap-1">
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

            {/* 제안사항 또는 후속 조치 */}
            <div>
              <Label htmlFor="suggestions_followup" className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4" />
                {t.fields.suggestionsFollowup}
              </Label>
              <Textarea
                id="suggestions_followup"
                value={formData.suggestions_followup || ''}
                onChange={(e) => handleInputChange('suggestions_followup', e.target.value)}
                placeholder={t.placeholders.suggestionsFollowup}
                rows={3}
              />
            </div>

            {/* 커뮤니케이션 */}
            <div>
              <Label className="flex items-center gap-2 mb-3">
                <MessageCircle className="w-4 h-4" />
                {t.fields.communication}
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {RATING_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={formData.communication === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleInputChange('communication', option.value)}
                    className="flex items-center gap-1 text-xs md:text-sm"
                  >
                    <span className="text-base">{option.icon}</span>
                    <span className="truncate">{locale === 'en' ? option.en : option.ko}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* 팀워크 */}
            <div>
              <Label className="flex items-center gap-2 mb-3">
                <Handshake className="w-4 h-4" />
                {t.fields.teamwork}
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {RATING_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={formData.teamwork === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleInputChange('teamwork', option.value)}
                    className="flex items-center gap-1 text-xs md:text-sm"
                  >
                    <span className="text-base">{option.icon}</span>
                    <span className="truncate">{locale === 'en' ? option.en : option.ko}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* 기타 코멘트 */}
            <div>
              <Label htmlFor="comments" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                {t.fields.comments}
              </Label>
              <Textarea
                id="comments"
                value={formData.comments || ''}
                onChange={(e) => handleInputChange('comments', e.target.value)}
                placeholder={t.placeholders.comments}
                rows={3}
              />
            </div>

            {/* 서명 */}
            <div>
              <Label htmlFor="sign" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {t.fields.sign}
              </Label>
              <Input
                id="sign"
                value={formData.sign || ''}
                onChange={(e) => handleInputChange('sign', e.target.value)}
                placeholder={t.placeholders.sign}
              />
            </div>

            {/* 사무실 메모 */}
            <div>
              <Label htmlFor="office_note" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {t.fields.officeNote}
              </Label>
              <Textarea
                id="office_note"
                value={formData.office_note || ''}
                onChange={(e) => handleInputChange('office_note', e.target.value)}
                placeholder={t.placeholders.officeNote}
                rows={2}
              />
            </div>

            {/* 제출 버튼 */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 h-12 text-base font-medium"
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
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
