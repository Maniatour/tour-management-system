import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import TourReportForm from './TourReportForm'
import TourReportList from './TourReportList'
import { FileText, Plus, Eye, Edit, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'

interface TourReportSectionProps {
  tourId: string
  productId?: string | null
  tourName?: string
  tourDate?: string
  canCreateReport?: boolean
  canEditReport?: boolean
  canDeleteReport?: boolean
  showHeader?: boolean
}

export default function TourReportSection({
  tourId,
  productId,
  tourName,
  tourDate,
  canCreateReport = true,
  canEditReport = true,
  canDeleteReport = true,
  showHeader = true
}: TourReportSectionProps) {
  const t = useTranslations('tours.tourReport')
  const locale = useLocale()
  const { user, simulatedUser, isSimulating } = useAuth()
  const currentUserEmail = isSimulating && simulatedUser ? simulatedUser.email : user?.email
  const [showForm, setShowForm] = useState(false)
  const [showList, setShowList] = useState(false)
  const [hasReports, setHasReports] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingReport, setEditingReport] = useState<any | null>(null)

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
      const has = !!(data && data.length > 0)
      setHasReports(has)
      if (has) {
        // 작성된 리포트가 있으면 목록을 바로 표시
        setShowList(true)
        setShowForm(false)
      }
    } catch (error) {
      console.error('Error checking for reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateReport = () => {
    setEditingReport(null)
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
    toast.success(t('reportSubmitted'))
  }

  const handleFormCancel = () => {
    setEditingReport(null)
    setShowForm(false)
  }

  const handleEditReport = (report: any) => {
    if (!currentUserEmail || report?.user_email !== currentUserEmail) {
      toast.error('본인이 작성한 리포트만 수정할 수 있습니다.')
      return
    }
    if (!tourDate) {
      toast.error('투어 날짜 정보를 찾을 수 없어 수정할 수 없습니다.')
      return
    }
    const endOfNextDay = new Date(tourDate)
    endOfNextDay.setDate(endOfNextDay.getDate() + 2)
    endOfNextDay.setHours(0, 0, 0, 0)
    if (new Date() >= endOfNextDay) {
      toast.error('리포트 수정은 투어 다음날까지만 가능합니다.')
      return
    }

    setEditingReport(report)
    setShowForm(true)
    setShowList(false)
  }

  const handleDeleteReport = (reportId: string) => {
    toast.success(t('reportDeleted'))
  }

  if (showForm) {
    return (
      <div className="space-y-4">
        {showHeader && (
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{t('writeReport')}</h3>
              {tourName && tourDate && (
                <p className="text-sm text-gray-600">
                  {tourName} - {new Date(tourDate).toLocaleDateString('ko-KR')}
                </p>
              )}
            </div>
            <Button onClick={handleFormCancel} variant="outline" size="sm">
              {t('backToList')}
            </Button>
          </div>
        )}
        <TourReportForm
          tourId={tourId}
          productId={productId ?? undefined}
          reportId={editingReport?.id ?? undefined}
          initialData={editingReport ?? undefined}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
          locale={locale}
        />
      </div>
    )
  }

  if (showList) {
    return (
      <div className="space-y-4">
        <TourReportList
          tourId={tourId}
          showTourInfo={false}
          onEdit={canEditReport ? handleEditReport : undefined}
          onDelete={canDeleteReport ? handleDeleteReport : undefined}
          locale={locale}
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  if (hasReports) {
    return (
      <div className="text-center py-6 space-y-3">
        <FileText className="w-10 h-10 text-green-500 mx-auto mb-3" />
        <p className="text-gray-700 text-base mb-1">{t('hasReports')}</p>
        <p className="text-gray-500 text-sm">
          {t('clickListButton')}
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={handleViewReports} size="sm" className="px-3">
            <Eye className="w-4 h-4 mr-1" />
            {t('reportList')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="text-center py-8">
      <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
      <p className="text-gray-500 text-lg mb-2">{t('noReports')}</p>
      <p className="text-gray-400 text-sm">
        {t('reportAfterTour')}
      </p>
    </div>
  )
}
