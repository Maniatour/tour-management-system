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
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Calendar, MapPin, Users, DollarSign, Cloud, Star, MessageSquare, AlertTriangle, Package, Lightbulb, MessageCircle, Handshake, FileText } from 'lucide-react'
import { toast } from 'sonner'

interface TourReportFormProps {
  tourId: string
  onSuccess?: () => void
  onCancel?: () => void
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
  { value: 'sunny', label: '맑음', icon: '☀️' },
  { value: 'cloudy', label: '흐림', icon: '☁️' },
  { value: 'rainy', label: '비', icon: '🌧️' },
  { value: 'snowy', label: '눈', icon: '❄️' },
  { value: 'windy', label: '바람', icon: '💨' },
  { value: 'foggy', label: '안개', icon: '🌫️' }
]

const MOOD_OPTIONS = [
  { value: 'excellent', label: '매우 좋음', icon: '😊' },
  { value: 'good', label: '좋음', icon: '🙂' },
  { value: 'average', label: '보통', icon: '😐' },
  { value: 'poor', label: '나쁨', icon: '😞' },
  { value: 'terrible', label: '매우 나쁨', icon: '😢' }
]

const RATING_OPTIONS = [
  { value: 'excellent', label: '매우 좋음', icon: '⭐⭐⭐' },
  { value: 'good', label: '좋음', icon: '⭐⭐' },
  { value: 'average', label: '보통', icon: '⭐' },
  { value: 'poor', label: '나쁨', icon: '👎' }
]

const MAIN_STOPS_OPTIONS = [
  '그랜드 캐니언', '앤텔로프 캐니언', '브라이스 캐니언', '자이온 국립공원',
  '모뉴먼트 밸리', '아치스 국립공원', '캐피톨 리프', '코랄 핑크 샌듄스',
  '호스슈 벤드', '글렌 캐니언', '페이지', '라스베가스', '로스앤젤레스'
]

const ACTIVITIES_OPTIONS = [
  '하이킹', '사진 촬영', '관광', '식사', '쇼핑', '선셋 관람',
  '선라이즈 관람', '헬리콥터 투어', '보트 투어', '버스 투어',
  '걷기 투어', '자전거 투어', '캠핑', '피크닉'
]

const INCIDENTS_OPTIONS = [
  '교통 지연', '날씨 문제', '차량 고장', '건강 문제', '사고',
  '예약 오류', '가이드 지연', '고객 불만', '기타'
]

const LOST_DAMAGE_OPTIONS = [
  '분실물 없음', '가방 분실', '휴대폰 분실', '카메라 분실',
  '차량 손상', '시설 손상', '기타 손상'
]

