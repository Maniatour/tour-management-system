import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import TourReportForm from './TourReportForm'
import TourReportList from './TourReportList'
import { FileText, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import { useTourDetailSectionChrome } from '@/components/tour/TourDetailModalChromeContext'

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
  canCreateReport: _canCreateReport = true,
  canEditReport = true,
  canDeleteReport = true,
  showHeader = true
}: TourReportSectionProps) {
  const t = useTranslations('tours.tourReport')
  const locale = useLocale()
  const chrome = useTourDetailSectionChrome()
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

  const handleDeleteReport = (_reportId: string) => {
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
                  productId={productId ?? null}
                  {...(editingReport?.id ? { reportId: editingReport.id } : {})}
                  {...(editingReport ? { initialData: editingReport } : {})}
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
          {...(canEditReport ? { onEdit: handleEditReport } : {})}
          {...(canDeleteReport ? { onDelete: handleDeleteReport } : {})}
          locale={locale}
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className={`text-center ${chrome.emptyStatePadding}`}>
        <div className={`animate-spin rounded-full border-b-2 border-primary mx-auto mb-2 ${chrome.compact ? 'h-6 w-6' : 'h-8 w-8'}`} />
        <p className={chrome.emptyStateTitle}>Loading...</p>
      </div>
    )
  }

  if (hasReports) {
    return (
      <div className={`text-center space-y-2 ${chrome.compact ? 'py-4' : 'py-6'}`}>
        <FileText className={`${chrome.compact ? 'w-8 h-8' : 'w-10 h-10'} text-green-500 mx-auto`} />
        <p className={chrome.compact ? 'text-xs text-gray-700' : 'text-gray-700 text-base'}>{t('hasReports')}</p>
        <p className={chrome.emptyStateSubtext}>
          {t('clickListButton')}
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={handleViewReports} size="sm" className={chrome.compact ? 'h-7 px-2 text-xs' : 'px-3'}>
            <Eye className={`${chrome.compact ? 'w-3 h-3' : 'w-4 h-4'} mr-1`} />
            {t('reportList')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={`text-center ${chrome.emptyStatePadding}`}>
      <FileText className={`${chrome.emptyStateIconClass} text-gray-400 mx-auto ${chrome.compact ? 'mb-2' : 'mb-4'}`} />
      <p className={chrome.emptyStateTitle}>{t('noReports')}</p>
      <p className={chrome.emptyStateSubtext}>
        {t('reportAfterTour')}
      </p>
    </div>
  )
}
