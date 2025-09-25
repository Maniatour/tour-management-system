'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import TourReportForm from './TourReportForm'
import TourReportList from './TourReportList'
import { FileText, Plus, Eye, Edit, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

interface TourReportSectionProps {
  tourId: string
  tourName?: string
  tourDate?: string
  canCreateReport?: boolean
  canEditReport?: boolean
  canDeleteReport?: boolean
  showHeader?: boolean
}

export default function TourReportSection({
  tourId,
  tourName,
  tourDate,
  canCreateReport = true,
  canEditReport = true,
  canDeleteReport = true,
  showHeader = true
}: TourReportSectionProps) {
  const [showForm, setShowForm] = useState(false)
  const [showList, setShowList] = useState(false)
  const [hasReports, setHasReports] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkForReports()
  }, [tourId])

  const checkForReports = async () => {
    try {
      const { data, error } = await supabase
        .from('tour_reports')
        .select('id')
        .eq('tour_id', tourId)
        .limit(1)

      if (error) throw error
      setHasReports(data && data.length > 0)
    } catch (error) {
      console.error('Error checking for reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateReport = () => {
    setShowForm(true)
    setShowList(false)
  }

  const handleViewReports = () => {
    setShowList(true)
    setShowForm(false)
  }

  const handleFormSuccess = () => {
    setShowForm(false)
    setShowList(true)
    setHasReports(true)
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

  if (showForm) {
    return (
      <div className="space-y-4">
        {showHeader && (
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">투어 리포트 작성</h3>
              {tourName && tourDate && (
                <p className="text-sm text-gray-600">
                  {tourName} - {new Date(tourDate).toLocaleDateString('ko-KR')}
                </p>
              )}
            </div>
            <Button onClick={handleFormCancel} variant="outline" size="sm">
              목록으로 돌아가기
            </Button>
          </div>
        )}
        <TourReportForm
          tourId={tourId}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      </div>
    )
  }

  if (showList) {
    return (
      <div className="space-y-4">
        {showHeader && (
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">투어 리포트 목록</h3>
              {tourName && tourDate && (
                <p className="text-sm text-gray-600">
                  {tourName} - {new Date(tourDate).toLocaleDateString('ko-KR')}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {canCreateReport && (
                <Button onClick={handleCreateReport} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  새 리포트
                </Button>
              )}
              <Button onClick={() => setShowList(false)} variant="outline" size="sm">
                닫기
              </Button>
            </div>
          </div>
        )}
        <TourReportList
          tourId={tourId}
          showTourInfo={false}
          onEdit={canEditReport ? handleEditReport : undefined}
          onDelete={canDeleteReport ? handleDeleteReport : undefined}
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-500">로딩 중...</p>
      </div>
    )
  }

  if (hasReports) {
    return (
      <div className="text-center py-6">
        <FileText className="w-10 h-10 text-green-500 mx-auto mb-3" />
        <p className="text-gray-700 text-base mb-1">작성된 리포트가 있습니다</p>
        <p className="text-gray-500 text-sm">
          위의 "목록" 버튼을 클릭하여 리포트를 확인하세요
        </p>
      </div>
    )
  }

  return (
    <div className="text-center py-8">
      <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
      <p className="text-gray-500 text-lg mb-2">아직 작성된 리포트가 없습니다</p>
      <p className="text-gray-400 text-sm">
        투어 종료 후 가이드와 드라이버가 리포트를 작성할 수 있습니다
      </p>
    </div>
  )
}