export default function TourReportForm({ tourId, onSuccess, onCancel }: TourReportFormProps) {
  const { user } = useAuth()
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
      toast.error('로그인이 필요합니다.')
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

      toast.success('투어 리포트가 성공적으로 제출되었습니다.')
      onSuccess?.()
    } catch (error) {
      console.error('Error submitting tour report:', error)
      toast.error('리포트 제출 중 오류가 발생했습니다.')
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
            투어 리포트 작성
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
            {/* 기본 정보 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="end_mileage" className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  종료 마일리지
                </Label>
                <Input
                  id="end_mileage"
                  type="number"
                  value={formData.end_mileage || ''}
                  onChange={(e) => handleInputChange('end_mileage', parseInt(e.target.value) || null)}
                  placeholder="마일리지 입력"
                />
              </div>
              <div>
                <Label htmlFor="cash_balance" className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  현금 잔액
                </Label>
                <Input
                  id="cash_balance"
                  type="number"
                  step="0.01"
                  value={formData.cash_balance || ''}
                  onChange={(e) => handleInputChange('cash_balance', parseFloat(e.target.value) || null)}
                  placeholder="잔액 입력"
                />
              </div>
              <div>
                <Label htmlFor="customer_count" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  고객 수
                </Label>
                <Input
                  id="customer_count"
                  type="number"
                  value={formData.customer_count || ''}
                  onChange={(e) => handleInputChange('customer_count', parseInt(e.target.value) || null)}
                  placeholder="고객 수 입력"
                />
              </div>
            </div>

            {/* 날씨 */}
            <div>
              <Label className="flex items-center gap-2 mb-3">
                <Cloud className="w-4 h-4" />
                날씨
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
                    <span className="truncate">{option.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* 주요 정류장 방문 */}
            <div>
              <Label className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4" />
                주요 정류장 방문
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {MAIN_STOPS_OPTIONS.map((stop) => (
                  <div key={stop} className="flex items-center space-x-2 p-2 border rounded-md hover:bg-gray-50">
                    <Checkbox
                      id={`stop-${stop}`}
                      checked={formData.main_stops_visited.includes(stop)}
                      onCheckedChange={(checked) => 
                        handleArrayChange('main_stops_visited', stop, checked as boolean)
                      }
                    />
                    <Label htmlFor={`stop-${stop}`} className="text-sm flex-1 cursor-pointer">
                      {stop}
                    </Label>
                  </div>
                ))}
              </div>
              {formData.main_stops_visited.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {formData.main_stops_visited.map((stop) => (
                    <Badge key={stop} variant="secondary">
                      {stop}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* 완료된 활동 */}
            <div>
              <Label className="flex items-center gap-2 mb-3">
                <Package className="w-4 h-4" />
                완료된 활동
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {ACTIVITIES_OPTIONS.map((activity) => (
                  <div key={activity} className="flex items-center space-x-2 p-2 border rounded-md hover:bg-gray-50">
                    <Checkbox
                      id={`activity-${activity}`}
                      checked={formData.activities_completed.includes(activity)}
                      onCheckedChange={(checked) => 
                        handleArrayChange('activities_completed', activity, checked as boolean)
                      }
                    />
                    <Label htmlFor={`activity-${activity}`} className="text-sm flex-1 cursor-pointer">
                      {activity}
                    </Label>
                  </div>
                ))}
              </div>
              {formData.activities_completed.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {formData.activities_completed.map((activity) => (
                    <Badge key={activity} variant="secondary">
                      {activity}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* 전체적인 분위기 */}
            <div>
              <Label className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4" />
                전체적인 분위기
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
                    <span className="truncate">{option.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* 고객 코멘트 */}
            <div>
              <Label htmlFor="guest_comments" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                고객 코멘트
              </Label>
              <Textarea
                id="guest_comments"
                value={formData.guest_comments || ''}
                onChange={(e) => handleInputChange('guest_comments', e.target.value)}
                placeholder="고객들의 의견이나 피드백을 입력하세요..."
                rows={3}
              />
            </div>

            {/* 사고/지연/건강 문제 */}
            <div>
              <Label className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4" />
                사고/지연/건강 문제
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {INCIDENTS_OPTIONS.map((incident) => (
                  <div key={incident} className="flex items-center space-x-2 p-2 border rounded-md hover:bg-gray-50">
                    <Checkbox
                      id={`incident-${incident}`}
                      checked={formData.incidents_delays_health.includes(incident)}
                      onCheckedChange={(checked) => 
                        handleArrayChange('incidents_delays_health', incident, checked as boolean)
                      }
                    />
                    <Label htmlFor={`incident-${incident}`} className="text-sm flex-1 cursor-pointer">
                      {incident}
                    </Label>
                  </div>
                ))}
              </div>
              {formData.incidents_delays_health.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {formData.incidents_delays_health.map((incident) => (
                    <Badge key={incident} variant="destructive">
                      {incident}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* 분실물/손상 */}
            <div>
              <Label className="flex items-center gap-2 mb-3">
                <Package className="w-4 h-4" />
                분실물/손상
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {LOST_DAMAGE_OPTIONS.map((item) => (
                  <div key={item} className="flex items-center space-x-2 p-2 border rounded-md hover:bg-gray-50">
                    <Checkbox
                      id={`lost-${item}`}
                      checked={formData.lost_items_damage.includes(item)}
                      onCheckedChange={(checked) => 
                        handleArrayChange('lost_items_damage', item, checked as boolean)
                      }
                    />
                    <Label htmlFor={`lost-${item}`} className="text-sm flex-1 cursor-pointer">
                      {item}
                    </Label>
                  </div>
                ))}
              </div>
              {formData.lost_items_damage.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {formData.lost_items_damage.map((item) => (
                    <Badge key={item} variant="outline">
                      {item}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* 제안사항 또는 후속 조치 */}
            <div>
              <Label htmlFor="suggestions_followup" className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4" />
                제안사항 또는 후속 조치
              </Label>
              <Textarea
                id="suggestions_followup"
                value={formData.suggestions_followup || ''}
                onChange={(e) => handleInputChange('suggestions_followup', e.target.value)}
                placeholder="개선사항이나 후속 조치가 필요한 내용을 입력하세요..."
                rows={3}
              />
            </div>

            {/* 커뮤니케이션 */}
            <div>
              <Label className="flex items-center gap-2 mb-3">
                <MessageCircle className="w-4 h-4" />
                커뮤니케이션
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
                    <span className="truncate">{option.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* 팀워크 */}
            <div>
              <Label className="flex items-center gap-2 mb-3">
                <Handshake className="w-4 h-4" />
                팀워크
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
                    <span className="truncate">{option.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* 기타 코멘트 */}
            <div>
              <Label htmlFor="comments" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                기타 코멘트
              </Label>
              <Textarea
                id="comments"
                value={formData.comments || ''}
                onChange={(e) => handleInputChange('comments', e.target.value)}
                placeholder="기타 의견이나 메모를 입력하세요..."
                rows={3}
              />
            </div>

            {/* 서명 */}
            <div>
              <Label htmlFor="sign" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                서명
              </Label>
              <Input
                id="sign"
                value={formData.sign || ''}
                onChange={(e) => handleInputChange('sign', e.target.value)}
                placeholder="서명을 입력하세요"
              />
            </div>

            {/* 사무실 메모 */}
            <div>
              <Label htmlFor="office_note" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                사무실 메모
              </Label>
              <Textarea
                id="office_note"
                value={formData.office_note || ''}
                onChange={(e) => handleInputChange('office_note', e.target.value)}
                placeholder="사무실에서 확인할 메모를 입력하세요..."
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
                {loading ? '제출 중...' : '리포트 제출'}
              </Button>
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  className="flex-1 sm:flex-none h-12 text-base"
                >
                  취소
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
