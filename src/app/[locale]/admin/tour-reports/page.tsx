'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase'
import TourReportList from '@/components/TourReportList'
import TourReportForm from '@/components/TourReportForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  FileText, 
  Plus, 
  Calendar, 
  MapPin, 
  Users,
  Search
} from 'lucide-react'
import { toast } from 'sonner'
import { useLocale } from 'next-intl'

interface Tour {
  id: string
  tour_date: string
  tour_status: string | null
  products?: {
    name_ko: string
    name_en: string
  }
}

interface AdminTourReportsProps {
  params: Promise<{ locale: string }>
}

export default function AdminTourReports({ params }: AdminTourReportsProps) {
  const { user } = useAuth()
  const locale = useLocale()
  const [tours, setTours] = useState<Tour[]>([])
  const [selectedTourId, setSelectedTourId] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTours()
  }, [])

  const fetchTours = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('tours')
        .select(`
          id,
          tour_date,
          tour_status,
          products (
            name_ko,
            name_en
          )
        `)
        .order('tour_date', { ascending: false })
        .limit(100)

      if (error) throw error
      setTours(data || [])
    } catch (error) {
      console.error('Error fetching tours:', error)
      toast.error('투어 목록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateReport = () => {
    if (!selectedTourId) {
      toast.error('투어를 선택해주세요.')
      return
    }
    setShowForm(true)
  }

  const handleFormSuccess = () => {
    setShowForm(false)
    setSelectedTourId('')
    toast.success('리포트가 성공적으로 제출되었습니다.')
  }

  const handleFormCancel = () => {
    setShowForm(false)
  }

  const handleEditReport = (report: any) => {
    // TODO: Implement edit functionality
    toast.info('편집 기능은 곧 추가될 예정입니다.')
  }

  const handleDeleteReport = (reportId: string) => {
    toast.success('리포트가 삭제되었습니다.')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>투어 목록을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (showForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">투어 리포트 작성</h1>
          <Button onClick={handleFormCancel} variant="outline">
            목록으로 돌아가기
          </Button>
        </div>
        <TourReportForm
          tourId={selectedTourId}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
          locale={locale}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-6 h-6" />
          투어 리포트 관리
        </h1>
      </div>

      {/* 투어 선택 및 리포트 작성 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            새 리포트 작성
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">투어 선택</label>
              <Select value={selectedTourId} onValueChange={setSelectedTourId}>
                <SelectTrigger>
                  <SelectValue placeholder="리포트를 작성할 투어를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {tours.map((tour) => (
                    <SelectItem key={tour.id} value={tour.id}>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {tour.products?.name_ko} ({tour.products?.name_en})
                        </span>
                        <span className="text-gray-500">
                          - {tour.tour_date}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleCreateReport}
              disabled={!selectedTourId}
            >
              리포트 작성
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 리포트 목록 */}
      <TourReportList
        onEdit={handleEditReport}
        onDelete={handleDeleteReport}
        locale={locale}
      />
    </div>
  )
}
